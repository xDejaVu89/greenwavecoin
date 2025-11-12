import MerkleTree from 'merkletreejs';
import keccak256 from 'keccak256';
import { ethers } from 'ethers';

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

export class MerkleService {
  /**
   * Generate a Merkle tree from reward claims
   */
  static generateTree(claims: RewardClaim[]): MerkleTree {
    const leaves = claims.map((claim) =>
      this.makeLeaf(claim.index, claim.account, claim.amount)
    );
    return new MerkleTree(leaves, keccak256, { sortPairs: true });
  }

  /**
   * Get Merkle root from tree
   */
  static getRoot(tree: MerkleTree): string {
    return tree.getHexRoot();
  }

  /**
   * Get proof for a specific claim
   */
  static getProof(tree: MerkleTree, claim: RewardClaim): MerkleProof {
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
  static verifyProof(proof: MerkleProof, root: string): boolean {
    const leaf = this.makeLeaf(proof.index, proof.account, proof.amount);
    const tree = new MerkleTree([], keccak256, { sortPairs: true });
    return tree.verify(proof.proof, leaf, root);
  }

  /**
   * Create a leaf node from claim data
   */
  private static makeLeaf(index: number, account: string, amount: string): Buffer {
    // Convert amount to wei (BigInt) for proper Solidity encoding
    const amountWei = ethers.parseEther(amount);
    const hash = ethers.solidityPackedKeccak256(
      ['uint256', 'address', 'uint256'],
      [index, account, amountWei]
    );
    return Buffer.from(hash.slice(2), 'hex');
  }
}
