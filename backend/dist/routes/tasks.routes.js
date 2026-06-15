"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tasksRouter = void 0;
const express_1 = require("express");
const task_service_1 = require("../services/task.service");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
exports.tasksRouter = (0, express_1.Router)();
/**
 * POST /api/tasks/create
 * Admin-only: seed a new task into the queue.
 * Body: { payload: string (JSON) }
 */
exports.tasksRouter.post('/create', auth_1.requireAdminKey, validate_1.validateCreateTask, (req, res) => {
    const { payload } = req.body;
    const task = task_service_1.taskService.addTask(typeof payload === 'string' ? payload : JSON.stringify(payload));
    res.json({ task });
});
/**
 * GET /api/tasks
 * Worker: fetch the next available task from the queue.
 * Returns 204 if the queue is empty.
 */
exports.tasksRouter.get('/', auth_1.requireWorkerKey, (_req, res) => {
    const task = task_service_1.taskService.getNextTask();
    if (!task)
        return res.status(204).send();
    res.json({ task });
});
/**
 * GET /api/tasks/stats
 * Public: return queue statistics.
 */
exports.tasksRouter.get('/stats', (_req, res) => {
    res.json({
        queueLength: task_service_1.taskService.getQueueLength(),
    });
});
//# sourceMappingURL=tasks.routes.js.map