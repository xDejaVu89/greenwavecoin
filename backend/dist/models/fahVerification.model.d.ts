export interface FAHVerification {
    id: string;
    walletAddress: string;
    fahUsername: string;
    totalCredits: number;
    workUnits: number;
    lastClaimedCredits: number;
    rewardAmount: string;
    merkleProof?: string[];
    verified: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class FAHVerificationStore {
    private verifications;
    /**
     * Save or update a verification
     */
    save(verification: FAHVerification): Promise<FAHVerification>;
    /**
     * Get verification by wallet address and FAH username
     */
    findByWalletAndUsername(walletAddress: string, fahUsername: string): Promise<FAHVerification | undefined>;
    /**
     * Get all verifications for a wallet
     */
    findByWallet(walletAddress: string): Promise<FAHVerification[]>;
    /**
     * Get all pending claims (verified but not yet claimed)
     */
    getPendingClaims(walletAddress: string): Promise<FAHVerification[]>;
    /**
     * Mark credits as claimed
     */
    markClaimed(walletAddress: string, fahUsername: string, creditsClaimed: number): Promise<void>;
    /**
     * Get all verifications (for Merkle tree generation)
     */
    getAll(): Promise<FAHVerification[]>;
}
export declare const fahVerificationStore: FAHVerificationStore;
//# sourceMappingURL=fahVerification.model.d.ts.map