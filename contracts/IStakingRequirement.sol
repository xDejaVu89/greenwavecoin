// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IStakingRequirement
 * @notice Interface for checking if an account meets the minimum staking requirement for compute rewards.
 */
interface IStakingRequirement {
    function hasMinimumStake(address account) external view returns (bool);
}
