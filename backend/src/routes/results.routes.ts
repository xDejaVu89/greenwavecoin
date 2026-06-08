import { Router } from 'express';
import { createHash } from 'crypto';
import { taskService, AIMetrics } from '../services/task.service';

export const resultsRouter = Router();

/**
 * Verify the AI result hash submitted by a worker.
 * The hash is a SHA-256 of: { task_id, config, accuracy, final_loss, param_count }
 * sorted by key, matching the Python worker's compute_result_hash() function.
 */
function verifyAIHash(
  taskId: string,
  config: Record<string, unknown>,
  metrics: AIMetrics,
  submittedHash: string
): boolean {
  try {
    const canonical = JSON.stringify(
      {
        task_id: taskId,
        config,
        accuracy: metrics.accuracy,
        final_loss: metrics.final_loss,
        param_count: metrics.param_count,
      },
      Object.keys({
        task_id: taskId,
        config,
        accuracy: metrics.accuracy,
        final_loss: metrics.final_loss,
        param_count: metrics.param_count,
      }).sort()
    );
    const expected = '0x' + createHash('sha256').update(canonical).digest('hex');
    return expected.toLowerCase() === submittedHash.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * POST /api/results
 * Worker submits a completed task result.
 *
 * Body (AI worker format):
 *   { id, worker, hash, signature, metrics, config }
 *
 * Body (legacy Rust worker format):
 *   { id, worker, hash, signature }
 */
resultsRouter.post('/', (req, res) => {
  const { id, worker, hash, signature, metrics, config } = req.body || {};

  if (!id || !worker || !hash || !signature) {
    return res.status(400).json({ error: 'id, worker, hash, signature required' });
  }

  const task = taskService.getTask(id);
  if (!task) return res.status(404).json({ error: 'task not found' });

  let validSignature = false;

  if (metrics && config) {
    // AI worker path: verify SHA-256 hash of metrics
    validSignature = verifyAIHash(id, config, metrics as AIMetrics, hash);
  } else {
    // Legacy Rust worker path: verify ethers signature of blake3 hash
    try {
      const { getBytes, verifyMessage } = require('ethers');
      const msgBytes = getBytes(hash);
      const recovered = verifyMessage(msgBytes, signature);
      validSignature = recovered.toLowerCase() === String(worker).toLowerCase();
    } catch (_e) {
      validSignature = false;
    }
  }

  taskService.addResult({
    id,
    worker,
    hash,
    signature,
    receivedAt: Date.now(),
    validSignature,
    metrics: metrics as AIMetrics | undefined,
    config: config as Record<string, unknown> | undefined,
  });

  res.json({ accepted: true, validSignature });
});

/**
 * GET /api/results
 * Admin/debug: list all submitted results.
 */
resultsRouter.get('/', (_req, res) => {
  res.json({ results: taskService.getResults() });
});
