import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";
import type { GreenWaveCoin, GreenWaveStaking, GreenWaveTimelock } from "../typechain-types/contracts";

describe("Integration Tests", function () {
    let token: GreenWaveCoin;
    let staking: GreenWaveStaking;
    let timelock: GreenWaveTimelock;
    let deployer: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;
    let treasury: HardhatEthersSigner;
    const TOTAL_SUPPLY = ethers.parseUnits("1000000", 18);
    const STAKING_PERIOD = 7 * 24 * 60 * 60; // 7 days
    const TIMELOCK_DELAY = 2 * 24 * 60 * 60; // 2 days

    beforeEach(async function () {
        const signers = await ethers.getSigners();
        [deployer, user1, user2, treasury] = signers;

        // Deploy token first
        const TokenFactory = await ethers.getContractFactory("GreenWaveCoin");
        token = (await upgrades.deployProxy(TokenFactory, [
            "GreenWaveCoin",
            "GWV",
            deployer.address,
            treasury.address
        ], { initializer: 'initialize', kind: 'uups' })) as unknown as GreenWaveCoin;

        // Deploy staking contract
        const StakingFactory = await ethers.getContractFactory("GreenWaveStaking");
        staking = (await upgrades.deployProxy(StakingFactory, [
            token.target,
            500, // 5% APR
            STAKING_PERIOD
        ], { initializer: 'initialize', kind: 'uups' })) as unknown as GreenWaveStaking;

        // Deploy timelock
        const TimelockFactory = await ethers.getContractFactory("GreenWaveTimelock");
        timelock = (await upgrades.deployProxy(TimelockFactory, [
            TIMELOCK_DELAY,
            [deployer.address], // proposers
            [deployer.address], // executors
            deployer.address // admin
        ], { initializer: 'initialize', kind: 'uups' })) as unknown as GreenWaveTimelock;
    });

    describe("Token-Staking Integration", function () {
        beforeEach(async function () {
            // Set staking contract in token
            await token.setStakingContract(staking.target);
            // Transfer some tokens to user1 for testing
            await token.transfer(user1.address, ethers.parseUnits("1000", 18));
        });

        it("correctly distributes fees to staking contract", async function () {
            const amount = ethers.parseUnits("100", 18);
            const fee = amount * 100n / 10000n; // 1% fee
            const stakingPortion = fee * 3000n / 10000n; // 30% of fee to staking

            const beforeStaking = await token.balanceOf(staking.target);
            await token.connect(user1).transfer(user2.address, amount);
            const afterStaking = await token.balanceOf(staking.target);

            expect(afterStaking - beforeStaking).to.equal(stakingPortion);
        });

        it("handles staking and unstaking with fees", async function () {
            const amount = ethers.parseUnits("100", 18);
            
            // Fund the reward pool
            await token.approve(staking.target, amount);
            await staking.addToRewardPool(amount);
            
            await token.connect(user1).approve(staking.target, amount);
            await staking.connect(user1).stake(amount);

            // 100 tokens staked, 3% fee to staking = 103 tokens total
            const expectedBalance = amount * 2n + (amount * 30n / 1000n);  // Initial funding + stake + 3% fee
            expect(await token.balanceOf(staking.target)).to.equal(expectedBalance);
            expect(await staking.totalStaked()).to.equal(amount);  // Staked amount is original amount

            // Try to unstake before minimum period (should fail)
            await expect(staking.connect(user1).unstake(amount))
                .to.be.revertedWithCustomError(staking, "MinimumPeriodNotMet");

            // Fast forward past minimum staking period
            await ethers.provider.send("evm_increaseTime", [STAKING_PERIOD + 1]);
            await ethers.provider.send("evm_mine", []);

            // Now unstake should work
            await staking.connect(user1).unstake(amount);
            expect(await staking.totalStaked()).to.equal(0);
        });
    });

    describe("Governance Flow", function () {
        beforeEach(async function () {
            // Transfer token ownership to timelock
            await token.enableTimelock(timelock.target);
        });

        it("executes fee update through timelock", async function () {
            const newFee = 200; // 2%
            const newBurnShare = 1000; // 10%
            const newStakingShare = 4000; // 40%

            // Encode the updateFees function call
            const data = token.interface.encodeFunctionData("updateFees", [
                newFee,
                newBurnShare,
                newStakingShare
            ]);

            // Get current timestamp
            const block = await ethers.provider.getBlock('latest');
            const timestamp = block!.timestamp;
            const eta = timestamp + TIMELOCK_DELAY + 1;

            // Schedule through timelock
            await timelock.schedule(
                token.target,
                0, // value
                data,
                ethers.ZeroHash, // predecessor
                ethers.ZeroHash, // salt
                TIMELOCK_DELAY
            );

            // Fast forward past delay
            await ethers.provider.send("evm_increaseTime", [TIMELOCK_DELAY + 1]);
            await ethers.provider.send("evm_mine", []);

            // Execute the proposal
            await timelock.execute(
                token.target,
                0,
                data,
                ethers.ZeroHash,
                ethers.ZeroHash
            );

            // Verify fee updates
            expect(await token.transactionFee()).to.equal(newFee);
            expect(await token.burnShare()).to.equal(newBurnShare);
            expect(await token.stakingShare()).to.equal(newStakingShare);
        });

        it("handles emergency withdraw through timelock", async function () {
            // Send some ETH to the token contract
            await deployer.sendTransaction({
                to: token.target,
                value: ethers.parseEther("1.0")
            });

            const recipient = user2.address;
            const amount = ethers.parseEther("1.0");

            // Encode the emergencyWithdraw function call
            const data = token.interface.encodeFunctionData("emergencyWithdraw", [
                ethers.ZeroAddress, // ETH
                recipient,
                amount
            ]);

            // Schedule through timelock
            await timelock.schedule(
                token.target,
                0,
                data,
                ethers.ZeroHash,
                ethers.ZeroHash,
                TIMELOCK_DELAY
            );

            // Fast forward past delay
            await ethers.provider.send("evm_increaseTime", [TIMELOCK_DELAY + 1]);
            await ethers.provider.send("evm_mine", []);

            // Record balance before
            const balanceBefore = await ethers.provider.getBalance(recipient);

            // Execute the proposal
            await timelock.execute(
                token.target,
                0,
                data,
                ethers.ZeroHash,
                ethers.ZeroHash
            );

            // Verify ETH was withdrawn
            const balanceAfter = await ethers.provider.getBalance(recipient);
            expect(balanceAfter - balanceBefore).to.equal(amount);
        });
    });

    describe("Emergency Scenarios", function () {
        it("allows pausing transfers through timelock", async function () {
            // Transfer token ownership to timelock
            await token.enableTimelock(timelock.target);

            // Encode pause function call
            const data = token.interface.encodeFunctionData("pause", []);

            // Schedule through timelock
            await timelock.schedule(
                token.target,
                0,
                data,
                ethers.ZeroHash,
                ethers.ZeroHash,
                TIMELOCK_DELAY
            );

            // Fast forward past delay
            await ethers.provider.send("evm_increaseTime", [TIMELOCK_DELAY + 1]);
            await ethers.provider.send("evm_mine", []);

            // Execute pause
            await timelock.execute(
                token.target,
                0,
                data,
                ethers.ZeroHash,
                ethers.ZeroHash
            );

            // Verify transfers are paused
            await expect(token.transfer(user1.address, 1000))
                .to.be.revertedWithCustomError(token, "EnforcedPause");
        });

        it("prevents reentrancy in fee distribution", async function () {
            // Deploy a malicious contract that tries to reenter during fee distribution
            const ReentrancyAttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
            const reentrancyAttacker = await ReentrancyAttackerFactory.deploy(token.target);
            
            // Fund the attacker with enough tokens to trigger fees
            const reentrancyAttackAmount = ethers.parseUnits("1000", 18);
            await token.transfer(reentrancyAttacker.target, reentrancyAttackAmount);
            
            // Enable fees to ensure fee distribution happens (must be set before setting treasury)
            await token.connect(deployer).updateFees(100, 3000, 3000); // 1% fee, 30% burn, 30% staking
            
            // Set attacker as treasury to force fee payment to go to the attacker
            await token.connect(deployer).setTreasury(reentrancyAttacker.target);
            
            // Attempt the attack. With current implementation there is no external callback
            // vector during fee distribution, so attack should complete but not gain extra tokens.
            await reentrancyAttacker.attack();
            // Attacker contract should not have been able to steal more than the treasury share
            // Calculate expected remainder: treasury portion of the fee when transferring full balance
            // Compute expected remainder using on-chain params (safer than hardcoding)
            const tf = BigInt(await token.transactionFee());
            const burnShare = BigInt(await token.burnShare());
            const stakingShare = BigInt(await token.stakingShare());
            const fee = reentrancyAttackAmount * tf / 10000n;
            const treasuryPortion = fee * (10000n - burnShare - stakingShare) / 10000n;
            const actualBalance = BigInt(await token.balanceOf(reentrancyAttacker.target));
            // Ensure attacker did not gain more than the expected single-transfer treasury portion
            expect(actualBalance <= treasuryPortion).to.equal(true);
            
    });
});
});