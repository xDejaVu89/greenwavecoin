"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerkleService = void 0;
const merkletreejs_1 = __importDefault(require("merkletreejs"));
const keccak256_1 = __importDefault(require("keccak256"));
const ethers_1 = require("ethers");
class MerkleService {
    /**
     * Generate a Merkle tree from reward claims
     */
    static generateTree(claims) {
        const leaves = claims.map((claim) => this.makeLeaf(claim.index, claim.account, claim.amount));
        return new merkletreejs_1.default(leaves, keccak256_1.default, { sortPairs: true });
    }
    /**
     * Get Merkle root from tree
     */
    static getRoot(tree) {
        return tree.getHexRoot();
    }
    /**
     * Get proof for a specific claim
     */
    static getProof(tree, claim) {
        const leaf = this.makeLeaf(claim.index, claim.account, claim.amount);
        const proof = tree.getHexProof(leaf);
        return {
            index: claim.index,
            account: claim.account,
            amount: claim.amount,
            proof,
        };
    }
    /**
     * Verify a proof against a root
     */
    static verifyProof(proof, root) {
        const leaf = this.makeLeaf(proof.index, proof.account, proof.amount);
        const tree = new merkletreejs_1.default([], keccak256_1.default, { sortPairs: true });
        return tree.verify(proof.proof, leaf, root);
    }
    /**
     * Create a leaf node from claim data
     */
    static makeLeaf(index, account, amount) {
        // Convert amount to wei (BigInt) for proper Solidity encoding
        const amountWei = ethers_1.ethers.parseEther(amount);
        const hash = ethers_1.ethers.solidityPackedKeccak256(['uint256', 'address', 'uint256'], [index, account, amountWei]);
        return Buffer.from(hash.slice(2), 'hex');
    }
}
exports.MerkleService = MerkleService;
//# sourceMappingURL=merkle.service.js.map