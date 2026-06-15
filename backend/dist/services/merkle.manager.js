"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merkleTreeManager = void 0;
const merkle_service_1 = require("../services/merkle.service");
const fahVerification_db_1 = require("../models/fahVerification.db");
/**
 * Global Merkle tree manager
 * Rebuilds tree whenever claims are updated
 */
class MerkleTreeManager {
    constructor() {
        this.currentRoot = null;
        this.lastBuilt = null;
        this.merkleService = new merkle_service_1.MerkleService();
    }
    /**
     * Build/rebuild the Merkle tree from all pending claims
     */
    async buildTree() {
        console.log('🌳 Building Merkle tree from all pending claims...');
        // Get all pending claims from database
        const allPendingClaims = fahVerification_db_1.fahVerificationDb.getAllPendingClaims();
        if (allPendingClaims.length === 0) {
            console.log('⚠️ No pending claims found, cannot build tree');
            return { root: '0x0000000000000000000000000000000000000000000000000000000000000000', claimCount: 0 };
        }
        // Convert to RewardClaim format with proper indexing
        const claims = allPendingClaims.map((claim, index) => {
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
        const tree = merkle_service_1.MerkleService.generateTree(claims);
        this.currentRoot = merkle_service_1.MerkleService.getRoot(tree);
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
    async getProof(walletAddress, fahUsername) {
        // Rebuild tree if needed (should be called periodically or on claim updates)
        if (!this.currentRoot) {
            await this.buildTree();
        }
        // Find the verification
        const verification = fahVerification_db_1.fahVerificationDb.findByWalletAndUsername(walletAddress, fahUsername);
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
        const allPendingClaims = fahVerification_db_1.fahVerificationDb.getAllPendingClaims();
        const claimIndex = allPendingClaims.findIndex(c => c.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
            c.fahUsername.toLowerCase() === fahUsername.toLowerCase());
        if (claimIndex === -1) {
            return {
                success: false,
                error: 'Claim not found in tree'
            };
        }
        const rewardAmount = (claimableCredits / 1000).toFixed(18);
        const claim = {
            index: claimIndex,
            account: walletAddress,
            amount: rewardAmount
        };
        // Generate tree and get proof
        const tree = merkle_service_1.MerkleService.generateTree(allPendingClaims.map((c, idx) => {
            const claimableAmount = c.totalCredits - c.lastClaimedCredits;
            return {
                index: idx,
                account: c.walletAddress,
                amount: (claimableAmount / 1000).toFixed(18)
            };
        }));
        const merkleProof = merkle_service_1.MerkleService.getProof(tree, claim);
        return {
            success: true,
            proof: merkleProof.proof,
            root: this.currentRoot,
            index: claimIndex,
            amount: rewardAmount
        };
    }
    /**
     * Get current Merkle root
     */
    getCurrentRoot() {
        return this.currentRoot;
    }
    /**
     * Force rebuild of tree (call after claims are updated)
     */
    async rebuild() {
        await this.buildTree();
    }
}
// Singleton instance
exports.merkleTreeManager = new MerkleTreeManager();
//# sourceMappingURL=merkle.manager.js.map