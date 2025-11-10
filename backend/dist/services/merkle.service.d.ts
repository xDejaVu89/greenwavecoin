import MerkleTree from 'merkletreejs';
export interface RewardClaim {
    index: number;
    account: string;
    amount: string;
}
export interface MerkleProof {
    index: number;
    account: string;
    amount: string;
    proof: string[];
}
export declare class MerkleService {
    /**
     * Generate a Merkle tree from reward claims
     */
    static generateTree(claims: RewardClaim[]): MerkleTree;
    /**
     * Get Merkle root from tree
     */
    static getRoot(tree: MerkleTree): string;
    /**
     * Get proof for a specific claim
     */
    static getProof(tree: MerkleTree, claim: RewardClaim): MerkleProof;
    /**
     * Verify a proof against a root
     */
    static verifyProof(proof: MerkleProof, root: string): boolean;
    /**
     * Create a leaf node from claim data
     */
    private static makeLeaf;
}
//# sourceMappingURL=merkle.service.d.ts.map