"use strict";
/**
 * GreenWaveCoin — Input Validation Middleware
 * =============================================
 * Validates and sanitizes incoming request bodies to prevent
 * malformed data from reaching the database or business logic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCreateTask = validateCreateTask;
exports.validateSubmitResult = validateSubmitResult;
exports.validateWalletParam = validateWalletParam;
/** Ethereum address regex */
const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
/** 0x-prefixed hex hash (sha256 = 64 hex chars, blake3 = 64 hex chars) */
const HEX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
/** Ethereum signature (65 bytes = 130 hex chars) */
const ETH_SIG_RE = /^0x[0-9a-fA-F]{130}$/;
function isString(v) {
    return typeof v === 'string';
}
function isNumber(v) {
    return typeof v === 'number' && isFinite(v);
}
/**
 * Validate POST /api/tasks/create
 */
function validateCreateTask(req, res, next) {
    const { payload } = req.body || {};
    if (!isString(payload) || payload.length === 0) {
        return res.status(400).json({ error: 'payload must be a non-empty string' });
    }
    if (payload.length > 8192) {
        return res.status(400).json({ error: 'payload too large (max 8192 bytes)' });
    }
    // Validate that payload is valid JSON
    try {
        JSON.parse(payload);
    }
    catch {
        return res.status(400).json({ error: 'payload must be valid JSON' });
    }
    next();
}
/**
 * Validate POST /api/results
 */
function validateSubmitResult(req, res, next) {
    const { id, worker, hash, signature, metrics, config } = req.body || {};
    if (!isString(id) || id.length === 0) {
        return res.status(400).json({ error: 'id must be a non-empty string' });
    }
    if (!isString(worker) || !ETH_ADDRESS_RE.test(worker)) {
        return res.status(400).json({ error: 'worker must be a valid Ethereum address (0x...)' });
    }
    if (!isString(hash) || !HEX_HASH_RE.test(hash)) {
        return res.status(400).json({ error: 'hash must be a 0x-prefixed 32-byte hex string' });
    }
    // Signature can be ETH sig or placeholder for AI workers
    if (!isString(signature) || signature.length < 4) {
        return res.status(400).json({ error: 'signature must be a non-empty string' });
    }
    // If AI metrics are provided, validate them
    if (metrics !== undefined) {
        if (typeof metrics !== 'object' || metrics === null) {
            return res.status(400).json({ error: 'metrics must be an object' });
        }
        const m = metrics;
        if (!isNumber(m.accuracy) || m.accuracy < 0 || m.accuracy > 1) {
            return res.status(400).json({ error: 'metrics.accuracy must be a number between 0 and 1' });
        }
        if (!isNumber(m.final_loss) || m.final_loss < 0) {
            return res.status(400).json({ error: 'metrics.final_loss must be a non-negative number' });
        }
        if (!isNumber(m.training_time_seconds) || m.training_time_seconds < 0) {
            return res.status(400).json({ error: 'metrics.training_time_seconds must be a non-negative number' });
        }
        if (!isNumber(m.param_count) || m.param_count < 0) {
            return res.status(400).json({ error: 'metrics.param_count must be a non-negative number' });
        }
    }
    if (config !== undefined && (typeof config !== 'object' || config === null)) {
        return res.status(400).json({ error: 'config must be an object' });
    }
    next();
}
/**
 * Validate GET /api/ai/leaderboard and similar wallet-param routes
 */
function validateWalletParam(req, res, next) {
    const { wallet } = req.params;
    if (wallet && !ETH_ADDRESS_RE.test(wallet)) {
        return res.status(400).json({ error: 'wallet must be a valid Ethereum address' });
    }
    next();
}
//# sourceMappingURL=validate.js.map