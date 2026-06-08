import { Router } from 'express';
import { taskService } from '../services/task.service';
import { requireAdminKey, requireWorkerKey } from '../middleware/auth';
import { validateCreateTask } from '../middleware/validate';

export const tasksRouter = Router();

/**
 * POST /api/tasks/create
 * Admin-only: seed a new task into the queue.
 * Body: { payload: string (JSON) }
 */
tasksRouter.post('/create', requireAdminKey, validateCreateTask, (req, res) => {
  const { payload } = req.body;
  const task = taskService.addTask(
    typeof payload === 'string' ? payload : JSON.stringify(payload)
  );
  res.json({ task });
});

/**
 * GET /api/tasks
 * Worker: fetch the next available task from the queue.
 * Returns 204 if the queue is empty.
 */
tasksRouter.get('/', requireWorkerKey, (_req, res) => {
  const task = taskService.getNextTask();
  if (!task) return res.status(204).send();
  res.json({ task });
});

/**
 * GET /api/tasks/stats
 * Public: return queue statistics.
 */
tasksRouter.get('/stats', (_req, res) => {
  res.json({
    queueLength: taskService.getQueueLength(),
  });
});
