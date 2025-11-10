// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IStakingRequirement } from "./IStakingRequirement.sol";

/**
 * @title RewardEscrowV2
 * @notice Merkle-claim escrow for GWC compute rewards with optional staking requirement.
 */
contract RewardEscrowV2 is Ownable {
    IERC20 public immutable token;
    IStakingRequirement public stakingRequirement;
    // epoch => merkle root
    mapping(uint256 => bytes32) public merkleRoots;
    // epoch => total rewards allocated
    mapping(uint256 => uint256) public epochTotals;
    // epoch => claimed bitmap
    mapping(uint256 => mapping(uint256 => uint256)) private claimedBitMap;

    event MerkleRootSet(uint256 indexed epoch, bytes32 root, uint256 total);
    event Claimed(uint256 indexed epoch, uint256 indexed index, address indexed account, uint256 amount);
    event StakingRequirementSet(address indexed stakingContract);

    constructor(address token_) {
        require(token_ != address(0), "token required");
        token = IERC20(token_);
    }

    function setMerkleRoot(uint256 epoch, bytes32 root, uint256 total) external onlyOwner {
        require(root != bytes32(0), "root required");
        require(epochTotals[epoch] == 0, "epoch already set");
        merkleRoots[epoch] = root;
        epochTotals[epoch] = total;
        emit MerkleRootSet(epoch, root, total);
    }

    function setStakingRequirement(address stakingContract) external onlyOwner {
        stakingRequirement = IStakingRequirement(stakingContract);
        emit StakingRequirementSet(stakingContract);
    }

    function isClaimed(uint256 epoch, uint256 index) public view returns (bool) {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        return (claimedBitMap[epoch][wordIndex] & (1 << bitIndex)) != 0;
    }

    function _setClaimed(uint256 epoch, uint256 index) private {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        claimedBitMap[epoch][wordIndex] |= (1 << bitIndex);
    }

    function claim(
        uint256 epoch,
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        require(!isClaimed(epoch, index), "already claimed");
        require(merkleRoots[epoch] != bytes32(0), "root not set");
        if (address(stakingRequirement) != address(0)) {
            require(stakingRequirement.hasMinimumStake(account), "stake required");
        }
        // Verify proof
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(verify(merkleProof, merkleRoots[epoch], node), "invalid proof");
        _setClaimed(epoch, index);
        require(token.transfer(account, amount), "transfer failed");
        emit Claimed(epoch, index, account, amount);
    }

    function verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf) public pure returns (bool) {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computed <= proofElement) {
                computed = keccak256(abi.encodePacked(computed, proofElement));
            } else {
                computed = keccak256(abi.encodePacked(proofElement, computed));
            }
        }
        return computed == root;
    }
}
