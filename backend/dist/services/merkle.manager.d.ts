/**
 * Global Merkle tree manager
 * Rebuilds tree whenever claims are updated
 */
declare class MerkleTreeManager {
    private merkleService;
    private currentRoot;
    private lastBuilt;
    constructor();
    /**
     * Build/rebuild the Merkle tree from all pending claims
     */
    buildTree(): Promise<{
        root: string;
        claimCount: number;
    }>;
    /**
     * Get proof for a specific wallet and username
     */
    getProof(walletAddress: string, fahUsername: string): Promise<{
        success: boolean;
        proof?: string[];
        root?: string;
        index?: number;
        amount?: string;
        error?: string;
    }>;
    /**
     * Get current Merkle root
     */
    getCurrentRoot(): string | null;
    /**
     * Force rebuild of tree (call after claims are updated)
     */
    rebuild(): Promise<void>;
}
export declare const merkleTreeManager: MerkleTreeManager;
export {};
//# sourceMappingURL=merkle.manager.d.ts.map