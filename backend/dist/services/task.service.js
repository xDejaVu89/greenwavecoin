"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskService = void 0;
const crypto_1 = require("crypto");
class TaskService {
    constructor() {
        this.queue = [];
        this.results = [];
        this.byId = new Map();
    }
    addTask(payload) {
        const task = { id: (0, crypto_1.randomUUID)(), payload };
        this.queue.push(task);
        this.byId.set(task.id, task);
        return task;
    }
    getNextTask() {
        const task = this.queue.shift() || null;
        if (task)
            task.assignedAt = Date.now();
        return task;
    }
    getTask(id) {
        return this.byId.get(id);
    }
    addResult(result) {
        this.results.push(result);
    }
    getResults() {
        return this.results.slice();
    }
}
exports.taskService = new TaskService();
//# sourceMappingURL=task.service.js.map