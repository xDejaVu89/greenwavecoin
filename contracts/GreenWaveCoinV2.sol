// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { GreenWaveCoin } from "./GreenWaveCoin.sol";

/**
 * @title GreenWaveCoinV2
 * @dev V2 implementation for rehearsal. Appends no storage; adds a simple version() function.
 * IMPORTANT: Do not modify existing storage. Only append new variables at the end if needed.
 */
contract GreenWaveCoinV2 is GreenWaveCoin {
    /// @notice Returns the version number of the implementation
    function version() external pure returns (uint256) {
        return 2;
    }
}
