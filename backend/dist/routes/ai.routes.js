"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const auth_1 = require("../middleware/auth");
const task_service_1 = require("../services/task.service");
const router = (0, express_1.Router)();
/**
 * GET /api/ai/leaderboard
 * Returns the top workers ranked by number of valid tasks completed and
 * average accuracy. Used by the Electron dashboard and public explorer.
 */
router.get('/leaderboard', (_req, res) => {
    const results = task_service_1.taskService.getResults();
    // Aggregate per-worker stats
    const workerStats = {};
    for (const r of results) {
        const wallet = (r.worker || '').toLowerCase();
        if (!wallet)
            continue;
        if (!workerStats[wallet]) {
            workerStats[wallet] = {
                wallet,
                tasksCompleted: 0,
                totalAccuracy: 0,
                totalTrainingTime: 0,
                invalidSubmissions: 0,
            };
        }
        const metrics = r.metrics || {};
        const accuracy = typeof metrics.accuracy === 'number' ? metrics.accuracy : 0;
        const trainingTime = typeof metrics.training_time_seconds === 'number'
            ? metrics.training_time_seconds : 0;
        if (r.validSignature !== false) {
            workerStats[wallet].tasksCompleted += 1;
            workerStats[wallet].totalAccuracy += accuracy;
            workerStats[wallet].totalTrainingTime += trainingTime;
        }
        else {
            workerStats[wallet].invalidSubmissions += 1;
        }
    }
    // Build leaderboard array
    const leaderboard = Object.values(workerStats)
        .map(w => {
        const avgAccuracy = w.tasksCompleted > 0
            ? Math.round((w.totalAccuracy / w.tasksCompleted) * 10000) / 10000
            : 0;
        return {
            wallet: w.wallet,
            // Frontend-compatible field names
            tasks: w.tasksCompleted,
            avgAccuracy,
            // Extended fields
            tasksCompleted: w.tasksCompleted,
            averageAccuracy: avgAccuracy,
            totalTrainingTimeSeconds: Math.round(w.totalTrainingTime),
            invalidSubmissions: w.invalidSubmissions,
            // Estimated GWC reward: 1 GWC per valid task + accuracy bonus
            estimatedGwcReward: parseFloat((w.tasksCompleted + w.totalAccuracy * 0.5).toFixed(4)),
        };
    })
        .sort((a, b) => b.tasks - a.tasks);
    res.json({ leaderboard, totalResults: results.length });
});
/**
 * GET /api/ai/best-configs
 * Returns the top-performing neural network configurations discovered so far.
 * Used by the evolution engine and public research dashboard.
 */
router.get('/best-configs', (_req, res) => {
    const results = task_service_1.taskService.getResults();
    const scored = [];
    for (const r of results) {
        if (r.validSignature === false)
            continue;
        const metrics = r.metrics || {};
        const config = r.config || {};
        const accuracy = typeof metrics.accuracy === 'number' ? metrics.accuracy : 0;
        if (accuracy > 0 && Object.keys(config).length > 0) {
            scored.push({
                accuracy,
                config,
                taskId: r.id,
                worker: r.worker,
            });
        }
    }
    scored.sort((a, b) => b.accuracy - a.accuracy);
    const top = scored.slice(0, 20);
    res.json({
        bestConfigs: top,
        totalEvaluated: scored.length,
    });
});
/**
 * GET /api/ai/stats
 * Returns aggregate network statistics for the dashboard.
 */
router.get('/stats', (_req, res) => {
    const results = task_service_1.taskService.getResults();
    const validResults = results.filter(r => r.validSignature !== false);
    const invalidResults = results.filter(r => r.validSignature === false);
    const uniqueWorkers = new Set(results.map(r => r.worker?.toLowerCase()).filter(Boolean));
    let totalAccuracy = 0;
    let bestAccuracy = 0;
    let totalTrainingTime = 0;
    for (const r of validResults) {
        const metrics = r.metrics || {};
        const accuracy = typeof metrics.accuracy === 'number' ? metrics.accuracy : 0;
        const trainingTime = typeof metrics.training_time_seconds === 'number'
            ? metrics.training_time_seconds : 0;
        totalAccuracy += accuracy;
        totalTrainingTime += trainingTime;
        if (accuracy > bestAccuracy)
            bestAccuracy = accuracy;
    }
    res.json({
        totalTasksCompleted: validResults.length,
        totalInvalidSubmissions: invalidResults.length,
        uniqueWorkers: uniqueWorkers.size,
        queueLength: task_service_1.taskService.getQueueLength(),
        averageAccuracy: validResults.length > 0
            ? Math.round((totalAccuracy / validResults.length) * 10000) / 10000
            : 0,
        bestAccuracy: Math.round(bestAccuracy * 10000) / 10000,
        bestAccuracyEver: Math.round(bestAccuracy * 10000) / 10000,
        totalComputeSeconds: Math.round(totalTrainingTime),
        networkStatus: 'active',
    });
});
/**
 * POST /api/ai/verify-result
 * Anti-cheat endpoint: re-computes the expected hash for a submitted result
 * and returns whether it matches. Used by the reward contract oracle.
 */
router.post('/verify-result', (req, res) => {
    const { taskId, config, metrics } = req.body || {};
    if (!taskId || !config || !metrics) {
        return res.status(400).json({ error: 'taskId, config, and metrics are required' });
    }
    const crypto = require('crypto');
    const canonical = JSON.stringify({ task_id: taskId, config, accuracy: metrics.accuracy,
        final_loss: metrics.final_loss, param_count: metrics.param_count }, Object.keys({ task_id: taskId, config, accuracy: metrics.accuracy,
        final_loss: metrics.final_loss, param_count: metrics.param_count }).sort());
    const expectedHash = '0x' + crypto.createHash('sha256').update(canonical).digest('hex');
    const submittedHash = req.body.hash || '';
    const matches = submittedHash.toLowerCase() === expectedHash.toLowerCase();
    res.json({
        verified: matches,
        expectedHash,
        submittedHash,
    });
});
/**
 * POST /api/ai/tasks/fetch
 * Worker compatibility endpoint — maps to the internal task queue.
 * Body: { wallet: string }
 * Returns: { task } or 204 if queue is empty.
 */
router.post('/tasks/fetch', auth_1.requireWorkerKey, (req, res) => {
    const task = task_service_1.taskService.getNextTask();
    if (!task)
        return res.status(204).send();
    res.json({ task });
});
/**
 * POST /api/ai/tasks/submit
 * Worker compatibility endpoint — maps to the results store.
 * Body: { taskId, wallet, metrics, resultHash }
 */
router.post('/tasks/submit', auth_1.requireWorkerKey, (req, res) => {
    const { taskId, wallet, metrics, resultHash } = req.body || {};
    if (!taskId || !wallet || !metrics) {
        return res.status(400).json({ error: 'taskId, wallet, and metrics are required' });
    }
    const task = task_service_1.taskService.getTask(taskId);
    if (!task)
        return res.status(404).json({ error: 'task not found' });
    // Parse config from the stored task payload
    let config = {};
    try {
        config = JSON.parse(task.payload);
    }
    catch (_) { }
    // Verify the simplified hash the GUI worker sends:
    // SHA-256 of "taskId:configJSON:accuracy.4f"
    // Note: JS JSON.parse coerces 0.0 -> 0, but Python json.loads preserves 0.0.
    // We normalize by re-serializing through JSON.parse to match JS behavior.
    let validSignature = false;
    try {
        // Normalize config through JSON round-trip to coerce floats like 0.0 -> 0
        const normalizedConfig = JSON.parse(JSON.stringify(config));
        const payloadStr = JSON.stringify(normalizedConfig, Object.keys(normalizedConfig).sort());
        const expected = (0, crypto_1.createHash)('sha256')
            .update(`${taskId}:${payloadStr}:${metrics.accuracy.toFixed(4)}`)
            .digest('hex');
        validSignature = (resultHash || '').toLowerCase() === expected.toLowerCase();
    }
    catch (_) {
        validSignature = false;
    }
    task_service_1.taskService.addResult({
        id: taskId,
        worker: wallet,
        hash: resultHash || '',
        signature: '',
        receivedAt: Date.now(),
        validSignature,
        metrics: metrics,
        config,
    });
    res.json({ accepted: true, validSignature });
});
exports.default = router;
//# sourceMappingURL=ai.routes.js.map