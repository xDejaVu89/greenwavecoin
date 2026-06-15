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
import { MerkleTree } from 'merkletreejs';
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
/**
 * Calculate GWC rewards for all workers based on their valid results.
 * Optionally filter to results within a specific epoch window.
 */
export declare function calculateRewards(sinceTimestamp?: number, untilTimestamp?: number): WorkerReward[];
export declare function buildMerkleTree(rewards: WorkerReward[]): {
    tree: MerkleTree;
    root: string;
    leaves: Buffer[];
};
/**
 * Finalise an epoch: calculate rewards, build Merkle tree, store in DB.
 * Returns the epoch data ready for on-chain publishing.
 */
export declare function finaliseEpoch(epoch: number, sinceTimestamp?: number, untilTimestamp?: number): EpochResult;
/**
 * Mark an epoch as published after the on-chain transaction confirms.
 */
export declare function markEpochPublished(epoch: number, txHash: string): void;
export declare function markEpochFailed(epoch: number): void;
/**
 * Get reward claims for a specific wallet address.
 */
export declare function getClaimsForWallet(wallet: string): {
    epoch: any;
    index: any;
    wallet: any;
    amountWei: any;
    amountGwc: string;
    proof: any;
    claimed: boolean;
    epochStatus: any;
    merkleRoot: any;
    txHash: any;
}[];
/**
 * Get the next epoch number to use.
 */
export declare function getNextEpoch(): number;
//# sourceMappingURL=reward.service.d.ts.map