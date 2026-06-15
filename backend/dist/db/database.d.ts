/**
 * GreenWaveCoin — SQLite Persistence Layer
 * ==========================================
 * Replaces the in-memory task/result store with a durable SQLite database.
 * Uses better-sqlite3 for synchronous, zero-dependency SQLite access.
 *
 * Database file location: controlled by DB_PATH env var (default: ./data/gwc.db)
 */
import { Database as BetterDatabase, Statement } from 'better-sqlite3';
export declare const db: BetterDatabase;
export declare const stmts: Record<string, Statement>;
export declare function deserializeResult(row: any): {
    id: any;
    worker: any;
    hash: any;
    signature: any;
    validSignature: boolean;
    metrics: any;
    config: any;
    receivedAt: number;
};
export default db;
//# sourceMappingURL=database.d.ts.map