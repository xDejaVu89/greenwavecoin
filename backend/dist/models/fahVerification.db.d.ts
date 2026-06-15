import { FAHVerification } from './fahVerification.model';
export declare class FAHVerificationDatabase {
    /**
     * Save or update a verification
     */
    save(verification: FAHVerification): FAHVerification;
    /**
     * Get verification by wallet address and FAH username
     */
    findByWalletAndUsername(walletAddress: string, fahUsername: string): FAHVerification | undefined;
    /**
     * Get all verifications for a wallet
     */
    findByWallet(walletAddress: string): FAHVerification[];
    /**
     * Get all pending claims (verified but not yet fully claimed)
     */
    getPendingClaims(walletAddress: string): FAHVerification[];
    /**
     * Mark credits as claimed
     */
    markClaimed(walletAddress: string, fahUsername: string, creditsClaimed: number): void;
    /**
     * Get all verifications (for Merkle tree generation)
     */
    getAll(): FAHVerification[];
    /**
     * Get all pending claims across all wallets (for Merkle tree)
     */
    getAllPendingClaims(): FAHVerification[];
    /**
     * Convert database row to FAHVerification object
     */
    private rowToVerification;
    /**
     * Close database connection
     */
    close(): void;
}
export declare const fahVerificationDb: FAHVerificationDatabase;
//# sourceMappingURL=fahVerification.db.d.ts.map