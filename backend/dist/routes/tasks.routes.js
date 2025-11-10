"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tasksRouter = void 0;
const express_1 = require("express");
const task_service_1 = require("../services/task.service");
exports.tasksRouter = (0, express_1.Router)();
// Create a task (admin/testing). Accepts JSON: { payload: any }
exports.tasksRouter.post('/create', (req, res) => {
    const { payload } = req.body || {};
    if (payload === undefined) {
        return res.status(400).json({ error: 'payload required' });
    }
    const task = task_service_1.taskService.addTask(typeof payload === 'string' ? payload : JSON.stringify(payload));
    res.json({ task });
});
// Get next available task for worker
exports.tasksRouter.get('/', (_req, res) => {
    const task = task_service_1.taskService.getNextTask();
    if (!task)
        return res.status(204).send();
    res.json({ task });
});
//# sourceMappingURL=tasks.routes.js.map