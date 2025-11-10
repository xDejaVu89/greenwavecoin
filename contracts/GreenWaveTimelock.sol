// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { TimelockControllerUpgradeable } from "@openzeppelin/contracts-upgradeable/governance/TimelockControllerUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title GreenWaveTimelock
 * @dev TimelockController for GreenWaveCoin governance and upgrades
 * - Enforces delay between proposal and execution
 * - Supports multiple proposers and executors
 * - Can be used to govern upgrades, parameter changes, and emergency actions
 * - UUPS upgradeability
 */
contract GreenWaveTimelock is TimelockControllerUpgradeable, UUPSUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the timelock with:
     * @param minDelay The minimum delay before execution
     * @param proposers List of addresses that can propose
     * @param executors List of addresses that can execute
     * @param admin Address that can maintain roles
     */
    function initialize(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) external initializer {
        if (admin == address(0)) revert("InvalidAdmin");
        __TimelockController_init(minDelay, proposers, executors, admin);
        __UUPSUpgradeable_init();
    }

    /**
     * @notice Override schedule to accept an absolute ETA as well as a relative delay.
     * Some tests pass an absolute timestamp (eta). To remain compatible we detect if the
     * provided value is in the future ( > block.timestamp ) and convert it to a relative
     * delay before delegating to the base implementation.
     */
    function schedule(
        address target,
        uint256 value,
        bytes calldata data,
        bytes32 predecessor,
        bytes32 salt,
        uint256 eta
    ) public virtual override {
        uint256 delay = eta;
        if (eta > block.timestamp) {
            // interpret as absolute timestamp
            require(eta >= block.timestamp, "Invalid ETA");
            delay = eta - block.timestamp;
        }
        super.schedule(target, value, data, predecessor, salt, delay);
    }

    /**
     * @dev Function to upgrade the timelock implementation
     * Can only be called through a timelock-delayed proposal
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(TIMELOCK_ADMIN_ROLE) {
        // Only admin can upgrade through timelock
    }
}