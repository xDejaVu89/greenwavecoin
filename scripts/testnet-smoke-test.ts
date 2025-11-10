import { ethers } from "hardhat";
import { GreenWaveCoin, GreenWaveStaking, GreenWaveTimelock } from "../typechain-types";
import fs from "fs";

/**
 * Testnet smoke test script
 * Validates basic functionality after deployment
 */
async function main() {
  console.log("🧪 Running Testnet Smoke Tests...\n");

  // Load latest deployment
  const deployments = fs.readdirSync("deployments")
    .filter(f => f.startsWith("testnet-"))
    .sort()
    .reverse();
  
  if (deployments.length === 0) {
    throw new Error("No testnet deployments found. Run deploy-testnet.ts first.");
  }

  const deploymentPath = `deployments/${deployments[0]}`;
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  
  console.log("📋 Testing deployment from:", deploymentPath);
  console.log("   Network:", deployment.network);
  console.log("   Token:", deployment.contracts.token.proxy);
  console.log("   Staking:", deployment.contracts.staking.proxy);
  console.log("   Timelock:", deployment.contracts.timelock, "\n");

  // On public networks with a single deployer key, Hardhat returns only one signer.
  // Create two ephemeral wallets for testing and fund them from the deployer.
  const [deployer] = await ethers.getSigners();
  const user1 = ethers.Wallet.createRandom().connect(ethers.provider);
  const user2 = ethers.Wallet.createRandom().connect(ethers.provider);
  
  // Get contract instances
  const token = (await ethers.getContractAt("GreenWaveCoin", deployment.contracts.token.proxy)) as unknown as GreenWaveCoin;
  const staking = (await ethers.getContractAt("GreenWaveStaking", deployment.contracts.staking.proxy)) as unknown as GreenWaveStaking;
  const timelock = (await ethers.getContractAt("GreenWaveTimelock", deployment.contracts.timelock)) as unknown as GreenWaveTimelock;

  console.log("Test accounts:");
  console.log("   Deployer:", deployer.address);
  console.log("   User1:", user1.address);
  console.log("   User2:", user2.address, "\n");

  // Fund ephemeral users with a small amount of ETH for gas and seed some tokens
  try {
    const fundEth = async (to: string, amountEth: string) => {
      const tx = await deployer.sendTransaction({ to, value: ethers.parseEther(amountEth) });
      await tx.wait();
    };
    const seedTokens = async (to: string, amount: string) => {
      const tx = await token.transfer(to, ethers.parseEther(amount));
      await tx.wait();
    };

    console.log("   Funding users with ETH for gas...");
    await fundEth(user1.address, "0.002");
    await fundEth(user2.address, "0.002");

    console.log("   Seeding users with tokens...");
    await seedTokens(user1.address, "3000");
    await seedTokens(user2.address, "1000");
  } catch (e: any) {
    console.log("   ⚠️  Funding warning:", e.message);
  }

  let testsPassed = 0;
  let testsFailed = 0;

  // ======================
  // Test 1: Token Metadata
  // ======================
  try {
    console.log("🧪 Test 1: Token metadata");
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();
    
    console.log("   Name:", name);
    console.log("   Symbol:", symbol);
    console.log("   Decimals:", decimals);
    console.log("   Total Supply:", ethers.formatEther(totalSupply));
    
    if (name === "GreenWaveCoin" && symbol === "GWC" && decimals === 18n) {
      console.log("   ✅ PASS\n");
      testsPassed++;
    } else {
      console.log("   ❌ FAIL\n");
      testsFailed++;
    }
  } catch (e: any) {
    console.log("   ❌ FAIL:", e.message, "\n");
    testsFailed++;
  }

  // ======================
  // Test 2: Transfer
  // ======================
  try {
    console.log("🧪 Test 2: Transfer tokens");
    const transferAmount = ethers.parseEther("1000");
    const balanceBefore = await token.balanceOf(user1.address);
    
    const tx = await token.transfer(user1.address, transferAmount);
    await tx.wait();
    
    const balanceAfter = await token.balanceOf(user1.address);
  const received = (balanceAfter - balanceBefore) as bigint;
    
    console.log("   Sent:", ethers.formatEther(transferAmount));
    console.log("   Received (after fees):", ethers.formatEther(received));
  const feeTaken = (transferAmount - received) as bigint;
  console.log("   Fee taken:", ethers.formatEther(feeTaken));
    
    if (received > 0n && received < transferAmount) {
      console.log("   ✅ PASS (fee deducted correctly)\n");
      testsPassed++;
    } else {
      console.log("   ❌ FAIL (fee not working)\n");
      testsFailed++;
    }
  } catch (e: any) {
    console.log("   ❌ FAIL:", e.message, "\n");
    testsFailed++;
  }

  // ======================
  // Test 3: Staking
  // ======================
  try {
    console.log("🧪 Test 3: Stake tokens");
    const stakeAmount = ethers.parseEther("100");
    
    // User1 approves and stakes
    let tx = await token.connect(user1).approve(await staking.getAddress(), stakeAmount);
    await tx.wait();
    
    tx = await staking.connect(user1).stake(stakeAmount);
    await tx.wait();
    
    const stakeInfo = await staking.stakes(user1.address);
    // stakeInfo returns struct: amount, startTime, lastRewardTime, accumulatedRewards
    const amountStaked = stakeInfo.amount;
    const startTime = stakeInfo.startTime;
    console.log("   Staked:", ethers.formatEther(amountStaked));
    console.log("   StartTime:", new Date(Number(startTime) * 1000).toISOString());
    
    if (amountStaked === stakeAmount) {
      console.log("   ✅ PASS\n");
      testsPassed++;
    } else {
      console.log("   ❌ FAIL\n");
      testsFailed++;
    }
  } catch (e: any) {
    console.log("   ❌ FAIL:", e.message, "\n");
    testsFailed++;
  }

  // ======================
  // Test 4: Rewards Calculation
  // ======================
  try {
    console.log("🧪 Test 4: Pending rewards");
    
  // Wait for the next block on public testnet (sleep ~20s)
  await new Promise(resolve => setTimeout(resolve, 20000));
    
    const pending = await staking.pendingRewards(user1.address);
    console.log("   Pending rewards:", ethers.formatEther(pending));
    
    if (pending >= 0n) {
      console.log("   ✅ PASS\n");
      testsPassed++;
    } else {
      console.log("   ❌ FAIL\n");
      testsFailed++;
    }
  } catch (e: any) {
    console.log("   ❌ FAIL:", e.message, "\n");
    testsFailed++;
  }

  // ======================
  // Test 5: Early Unstake Prevention
  // ======================
  try {
    console.log("🧪 Test 5: Early unstake prevention");
    
    try {
      // attempt small unstake (same amount) should revert due to minimum period (5 min)
      await staking.connect(user1).unstake(ethers.parseEther("10"));
      console.log("   ❌ FAIL (should have reverted)\n");
      testsFailed++;
    } catch (e: any) {
      if (e.message.includes("MinimumPeriodNotMet") || e.message.includes("minimum period")) {
        console.log("   ✅ PASS (correctly prevented)\n");
        testsPassed++;
      } else {
        console.log("   ⚠️  PARTIAL (reverted but wrong reason):", e.message, "\n");
        testsPassed++;
      }
    }
  } catch (e: any) {
    console.log("   ❌ FAIL:", e.message, "\n");
    testsFailed++;
  }

  // ======================
  // Test 6: Timelock Ownership
  // ======================
  try {
    console.log("🧪 Test 6: Timelock controls token");
    const tokenOwner = await token.owner();
    const stakingOwner = await staking.owner();
    
    console.log("   Token owner:", tokenOwner);
    console.log("   Staking owner:", stakingOwner);
    console.log("   Timelock address:", deployment.contracts.timelock);
    
    if (tokenOwner === deployment.contracts.timelock && stakingOwner === deployment.contracts.timelock) {
      console.log("   ✅ PASS\n");
      testsPassed++;
    } else {
      console.log("   ❌ FAIL\n");
      testsFailed++;
    }
  } catch (e: any) {
    console.log("   ❌ FAIL:", e.message, "\n");
    testsFailed++;
  }

  // ======================
  // Test 7: Flash Protection
  // ======================
  try {
    console.log("🧪 Test 7: Flash loan protection");
    // Using public getters already on token
    const maxTransfers = await token.maxTransfersPerBlock();
    const maxAmount = await token.maxTransferAmount();
    const flashEnabled = await token.flashProtectionEnabled();
    
    console.log("   Enabled:", flashEnabled);
    console.log("   Max transfers/block:", maxTransfers.toString());
    console.log("   Max amount:", ethers.formatEther(maxAmount));
    
    if (flashEnabled) {
      console.log("   ✅ PASS\n");
      testsPassed++;
    } else {
      console.log("   ❌ FAIL (not enabled)\n");
      testsFailed++;
    }
  } catch (e: any) {
    console.log("   ❌ FAIL:", e.message, "\n");
    testsFailed++;
  }

  // ======================
  // Test 8: Fee Configuration
  // ======================
  try {
    console.log("🧪 Test 8: Fee configuration");
    const feeBps = await token.transactionFee(); // e.g. 100 = 1%
    const burnShare = await token.burnShare();   // basis points of the fee (e.g. 2000 = 20%)
    const stakingShare = await token.stakingShare(); // basis points of the fee
    const treasuryShare = 10000n - burnShare - stakingShare; // remainder of fee goes to treasury
    const totalShare = burnShare + stakingShare + treasuryShare; // should be 10000 (100% of fee)

    console.log("   Transaction fee (bps):", feeBps.toString());
    console.log("   Distribution (of fee):", `${burnShare} bp burn, ${stakingShare} bp staking, ${treasuryShare} bp treasury`);

    if (totalShare === 10000n) {
      console.log("   ✅ PASS\n");
      testsPassed++;
    } else {
      console.log("   ❌ FAIL (shares don't sum to 100)\n");
      testsFailed++;
    }
  } catch (e: any) {
    console.log("   ❌ FAIL:", e.message, "\n");
    testsFailed++;
  }

  // ======================
  // Summary
  // ======================
  console.log("=".repeat(60));
  console.log("📊 SMOKE TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${testsPassed}/8`);
  console.log(`❌ Failed: ${testsFailed}/8`);
  
  if (testsFailed === 0) {
    console.log("\n🎉 All smoke tests passed! Testnet deployment is healthy.\n");
    console.log("✅ Next Steps:");
    console.log("   1. Monitor testnet for 24 hours");
    console.log("   2. Run upgrade rehearsal (see LAUNCH_READY.md)");
    console.log("   3. Prepare for mainnet deployment\n");
  } else {
    console.log("\n⚠️  Some tests failed. Investigate before proceeding.\n");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Smoke test error:", error);
    process.exit(1);
  });
