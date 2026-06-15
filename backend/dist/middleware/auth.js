"use strict";
/**
 * GreenWaveCoin — API Key Authentication Middleware
 * ===================================================
 * Protects admin and task-creation endpoints with a shared API key.
 *
 * Usage:
 *   - Set ADMIN_API_KEY in .env for admin routes
 *   - Set WORKER_API_KEY in .env for worker routes (task fetch / result submit)
 *   - Public routes (leaderboard, stats, best-configs) require no key
 *
 * Clients pass the key in the Authorization header:
 *   Authorization: Bearer <key>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminKey = requireAdminKey;
exports.requireWorkerKey = requireWorkerKey;
function extractBearer(req) {
    // Accept both 'X-API-Key: <key>' (worker client) and 'Authorization: Bearer <key>'
    const xApiKey = req.headers['x-api-key'];
    if (xApiKey && typeof xApiKey === 'string') {
        return xApiKey.trim();
    }
    const header = req.headers['authorization'] || '';
    if (header.startsWith('Bearer ')) {
        return header.slice(7).trim();
    }
    return null;
}
/**
 * Middleware: require a valid ADMIN_API_KEY.
 * Used for task creation (seeding), result listing, and verify endpoints.
 */
function requireAdminKey(req, res, next) {
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) {
        // If no key is configured, allow access (dev mode)
        return next();
    }
    const provided = extractBearer(req);
    if (!provided || provided !== adminKey) {
        return res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
    }
    next();
}
/**
 * Middleware: require a valid WORKER_API_KEY.
 * Used for task fetch and result submission endpoints.
 */
function requireWorkerKey(req, res, next) {
    const workerKey = process.env.WORKER_API_KEY;
    if (!workerKey) {
        // If no key is configured, allow access (dev mode)
        return next();
    }
    const provided = extractBearer(req);
    if (!provided || provided !== workerKey) {
        return res.status(401).json({ error: 'Unauthorized: invalid or missing worker API key' });
    }
    next();
}
//# sourceMappingURL=auth.js.map