export interface FAHVerification {
  id: string;
  walletAddress: string;
  fahUsername: string;
  totalCredits: number;
  workUnits: number;
  lastClaimedCredits: number;
  rewardAmount: string; // GWC tokens
  merkleProof?: string[];
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage for now (replace with real database later)
export class FAHVerificationStore {
  private verifications: Map<string, FAHVerification> = new Map();

  /**
   * Save or update a verification
   */
  async save(verification: FAHVerification): Promise<FAHVerification> {
    const key = `${verification.walletAddress}-${verification.fahUsername}`.toLowerCase();
    this.verifications.set(key, {
      ...verification,
      updatedAt: new Date()
    });
    return verification;
  }

  /**
   * Get verification by wallet address and FAH username
   */
  async findByWalletAndUsername(
    walletAddress: string,
    fahUsername: string
  ): Promise<FAHVerification | undefined> {
    const key = `${walletAddress}-${fahUsername}`.toLowerCase();
    return this.verifications.get(key);
  }

  /**
   * Get all verifications for a wallet
   */
  async findByWallet(walletAddress: string): Promise<FAHVerification[]> {
    const results: FAHVerification[] = [];
    for (const [key, verification] of this.verifications.entries()) {
      if (verification.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
        results.push(verification);
      }
    }
    return results;
  }

  /**
   * Get all pending claims (verified but not yet claimed)
   */
  async getPendingClaims(walletAddress: string): Promise<FAHVerification[]> {
    const verifications = await this.findByWallet(walletAddress);
    return verifications.filter(v => {
      const claimableCredits = v.totalCredits - v.lastClaimedCredits;
      return v.verified && claimableCredits > 0;
    });
  }

  /**
   * Mark credits as claimed
   */
  async markClaimed(
    walletAddress: string,
    fahUsername: string,
    creditsClaimed: number
  ): Promise<void> {
    const verification = await this.findByWalletAndUsername(walletAddress, fahUsername);
    if (verification) {
      verification.lastClaimedCredits += creditsClaimed;
      verification.updatedAt = new Date();
      await this.save(verification);
    }
  }

  /**
   * Get all verifications (for Merkle tree generation)
   */
  async getAll(): Promise<FAHVerification[]> {
    return Array.from(this.verifications.values());
  }
}

// Singleton instance
export const fahVerificationStore = new FAHVerificationStore();
