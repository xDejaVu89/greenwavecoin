"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const fahVerification_db_1 = require("../models/fahVerification.db");
const router = (0, express_1.Router)();
router.post('/verify-workunit', async (req, res) => {
    try {
        const { username, walletAddress } = req.body;
        if (!username || !walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'Username and wallet address are required'
            });
        }
        const fahApiUrl = `https://stats.foldingathome.org/api/donor/${encodeURIComponent(username)}`;
        console.log(`Fetching FAH stats for user: ${username}`);
        const response = await axios_1.default.get(fahApiUrl, {
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
        const userData = response.data;
        const totalCredits = userData.score || 0;
        const workUnits = userData.wus || 0;
        let existingVerification = fahVerification_db_1.fahVerificationDb.findByWalletAndUsername(walletAddress, username);
        let lastClaimedCredits = existingVerification?.lastClaimedCredits || 0;
        let claimableCredits = totalCredits - lastClaimedCredits;
        const rewardAmount = (claimableCredits / 1000).toFixed(4);
        fahVerification_db_1.fahVerificationDb.save({
            id: existingVerification?.id || (0, uuid_1.v4)(),
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
    }
    catch (error) {
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
router.get('/stats/:username', async (req, res) => {
    try {
        const { username } = req.params;
        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Username is required'
            });
        }
        const fahApiUrl = `https://stats.foldingathome.org/api/donor/${encodeURIComponent(username)}`;
        const response = await axios_1.default.get(fahApiUrl, {
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
        const userData = response.data;
        return res.json({
            success: true,
            username: userData.name,
            totalCredits: userData.score || 0,
            workUnits: userData.wus || 0,
            teams: userData.teams || [],
            potentialReward: ((userData.score || 0) / 1000).toFixed(4) + ' GWC'
        });
    }
    catch (error) {
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
router.get('/claims/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'Wallet address is required'
            });
        }
        const pendingClaims = fahVerification_db_1.fahVerificationDb.getPendingClaims(walletAddress);
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
            totalPendingReward: claimsWithDetails.reduce((sum, claim) => sum + parseFloat(claim.claimableReward), 0).toFixed(4) + ' GWC',
            claims: claimsWithDetails
        });
    }
    catch (error) {
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
router.get('/proof/:walletAddress/:fahUsername', async (req, res) => {
    try {
        const { walletAddress, fahUsername } = req.params;
        if (!walletAddress || !fahUsername) {
            return res.status(400).json({
                success: false,
                error: 'Wallet address and FAH username are required'
            });
        }
        const verification = fahVerification_db_1.fahVerificationDb.findByWalletAndUsername(walletAddress, fahUsername);
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
    }
    catch (error) {
        console.error('Get proof error:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate proof'
        });
    }
});
exports.default = router;
//# sourceMappingURL=fah.routes.backup.js.map