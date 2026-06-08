/**
 * GreenWaveCoin — SQLite Persistence Layer
 * ==========================================
 * Replaces the in-memory task/result store with a durable SQLite database.
 * Uses better-sqlite3 for synchronous, zero-dependency SQLite access.
 *
 * Database file location: controlled by DB_PATH env var (default: ./data/gwc.db)
 */

import Database, { Database as BetterDatabase, Statement } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/gwc.db');

// Ensure the data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: BetterDatabase = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
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

export const stmts: Record<string, Statement> = {
  // Tasks
  insertTask: db.prepare(
    `INSERT INTO tasks (id, payload, status) VALUES (@id, @payload, 'pending')`
  ),
  fetchNextTask: db.prepare(
    `UPDATE tasks SET status = 'assigned', assigned_at = unixepoch()
     WHERE id = (
       SELECT id FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1
     )
     RETURNING id, payload, assigned_at`
  ),
  getTaskById: db.prepare(
    `SELECT id, payload, assigned_at FROM tasks WHERE id = ?`
  ),
  markTaskCompleted: db.prepare(
    `UPDATE tasks SET status = 'completed' WHERE id = ?`
  ),
  getQueueLength: db.prepare(
    `SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'`
  ),
  requeueStuckTasks: db.prepare(
    // Re-queue tasks that have been assigned but not completed in >10 minutes
    `UPDATE tasks SET status = 'pending', assigned_at = NULL
     WHERE status = 'assigned' AND assigned_at < unixepoch() - 600`
  ),

  // Results
  insertResult: db.prepare(
    `INSERT OR REPLACE INTO results
       (id, worker, hash, signature, valid_signature, metrics, config, received_at)
     VALUES
       (@id, @worker, @hash, @signature, @valid_signature, @metrics, @config, unixepoch())`
  ),
  getAllResults: db.prepare(
    `SELECT id, worker, hash, signature, valid_signature, metrics, config, received_at
     FROM results ORDER BY received_at DESC`
  ),
  getResultsByWorker: db.prepare(
    `SELECT id, worker, hash, signature, valid_signature, metrics, config, received_at
     FROM results WHERE worker = ? ORDER BY received_at DESC`
  ),
  getTotalResults: db.prepare(
    `SELECT COUNT(*) as count FROM results`
  ),
  getValidResults: db.prepare(
    `SELECT COUNT(*) as count FROM results WHERE valid_signature = 1`
  ),
  getUniqueWorkers: db.prepare(
    `SELECT COUNT(DISTINCT LOWER(worker)) as count FROM results`
  ),
};

// ---------------------------------------------------------------------------
// Helper: deserialize a result row from DB into the TaskResult shape
// ---------------------------------------------------------------------------

export function deserializeResult(row: any) {
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

export default db;
