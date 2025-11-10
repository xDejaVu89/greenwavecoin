// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { ERC20BurnableUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import { ERC20PermitUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import { ERC20VotesUpgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GreenWaveCoin (reconstructed)
 * @notice Minimal reconstructed token to restore compilation and provide stubs used in tests.
 * NOTE: This is an automated conservative reconstruction from corrupted sources. Behavioural
 * details (fees, staking distribution) may be simplified compared to the original. Use this
 * to run tests and iterate; replace with the authoritative source when available.
 */
contract GreenWaveCoin is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // --- Custom errors used by tests ---
    error FlashLoanProtectionActive();
    error MaxTransferExceeded();
    error MaxDelegationsExceeded();
    error ArrayLengthMismatch();
    error EnforcedPause();
    error TimelockNotEnabled();
    error UnauthorizedOperation();
    error InvalidTimelockAddress();
    error InvalidTreasuryAddress();
    error FeeTooHigh();
    error InvalidFeeDistribution();
    error ETHTransferFailed();
    error TokenTransferFailed();

    // --- State (minimal for tests) ---
    /// @notice Whether the timelock governance is enabled
    bool public timelockEnabled;
    /// @notice Address of the timelock controller when governance is enabled
    address public timelock;

    // Flash loan protection
    /// @notice Whether flash-loan protection is enabled
    bool public flashProtectionEnabled;
    /// @notice Maximum number of transfers allowed per block per address
    uint256 public maxTransfersPerBlock;
    /// @notice Maximum transfer amount allowed per transaction when protection is enabled
    uint256 public maxTransferAmount;

    // Track last transfer block for each address
    /// @dev Tracks the most recent block number in which an address transferred tokens
    mapping(address => uint256) private lastTransferBlock;
    /// @dev Counts the number of transfers performed by an address in the current block
    mapping(address => uint256) private transfersInCurrentBlock;
    
    // Delegation counts (tracked separately to satisfy tests)
    /// @notice Number of times an address has been delegated to
    mapping(address => uint256) public delegationCounts;
    /// @notice Maximum number of delegations allowed per delegatee (0 = unlimited)
    uint256 public maxDelegations;

    // Staking contract address
    /// @notice Address of the staking contract that receives staking fee distributions
    address public stakingContract;
    // Treasury address (receives portion of fees)
    /// @notice Address of the treasury that receives treasury fee distributions
    address public treasury;

    // Fee parameters (kept but not enforced heavily)
    /// @notice Transaction fee in basis points (100 = 1%)
    uint256 public transactionFee;
    /// @notice Portion of the fee to burn (basis points of fee, e.g., 2000 = 20%)
    uint256 public burnShare;
    /// @notice Portion of the fee to allocate to staking (basis points of fee)
    uint256 public stakingShare;

    // Guard used to bypass flash-protection during internal fee distribution
    bool private _inFeeDistribution;

    // Events for state changes
    /// @notice Emitted when timelock governance is enabled
    /// @param timelock The timelock controller address
    event TimelockEnabled(address indexed timelock);
    /// @notice Emitted when the per-block transfer limit changes
    /// @param newMax The new maximum transfers per block
    event MaxTransfersPerBlockUpdated(uint256 newMax);
    /// @notice Emitted when flash-loan protection parameters are updated
    /// @param enabled Whether protection is enabled
    /// @param maxTransfersPerBlock Maximum transfers per block
    /// @param maxTransferAmount Maximum transfer amount per tx
    event FlashLoanProtectionConfigured(bool enabled, uint256 maxTransfersPerBlock, uint256 maxTransferAmount);
    /// @notice Emitted when the staking contract is updated
    /// @param newStaking The new staking contract address
    event StakingContractUpdated(address indexed newStaking);
    /// @notice Emitted when the treasury address is updated
    /// @param newTreasury The new treasury address
    event TreasuryUpdated(address indexed newTreasury);
    /// @notice Emitted when delegation limits are configured
    /// @param maxDelegations The maximum number of delegations allowed
    event DelegationLimitsConfigured(uint256 maxDelegations);
    /// @notice Emitted when fee parameters are updated
    /// @param transactionFee The transaction fee in basis points
    /// @param burnShare The burn share in basis points (of fee)
    /// @param stakingShare The staking share in basis points (of fee)
    event FeesUpdated(uint256 transactionFee, uint256 burnShare, uint256 stakingShare);
    /// @notice Emitted on emergency withdrawal of ETH/ERC20
    /// @param token The token address (0 for ETH)
    /// @param to The recipient address
    /// @param amount The amount withdrawn
    event EmergencyWithdrawal(address indexed token, address indexed to, uint256 amount);

    // Reserved storage gap for upgradeability (allows adding new variables in future implementations)
    // See OpenZeppelin upgradeable contract recommendations.
    uint256[50] private __gap;

    // --- Initializer ---
    /**
     * @notice Initialize the GreenWaveCoin token contract
     * @dev Sets up all inherited contracts and mints initial supply
     * @param name_ The name of the token
     * @param symbol_ The symbol of the token
     * @param owner_ The address that will receive initial supply and ownership
     * @param treasury_ The address that will receive treasury fee distributions
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        address owner_,
        address treasury_
    ) public initializer {
        _initBase(name_, symbol_, owner_, treasury_);
        // Default initial supply for tests/local flows: 1,000,000 tokens
        _mint(owner_, 1_000_000 * 10 ** decimals());
    }

    /**
     * @notice Alternate initializer allowing explicit initial supply (in whole tokens)
     * @dev Use this for production deployments to set total supply precisely (e.g., 21,000,000)
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param owner_ Owner/recipient of initial supply
     * @param treasury_ Treasury address
     * @param initialSupplyTokens Initial supply expressed in whole tokens (18 decimals will be applied)
     */
    function initializeWithSupply(
        string memory name_,
        string memory symbol_,
        address owner_,
        address treasury_,
        uint256 initialSupplyTokens
    ) public initializer {
        _initBase(name_, symbol_, owner_, treasury_);
        if (initialSupplyTokens > 0) {
            _mint(owner_, initialSupplyTokens * 10 ** decimals());
        }
    }

    function _initBase(
        string memory name_,
        string memory symbol_,
        address owner_,
        address treasury_
    ) internal {
        __ERC20_init(name_, symbol_);
        __ERC20Burnable_init();
        __ERC20Permit_init(name_);
        __ERC20Votes_init();
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        // Set treasury from initializer
        treasury = treasury_;
        // Set owner
        _transferOwnership(owner_);
        // default fee parameters: 0.3% fee, 20% burn, 30% staking, 50% treasury
        transactionFee = 30; // basis points (30 / 10000 = 0.3%)
        burnShare = 2000; // 20% of fee
        stakingShare = 3000; // 30% of fee
        // treasury implicitly receives remaining fee share
    }

    // --- Timelock helper modifier (kept simple) ---
    modifier enforceTimelock() {
        if (!timelockEnabled) revert TimelockNotEnabled();
        if (msg.sender != timelock) revert UnauthorizedOperation();
        _;
    }

    // --- Governance / admin functions (minimal implementations) ---
    /**
     * @notice Enables timelock-controlled governance and transfers ownership to the timelock
     * @dev Once enabled, only the timelock can execute critical admin functions
     * @param _timelock The address of the timelock contract
     */
    function enableTimelock(address _timelock) external onlyOwner {
        if (_timelock == address(0)) revert InvalidTimelockAddress();
        timelockEnabled = true;
        timelock = _timelock;
        // Transfer ownership to the timelock so scheduled operations can call onlyOwner functions
        _transferOwnership(_timelock);
        emit TimelockEnabled(_timelock);
    }

    /**
     * @notice Updates the maximum number of transfers allowed per block
     * @dev Part of flash loan protection mechanism
     * @param _max The new maximum transfers per block limit
     */
    function setMaxTransfersPerBlock(uint256 _max) external onlyOwner {
        maxTransfersPerBlock = _max;
        emit MaxTransfersPerBlockUpdated(_max);
    }

    /**
     * @notice Configures flash loan protection parameters
     * @dev Enables per-block transfer limits to prevent flash loan attacks
     * @param enabled Whether flash loan protection is active
     * @param _maxTransfersPerBlock Maximum transfers per block for any address
     * @param _maxTransferAmount Maximum amount that can be transferred in one transaction
     */
    function configureFlashLoanProtection(bool enabled, uint256 _maxTransfersPerBlock, uint256 _maxTransferAmount) external onlyOwner {
        flashProtectionEnabled = enabled;
        maxTransfersPerBlock = _maxTransfersPerBlock;
        maxTransferAmount = _maxTransferAmount;
        emit FlashLoanProtectionConfigured(enabled, _maxTransfersPerBlock, _maxTransferAmount);
    }

    /**
     * @notice Sets the staking contract address that receives staking fee distributions
     * @dev Can be set to zero address to disable staking distributions (fees go to treasury)
     * @param _staking The address of the staking contract
     */
    function setStakingContract(address _staking) external onlyOwner {
        // Allow setting to zero address to disable staking
        stakingContract = _staking;
        emit StakingContractUpdated(_staking);
    }

    /**
     * @notice Sets the treasury address that receives treasury fee distributions
     * @dev Treasury cannot be zero address
     * @param _treasury The address of the treasury
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidTreasuryAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @notice Configures the maximum number of times an address can delegate
     * @dev Prevents delegation spamming attacks
     * @param _maxDelegations The maximum number of delegation operations allowed
     */
    function configureDelegationLimits(uint256 _maxDelegations) external onlyOwner {
        maxDelegations = _maxDelegations;
        emit DelegationLimitsConfigured(_maxDelegations);
    }

    /**
     * @notice Updates transaction fee parameters
     * @dev Fee is split between burn, staking, and treasury based on shares
     * @param _transactionFee The transaction fee in basis points (100 = 1%, max 1000 = 10%)
     * @param _burnShare The percentage of fees to burn (in basis points, 2000 = 20%)
     * @param _stakingShare The percentage of fees to staking (in basis points, 3000 = 30%)
     */
    function updateFees(uint256 _transactionFee, uint256 _burnShare, uint256 _stakingShare) external onlyOwner {
        // limit transaction fee to a sensible maximum (e.g., 10% = 1000 basis points)
        if (_transactionFee > 1000) revert FeeTooHigh();
        // Validate fee shares sum to <= 100% (10000 basis points)
        if (_burnShare + _stakingShare > 10000) revert InvalidFeeDistribution();
        transactionFee = _transactionFee;
        burnShare = _burnShare;
        stakingShare = _stakingShare;
        emit FeesUpdated(_transactionFee, _burnShare, _stakingShare);
    }

    /**
     * @notice Emergency withdrawal of ETH or ERC20 tokens from the contract
     * @dev Only callable by timelock after governance approval
     * @param tokenAddress The address of the token to withdraw (zero address for ETH)
     * @param to The address to send the withdrawn tokens to
     * @param amount The amount to withdraw
     */
    function emergencyWithdraw(address tokenAddress, address to, uint256 amount) external enforceTimelock nonReentrant {
        if (to == address(0)) revert InvalidTreasuryAddress();
        if (tokenAddress == address(0)) {
            // ETH withdrawal
            (bool sent, ) = to.call{value: amount}("");
            if (!sent) revert ETHTransferFailed();
            emit EmergencyWithdrawal(address(0), to, amount);
            return;
        }
        // ERC20 withdrawal: transfer the specified amount
        // Use low-level call to ensure compatibility and check success
        (bool success, bytes memory data) = tokenAddress.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        if (!(success && (data.length == 0 || abi.decode(data, (bool))))) revert TokenTransferFailed();
        emit EmergencyWithdrawal(tokenAddress, to, amount);
    }

    // --- Pause controls ---
    /**
     * @notice Pauses all token transfers
     * @dev Only callable by timelock through governance
     */
    function pause() external enforceTimelock {
        _pause();
    }

    /**
     * @notice Unpauses token transfers
     * @dev Only callable by timelock through governance
     */
    function unpause() external enforceTimelock {
        _unpause();
    }

    // --- Delegation tracking ---
    /**
     * @notice Delegate voting power to another address
     * @dev Tracks delegation count to prevent spam attacks
     * @param delegatee The address to delegate voting power to
     */
    function delegate(address delegatee) public override {
        // Basic enforcement: prevent exceeding maxDelegations
        if (maxDelegations > 0 && delegationCounts[delegatee] + 1 > maxDelegations) revert MaxDelegationsExceeded();
        super.delegate(delegatee);
        // Increment delegation count for the delegatee (best-effort)
        delegationCounts[delegatee] += 1;
    }

    // --- Transfers with minimal flash protection enforcement ---
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override(ERC20Upgradeable) {
        super._beforeTokenTransfer(from, to, amount);
        // Pause handling: use custom error for consistency
        if (paused()) revert EnforcedPause();
        
        if (flashProtectionEnabled && from != address(0) && !_inFeeDistribution) {
            // Per-block transfer limit protection
            if (maxTransfersPerBlock > 0) {
                // Reset counter if we're in a new block
                if (lastTransferBlock[from] < block.number) {
                    transfersInCurrentBlock[from] = 0;
                    lastTransferBlock[from] = block.number;
                }
                
                // Check if limit exceeded
                if (transfersInCurrentBlock[from] >= maxTransfersPerBlock) {
                    revert FlashLoanProtectionActive();
                }
                
                // Increment transfer count for this block
                ++transfersInCurrentBlock[from];
            }
            
            // Maximum transfer amount check
            if (maxTransferAmount > 0 && amount > maxTransferAmount) {
                revert MaxTransferExceeded();
            }
        }
    }

    // --- Batch transfer helper used by tests ---
    /**
     * @notice Transfer tokens to multiple recipients in a single transaction
     * @dev Bypasses fee logic to ensure exact amounts are delivered
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts corresponding to each recipient
     */
    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external whenNotPaused {
        if (recipients.length != amounts.length) revert ArrayLengthMismatch();
        
        // Batch transfers bypass fee logic to ensure exact amounts are delivered
        // This is an administrative/operational feature for efficient token distribution
        _inFeeDistribution = true;
        for (uint256 i = 0; i < recipients.length; ++i) {
            _transfer(msg.sender, recipients[i], amounts[i]);
        }
        _inFeeDistribution = false;
    }

    // --- Fee-aware transfer override ---
    function _transfer(address from, address to, uint256 amount) internal override {
        // Apply transaction fees when enabled (transactionFee in basis points, base 10000)
        // Fee exemptions for:
        // 1. Transfers to/from staking contract (staking/unstaking/rewards)
        // 2. Emergency recovery operations (from this contract)
        // 3. Flash protection bypass during fee distribution
        if (to == stakingContract || from == stakingContract || from == address(this) || _inFeeDistribution) {
            super._transfer(from, to, amount);
            return;
        }

        if (transactionFee > 0 && from != address(0) && to != address(0)) {
            uint256 fee = (amount * transactionFee) / 10000;
            if (fee == 0) {
                super._transfer(from, to, amount);
                return;
            }

            // Calculate fee distribution with precision preservation
            uint256 burnAmount = (amount * transactionFee * burnShare) / 100000000;
            uint256 stakingAmount = (amount * transactionFee * stakingShare) / 100000000;
            uint256 treasuryAmount = fee - burnAmount - stakingAmount;
            // If no staking contract is configured, route staking share to treasury
            if (stakingContract == address(0)) {
                treasuryAmount += stakingAmount;
                stakingAmount = 0;
            }

            // Emit Transfer of full amount to recipient first (matches historical behavior/tests)
            super._transfer(from, to, amount);

            // Move fee portions from recipient to recipients while bypassing flash protection
            _inFeeDistribution = true;
            if (stakingAmount > 0 && stakingContract != address(0)) {
                super._transfer(to, stakingContract, stakingAmount);
            }
            if (treasuryAmount > 0 && treasury != address(0)) {
                super._transfer(to, treasury, treasuryAmount);
            }
            if (burnAmount > 0) {
                // Burn from recipient to reduce total supply
                _burn(to, burnAmount);
            }
            _inFeeDistribution = false;
            return;
        }

        super._transfer(from, to, amount);
    }

    // --- Required overrides for ERC20Votes and UUPS ---
    function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        super._burn(account, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- Receive ETH ---
    receive() external payable {}
}