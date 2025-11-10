// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../GreenWaveCoin.sol";

/**
 * @title ReentrancyAttacker
 * @dev Test contract that attempts to reenter during fee distribution
 */
contract ReentrancyAttacker {
    GreenWaveCoin public token;
    bool private attacking;
    
    constructor(address payable _token) {
        token = GreenWaveCoin(_token);
    }

    function attack() external {
        require(!attacking, "Already attacking");
        attacking = true;
        // Initial transfer to trigger fee distribution
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No tokens to attack with");
        try token.transfer(msg.sender, balance) {
            // If we get here, try to reenter by making another transfer
            uint256 afterBalance = token.balanceOf(address(this));
            if (afterBalance > 0) {
                token.transfer(msg.sender, afterBalance);  // This should fail with reentrancy guard error
            }
        } catch {
            // If the first transfer fails, we still need to reset attacking
            attacking = false;
            revert("Initial transfer failed");
        }
        attacking = false;
    }

    // This gets called when we receive fees as the treasury
    receive() external payable {
        if (attacking) {
            // Try to reenter during fee distribution
            uint256 balance = token.balanceOf(address(this));
            if (balance > 0) {
                token.transfer(msg.sender, balance);
            }
        }
    }
}