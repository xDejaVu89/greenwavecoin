/**
 * Backend API service for FAH verification
 */

const BACKEND_URL = 'http://localhost:3000';

export interface FAHVerificationResult {
  success: boolean;
  username: string;
  totalCredits: number;
  workUnits: number;
  rewardAmount: string;
  lastUpdated: string;
  error?: string;
}

export interface PendingClaim {
  username: string;
  totalCredits: number;
  lastClaimedCredits: number;
  claimableCredits: number;
  claimableReward: string;
  verified: boolean;
  lastUpdated: string;
}

export interface PendingClaimsResponse {
  success: boolean;
  walletAddress: string;
  totalPendingReward: string;
  claims: PendingClaim[];
  error?: string;
}

export interface FAHStatsResponse {
  success: boolean;
  username: string;
  totalCredits: number;
  workUnits: number;
  teams: number[];
  potentialReward: string;
  error?: string;
}

export interface MerkleProofResponse {
  success: boolean;
  walletAddress: string;
  fahUsername: string;
  proof: string[];
  merkleRoot: string;
  index: number;
  amount: string;
  claimableCredits: number;
  error?: string;
}



async function pingHealth(timeoutMs = 600): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('http://localhost:3000/health', { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

class BackendService {
  /**
   * Verify FAH contributions for a user
   */
  async verifyFAHContributions(
    username: string,
    walletAddress: string
  ): Promise<FAHVerificationResult> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/fah/verify-workunit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, walletAddress }),
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('FAH verification error:', error);
      return {
        success: false,
        username,
        totalCredits: 0,
        workUnits: 0,
        rewardAmount: '0',
        lastUpdated: new Date().toISOString(),
        error: error.message || 'Failed to verify FAH contributions',
      };
    }
  }

  /**
   * Get FAH stats for a username
   */
  async getFAHStats(username: string): Promise<FAHStatsResponse> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/fah/stats/${encodeURIComponent(username)}`);
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('FAH stats error:', error);
      return {
        success: false,
        username,
        totalCredits: 0,
        workUnits: 0,
        teams: [],
        potentialReward: '0 GWC',
        error: error.message || 'Failed to fetch FAH stats',
      };
    }
  }

  /**
   * Get pending claims for a wallet
   */
  async getPendingClaims(walletAddress: string): Promise<PendingClaimsResponse> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/fah/claims/${walletAddress}`);
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Get pending claims error:', error);
      return {
        success: false,
        walletAddress,
        totalPendingReward: '0 GWC',
        claims: [],
        error: error.message || 'Failed to fetch pending claims',
      };
    }
  }

  /**
   * Get Merkle proof for claiming rewards
   */
  async getMerkleProof(walletAddress: string, fahUsername: string): Promise<MerkleProofResponse> {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/fah/proof/${walletAddress}/${encodeURIComponent(fahUsername)}`
      );
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Get merkle proof error:', error);
      return {
        success: false,
        walletAddress,
        fahUsername,
        proof: [],
        merkleRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
        index: 0,
        amount: '0',
        claimableCredits: 0,
        error: error.message || 'Failed to get merkle proof',
      };
    }
  }

  /**
   * Test backend connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      const data = await response.json();
      return data.status === 'ok';
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  }
}

export const backendService = new BackendService();

