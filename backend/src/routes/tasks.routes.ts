import { Router } from 'express';
import { taskService } from '../services/task.service';

export const tasksRouter = Router();

// Create a task (admin/testing). Accepts JSON: { payload: any }
tasksRouter.post('/create', (req, res) => {
  const { payload } = req.body || {};
  if (payload === undefined) {
    return res.status(400).json({ error: 'payload required' });
  }
  const task = taskService.addTask(typeof payload === 'string' ? payload : JSON.stringify(payload));
  res.json({ task });
});

// Get next available task for worker
tasksRouter.get('/', (_req, res) => {
  const task = taskService.getNextTask();
  if (!task) return res.status(204).send();
  res.json({ task });
});
