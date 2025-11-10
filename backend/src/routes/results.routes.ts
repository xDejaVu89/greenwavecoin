import { Router } from 'express';
import { getBytes, verifyMessage } from 'ethers';
import { taskService } from '../services/task.service';

export const resultsRouter = Router();

// Worker submits result: { id, worker, hash, signature }
resultsRouter.post('/', (req, res) => {
  const { id, worker, hash, signature } = req.body || {};
  if (!id || !worker || !hash || !signature) {
    return res.status(400).json({ error: 'id, worker, hash, signature required' });
  }

  const task = taskService.getTask(id);
  if (!task) return res.status(404).json({ error: 'task not found' });

  let validSignature = false;
  try {
    // Worker is expected to sign raw 32-byte blake3 hash
    const msgBytes = getBytes(hash);
    const recovered = verifyMessage(msgBytes, signature);
    validSignature = recovered.toLowerCase() === String(worker).toLowerCase();
  } catch (_e) {
    validSignature = false;
  }

  taskService.addResult({ id, worker, hash, signature, receivedAt: Date.now(), validSignature });
  res.json({ accepted: true, validSignature });
});

// Admin/debug: list results
resultsRouter.get('/', (_req, res) => {
  res.json({ results: taskService.getResults() });
});
