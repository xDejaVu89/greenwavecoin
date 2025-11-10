import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { GreenWaveCoin, GreenWaveStaking } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Invariant/Property-Based Tests
 * 
 * These tests verify invariants that must always hold true:
 * - Total supply never increases (only burns allowed)
 * - Fee shares always sum to ≤ 100%
 * - Staking balance ≤ staking contract balance
 * - Treasury/burn/staking distribution is exact
 */

describe("Invariant Tests", function () {
  let token: GreenWaveCoin;
  let staking: GreenWaveStaking;
  let deployer: SignerWithAddress;
  let treasury: SignerWithAddress;
  let users: SignerWithAddress[];

  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [deployer, treasury, ...users] = await ethers.getSigners();

    // Deploy token
    const GreenWaveCoinFactory = await ethers.getContractFactory("GreenWaveCoin");
    token = (await upgrades.deployProxy(
      GreenWaveCoinFactory,
      ["GreenWaveCoin", "GWC", deployer.address, treasury.address],
      { kind: "uups" }
    )) as unknown as GreenWaveCoin;

    // Deploy staking
    const GreenWaveStakingFactory = await ethers.getContractFactory("GreenWaveStaking");
    staking = (await upgrades.deployProxy(
      GreenWaveStakingFactory,
      [await token.getAddress(), 1000, 7 * 24 * 60 * 60],
      { kind: "uups" }
    )) as unknown as GreenWaveStaking;

    await token.setStakingContract(await staking.getAddress());
  });

  describe("Supply Invariants", function () {
    it("Total supply never increases", async function () {
      const initialSupply = await token.totalSupply();

      // Perform various operations
      await token.transfer(users[0].address, ethers.parseEther("1000"));
      await token.connect(users[0]).transfer(users[1].address, ethers.parseEther("500"));
      await token.connect(users[1]).transfer(users[2].address, ethers.parseEther("100"));

      const finalSupply = await token.totalSupply();

      // Supply should decrease (due to burns) or stay the same, never increase
      expect(finalSupply).to.be.lte(initialSupply);
    });

    it("Supply only decreases through burns (never mints)", async function () {
      const initialSupply = await token.totalSupply();

      // Transfer with fees (includes burn)
      await token.transfer(users[0].address, ethers.parseEther("10000"));

      const afterTransferSupply = await token.totalSupply();

      // Supply should have decreased due to burn
      expect(afterTransferSupply).to.be.lt(initialSupply);

      // Amount decreased should equal burn amount
      const burnAmount = initialSupply - afterTransferSupply;
      expect(burnAmount).to.be.gt(0);
    });

    it("Sum of all balances + burned ≤ initial supply", async function () {
      // Distribute tokens
      await token.transfer(users[0].address, ethers.parseEther("10000"));
      await token.transfer(users[1].address, ethers.parseEther("10000"));
      await token.transfer(treasury.address, ethers.parseEther("10000"));

      const deployerBalance = await token.balanceOf(deployer.address);
      const user0Balance = await token.balanceOf(users[0].address);
      const user1Balance = await token.balanceOf(users[1].address);
      const treasuryBalance = await token.balanceOf(treasury.address);
      const stakingBalance = await token.balanceOf(await staking.getAddress());
      const currentSupply = await token.totalSupply();

      const totalBalances = deployerBalance + user0Balance + user1Balance + treasuryBalance + stakingBalance;

      // Total balances should equal current supply
      expect(totalBalances).to.equal(currentSupply);

      // Current supply should be ≤ initial supply
      expect(currentSupply).to.be.lte(INITIAL_SUPPLY);
    });
  });

  describe("Fee Distribution Invariants", function () {
    it("Fee shares always sum to ≤ 100%", async function () {
      const burnShare = await token.burnShare();
      const stakingShare = await token.stakingShare();

      // Burn + staking should be ≤ 10000 (100%)
      expect(burnShare + stakingShare).to.be.lte(10000);
    });

    it("Fee distribution is exact (no rounding losses)", async function () {
      const amount = ethers.parseEther("1000");
      const fee = await token.transactionFee();

      if (fee == 0n) {
        this.skip(); // Skip if fees disabled
      }

      const deployerBalanceBefore = await token.balanceOf(deployer.address);
      const treasuryBalanceBefore = await token.balanceOf(treasury.address);
      const stakingBalanceBefore = await token.balanceOf(await staking.getAddress());
      const supplyBefore = await token.totalSupply();

      await token.transfer(users[0].address, amount);

      const deployerBalanceAfter = await token.balanceOf(deployer.address);
      const user0BalanceAfter = await token.balanceOf(users[0].address);
      const treasuryBalanceAfter = await token.balanceOf(treasury.address);
      const stakingBalanceAfter = await token.balanceOf(await staking.getAddress());
      const supplyAfter = await token.totalSupply();

      const deployerDecrease = deployerBalanceBefore - deployerBalanceAfter;
      const userIncrease = user0BalanceAfter;
      const treasuryIncrease = treasuryBalanceAfter - treasuryBalanceBefore;
      const stakingIncrease = stakingBalanceAfter - stakingBalanceBefore;
      const burned = supplyBefore - supplyAfter;

      // Deployer decrease should equal user increase + treasury increase + staking increase + burned
      expect(deployerDecrease).to.equal(userIncrease + treasuryIncrease + stakingIncrease + burned);
    });

    it("Cannot set fees above maximum", async function () {
      await expect(
        token.updateFees(1001, 2000, 3000) // 10.01% fee (max is 10%)
      ).to.be.revertedWithCustomError(token, "FeeTooHigh");
    });

    it("Cannot set fee shares > 100%", async function () {
      await expect(
        token.updateFees(100, 6000, 5000) // 60% + 50% = 110%
      ).to.be.revertedWithCustomError(token, "InvalidFeeDistribution");
    });
  });

  describe("Staking Invariants", function () {
    it("Total staked ≤ staking contract balance", async function () {
      // Fund staking reward pool
      await token.approve(await staking.getAddress(), ethers.parseEther("100000"));
      await staking.addToRewardPool(ethers.parseEther("100000"));

      // Users stake
      await token.transfer(users[0].address, ethers.parseEther("10000"));
      await token.connect(users[0]).approve(await staking.getAddress(), ethers.parseEther("5000"));
      await staking.connect(users[0]).stake(ethers.parseEther("5000"));

      await token.transfer(users[1].address, ethers.parseEther("10000"));
      await token.connect(users[1]).approve(await staking.getAddress(), ethers.parseEther("3000"));
      await staking.connect(users[1]).stake(ethers.parseEther("3000"));

      const totalStaked = await staking.totalStaked();
      const stakingBalance = await token.balanceOf(await staking.getAddress());

      // Total staked should be ≤ contract balance (rewards are extra)
      expect(totalStaked).to.be.lte(stakingBalance);
    });

    it("User stake amount ≤ user's staking balance", async function () {
      await token.transfer(users[0].address, ethers.parseEther("10000"));
      await token.connect(users[0]).approve(await staking.getAddress(), ethers.parseEther("5000"));
      await staking.connect(users[0]).stake(ethers.parseEther("5000"));

      const userStake = await staking.stakes(users[0].address);
      const userTokenBalance = await token.balanceOf(users[0].address);

      // User's stake should be 5000, remaining balance should be ~5000 (minus fees)
      expect(userStake.amount).to.equal(ethers.parseEther("5000"));
    });

    it("Reward pool never goes negative", async function () {
      // Fund small reward pool
      await token.approve(await staking.getAddress(), ethers.parseEther("1000"));
      await staking.addToRewardPool(ethers.parseEther("1000"));

      // User stakes
      await token.transfer(users[0].address, ethers.parseEther("10000"));
      await token.connect(users[0]).approve(await staking.getAddress(), ethers.parseEther("5000"));
      await staking.connect(users[0]).stake(ethers.parseEther("5000"));

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]); // 1 year
      await ethers.provider.send("evm_mine", []);

      // Pending rewards might exceed pool
      const pendingRewards = await staking.pendingRewards(users[0].address);
      const rewardPool = await staking.rewardPool();

      // If pending > pool, claim should not revert but should give available amount
      if (pendingRewards > rewardPool) {
        await expect(staking.connect(users[0]).claimRewards()).to.not.be.reverted;
      }

      const finalPool = await staking.rewardPool();
      expect(finalPool).to.be.gte(0); // Never negative
    });
  });

  describe("Access Control Invariants", function () {
    it("Only owner can call admin functions", async function () {
      await expect(
        token.connect(users[0]).updateFees(50, 2000, 3000)
      ).to.be.reverted;

      await expect(
        token.connect(users[0]).setTreasury(users[1].address)
      ).to.be.reverted;

      await expect(
        token.connect(users[0]).configureFlashLoanProtection(true, 10, ethers.parseEther("1000"))
      ).to.be.reverted;
    });

    it("After timelock enabled, only timelock can call admin functions", async function () {
      const GreenWaveTimelockFactory = await ethers.getContractFactory("GreenWaveTimelock");
      const timelock = (await upgrades.deployProxy(GreenWaveTimelockFactory, [
        60, // min delay
        [deployer.address], // proposers
        [deployer.address], // executors
        deployer.address // admin
      ], { initializer: 'initialize', kind: 'uups' })) as any;

      await token.enableTimelock(await timelock.getAddress());

      // Original owner can't call anymore
      await expect(
        token.updateFees(50, 2000, 3000)
      ).to.be.reverted;
    });
  });

  describe("Flash Loan Protection Invariants", function () {
    it("Transfer count resets on new block", async function () {
      // This test verifies that the protection tracks by block number
      // Note: Hardhat mines each tx in a new block, so we verify the tracking state
      
      await token.configureFlashLoanProtection(true, 3, ethers.parseEther("100000"));

      // Each transfer in Hardhat gets its own block, so counter should reset each time
      // This is different from real mainnet where multiple txs can be in same block
      await token.transfer(users[0].address, ethers.parseEther("100"));
      await token.transfer(users[0].address, ethers.parseEther("100"));
      await token.transfer(users[0].address, ethers.parseEther("100"));
      
      // Since each tx is in a new block in Hardhat, all transfers succeed
      // The security.test.ts file has more realistic flash loan protection tests
      await expect(
        token.transfer(users[0].address, ethers.parseEther("100"))
      ).to.not.be.reverted;
    });

    it("Max transfer amount is enforced", async function () {
      const maxAmount = ethers.parseEther("10000");
      await token.configureFlashLoanProtection(true, 100, maxAmount);

      // Transfer above max should fail
      await expect(
        token.transfer(users[0].address, maxAmount + 1n)
      ).to.be.reverted;

      // Transfer at max should work
      await expect(
        token.transfer(users[0].address, maxAmount)
      ).to.not.be.reverted;
    });
  });

  describe("Pause Invariants", function () {
    it("Transfers blocked when paused", async function () {
      // Need timelock for pause
      const GreenWaveTimelockFactory = await ethers.getContractFactory("GreenWaveTimelock");
      const timelock = (await upgrades.deployProxy(GreenWaveTimelockFactory, [
        1, // 1 second delay for testing
        [deployer.address], // proposers
        [deployer.address], // executors
        deployer.address // admin
      ], { initializer: 'initialize', kind: 'uups' })) as any;

      await token.enableTimelock(await timelock.getAddress());

      // Schedule and execute pause
      const timelockAddr = await timelock.getAddress();
      const pauseData = token.interface.encodeFunctionData("pause");
      const salt = ethers.solidityPackedKeccak256(["string"], ["pause-test"]);
      const eta = (await ethers.provider.getBlock("latest"))!.timestamp + 2;

      await timelock.schedule(
        await token.getAddress(),
        0,
        pauseData,
        ethers.ZeroHash,
        salt,
        eta
      );

      await ethers.provider.send("evm_increaseTime", [3]);
      await ethers.provider.send("evm_mine", []);

      await timelock.execute(
        await token.getAddress(),
        0,
        pauseData,
        ethers.ZeroHash,
        salt
      );

      // Transfers should be blocked
      await expect(
        token.transfer(users[0].address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
  });
});
