"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const rewards_routes_1 = __importDefault(require("./routes/rewards.routes"));
const tasks_routes_1 = require("./routes/tasks.routes");
const results_routes_1 = require("./routes/results.routes");
const fah_routes_1 = __importDefault(require("./routes/fah.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
const task_service_1 = require("./services/task.service");
const reward_service_1 = require("./services/reward.service");
const chain_service_1 = require("./services/chain.service");
const reward_service_2 = require("./services/reward.service");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------
// Trust nginx reverse proxy (needed for rate limiting behind nginx)
app.set('trust proxy', 1);
app.use((0, helmet_1.default)());
// CORS — restrict to allowed origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Electron)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json({ limit: '64kb' }));
// ---------------------------------------------------------------------------
// Rate limiting — stricter limits for write endpoints
// ---------------------------------------------------------------------------
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '120'),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' },
});
const writeLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 30, // max 30 result submissions per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Result submission rate limit exceeded.' },
});
app.use('/api/', generalLimiter);
app.use('/api/results', writeLimiter);
// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        network: 'GreenWaveCoin AI Research Network',
        version: process.env.npm_package_version || '1.0.0',
        ...task_service_1.taskService.getStats(),
    });
});
// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/rewards', rewards_routes_1.default);
app.use('/api/tasks', tasks_routes_1.tasksRouter);
app.use('/api/results', results_routes_1.resultsRouter);
app.use('/api/fah', fah_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
    console.error('[ERROR]', err.message);
    if (err.message.startsWith('CORS:')) {
        return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
});
// ---------------------------------------------------------------------------
// Background jobs
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'test') {
    // Re-queue stuck tasks every 5 minutes
    setInterval(() => {
        const requeued = task_service_1.taskService.requeueStuckTasks();
        if (requeued > 0) {
            console.log(`[SCHEDULER] Re-queued ${requeued} stuck task(s)`);
        }
    }, 5 * 60 * 1000);
    // Auto-epoch scheduler: finalise and publish rewards on a configurable interval
    // Default: every 24 hours. Set EPOCH_INTERVAL_HOURS in .env to change.
    const epochIntervalHours = parseFloat(process.env.EPOCH_INTERVAL_HOURS || '24');
    const epochIntervalMs = epochIntervalHours * 60 * 60 * 1000;
    setInterval(async () => {
        try {
            const pending = (0, reward_service_1.calculateRewards)();
            if (pending.length === 0) {
                console.log('[EPOCH] No new valid results to reward, skipping epoch.');
                return;
            }
            console.log(`[EPOCH] Auto-finalising epoch with ${pending.length} worker(s)...`);
            const epoch = (0, reward_service_1.getNextEpoch)();
            const result = (0, reward_service_1.finaliseEpoch)(epoch);
            console.log(`[EPOCH] Epoch ${epoch} finalised — ${result.totalGwc.toFixed(2)} GWC across ${result.claims.length} workers`);
            if (chain_service_1.chainService.isConfigured) {
                console.log(`[EPOCH] Publishing epoch ${epoch} on-chain...`);
                const { db } = await Promise.resolve().then(() => __importStar(require('./db/database')));
                const epochRow = db.prepare('SELECT * FROM reward_epochs WHERE epoch = ?').get(epoch);
                try {
                    const txHash = await chain_service_1.chainService.publishMerkleRoot(epoch, epochRow.merkle_root, BigInt(epochRow.total_gwc));
                    (0, reward_service_2.markEpochPublished)(epoch, txHash);
                    console.log(`[EPOCH] Epoch ${epoch} published on-chain: ${txHash}`);
                }
                catch (chainErr) {
                    (0, reward_service_2.markEpochFailed)(epoch);
                    console.error(`[EPOCH] On-chain publish failed: ${chainErr.message}`);
                }
            }
            else {
                console.log(`[EPOCH] Chain not configured — epoch ${epoch} stored in DB, publish manually via POST /api/rewards/publish-epoch`);
            }
        }
        catch (err) {
            console.error(`[EPOCH] Auto-epoch error: ${err.message}`);
        }
    }, epochIntervalMs);
    app.listen(PORT, () => {
        console.log(`🚀 GreenWaveCoin coordinator running on port ${PORT}`);
        console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
        console.log(`   Auth        : ${process.env.ADMIN_API_KEY ? 'enabled' : 'DISABLED (set ADMIN_API_KEY)'}`);
        console.log(`   Database    : ${process.env.DB_PATH || 'data/gwc.db'}`);
        console.log(`   Chain       : ${chain_service_1.chainService.isConfigured ? 'configured' : 'NOT configured (manual publish mode)'}`);
        console.log(`   Epoch every : ${epochIntervalHours}h`);
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map