// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title GreenWaveStaking
 * @dev Staking contract for GreenWaveCoin with:
 * - Flexible APR controlled by governance
 * - Emergency withdrawal capability
 * - Configurable reward distribution
 * - Protection against reentrancy
 */
contract GreenWaveStaking is 
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Custom errors for gas-efficient reverts
    error InvalidAddress();
    error InvalidAmount();
    error MinimumPeriodNotMet();
    error NoStakeToWithdraw();
    error NoRewardsToClaim();
    error InsufficientRewardPool();

    /// @notice The GreenWaveCoin token contract
    IERC20Upgradeable public token;

    /// @notice Annual percentage rate for rewards (in basis points, 1% = 100)
    uint256 public rewardRate;

    /// @notice Minimum staking duration in seconds
    uint256 public minimumStakingPeriod;

    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 lastRewardTime;
        uint256 accumulatedRewards;
    }

    /// @notice Mapping of staker address to their stake details
    mapping(address => Stake) public stakes;

    /// @notice Total staked amount
    uint256 public totalStaked;

    /// @notice Reward pool balance
    uint256 public rewardPool;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);
    event EmergencyWithdrawn(address indexed user, uint256 amount);
    event TimelockEnabled(address indexed timelock);
    event Initialized(address indexed token, uint256 rewardRate, uint256 minimumStakingPeriod);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the staking contract
     * @param _token The GreenWaveCoin token address
     * @param _rewardRate Initial APR in basis points
     * @param _minimumStakingPeriod Minimum staking duration
     */
    function initialize(
        address _token,
        uint256 _rewardRate,
        uint256 _minimumStakingPeriod
    ) external initializer {
        __Ownable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

    if (_token == address(0)) revert InvalidAddress();

        token = IERC20Upgradeable(_token);
        rewardRate = _rewardRate;
        minimumStakingPeriod = _minimumStakingPeriod;

        _transferOwnership(msg.sender);
        
        emit Initialized(_token, _rewardRate, _minimumStakingPeriod);
    }

    /**
     * @dev Required by UUPS, restricts upgrade access to owner (timelock)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Transfer ownership to the timelock contract. This is a one-way operation.
     * After this, all admin operations must go through the timelock's delay period.
     * @param timelock The timelock contract address that will become the new owner
     */
    function enableTimelock(address timelock) external onlyOwner {
        if (timelock == address(0)) revert InvalidAddress();
        _transferOwnership(timelock);
        emit TimelockEnabled(timelock);
    }

    /**
     * @notice Stake tokens in the contract to earn rewards
     * @dev Updates existing rewards before adding new stake
     * @param amount Amount of tokens to stake
     */
    function stake(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        
        // Update existing rewards before adding new stake
        _updateRewards(msg.sender);

        // Update state before external call to prevent reentrancy
        bool isFirstStake = stakes[msg.sender].startTime == 0;
        stakes[msg.sender].amount += amount;
        totalStaked += amount;

        if (isFirstStake) {
            stakes[msg.sender].startTime = block.timestamp;
            stakes[msg.sender].lastRewardTime = block.timestamp;
        }

        // Transfer tokens to this contract (after state updates)
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount);
    }

    /**
     * @dev Unstake tokens and claim rewards
     * @param amount Amount of tokens to unstake
    /**
     * @notice Unstake tokens and claim accumulated rewards
     * @dev Enforces minimum staking period before allowing unstake
     * @param amount Amount of tokens to unstake
     */
    function unstake(uint256 amount) external nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        if (amount == 0 || amount > userStake.amount) revert InvalidAmount();
        if (block.timestamp < userStake.startTime + minimumStakingPeriod) revert MinimumPeriodNotMet();

        // Update and claim rewards
        _updateRewards(msg.sender);
        _claimRewards();

        // Update stake
        userStake.amount -= amount;
        totalStaked -= amount;

        // Transfer tokens back to user
        token.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    /**
     * @notice Claim all accumulated staking rewards
     * @dev Transfers rewards from the reward pool to the caller
     */
    function claimRewards() external nonReentrant {
        _updateRewards(msg.sender);
        _claimRewards();
    }

    /**
     * @notice Emergency withdraw staked tokens without rewards
     * @dev Only callable when contract is paused - forfeits all rewards
     */
    function emergencyWithdraw() external whenPaused nonReentrant {
        Stake storage userStake = stakes[msg.sender];
        if (userStake.amount == 0) revert NoStakeToWithdraw();

        uint256 amount = userStake.amount;
        userStake.amount = 0;
        userStake.accumulatedRewards = 0;
        totalStaked -= amount;

        token.safeTransfer(msg.sender, amount);

        emit EmergencyWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Add funds to the reward pool
     * @dev Anyone can add to the reward pool to extend reward availability
     * @param amount Amount of tokens to add to the reward pool
     */
    function addToRewardPool(uint256 amount) external nonReentrant {
        rewardPool += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice Update the annual reward rate
     * @dev Only callable by owner (timelock after enableTimelock)
     * @param newRate New APR in basis points (100 = 1%)
     */
    function setRewardRate(uint256 newRate) external onlyOwner {
        rewardRate = newRate;
        emit RewardRateUpdated(newRate);
    }

    /**
     * @notice Pause staking and unstaking operations
     * @dev Only callable by owner (timelock after enableTimelock)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause staking and unstaking operations
     * @dev Only callable by owner (timelock after enableTimelock)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice View function to calculate pending rewards for a user
     * @param user Address to check rewards for
     * @return The amount of pending rewards in tokens
     */
    function pendingRewards(address user) public view returns (uint256) {
        Stake storage userStake = stakes[user];
        if (userStake.amount == 0) return userStake.accumulatedRewards;

        uint256 timeElapsed = block.timestamp - userStake.lastRewardTime;
        uint256 newRewards = (userStake.amount * rewardRate * timeElapsed) / (365 days * 10000);

        return userStake.accumulatedRewards + newRewards;
    }

    /**
     * @dev Internal function to update reward accounting
     * @param user Address to update rewards for
     */
    function _updateRewards(address user) internal {
        Stake storage userStake = stakes[user];
        userStake.accumulatedRewards = pendingRewards(user);
        userStake.lastRewardTime = block.timestamp;
    }

    /**
     * @dev Internal function to transfer accumulated rewards
     */
    function _claimRewards() internal {
        Stake storage userStake = stakes[msg.sender];
        uint256 rewards = userStake.accumulatedRewards;
        if (rewards == 0) revert NoRewardsToClaim();
        if (rewards > rewardPool) revert InsufficientRewardPool();

        userStake.accumulatedRewards = 0;
        rewardPool -= rewards;
        token.safeTransfer(msg.sender, rewards);

        emit RewardClaimed(msg.sender, rewards);
    }
}