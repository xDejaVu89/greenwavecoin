"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fahVerificationStore = exports.FAHVerificationStore = void 0;
// In-memory storage for now (replace with real database later)
class FAHVerificationStore {
    constructor() {
        this.verifications = new Map();
    }
    /**
     * Save or update a verification
     */
    async save(verification) {
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
    async findByWalletAndUsername(walletAddress, fahUsername) {
        const key = `${walletAddress}-${fahUsername}`.toLowerCase();
        return this.verifications.get(key);
    }
    /**
     * Get all verifications for a wallet
     */
    async findByWallet(walletAddress) {
        const results = [];
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
    async getPendingClaims(walletAddress) {
        const verifications = await this.findByWallet(walletAddress);
        return verifications.filter(v => {
            const claimableCredits = v.totalCredits - v.lastClaimedCredits;
            return v.verified && claimableCredits > 0;
        });
    }
    /**
     * Mark credits as claimed
     */
    async markClaimed(walletAddress, fahUsername, creditsClaimed) {
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
    async getAll() {
        return Array.from(this.verifications.values());
    }
}
exports.FAHVerificationStore = FAHVerificationStore;
// Singleton instance
exports.fahVerificationStore = new FAHVerificationStore();
//# sourceMappingURL=fahVerification.model.js.map