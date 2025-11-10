import { Router, Request, Response } from 'express';
import { MerkleService, RewardClaim } from '../services/merkle.service';

const router = Router();

/**
 * GET /api/rewards/:address
 * Get pending rewards and proofs for an address
 */
router.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    // TODO: Query database for user's pending rewards
    // For now, return mock data
    res.json({
      address,
      pendingRewards: [
        {
          epoch: 1,
          amount: '10000000000000000000', // 10 GWC
          proof: [],
          claimed: false,
        },
      ],
    });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

/**
 * POST /api/rewards/calculate
 * Calculate rewards for an epoch (admin only)
 */
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { epoch, claims } = req.body;

    // TODO: Add authentication/authorization
    // TODO: Validate claims data

    // Generate Merkle tree
    const tree = MerkleService.generateTree(claims as RewardClaim[]);
    const root = MerkleService.getRoot(tree);

    // TODO: Store tree and proofs in database
    // TODO: Publish root to blockchain via Timelock

    res.json({
      epoch,
      root,
      totalClaims: claims.length,
      message: 'Merkle root generated successfully',
    });
  } catch (error) {
    console.error('Error calculating rewards:', error);
    res.status(500).json({ error: 'Failed to calculate rewards' });
  }
});

export default router;
