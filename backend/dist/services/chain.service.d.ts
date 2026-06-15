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
export declare class ChainService {
    private provider;
    private signer;
    private escrow;
    private readonly rpcUrl;
    private readonly privateKey;
    private readonly escrowAddress;
    constructor();
    get isConfigured(): boolean;
    private connect;
    /**
     * Verify that the signer is the contract owner before attempting to publish.
     */
    verifyOwnership(): Promise<{
        isOwner: boolean;
        signerAddress: string;
        ownerAddress: string;
    }>;
    /**
     * Publish a Merkle root for a given epoch to the RewardEscrowV2 contract.
     * Returns the transaction hash on success.
     */
    publishMerkleRoot(epoch: number, merkleRoot: string, totalWei: bigint): Promise<string>;
    /**
     * Get the current on-chain Merkle root for an epoch.
     */
    getOnChainRoot(epoch: number): Promise<string>;
    /**
     * Get the signer's ETH balance (to check if it has gas money).
     */
    getSignerBalance(): Promise<{
        address: string;
        balanceEth: string;
    }>;
}
export declare const chainService: ChainService;
//# sourceMappingURL=chain.service.d.ts.map