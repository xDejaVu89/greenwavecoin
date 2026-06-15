"use strict";
/**
 * GreenWaveCoin — SQLite Persistence Layer
 * ==========================================
 * Replaces the in-memory task/result store with a durable SQLite database.
 * Uses better-sqlite3 for synchronous, zero-dependency SQLite access.
 *
 * Database file location: controlled by DB_PATH env var (default: ./data/gwc.db)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stmts = exports.db = void 0;
exports.deserializeResult = deserializeResult;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DB_PATH = process.env.DB_PATH || path_1.default.join(__dirname, '../../data/gwc.db');
// Ensure the data directory exists
const dbDir = path_1.default.dirname(DB_PATH);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
exports.db = new better_sqlite3_1.default(DB_PATH);
// Enable WAL mode for better concurrent read performance
exports.db.pragma('journal_mode = WAL');
exports.db.pragma('foreign_keys = ON');
// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
exports.db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    payload     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending | assigned | completed
    assigned_at INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS results (
    id              TEXT NOT NULL,
    worker          TEXT NOT NULL,
    hash            TEXT NOT NULL,
    signature       TEXT NOT NULL,
    valid_signature INTEGER NOT NULL DEFAULT 0,
    metrics         TEXT,          -- JSON string of AIMetrics
    config          TEXT,          -- JSON string of task config
    received_at     INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (id, worker)
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_results_worker  ON results(worker);
  CREATE INDEX IF NOT EXISTS idx_results_valid   ON results(valid_signature);
`);
// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------
exports.stmts = {
    // Tasks
    insertTask: exports.db.prepare(`INSERT INTO tasks (id, payload, status) VALUES (@id, @payload, 'pending')`),
    fetchNextTask: exports.db.prepare(`UPDATE tasks SET status = 'assigned', assigned_at = unixepoch()
     WHERE id = (
       SELECT id FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1
     )
     RETURNING id, payload, assigned_at`),
    getTaskById: exports.db.prepare(`SELECT id, payload, assigned_at FROM tasks WHERE id = ?`),
    markTaskCompleted: exports.db.prepare(`UPDATE tasks SET status = 'completed' WHERE id = ?`),
    getQueueLength: exports.db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'`),
    requeueStuckTasks: exports.db.prepare(
    // Re-queue tasks that have been assigned but not completed in >10 minutes
    `UPDATE tasks SET status = 'pending', assigned_at = NULL
     WHERE status = 'assigned' AND assigned_at < unixepoch() - 600`),
    // Results
    insertResult: exports.db.prepare(`INSERT OR REPLACE INTO results
       (id, worker, hash, signature, valid_signature, metrics, config, received_at)
     VALUES
       (@id, @worker, @hash, @signature, @valid_signature, @metrics, @config, unixepoch())`),
    getAllResults: exports.db.prepare(`SELECT id, worker, hash, signature, valid_signature, metrics, config, received_at
     FROM results ORDER BY received_at DESC`),
    getResultsByWorker: exports.db.prepare(`SELECT id, worker, hash, signature, valid_signature, metrics, config, received_at
     FROM results WHERE worker = ? ORDER BY received_at DESC`),
    getTotalResults: exports.db.prepare(`SELECT COUNT(*) as count FROM results`),
    getValidResults: exports.db.prepare(`SELECT COUNT(*) as count FROM results WHERE valid_signature = 1`),
    getUniqueWorkers: exports.db.prepare(`SELECT COUNT(DISTINCT LOWER(worker)) as count FROM results`),
};
// ---------------------------------------------------------------------------
// Helper: deserialize a result row from DB into the TaskResult shape
// ---------------------------------------------------------------------------
function deserializeResult(row) {
    return {
        id: row.id,
        worker: row.worker,
        hash: row.hash,
        signature: row.signature,
        validSignature: row.valid_signature === 1,
        metrics: row.metrics ? JSON.parse(row.metrics) : undefined,
        config: row.config ? JSON.parse(row.config) : undefined,
        receivedAt: row.received_at * 1000, // convert to ms
    };
}
exports.default = exports.db;
//# sourceMappingURL=database.js.map