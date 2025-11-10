import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
    GreenWaveCoin,
    GreenWaveTimelock,
    GreenWaveStaking
} from "../typechain-types";

describe("GreenWaveCoin Ecosystem", function () {
    let token: GreenWaveCoin;
    let timelock: GreenWaveTimelock;
    let staking: GreenWaveStaking;
    let owner: SignerWithAddress;
    let treasury: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let proposer: SignerWithAddress;
    let executor: SignerWithAddress;

    const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M tokens
    const VOTING_DELAY = 1; // 1 block
    const VOTING_PERIOD = 50400; // About 1 week
    const TIMELOCK_DELAY = 172800; // 2 days

    beforeEach(async function () {
        [owner, treasury, alice, bob, proposer, executor] = await ethers.getSigners();

        // Deploy Timelock
        const TimelockFactory = await ethers.getContractFactory("GreenWaveTimelock");
        timelock = await upgrades.deployProxy(TimelockFactory, [
            TIMELOCK_DELAY,
            [proposer.address],
            [executor.address],
            owner.address
        ]) as GreenWaveTimelock;

        // Deploy Token
        const TokenFactory = await ethers.getContractFactory("GreenWaveCoin");
        token = await upgrades.deployProxy(TokenFactory, [
            "GreenWaveCoin",
            "GWC",
            owner.address, // Make deployer initial owner for setup
            await treasury.getAddress()
        ]) as GreenWaveCoin;

        // Deploy Staking
        const StakingFactory = await ethers.getContractFactory("GreenWaveStaking");
        staking = await upgrades.deployProxy(StakingFactory, [
            await token.getAddress(),
            500, // 5% APR
            86400 // 1 day minimum stake
        ]) as GreenWaveStaking;

        // Configure token with staking contract
        await token.setStakingContract(await staking.getAddress());

        // Transfer some tokens to users for testing
        await token.transfer(alice.address, ethers.parseEther("10000"));
        await token.transfer(bob.address, ethers.parseEther("10000"));
        
        // Set fees back to 1% for fee tests
        await token.updateFees(100, 2000, 3000);
        
        // Now transfer ownership to timelock
        await token.transferOwnership(await timelock.getAddress());
    });

    describe("Token Features", function () {
        it("Should handle fees correctly", async function () {
            const transferAmount = ethers.parseEther("1000");
            
            // Get initial balances
            const initialBobBalance = await token.balanceOf(bob.address);
            const initialTreasuryBalance = await token.balanceOf(treasury.address);
            const initialStakingBalance = await token.balanceOf(staking.getAddress());
            
            // Transfer from Alice to Bob
            await token.connect(alice).transfer(bob.address, transferAmount);
            
            // Calculate expected fees (1% total fee)
            const fee = transferAmount * 100n / 10000n; // 1% fee
            const burnAmount = fee * 2000n / 10000n; // 20% of fee
            const stakingAmount = fee * 3000n / 10000n; // 30% of fee
            const treasuryAmount = fee - burnAmount - stakingAmount;
            
            // Verify balances (recipient receives amount minus fee)
            expect(await token.balanceOf(bob.address))
                .to.equal(initialBobBalance + transferAmount - fee);
            expect(await token.balanceOf(treasury.address))
                .to.equal(initialTreasuryBalance + treasuryAmount);
            expect(await token.balanceOf(staking.getAddress()))
                .to.equal(initialStakingBalance + stakingAmount);
        });

        it("Should allow governance to update fees", async function () {
            const newFee = 200;
            const newBurnShare = 3000;
            const newStakingShare = 3000;
            
            // Encode the function call
            const calldata = token.interface.encodeFunctionData("updateFees", [
                newFee,
                newBurnShare,
                newStakingShare
            ]);

            // Schedule proposal through timelock
            const delay = await timelock.getMinDelay();
            const schedule = await timelock.connect(proposer).schedule(
                await token.getAddress(),
                0,
                calldata,
                ethers.ZeroHash,
                ethers.ZeroHash,
                delay
            );

            // Wait for delay
            await ethers.provider.send("evm_increaseTime", [Number(delay)]);
            await ethers.provider.send("evm_mine");

            // Execute proposal
            await timelock.connect(executor).execute(
                await token.getAddress(),
                0,
                calldata,
                ethers.ZeroHash,
                ethers.ZeroHash
            );

            // Verify changes
            expect(await token.transactionFee()).to.equal(newFee);
            expect(await token.burnShare()).to.equal(newBurnShare);
            expect(await token.stakingShare()).to.equal(newStakingShare);
        });

        it("Should delegate and track voting power", async function () {
            await token.connect(alice).delegate(alice.address);
            // Account for 1% fee deduction in voting power
            const expectedVotes = ethers.parseEther("10000") * 99n / 100n;
            expect(await token.getVotes(alice.address))
                .to.equal(expectedVotes);
        });
    });

    describe("Staking", function () {
        const stakeAmount = ethers.parseEther("1000");

        beforeEach(async function () {
            await token.connect(alice).approve(staking.getAddress(), stakeAmount);
        });

        it("Should stake tokens and track rewards", async function () {
            await staking.connect(alice).stake(stakeAmount);
            expect(await staking.totalStaked()).to.equal(stakeAmount);
            
            // Move forward 30 days
            await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
            await ethers.provider.send("evm_mine", []);
            
            const pendingRewards = await staking.pendingRewards(alice.address);
            expect(pendingRewards).to.be.gt(0);
        });

        it("Should enforce minimum staking period", async function () {
            await staking.connect(alice).stake(stakeAmount);
            await expect(staking.connect(alice).unstake(stakeAmount))
                .to.be.revertedWithCustomError(staking, "MinimumPeriodNotMet");
        });
    });

    describe("Timelock Governance", function () {
        const PROPOSAL_DESCRIPTION = "Test Proposal";
        
        it("Should execute proposals through timelock", async function () {
            const newFee = 150; // 1.5%
            const calldata = token.interface.encodeFunctionData("updateFees", [
                newFee, 2000, 3000
            ]);

            // Schedule proposal (no predecessor)
            const target = await token.getAddress();
            const predecessor = ethers.ZeroHash;
            const salt = ethers.ZeroHash;

            await timelock.connect(proposer).schedule(
                target,
                0,
                calldata,
                predecessor,
                salt,
                TIMELOCK_DELAY
            );

            // Wait for delay
            await ethers.provider.send("evm_increaseTime", [TIMELOCK_DELAY]);
            await ethers.provider.send("evm_mine", []);

            // Execute (no predecessor)
            await timelock.connect(executor).execute(
                target,
                0,
                calldata,
                predecessor,
                salt
            );

            expect(await token.transactionFee()).to.equal(newFee);
        });
    });
});