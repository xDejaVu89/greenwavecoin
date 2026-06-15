"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskService = void 0;
const crypto_1 = require("crypto");
const database_1 = require("../db/database");
class TaskService {
    addTask(payload) {
        const task = { id: (0, crypto_1.randomUUID)(), payload };
        database_1.stmts.insertTask.run({ id: task.id, payload: task.payload });
        return task;
    }
    getNextTask() {
        const row = database_1.stmts.fetchNextTask.get();
        if (!row)
            return null;
        return {
            id: row.id,
            payload: row.payload,
            assignedAt: row.assigned_at ? row.assigned_at * 1000 : undefined,
        };
    }
    getTask(id) {
        const row = database_1.stmts.getTaskById.get(id);
        if (!row)
            return undefined;
        return {
            id: row.id,
            payload: row.payload,
            assignedAt: row.assigned_at ? row.assigned_at * 1000 : undefined,
        };
    }
    addResult(result) {
        database_1.stmts.insertResult.run({
            id: result.id,
            worker: result.worker,
            hash: result.hash,
            signature: result.signature,
            valid_signature: result.validSignature ? 1 : 0,
            metrics: result.metrics ? JSON.stringify(result.metrics) : null,
            config: result.config ? JSON.stringify(result.config) : null,
        });
        // Mark the task as completed so it leaves the queue
        database_1.stmts.markTaskCompleted.run(result.id);
    }
    getResults() {
        const rows = database_1.stmts.getAllResults.all();
        return rows.map(database_1.deserializeResult);
    }
    getResultsByWorker(wallet) {
        const rows = database_1.stmts.getResultsByWorker.all(wallet.toLowerCase());
        return rows.map(database_1.deserializeResult);
    }
    getQueueLength() {
        const row = database_1.stmts.getQueueLength.get();
        return row?.count ?? 0;
    }
    /** Re-queue tasks stuck in 'assigned' for more than 10 minutes */
    requeueStuckTasks() {
        const info = database_1.stmts.requeueStuckTasks.run();
        return info.changes;
    }
    getStats() {
        const queueLength = this.getQueueLength();
        const totalResults = database_1.stmts.getTotalResults.get()?.count ?? 0;
        const validResults = database_1.stmts.getValidResults.get()?.count ?? 0;
        const uniqueWorkers = database_1.stmts.getUniqueWorkers.get()?.count ?? 0;
        return { queueLength, totalResults, validResults, uniqueWorkers };
    }
}
exports.taskService = new TaskService();
//# sourceMappingURL=task.service.js.map