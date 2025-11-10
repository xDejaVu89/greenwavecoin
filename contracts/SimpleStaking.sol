// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IStakingRequirement } from "./IStakingRequirement.sol";

/**
 * @title SimpleStaking
 * @notice Minimal staking contract for compute reward eligibility. Users must stake a minimum amount to claim rewards.
 */
contract SimpleStaking is Ownable, IStakingRequirement {
    IERC20 public immutable token;
    uint256 public minimumStake;
    mapping(address => uint256) public staked;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event MinimumStakeSet(uint256 amount);

    constructor(address token_, uint256 minStake) {
        require(token_ != address(0), "token required");
        token = IERC20(token_);
        minimumStake = minStake;
    }

    function setMinimumStake(uint256 amount) external onlyOwner {
        minimumStake = amount;
        emit MinimumStakeSet(amount);
    }

    function stake(uint256 amount) external {
        require(amount > 0, "amount required");
        staked[msg.sender] += amount;
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        require(amount > 0, "amount required");
        require(staked[msg.sender] >= amount, "not enough staked");
        staked[msg.sender] -= amount;
        require(token.transfer(msg.sender, amount), "transfer failed");
        emit Unstaked(msg.sender, amount);
    }

    function hasMinimumStake(address account) external view override returns (bool) {
        return staked[account] >= minimumStake;
    }
}
