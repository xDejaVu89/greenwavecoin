/**
 * GreenWaveCoin — Reward Distribution Service
 * =============================================
 * Bridges the backend coordinator to the on-chain RewardEscrowV2 contract.
 *
 * Flow:
 *  1. Workers submit valid AI results → stored in the `results` table.
 *  2. At the end of each epoch (configurable interval), this service:
 *     a. Reads all valid results for the epoch from the DB.
 *     b. Calculates each worker's GWC reward based on tasks completed + accuracy.
 *     c. Builds a Merkle tree of (index, wallet, amount) leaves.
 *     d. Stores the tree and proofs in the `reward_epochs` and `reward_claims` tables.
 *     e. Publishes the Merkle root to the RewardEscrowV2 contract on-chain.
 *  3. Workers can call GET /api/rewards/:wallet to get their proof and claim on-chain.
 *
 * Reward Formula:
 *   base reward   = GWC_PER_TASK (default: 1 GWC per valid task)
 *   accuracy bonus = accuracy * GWC_ACCURACY_MULTIPLIER (default: 0.5 GWC per 100% accuracy)
 *   total = (base + bonus) * tasks_completed
 */

import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import { createHash } from 'crypto';
import { db } from '../db/database';

// ---------------------------------------------------------------------------
// Configuration (from environment variables)
// ---------------------------------------------------------------------------

const GWC_PER_TASK = parseFloat(process.env.GWC_PER_TASK || '1.0');
const GWC_ACCURACY_MULTIPLIER = parseFloat(process.env.GWC_ACCURACY_MULTIPLIER || '0.5');
const GWC_DECIMALS = 18;

// ---------------------------------------------------------------------------
// Database schema for reward tracking
// ---------------------------------------------------------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS reward_epochs (
    epoch         INTEGER PRIMARY KEY,
    merkle_root   TEXT NOT NULL,
    total_gwc     TEXT NOT NULL,   -- in wei (string to avoid JS bigint issues)
    claim_count   INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending', -- pending | published | failed
    tx_hash       TEXT,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    published_at  INTEGER
  );

  CREATE TABLE IF NOT EXISTS reward_claims (
    epoch         INTEGER NOT NULL,
    claim_index   INTEGER NOT NULL,
    wallet        TEXT NOT NULL,
    amount_wei    TEXT NOT NULL,
    proof         TEXT NOT NULL,  -- JSON array of hex strings
    claimed       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (epoch, claim_index),
    FOREIGN KEY (epoch) REFERENCES reward_epochs(epoch)
  );

  CREATE INDEX IF NOT EXISTS idx_claims_wallet ON reward_claims(wallet);
  CREATE INDEX IF NOT EXISTS idx_claims_epoch  ON reward_claims(epoch);
`);

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const stmts = {
  insertEpoch: db.prepare(
    `INSERT OR IGNORE INTO reward_epochs (epoch, merkle_root, total_gwc, claim_count, status)
     VALUES (@epoch, @merkle_root, @total_gwc, @claim_count, 'pending')`
  ),
  updateEpochPublished: db.prepare(
    `UPDATE reward_epochs SET status = 'published', tx_hash = @tx_hash,
     published_at = unixepoch() WHERE epoch = @epoch`
  ),
  updateEpochFailed: db.prepare(
    `UPDATE reward_epochs SET status = 'failed' WHERE epoch = @epoch`
  ),
  insertClaim: db.prepare(
    `INSERT OR IGNORE INTO reward_claims
       (epoch, claim_index, wallet, amount_wei, proof)
     VALUES (@epoch, @claim_index, @wallet, @amount_wei, @proof)`
  ),
  getClaimsByWallet: db.prepare(
    `SELECT rc.epoch, rc.claim_index, rc.wallet, rc.amount_wei, rc.proof, rc.claimed,
            re.merkle_root, re.status as epoch_status, re.tx_hash
     FROM reward_claims rc
     JOIN reward_epochs re ON rc.epoch = re.epoch
     WHERE LOWER(rc.wallet) = LOWER(?)
     ORDER BY rc.epoch DESC`
  ),
  getLatestEpoch: db.prepare(
    `SELECT MAX(epoch) as max_epoch FROM reward_epochs`
  ),
  getEpoch: db.prepare(
    `SELECT * FROM reward_epochs WHERE epoch = ?`
  ),
  markClaimed: db.prepare(
    `UPDATE reward_claims SET claimed = 1 WHERE epoch = ? AND LOWER(wallet) = LOWER(?)`
  ),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkerReward {
  wallet: string;
  tasksCompleted: number;
  totalAccuracy: number;
  amountGwc: number;
  amountWei: bigint;
}

export interface EpochResult {
  epoch: number;
  merkleRoot: string;
  totalGwc: number;
  claims: WorkerReward[];
  txHash?: string;
}

// ---------------------------------------------------------------------------
// Merkle leaf hashing (must match RewardEscrowV2.sol)
// ---------------------------------------------------------------------------

function hashLeaf(index: number, wallet: string, amountWei: bigint): Buffer {
  // keccak256(abi.encodePacked(index, account, amount))
  const encoded = ethers.solidityPacked(
    ['uint256', 'address', 'uint256'],
    [index, wallet, amountWei]
  );
  return Buffer.from(ethers.keccak256(encoded).slice(2), 'hex');
}

// ---------------------------------------------------------------------------
// Core reward calculation
// ---------------------------------------------------------------------------

/**
 * Calculate GWC rewards for all workers based on their valid results.
 * Optionally filter to results within a specific epoch window.
 */
export function calculateRewards(
  sinceTimestamp?: number,
  untilTimestamp?: number
): WorkerReward[] {
  // Query valid results from the DB
  let query = `
    SELECT worker, metrics, config
    FROM results
    WHERE valid_signature = 1
  `;
  const params: any[] = [];

  if (sinceTimestamp) {
    query += ` AND received_at >= ?`;
    params.push(Math.floor(sinceTimestamp / 1000));
  }
  if (untilTimestamp) {
    query += ` AND received_at < ?`;
    params.push(Math.floor(untilTimestamp / 1000));
  }

  const rows = db.prepare(query).all(...params) as any[];

  // Aggregate per wallet
  const workerMap = new Map<string, { tasks: number; totalAccuracy: number }>();

  for (const row of rows) {
    const wallet = (row.worker || '').toLowerCase();
    if (!wallet || !wallet.startsWith('0x')) continue;

    const metrics = row.metrics ? JSON.parse(row.metrics) : {};
    const accuracy = typeof metrics.accuracy === 'number' ? metrics.accuracy : 0;

    if (!workerMap.has(wallet)) {
      workerMap.set(wallet, { tasks: 0, totalAccuracy: 0 });
    }
    const entry = workerMap.get(wallet)!;
    entry.tasks += 1;
    entry.totalAccuracy += accuracy;
  }

  // Convert to reward array
  const rewards: WorkerReward[] = [];
  for (const [wallet, stats] of workerMap.entries()) {
    const avgAccuracy = stats.tasks > 0 ? stats.totalAccuracy / stats.tasks : 0;
    const amountGwc = (GWC_PER_TASK + avgAccuracy * GWC_ACCURACY_MULTIPLIER) * stats.tasks;
    const amountWei = BigInt(Math.floor(amountGwc * 10 ** GWC_DECIMALS));

    rewards.push({
      wallet,
      tasksCompleted: stats.tasks,
      totalAccuracy: stats.totalAccuracy,
      amountGwc: Math.round(amountGwc * 1e6) / 1e6,
      amountWei,
    });
  }

  return rewards.sort((a, b) => b.amountGwc - a.amountGwc);
}

// ---------------------------------------------------------------------------
// Merkle tree builder
// ---------------------------------------------------------------------------

export function buildMerkleTree(rewards: WorkerReward[]): {
  tree: MerkleTree;
  root: string;
  leaves: Buffer[];
} {
  const leaves = rewards.map((r, i) => hashLeaf(i, r.wallet, r.amountWei));
  const tree = new MerkleTree(leaves, (data: Buffer) =>
    Buffer.from(ethers.keccak256(data).slice(2), 'hex'), { sort: true }
  );
  const root = '0x' + tree.getRoot().toString('hex');
  return { tree, root, leaves };
}

// ---------------------------------------------------------------------------
// Epoch management
// ---------------------------------------------------------------------------

/**
 * Finalise an epoch: calculate rewards, build Merkle tree, store in DB.
 * Returns the epoch data ready for on-chain publishing.
 */
export function finaliseEpoch(
  epoch: number,
  sinceTimestamp?: number,
  untilTimestamp?: number
): EpochResult {
  const existing = stmts.getEpoch.get(epoch) as any;
  if (existing) {
    throw new Error(`Epoch ${epoch} already exists with status: ${existing.status}`);
  }

  const rewards = calculateRewards(sinceTimestamp, untilTimestamp);
  if (rewards.length === 0) {
    throw new Error('No valid results to reward in this epoch');
  }

  const { tree, root, leaves } = buildMerkleTree(rewards);
  const totalGwc = rewards.reduce((sum, r) => sum + r.amountGwc, 0);
  const totalWei = rewards.reduce((sum, r) => sum + r.amountWei, 0n);

  // Store epoch and all claims in DB (atomic transaction)
  const insertAll = db.transaction(() => {
    stmts.insertEpoch.run({
      epoch,
      merkle_root: root,
      total_gwc: totalWei.toString(),
      claim_count: rewards.length,
    });

    rewards.forEach((reward, index) => {
      const leaf = leaves[index];
      const proof = tree.getHexProof(leaf);
      stmts.insertClaim.run({
        epoch,
        claim_index: index,
        wallet: reward.wallet,
        amount_wei: reward.amountWei.toString(),
        proof: JSON.stringify(proof),
      });
    });
  });

  insertAll();

  return {
    epoch,
    merkleRoot: root,
    totalGwc,
    claims: rewards,
  };
}

/**
 * Mark an epoch as published after the on-chain transaction confirms.
 */
export function markEpochPublished(epoch: number, txHash: string): void {
  stmts.updateEpochPublished.run({ epoch, tx_hash: txHash });
}

export function markEpochFailed(epoch: number): void {
  stmts.updateEpochFailed.run(epoch);
}

/**
 * Get reward claims for a specific wallet address.
 */
export function getClaimsForWallet(wallet: string) {
  const rows = stmts.getClaimsByWallet.all(wallet) as any[];
  return rows.map(row => ({
    epoch: row.epoch,
    index: row.claim_index,
    wallet: row.wallet,
    amountWei: row.amount_wei,
    amountGwc: (Number(BigInt(row.amount_wei)) / 10 ** GWC_DECIMALS).toFixed(6),
    proof: JSON.parse(row.proof),
    claimed: row.claimed === 1,
    epochStatus: row.epoch_status,
    merkleRoot: row.merkle_root,
    txHash: row.tx_hash,
  }));
}

/**
 * Get the next epoch number to use.
 */
export function getNextEpoch(): number {
  const row = stmts.getLatestEpoch.get() as any;
  return (row?.max_epoch ?? -1) + 1;
}
