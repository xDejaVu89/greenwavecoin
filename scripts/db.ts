import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.MONITOR_DB_PATH || path.join(__dirname, '..', 'monitor.db');

const db = new Database(DB_PATH);

// Initialize table
db.prepare(
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    txhash TEXT UNIQUE,
    blockNumber INTEGER,
    fromAddr TEXT,
    toAddr TEXT,
    value TEXT,
    timestamp INTEGER
  );`
).run();

export function addEvent(e: { txhash: string; blockNumber: number; fromAddr: string; toAddr: string; value: string; timestamp: number }) {
  try {
    const stmt = db.prepare(`INSERT OR IGNORE INTO events (txhash, blockNumber, fromAddr, toAddr, value, timestamp) VALUES (?, ?, ?, ?, ?, ?)`);
    stmt.run(e.txhash, e.blockNumber, e.fromAddr, e.toAddr, e.value, e.timestamp);
  } catch (err) {
    console.error('DB insert error', err);
  }
}

export function getEvents(limit = 100, offset = 0) {
  const stmt = db.prepare(`SELECT txhash, blockNumber, fromAddr, toAddr, value, timestamp FROM events ORDER BY id DESC LIMIT ? OFFSET ?`);
  return stmt.all(limit, offset);
}

export function countEvents() {
  const row: any = db.prepare(`SELECT COUNT(1) as c FROM events`).get();
  return row?.c ?? 0;
}

export default db;
