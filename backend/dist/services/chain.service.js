"use strict";
/**
 * GreenWaveCoin — On-Chain Publisher Service
 * ============================================
 * Handles all interactions with the RewardEscrowV2 smart contract.
 * Publishes Merkle roots on-chain after each epoch is finalised.
 *
 * Environment variables required:
 *   RPC_URL             — Ethereum/L2 JSON-RPC endpoint
 *   TREASURY_PRIVATE_KEY — Private key of the treasury/owner wallet
 *   ESCROW_ADDRESS      — Deployed RewardEscrowV2 contract address
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.chainService = exports.ChainService = void 0;
const ethers_1 = require("ethers");
// ---------------------------------------------------------------------------
// RewardEscrowV2 ABI (minimal — only what we need)
// ---------------------------------------------------------------------------
const ESCROW_ABI = [
    'function setMerkleRoot(uint256 epoch, bytes32 root, uint256 total) external',
    'function merkleRoots(uint256 epoch) external view returns (bytes32)',
    'function epochTotals(uint256 epoch) external view returns (uint256)',
    'function owner() external view returns (address)',
    'event MerkleRootSet(uint256 indexed epoch, bytes32 root, uint256 total)',
];
// ---------------------------------------------------------------------------
// Chain service class
// ---------------------------------------------------------------------------
class ChainService {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.escrow = null;
        this.rpcUrl = process.env.RPC_URL || '';
        this.privateKey = process.env.TREASURY_PRIVATE_KEY || '';
        this.escrowAddress = process.env.ESCROW_ADDRESS || '';
    }
    get isConfigured() {
        return !!(this.rpcUrl && this.privateKey && this.escrowAddress);
    }
    connect() {
        if (this.escrow)
            return; // already connected
        if (!this.isConfigured) {
            throw new Error('Chain service not configured. Set RPC_URL, TREASURY_PRIVATE_KEY, and ESCROW_ADDRESS in .env');
        }
        this.provider = new ethers_1.ethers.JsonRpcProvider(this.rpcUrl);
        this.signer = new ethers_1.ethers.Wallet(this.privateKey, this.provider);
        this.escrow = new ethers_1.ethers.Contract(this.escrowAddress, ESCROW_ABI, this.signer);
    }
    /**
     * Verify that the signer is the contract owner before attempting to publish.
     */
    async verifyOwnership() {
        this.connect();
        const signerAddress = await this.signer.getAddress();
        const ownerAddress = await this.escrow.owner();
        return {
            isOwner: signerAddress.toLowerCase() === ownerAddress.toLowerCase(),
            signerAddress,
            ownerAddress,
        };
    }
    /**
     * Publish a Merkle root for a given epoch to the RewardEscrowV2 contract.
     * Returns the transaction hash on success.
     */
    async publishMerkleRoot(epoch, merkleRoot, totalWei) {
        this.connect();
        // Check ownership first
        const { isOwner, signerAddress, ownerAddress } = await this.verifyOwnership();
        if (!isOwner) {
            throw new Error(`Signer ${signerAddress} is not the contract owner (${ownerAddress}). ` +
                `Ensure TREASURY_PRIVATE_KEY corresponds to the owner wallet.`);
        }
        // Check if epoch already has a root set
        const existingRoot = await this.escrow.merkleRoots(epoch);
        if (existingRoot !== ethers_1.ethers.ZeroHash) {
            throw new Error(`Epoch ${epoch} already has a Merkle root set on-chain: ${existingRoot}`);
        }
        console.log(`[CHAIN] Publishing epoch ${epoch} root: ${merkleRoot}`);
        console.log(`[CHAIN] Total rewards: ${ethers_1.ethers.formatEther(totalWei)} GWC`);
        // Estimate gas first to catch errors early
        const gasEstimate = await this.escrow.setMerkleRoot.estimateGas(epoch, merkleRoot, totalWei);
        console.log(`[CHAIN] Estimated gas: ${gasEstimate.toString()}`);
        // Send transaction with 20% gas buffer
        const tx = await this.escrow.setMerkleRoot(epoch, merkleRoot, totalWei, {
            gasLimit: (gasEstimate * 120n) / 100n,
        });
        console.log(`[CHAIN] Transaction sent: ${tx.hash}`);
        // Wait for confirmation
        const receipt = await tx.wait(1);
        if (!receipt || receipt.status !== 1) {
            throw new Error(`Transaction ${tx.hash} failed or was reverted`);
        }
        console.log(`[CHAIN] Epoch ${epoch} root confirmed in block ${receipt.blockNumber}`);
        return tx.hash;
    }
    /**
     * Get the current on-chain Merkle root for an epoch.
     */
    async getOnChainRoot(epoch) {
        this.connect();
        return await this.escrow.merkleRoots(epoch);
    }
    /**
     * Get the signer's ETH balance (to check if it has gas money).
     */
    async getSignerBalance() {
        this.connect();
        const address = await this.signer.getAddress();
        const balance = await this.provider.getBalance(address);
        return {
            address,
            balanceEth: ethers_1.ethers.formatEther(balance),
        };
    }
}
exports.ChainService = ChainService;
exports.chainService = new ChainService();
//# sourceMappingURL=chain.service.js.map