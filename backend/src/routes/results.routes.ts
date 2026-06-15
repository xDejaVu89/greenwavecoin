import { Router } from 'express';
import { createHash } from 'crypto';
import { taskService, AIMetrics } from '../services/task.service';
import { requireAdminKey, requireWorkerKey } from '../middleware/auth';
import { validateSubmitResult } from '../middleware/validate';

export const resultsRouter = Router();

/**
 * Deep-sort replacer for JSON.stringify — sorts all object keys recursively.
 * This matches Python's json.dumps(sort_keys=True) behavior exactly.
 */
function deepSortReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce((sorted: Record<string, unknown>, k) => {
        sorted[k] = (value as Record<string, unknown>)[k];
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
function verifyAIHash(
  taskId: string,
  config: Record<string, unknown>,
  metrics: AIMetrics,
  submittedHash: string
): boolean {
  try {
    const obj = {
      task_id: taskId,
      config,
      accuracy: metrics.accuracy,
      final_loss: metrics.final_loss,
      param_count: metrics.param_count,
    };
    // Use deepSortReplacer + no spaces to match Python: json.dumps(sort_keys=True, separators=(',', ':'))
    const canonical = JSON.stringify(obj, deepSortReplacer as (key: string, value: unknown) => unknown);
    const expected = '0x' + createHash('sha256').update(canonical).digest('hex');
    return expected.toLowerCase() === submittedHash.toLowerCase();
  } catch {
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
resultsRouter.post('/', requireWorkerKey, validateSubmitResult, (req, res) => {
  const { id, worker, hash, signature, metrics, config } = req.body;

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
 * Admin-only: list all submitted results.
 */
resultsRouter.get('/', requireAdminKey, (_req, res) => {
  res.json({ results: taskService.getResults() });
});
