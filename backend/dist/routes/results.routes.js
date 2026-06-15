"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resultsRouter = void 0;
const express_1 = require("express");
const crypto_1 = require("crypto");
const task_service_1 = require("../services/task.service");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
exports.resultsRouter = (0, express_1.Router)();
/**
 * Deep-sort replacer for JSON.stringify — sorts all object keys recursively.
 * This matches Python's json.dumps(sort_keys=True) behavior exactly.
 */
function deepSortReplacer(_key, value) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return Object.keys(value)
            .sort()
            .reduce((sorted, k) => {
            sorted[k] = value[k];
            return sorted;
        }, {});
    }
    return value;
}
/**
 * Verify the AI result hash submitted by a worker.
 * The hash is a SHA-256 of: { task_id, config, accuracy, final_loss, param_count }
 * with ALL keys sorted recursively (matching Python's json.dumps(sort_keys=True,
 * separators=(',', ':')) behavior).
 */
function verifyAIHash(taskId, config, metrics, submittedHash) {
    try {
        const obj = {
            task_id: taskId,
            config,
            accuracy: metrics.accuracy,
            final_loss: metrics.final_loss,
            param_count: metrics.param_count,
        };
        // Use deepSortReplacer + no spaces to match Python: json.dumps(sort_keys=True, separators=(',', ':'))
        const canonical = JSON.stringify(obj, deepSortReplacer);
        const expected = '0x' + (0, crypto_1.createHash)('sha256').update(canonical).digest('hex');
        return expected.toLowerCase() === submittedHash.toLowerCase();
    }
    catch {
        return false;
    }
}
/**
 * POST /api/results
 * Worker: submit a completed task result.
 *
 * Body (AI worker):   { id, worker, hash, signature, metrics, config }
 * Body (legacy Rust): { id, worker, hash, signature }
 */
exports.resultsRouter.post('/', auth_1.requireWorkerKey, validate_1.validateSubmitResult, (req, res) => {
    const { id, worker, hash, signature, metrics, config } = req.body;
    const task = task_service_1.taskService.getTask(id);
    if (!task)
        return res.status(404).json({ error: 'task not found' });
    let validSignature = false;
    if (metrics && config) {
        // AI worker path: verify SHA-256 hash of metrics
        validSignature = verifyAIHash(id, config, metrics, hash);
    }
    else {
        // Legacy Rust worker path: verify ethers signature of blake3 hash
        try {
            const { getBytes, verifyMessage } = require('ethers');
            const msgBytes = getBytes(hash);
            const recovered = verifyMessage(msgBytes, signature);
            validSignature = recovered.toLowerCase() === String(worker).toLowerCase();
        }
        catch (_e) {
            validSignature = false;
        }
    }
    task_service_1.taskService.addResult({
        id,
        worker,
        hash,
        signature,
        receivedAt: Date.now(),
        validSignature,
        metrics: metrics,
        config: config,
    });
    res.json({ accepted: true, validSignature });
});
/**
 * GET /api/results
 * Admin-only: list all submitted results.
 */
exports.resultsRouter.get('/', auth_1.requireAdminKey, (_req, res) => {
    res.json({ results: task_service_1.taskService.getResults() });
});
//# sourceMappingURL=results.routes.js.map