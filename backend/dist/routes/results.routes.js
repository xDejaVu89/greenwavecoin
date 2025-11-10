"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resultsRouter = void 0;
const express_1 = require("express");
const ethers_1 = require("ethers");
const task_service_1 = require("../services/task.service");
exports.resultsRouter = (0, express_1.Router)();
// Worker submits result: { id, worker, hash, signature }
exports.resultsRouter.post('/', (req, res) => {
    const { id, worker, hash, signature } = req.body || {};
    if (!id || !worker || !hash || !signature) {
        return res.status(400).json({ error: 'id, worker, hash, signature required' });
    }
    const task = task_service_1.taskService.getTask(id);
    if (!task)
        return res.status(404).json({ error: 'task not found' });
    let validSignature = false;
    try {
        // Worker is expected to sign raw 32-byte blake3 hash
        const msgBytes = (0, ethers_1.getBytes)(hash);
        const recovered = (0, ethers_1.verifyMessage)(msgBytes, signature);
        validSignature = recovered.toLowerCase() === String(worker).toLowerCase();
    }
    catch (_e) {
        validSignature = false;
    }
    task_service_1.taskService.addResult({ id, worker, hash, signature, receivedAt: Date.now(), validSignature });
    res.json({ accepted: true, validSignature });
});
// Admin/debug: list results
exports.resultsRouter.get('/', (_req, res) => {
    res.json({ results: task_service_1.taskService.getResults() });
});
//# sourceMappingURL=results.routes.js.map