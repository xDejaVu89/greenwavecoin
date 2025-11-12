import { MerkleService, RewardClaim } from '../services/merkle.service';
import { fahVerificationDb } from '../models/fahVerification.db';

/**
 * Global Merkle tree manager
 * Rebuilds tree whenever claims are updated
 */
class MerkleTreeManager {
  private merkleService: MerkleService;
  private currentRoot: string | null = null;
  private lastBuilt: Date | null = null;

  constructor() {
    this.merkleService = new MerkleService();
  }

  /**
   * Build/rebuild the Merkle tree from all pending claims
   */
  async buildTree(): Promise<{ root: string; claimCount: number }> {
    console.log('🌳 Building Merkle tree from all pending claims...');
    
    // Get all pending claims from database
    const allPendingClaims = fahVerificationDb.getAllPendingClaims();
    
    if (allPendingClaims.length === 0) {
      console.log('⚠️ No pending claims found, cannot build tree');
      return { root: '0x0000000000000000000000000000000000000000000000000000000000000000', claimCount: 0 };
    }

    // Convert to RewardClaim format with proper indexing
    const claims: RewardClaim[] = allPendingClaims.map((claim, index) => {
      // No cap - allow full credit claiming
      const claimableCredits = claim.totalCredits - claim.lastClaimedCredits;
      const rewardAmount = (claimableCredits / 1000).toFixed(18); // 18 decimals for wei conversion
      
      return {
        index,
        account: claim.walletAddress,
        amount: rewardAmount
      };
    });

    // Generate tree
    const tree = MerkleService.generateTree(claims);
    this.currentRoot = MerkleService.getRoot(tree);
    this.lastBuilt = new Date();

    console.log(`✅ Merkle tree built with ${claims.length} claims`);
    console.log(`📜 Root: ${this.currentRoot}`);
    console.log(`⏰ Built at: ${this.lastBuilt.toISOString()}`);

    return {
      root: this.currentRoot,
      claimCount: claims.length
    };
  }

  /**
   * Get proof for a specific wallet and username
   */
  async getProof(walletAddress: string, fahUsername: string): Promise<{
    success: boolean;
    proof?: string[];
    root?: string;
    index?: number;
    amount?: string;
    error?: string;
  }> {
    // Rebuild tree if needed (should be called periodically or on claim updates)
    if (!this.currentRoot) {
      await this.buildTree();
    }

    // Find the verification
    const verification = fahVerificationDb.findByWalletAndUsername(walletAddress, fahUsername);
    
    if (!verification) {
      return {
        success: false,
        error: 'No verification found for this wallet and username'
      };
    }

    // No cap - allow full credit claiming
    const claimableCredits = verification.totalCredits - verification.lastClaimedCredits;
    
    if (claimableCredits <= 0) {
      return {
        success: false,
        error: 'No claimable rewards available'
      };
    }

    // Get all pending claims to find index
    const allPendingClaims = fahVerificationDb.getAllPendingClaims();
    const claimIndex = allPendingClaims.findIndex(
      c => c.walletAddress.toLowerCase() === walletAddress.toLowerCase() && 
           c.fahUsername.toLowerCase() === fahUsername.toLowerCase()
    );

    if (claimIndex === -1) {
      return {
        success: false,
        error: 'Claim not found in tree'
      };
    }

  const rewardAmount = (claimableCredits / 1000).toFixed(18);
    const claim: RewardClaim = {
      index: claimIndex,
      account: walletAddress,
      amount: rewardAmount
    };

    // Generate tree and get proof
    const tree = MerkleService.generateTree(
      allPendingClaims.map((c, idx) => {
        const claimableAmount = c.totalCredits - c.lastClaimedCredits;
        return {
          index: idx,
          account: c.walletAddress,
          amount: (claimableAmount / 1000).toFixed(18)
        };
      })
    );

    const merkleProof = MerkleService.getProof(tree, claim);

    return {
      success: true,
      proof: merkleProof.proof,
      root: this.currentRoot!,
      index: claimIndex,
      amount: rewardAmount
    };
  }

  /**
   * Get current Merkle root
   */
  getCurrentRoot(): string | null {
    return this.currentRoot;
  }

  /**
   * Force rebuild of tree (call after claims are updated)
   */
  async rebuild(): Promise<void> {
    await this.buildTree();
  }
}

// Singleton instance
export const merkleTreeManager = new MerkleTreeManager();
