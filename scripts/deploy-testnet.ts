import { ethers, upgrades, run } from "hardhat";
import { GreenWaveCoin, GreenWaveStaking, GreenWaveTimelock } from "../typechain-types";
import fs from "fs";

/**
 * Testnet deployment script for GreenWaveCoin ecosystem
 * Simplified version for Sepolia testing
 */
async function main() {
  console.log("🧪 Starting GreenWaveCoin Testnet Deployment (Sepolia)...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Network:", network.name, `(chainId: ${network.chainId})`);
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  const MIN_BALANCE = ethers.parseEther("0.05");
  if (balance < MIN_BALANCE) {
    console.warn("⚠️  Low balance (", ethers.formatEther(balance), "ETH ). Recommended ≥ 0.05 ETH. Continuing anyway...");
  }

  // ======================
  // Configuration (testnet values)
  // ======================
  const TOKEN_NAME = "GreenWaveCoin";
  const TOKEN_SYMBOL = "GWC";
  const TREASURY_ADDRESS = deployer.address; // Testnet: use deployer as treasury
  
  // Timelock: 5 minutes delay for testing (fast rehearsal), vs 24h in production
  const TIMELOCK_DELAY = 5 * 60; // 5 minutes
  
  // Staking: 10% APR, 5 minute minimum for testing (vs 7 days production)
  const REWARD_RATE = 1000; // 10% APR in basis points
  const MINIMUM_STAKING_PERIOD = 5 * 60; // 5 minutes
  
  // Flash protection
  const MAX_TRANSFERS_PER_BLOCK = 5;
  const MAX_TRANSFER_AMOUNT = ethers.parseEther("10000"); // 1% of 1M supply

  console.log("📋 Testnet Configuration:");
  console.log("  Token:", TOKEN_NAME, `(${TOKEN_SYMBOL})`);
  console.log("  Treasury:", TREASURY_ADDRESS);
  console.log("  Timelock Delay:", TIMELOCK_DELAY / 60, "minutes");
  console.log("  Staking APR:", REWARD_RATE / 100, "%");
  console.log("  Min Staking:", MINIMUM_STAKING_PERIOD / 60, "minutes");
  console.log("  Flash Protection: Enabled\n");

  // ======================
  // Deploy Token
  // ======================
  console.log("📝 [1/5] Deploying GreenWaveCoin (UUPS Proxy)...");
  const GreenWaveCoinFactory = await ethers.getContractFactory("GreenWaveCoin");
  
  const token = await upgrades.deployProxy(
    GreenWaveCoinFactory,
    [TOKEN_NAME, TOKEN_SYMBOL, deployer.address, TREASURY_ADDRESS],
    { 
      kind: "uups",
      initializer: "initialize"
    }
  ) as unknown as GreenWaveCoin;
  
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  const tokenImpl = await upgrades.erc1967.getImplementationAddress(tokenAddress);
  
  console.log("✅ Token Proxy:", tokenAddress);
  console.log("   Implementation:", tokenImpl, "\n");

  // ======================
  // Deploy Staking
  // ======================
  console.log("📝 [2/5] Deploying GreenWaveStaking (UUPS Proxy)...");
  const GreenWaveStakingFactory = await ethers.getContractFactory("GreenWaveStaking");
  
  const staking = await upgrades.deployProxy(
    GreenWaveStakingFactory,
    [tokenAddress, REWARD_RATE, MINIMUM_STAKING_PERIOD],
    { 
      kind: "uups",
      initializer: "initialize"
    }
  ) as unknown as GreenWaveStaking;
  
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  const stakingImpl = await upgrades.erc1967.getImplementationAddress(stakingAddress);
  
  console.log("✅ Staking Proxy:", stakingAddress);
  console.log("   Implementation:", stakingImpl, "\n");

  // ======================
  // Deploy Timelock
  // ======================
  console.log("📝 [3/5] Deploying GreenWaveTimelock (UUPS Proxy)...");
  const GreenWaveTimelockFactory = await ethers.getContractFactory("GreenWaveTimelock");

  const timelock = await upgrades.deployProxy(
    GreenWaveTimelockFactory,
    [
      TIMELOCK_DELAY,
      [deployer.address], // proposers
      [deployer.address], // executors
      deployer.address    // admin
    ],
    {
      kind: "uups",
      initializer: "initialize"
    }
  ) as unknown as GreenWaveTimelock;
  
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  const timelockImpl = await upgrades.erc1967.getImplementationAddress(timelockAddress);
  
  console.log("✅ Timelock (Proxy):", timelockAddress);
  console.log("   Implementation:", timelockImpl);
  console.log("   Delay:", TIMELOCK_DELAY / 60, "minutes\n");

  // ======================
  // Configure
  // ======================
  console.log("📝 [4/5] Configuring contracts...");
  
  console.log("   → Setting staking contract...");
  let tx = await token.setStakingContract(stakingAddress);
  await tx.wait();
  
  console.log("   → Setting delegation limits...");
  tx = await token.configureDelegationLimits(100);
  await tx.wait();
  
  console.log("   → Funding staking reward pool (100k tokens)...");
  const REWARD_POOL = ethers.parseEther("100000");
  tx = await token.approve(stakingAddress, REWARD_POOL);
  await tx.wait();
  tx = await staking.addToRewardPool(REWARD_POOL);
  await tx.wait();
  
  // Enable flash protection AFTER large reward pool funding to avoid maxTransferAmount revert
  console.log("   → Enabling flash protection...");
  tx = await token.configureFlashLoanProtection(true, MAX_TRANSFERS_PER_BLOCK, MAX_TRANSFER_AMOUNT);
  await tx.wait();
  
  console.log("   → Transferring ownership to timelock...");
  tx = await token.transferOwnership(timelockAddress);
  await tx.wait();
  tx = await staking.transferOwnership(timelockAddress);
  await tx.wait();
  
  console.log("✅ Configuration complete\n");

  // ======================
  // Verify on Etherscan
  // ======================
  console.log("📝 [5/5] Verifying contracts on Etherscan...");
  console.log("   Waiting 30 seconds for Etherscan to index...");
  await new Promise(resolve => setTimeout(resolve, 30000));

  try {
    console.log("   → Verifying token implementation...");
    await run("verify:verify", {
      address: tokenImpl,
      constructorArguments: []
    });
    console.log("   ✅ Token verified");
  } catch (e: any) {
    if (e.message.includes("Already Verified")) {
      console.log("   ℹ️  Token already verified");
    } else {
      console.log("   ⚠️  Token verification failed:", e.message);
    }
  }

  try {
    console.log("   → Verifying staking implementation...");
    await run("verify:verify", {
      address: stakingImpl,
      constructorArguments: []
    });
    console.log("   ✅ Staking verified");
  } catch (e: any) {
    if (e.message.includes("Already Verified")) {
      console.log("   ℹ️  Staking already verified");
    } else {
      console.log("   ⚠️  Staking verification failed:", e.message);
    }
  }

  try {
    console.log("   → Verifying timelock...");
    await run("verify:verify", {
      address: timelockAddress,
      constructorArguments: [TIMELOCK_DELAY, deployer.address]
    });
    console.log("   ✅ Timelock verified");
  } catch (e: any) {
    if (e.message.includes("Already Verified")) {
      console.log("   ℹ️  Timelock already verified");
    } else {
      console.log("   ⚠️  Timelock verification failed:", e.message);
    }
  }

  // ======================
  // Save deployment info
  // ======================
  const deployment = {
    network: network.name,
    chainId: Number(network.chainId),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      token: {
        proxy: tokenAddress,
        implementation: tokenImpl
      },
      staking: {
        proxy: stakingAddress,
        implementation: stakingImpl
      },
      timelock: timelockAddress
    },
    config: {
      timelockDelay: TIMELOCK_DELAY,
      stakingAPR: REWARD_RATE / 100,
      minStakingPeriod: MINIMUM_STAKING_PERIOD,
      rewardPoolFunded: ethers.formatEther(REWARD_POOL)
    }
  };

  const deploymentPath = `deployments/testnet-${network.name}-${Date.now()}.json`;
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  // ======================
  // Summary
  // ======================
  console.log("\n" + "=".repeat(60));
  console.log("🎉 TESTNET DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("   GreenWaveCoin (Proxy):", tokenAddress);
  console.log("   GreenWaveStaking (Proxy):", stakingAddress);
  console.log("   GreenWaveTimelock:", timelockAddress);
  console.log("\n🔗 Etherscan Links:");
  console.log("   Token:", `https://sepolia.etherscan.io/address/${tokenAddress}`);
  console.log("   Staking:", `https://sepolia.etherscan.io/address/${stakingAddress}`);
  console.log("   Timelock:", `https://sepolia.etherscan.io/address/${timelockAddress}`);
  console.log("\n💾 Deployment saved:", deploymentPath);
  console.log("\n✅ Next Steps:");
  console.log("   1. Run smoke tests: npx hardhat run scripts/testnet-smoke-test.ts --network sepolia");
  console.log("   2. Execute upgrade rehearsal (see LAUNCH_READY.md)");
  console.log("   3. Monitor for 24 hours before mainnet\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
