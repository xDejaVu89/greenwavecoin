import { Router, Request, Response } from 'express';
import { taskService } from '../services/task.service';

const router = Router();

/**
 * GET /api/ai/leaderboard
 * Returns the top workers ranked by number of valid tasks completed and
 * average accuracy. Used by the Electron dashboard and public explorer.
 */
router.get('/leaderboard', (_req: Request, res: Response) => {
  const results = taskService.getResults();

  // Aggregate per-worker stats
  const workerStats: Record<string, {
    wallet: string;
    tasksCompleted: number;
    totalAccuracy: number;
    totalTrainingTime: number;
    invalidSubmissions: number;
  }> = {};

  for (const r of results) {
    const wallet = (r.worker || '').toLowerCase();
    if (!wallet) continue;

    if (!workerStats[wallet]) {
      workerStats[wallet] = {
        wallet,
        tasksCompleted: 0,
        totalAccuracy: 0,
        totalTrainingTime: 0,
        invalidSubmissions: 0,
      };
    }

    const metrics = (r as any).metrics || {};
    const accuracy = typeof metrics.accuracy === 'number' ? metrics.accuracy : 0;
    const trainingTime = typeof metrics.training_time_seconds === 'number'
      ? metrics.training_time_seconds : 0;

    if (r.validSignature !== false) {
      workerStats[wallet].tasksCompleted += 1;
      workerStats[wallet].totalAccuracy += accuracy;
      workerStats[wallet].totalTrainingTime += trainingTime;
    } else {
      workerStats[wallet].invalidSubmissions += 1;
    }
  }

  // Build leaderboard array
  const leaderboard = Object.values(workerStats)
    .map(w => ({
      wallet: w.wallet,
      tasksCompleted: w.tasksCompleted,
      averageAccuracy: w.tasksCompleted > 0
        ? Math.round((w.totalAccuracy / w.tasksCompleted) * 10000) / 10000
        : 0,
      totalTrainingTimeSeconds: Math.round(w.totalTrainingTime),
      invalidSubmissions: w.invalidSubmissions,
      // Estimated GWC reward: 1 GWC per valid task + accuracy bonus
      estimatedGwcReward: parseFloat(
        (w.tasksCompleted + w.totalAccuracy * 0.5).toFixed(4)
      ),
    }))
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted);

  res.json({ leaderboard, totalResults: results.length });
});


/**
 * GET /api/ai/best-configs
 * Returns the top-performing neural network configurations discovered so far.
 * Used by the evolution engine and public research dashboard.
 */
router.get('/best-configs', (_req: Request, res: Response) => {
  const results = taskService.getResults();

  const scored: Array<{ accuracy: number; config: any; taskId: string; worker: string }> = [];

  for (const r of results) {
    if (r.validSignature === false) continue;
    const metrics = (r as any).metrics || {};
    const config = (r as any).config || {};
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
router.get('/stats', (_req: Request, res: Response) => {
  const results = taskService.getResults();
  const validResults = results.filter(r => r.validSignature !== false);
  const invalidResults = results.filter(r => r.validSignature === false);

  const uniqueWorkers = new Set(results.map(r => r.worker?.toLowerCase()).filter(Boolean));

  let totalAccuracy = 0;
  let bestAccuracy = 0;
  let totalTrainingTime = 0;

  for (const r of validResults) {
    const metrics = (r as any).metrics || {};
    const accuracy = typeof metrics.accuracy === 'number' ? metrics.accuracy : 0;
    const trainingTime = typeof metrics.training_time_seconds === 'number'
      ? metrics.training_time_seconds : 0;
    totalAccuracy += accuracy;
    totalTrainingTime += trainingTime;
    if (accuracy > bestAccuracy) bestAccuracy = accuracy;
  }

  res.json({
    totalTasksCompleted: validResults.length,
    totalInvalidSubmissions: invalidResults.length,
    uniqueWorkers: uniqueWorkers.size,
    averageAccuracy: validResults.length > 0
      ? Math.round((totalAccuracy / validResults.length) * 10000) / 10000
      : 0,
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
router.post('/verify-result', (req: Request, res: Response) => {
  const { taskId, config, metrics } = req.body || {};

  if (!taskId || !config || !metrics) {
    return res.status(400).json({ error: 'taskId, config, and metrics are required' });
  }

  const crypto = require('crypto');
  const canonical = JSON.stringify(
    { task_id: taskId, config, accuracy: metrics.accuracy,
      final_loss: metrics.final_loss, param_count: metrics.param_count },
    Object.keys({ task_id: taskId, config, accuracy: metrics.accuracy,
      final_loss: metrics.final_loss, param_count: metrics.param_count }).sort()
  );
  const expectedHash = '0x' + crypto.createHash('sha256').update(canonical).digest('hex');

  const submittedHash = req.body.hash || '';
  const matches = submittedHash.toLowerCase() === expectedHash.toLowerCase();

  res.json({
    verified: matches,
    expectedHash,
    submittedHash,
  });
});

export default router;
