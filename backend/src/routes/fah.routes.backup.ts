import { Router, Request, Response } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { fahVerificationDb } from '../models/fahVerification.db';

const router = Router();

interface FAHUser {
  name: string;
  score: number;
  wus: number;
  teams: number[];
}

interface FAHVerificationRequest {
  username: string;
  walletAddress: string;
}

interface FAHVerificationResponse {
  success: boolean;
  username: string;
  totalCredits: number;
  workUnits: number;
  rewardAmount: string;
  lastUpdated: string;
  error?: string;
}

router.post('/verify-workunit', async (req: Request, res: Response) => {
  try {
    const { username, walletAddress }: FAHVerificationRequest = req.body;

    if (!username || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Username and wallet address are required'
      });
    }

    const fahApiUrl = `https://stats.foldingathome.org/api/donor/${encodeURIComponent(username)}`;
    
    console.log(`Fetching FAH stats for user: ${username}`);
    const response = await axios.get(fahApiUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'GreenWaveCoin/1.0'
      }
    });

    if (!response.data) {
      return res.status(404).json({
        success: false,
        error: 'User not found in Folding@Home database'
      });
    }

    const userData: FAHUser = response.data;
    const totalCredits = userData.score || 0;
    const workUnits = userData.wus || 0;

    let existingVerification = fahVerificationDb.findByWalletAndUsername(
      walletAddress,
      username
    );

    let lastClaimedCredits = existingVerification?.lastClaimedCredits || 0;
    let claimableCredits = totalCredits - lastClaimedCredits;
    const rewardAmount = (claimableCredits / 1000).toFixed(4);

    fahVerificationDb.save({
      id: existingVerification?.id || uuidv4(),
      walletAddress,
      fahUsername: userData.name,
      totalCredits,
      workUnits,
      lastClaimedCredits,
      rewardAmount,
      verified: true,
      createdAt: existingVerification?.createdAt || new Date(),
      updatedAt: new Date()
    });

    console.log(`Verified FAH user ${username}: ${totalCredits} total credits, ${claimableCredits} claimable = ${rewardAmount} GWC`);
    
    return res.json({
      success: true,
      username: userData.name,
      totalCredits,
      workUnits,
      rewardAmount,
      lastUpdated: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('FAH verification error:', error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Folding@Home username not found. Make sure you have completed at least one work unit.'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to verify Folding@Home contributions'
    });
  }
});

router.get('/stats/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username is required'
      });
    }

    const fahApiUrl = `https://stats.foldingathome.org/api/donor/${encodeURIComponent(username)}`;
    
    const response = await axios.get(fahApiUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'GreenWaveCoin/1.0'
      }
    });

    if (!response.data) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userData: FAHUser = response.data;

    return res.json({
      success: true,
      username: userData.name,
      totalCredits: userData.score || 0,
      workUnits: userData.wus || 0,
      teams: userData.teams || [],
      potentialReward: ((userData.score || 0) / 1000).toFixed(4) + ' GWC'
    });

  } catch (error: any) {
    console.error('FAH stats error:', error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Username not found'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch FAH stats'
    });
  }
});

router.get('/claims/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required'
      });
    }

    const pendingClaims = fahVerificationDb.getPendingClaims(walletAddress);

    const claimsWithDetails = pendingClaims.map(claim => {
      const claimableCredits = claim.totalCredits - claim.lastClaimedCredits;
      const claimableReward = (claimableCredits / 1000).toFixed(4);
      
      return {
        username: claim.fahUsername,
        totalCredits: claim.totalCredits,
        lastClaimedCredits: claim.lastClaimedCredits,
        claimableCredits,
        claimableReward: `${claimableReward} GWC`,
        verified: claim.verified,
        lastUpdated: claim.updatedAt.toISOString()
      };
    });

    return res.json({
      success: true,
      walletAddress,
      totalPendingReward: claimsWithDetails.reduce((sum, claim) => 
        sum + parseFloat(claim.claimableReward), 0
      ).toFixed(4) + ' GWC',
      claims: claimsWithDetails
    });

  } catch (error: any) {
    console.error('Get claims error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch pending claims'
    });
  }
});


/**
 * Get Merkle proof for claiming rewards
 * GET /api/fah/proof/:walletAddress/:fahUsername
 */
router.get('/proof/:walletAddress/:fahUsername', async (req: Request, res: Response) => {
  try {
    const { walletAddress, fahUsername } = req.params;

    if (!walletAddress || !fahUsername) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address and FAH username are required'
      });
    }

    const verification = fahVerificationDb.findByWalletAndUsername(walletAddress, fahUsername);

    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'No verification found for this wallet and username'
      });
    }

    const claimableCredits = verification.totalCredits - verification.lastClaimedCredits;

    if (claimableCredits <= 0) {
      return res.status(400).json({
        success: false,
        error: 'No claimable rewards available'
      });
    }

    // For now, return a simple proof structure
    // TODO: Implement actual Merkle tree generation across all users
    const rewardAmount = (claimableCredits / 1000).toFixed(4);

    return res.json({
      success: true,
      walletAddress,
      fahUsername,
      rewardAmount,
      claimableCredits,
      proof: [],
      merkleRoot: '0x0000000000000000000000000000000000000000000000000000000000000000'
    });

  } catch (error: any) {
    console.error('Get proof error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate proof'
    });
  }
});

export default router;

