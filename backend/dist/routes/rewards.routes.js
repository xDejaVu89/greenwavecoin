"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reward_service_1 = require("../services/reward.service");
const chain_service_1 = require("../services/chain.service");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
/**
 * GET /api/rewards/preview
 * Returns what each worker would earn if an epoch were finalised right now.
 */
router.get('/preview', (_req, res) => {
    try {
        const rewards = (0, reward_service_1.calculateRewards)();
        const totalGwc = rewards.reduce((sum, r) => sum + r.amountGwc, 0);
        res.json({
            preview: true,
            nextEpoch: (0, reward_service_1.getNextEpoch)(),
            workerCount: rewards.length,
            totalGwc: totalGwc.toFixed(6),
            rewards: rewards.map(r => ({
                wallet: r.wallet,
                tasksCompleted: r.tasksCompleted,
                amountGwc: r.amountGwc,
            })),
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * GET /api/rewards/chain-status
 * Returns the treasury wallet balance and escrow contract configuration.
 */
router.get('/chain-status', auth_1.requireAdminKey, async (_req, res) => {
    if (!chain_service_1.chainService.isConfigured) {
        return res.json({
            configured: false,
            message: 'Set RPC_URL, TREASURY_PRIVATE_KEY, and ESCROW_ADDRESS in .env to enable on-chain publishing.',
        });
    }
    try {
        const balance = await chain_service_1.chainService.getSignerBalance();
        const ownership = await chain_service_1.chainService.verifyOwnership();
        res.json({
            configured: true,
            escrowAddress: process.env.ESCROW_ADDRESS,
            rpcUrl: process.env.RPC_URL,
            treasury: {
                address: balance.address,
                balanceEth: balance.balanceEth,
                isContractOwner: ownership.isOwner,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * GET /api/rewards/proof?wallet=0x...
 * Returns the best available claim proof for a wallet — formatted for the /claim page.
 * Finds the most recent published epoch with an unclaimed reward for this wallet.
 */
router.get('/proof', (req, res) => {
    const wallet = (req.query.wallet || '').toLowerCase();
    if (!wallet || !wallet.startsWith('0x')) {
        return res.status(400).json({ error: 'wallet query parameter is required (0x...)' });
    }
    try {
        const claims = (0, reward_service_1.getClaimsForWallet)(wallet);
        // Find the most recent published, unclaimed epoch
        const pending = claims
            .filter(c => !c.claimed && c.epochStatus === 'published')
            .sort((a, b) => b.epoch - a.epoch);
        if (pending.length === 0) {
            return res.status(404).json({ error: 'No pending rewards found for this wallet' });
        }
        const best = pending[0];
        return res.json({
            epochId: best.epoch,
            index: best.index,
            cumulativeAmount: best.amountWei,
            amountGwc: best.amountGwc,
            proof: best.proof,
            escrowAddress: process.env.ESCROW_ADDRESS || null,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * GET /api/rewards/:wallet
 * Returns all pending and published reward claims for a wallet address,
 * including the Merkle proof needed to claim on-chain.
 */
router.get('/:wallet', validate_1.validateWalletParam, (req, res) => {
    const { wallet } = req.params;
    try {
        const claims = (0, reward_service_1.getClaimsForWallet)(wallet);
        const totalPendingGwc = claims
            .filter(c => !c.claimed && c.epochStatus === 'published')
            .reduce((sum, c) => sum + parseFloat(c.amountGwc), 0);
        res.json({
            wallet,
            claims,
            totalPendingGwc: totalPendingGwc.toFixed(6),
            escrowAddress: process.env.ESCROW_ADDRESS || null,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * POST /api/rewards/finalise-epoch
 * Calculates rewards, builds Merkle tree, stores in DB. Does NOT publish on-chain.
 */
router.post('/finalise-epoch', auth_1.requireAdminKey, (req, res) => {
    const { sinceTimestamp, untilTimestamp } = req.body || {};
    try {
        const epoch = (0, reward_service_1.getNextEpoch)();
        const result = (0, reward_service_1.finaliseEpoch)(epoch, sinceTimestamp, untilTimestamp);
        res.json({
            success: true,
            epoch: result.epoch,
            merkleRoot: result.merkleRoot,
            totalGwc: result.totalGwc.toFixed(6),
            claimCount: result.claims.length,
            message: `Epoch ${epoch} finalised. Call POST /api/rewards/publish-epoch to push on-chain.`,
        });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
/**
 * POST /api/rewards/publish-epoch
 * Sends the stored Merkle root for the given epoch to the RewardEscrowV2 contract.
 */
router.post('/publish-epoch', auth_1.requireAdminKey, async (req, res) => {
    const { epoch } = req.body || {};
    if (typeof epoch !== 'number') {
        return res.status(400).json({ error: 'epoch (number) is required' });
    }
    if (!chain_service_1.chainService.isConfigured) {
        return res.status(503).json({
            error: 'Chain service not configured. Set RPC_URL, TREASURY_PRIVATE_KEY, and ESCROW_ADDRESS in .env',
        });
    }
    const { db } = await Promise.resolve().then(() => __importStar(require('../db/database')));
    const epochRow = db.prepare('SELECT * FROM reward_epochs WHERE epoch = ?').get(epoch);
    if (!epochRow) {
        return res.status(404).json({ error: `Epoch ${epoch} not found. Run finalise-epoch first.` });
    }
    if (epochRow.status === 'published') {
        return res.status(409).json({ error: `Epoch ${epoch} is already published (tx: ${epochRow.tx_hash})` });
    }
    try {
        const txHash = await chain_service_1.chainService.publishMerkleRoot(epoch, epochRow.merkle_root, BigInt(epochRow.total_gwc));
        (0, reward_service_1.markEpochPublished)(epoch, txHash);
        res.json({
            success: true,
            epoch,
            txHash,
            merkleRoot: epochRow.merkle_root,
            message: `Epoch ${epoch} published on-chain. Workers can now claim their rewards.`,
        });
    }
    catch (err) {
        (0, reward_service_1.markEpochFailed)(epoch);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=rewards.routes.js.map