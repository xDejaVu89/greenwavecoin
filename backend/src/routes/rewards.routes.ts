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

import { Router, Request, Response } from 'express';
import {
  calculateRewards,
  finaliseEpoch,
  markEpochPublished,
  markEpochFailed,
  getClaimsForWallet,
  getNextEpoch,
} from '../services/reward.service';
import { chainService } from '../services/chain.service';
import { requireAdminKey } from '../middleware/auth';
import { validateWalletParam } from '../middleware/validate';

const router = Router();

/**
 * GET /api/rewards/preview
 * Returns what each worker would earn if an epoch were finalised right now.
 */
router.get('/preview', (_req: Request, res: Response) => {
  try {
    const rewards = calculateRewards();
    const totalGwc = rewards.reduce((sum, r) => sum + r.amountGwc, 0);
    res.json({
      preview: true,
      nextEpoch: getNextEpoch(),
      workerCount: rewards.length,
      totalGwc: totalGwc.toFixed(6),
      rewards: rewards.map(r => ({
        wallet: r.wallet,
        tasksCompleted: r.tasksCompleted,
        amountGwc: r.amountGwc,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rewards/chain-status
 * Returns the treasury wallet balance and escrow contract configuration.
 */
router.get('/chain-status', requireAdminKey, async (_req: Request, res: Response) => {
  if (!chainService.isConfigured) {
    return res.json({
      configured: false,
      message: 'Set RPC_URL, TREASURY_PRIVATE_KEY, and ESCROW_ADDRESS in .env to enable on-chain publishing.',
    });
  }
  try {
    const balance = await chainService.getSignerBalance();
    const ownership = await chainService.verifyOwnership();
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rewards/proof?wallet=0x...
 * Returns the best available claim proof for a wallet — formatted for the /claim page.
 * Finds the most recent published epoch with an unclaimed reward for this wallet.
 */
router.get('/proof', (req: Request, res: Response) => {
  const wallet = (req.query.wallet as string || '').toLowerCase();
  if (!wallet || !wallet.startsWith('0x')) {
    return res.status(400).json({ error: 'wallet query parameter is required (0x...)' });
  }
  try {
    const claims = getClaimsForWallet(wallet);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rewards/:wallet
 * Returns all pending and published reward claims for a wallet address,
 * including the Merkle proof needed to claim on-chain.
 */
router.get('/:wallet', validateWalletParam, (req: Request, res: Response) => {
  const { wallet } = req.params;
  try {
    const claims = getClaimsForWallet(wallet);
    const totalPendingGwc = claims
      .filter(c => !c.claimed && c.epochStatus === 'published')
      .reduce((sum, c) => sum + parseFloat(c.amountGwc), 0);
    res.json({
      wallet,
      claims,
      totalPendingGwc: totalPendingGwc.toFixed(6),
      escrowAddress: process.env.ESCROW_ADDRESS || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rewards/finalise-epoch
 * Calculates rewards, builds Merkle tree, stores in DB. Does NOT publish on-chain.
 */
router.post('/finalise-epoch', requireAdminKey, (req: Request, res: Response) => {
  const { sinceTimestamp, untilTimestamp } = req.body || {};
  try {
    const epoch = getNextEpoch();
    const result = finaliseEpoch(epoch, sinceTimestamp, untilTimestamp);
    res.json({
      success: true,
      epoch: result.epoch,
      merkleRoot: result.merkleRoot,
      totalGwc: result.totalGwc.toFixed(6),
      claimCount: result.claims.length,
      message: `Epoch ${epoch} finalised. Call POST /api/rewards/publish-epoch to push on-chain.`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/rewards/publish-epoch
 * Sends the stored Merkle root for the given epoch to the RewardEscrowV2 contract.
 */
router.post('/publish-epoch', requireAdminKey, async (req: Request, res: Response) => {
  const { epoch } = req.body || {};
  if (typeof epoch !== 'number') {
    return res.status(400).json({ error: 'epoch (number) is required' });
  }
  if (!chainService.isConfigured) {
    return res.status(503).json({
      error: 'Chain service not configured. Set RPC_URL, TREASURY_PRIVATE_KEY, and ESCROW_ADDRESS in .env',
    });
  }
  const { db } = await import('../db/database');
  const epochRow = db.prepare('SELECT * FROM reward_epochs WHERE epoch = ?').get(epoch) as any;
  if (!epochRow) {
    return res.status(404).json({ error: `Epoch ${epoch} not found. Run finalise-epoch first.` });
  }
  if (epochRow.status === 'published') {
    return res.status(409).json({ error: `Epoch ${epoch} is already published (tx: ${epochRow.tx_hash})` });
  }
  try {
    const txHash = await chainService.publishMerkleRoot(
      epoch,
      epochRow.merkle_root,
      BigInt(epochRow.total_gwc)
    );
    markEpochPublished(epoch, txHash);
    res.json({
      success: true,
      epoch,
      txHash,
      merkleRoot: epochRow.merkle_root,
      message: `Epoch ${epoch} published on-chain. Workers can now claim their rewards.`,
    });
  } catch (err: any) {
    markEpochFailed(epoch);
    res.status(500).json({ error: err.message });
  }
});

export default router;
