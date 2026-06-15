/**
 * GreenWaveCoin — Rewards API Routes
 * ====================================
 * Connects the reward distribution service to the HTTP API.
 *
 * Public endpoints (no auth required):
 *   GET  /api/rewards/:wallet          — Get pending reward claims + proofs for a wallet
 *   GET  /api/rewards/preview          — Preview rewards for the next epoch (dry run)
 *
 * Admin endpoints (ADMIN_API_KEY required):
 *   POST /api/rewards/finalise-epoch   — Calculate rewards, build Merkle tree, store in DB
 *   POST /api/rewards/publish-epoch    — Push Merkle root to the on-chain contract
 *   GET  /api/rewards/chain-status     — Check treasury wallet balance and contract status
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=rewards.routes.d.ts.map