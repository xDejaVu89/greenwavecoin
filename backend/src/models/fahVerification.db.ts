import Database from 'better-sqlite3';
import path from 'path';
import { FAHVerification } from './fahVerification.model';

const dbPath = path.join(__dirname, '../../data/fah_verifications.db');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS fah_verifications (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    fah_username TEXT NOT NULL,
    total_credits INTEGER NOT NULL,
    work_units INTEGER NOT NULL,
    last_claimed_credits INTEGER NOT NULL DEFAULT 0,
    reward_amount TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(wallet_address, fah_username)
  );

  CREATE INDEX IF NOT EXISTS idx_wallet_address ON fah_verifications(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_fah_username ON fah_verifications(fah_username);
`);

export class FAHVerificationDatabase {
  /**
   * Save or update a verification
   */
  save(verification: FAHVerification): FAHVerification {
    const stmt = db.prepare(`
      INSERT INTO fah_verifications (
        id, wallet_address, fah_username, total_credits, work_units,
        last_claimed_credits, reward_amount, verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(wallet_address, fah_username) DO UPDATE SET
        total_credits = excluded.total_credits,
        work_units = excluded.work_units,
        reward_amount = excluded.reward_amount,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      verification.id,
      verification.walletAddress,
      verification.fahUsername,
      verification.totalCredits,
      verification.workUnits,
      verification.lastClaimedCredits,
      verification.rewardAmount,
      verification.verified ? 1 : 0,
      verification.createdAt.getTime(),
      verification.updatedAt.getTime()
    );

    return verification;
  }

  /**
   * Get verification by wallet address and FAH username
   */
  findByWalletAndUsername(
    walletAddress: string,
    fahUsername: string
  ): FAHVerification | undefined {
    const stmt = db.prepare(`
      SELECT * FROM fah_verifications
      WHERE wallet_address = ? AND fah_username = ?
    `);

    const row = stmt.get(walletAddress, fahUsername) as any;
    return row ? this.rowToVerification(row) : undefined;
  }

  /**
   * Get all verifications for a wallet
   */
  findByWallet(walletAddress: string): FAHVerification[] {
    const stmt = db.prepare(`
      SELECT * FROM fah_verifications
      WHERE wallet_address = ?
      ORDER BY updated_at DESC
    `);

    const rows = stmt.all(walletAddress) as any[];
    return rows.map(row => this.rowToVerification(row));
  }

  /**
   * Get all pending claims (verified but not yet fully claimed)
   */
  getPendingClaims(walletAddress: string): FAHVerification[] {
    const stmt = db.prepare(`
      SELECT * FROM fah_verifications
      WHERE wallet_address = ? AND verified = 1 AND total_credits > last_claimed_credits
      ORDER BY updated_at DESC
    `);

    const rows = stmt.all(walletAddress) as any[];
    return rows.map(row => this.rowToVerification(row));
  }

  /**
   * Mark credits as claimed
   */
  markClaimed(walletAddress: string, fahUsername: string, creditsClaimed: number): void {
    const stmt = db.prepare(`
      UPDATE fah_verifications
      SET last_claimed_credits = last_claimed_credits + ?,
          updated_at = ?
      WHERE wallet_address = ? AND fah_username = ?
    `);

    stmt.run(creditsClaimed, Date.now(), walletAddress, fahUsername);
  }

  /**
   * Get all verifications (for Merkle tree generation)
   */
  getAll(): FAHVerification[] {
    const stmt = db.prepare('SELECT * FROM fah_verifications ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToVerification(row));
  }

  /**
   * Get all pending claims across all wallets (for Merkle tree)
   */
  getAllPendingClaims(): FAHVerification[] {
    const stmt = db.prepare(`
      SELECT * FROM fah_verifications
      WHERE verified = 1 AND total_credits > last_claimed_credits
      ORDER BY updated_at DESC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => this.rowToVerification(row));
  }

  /**
   * Convert database row to FAHVerification object
   */
  private rowToVerification(row: any): FAHVerification {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      fahUsername: row.fah_username,
      totalCredits: row.total_credits,
      workUnits: row.work_units,
      lastClaimedCredits: row.last_claimed_credits,
      rewardAmount: row.reward_amount,
      verified: row.verified === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    db.close();
  }
}

// Singleton instance
export const fahVerificationDb = new FAHVerificationDatabase();
