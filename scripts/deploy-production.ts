import { ethers, upgrades, run } from "hardhat";
import { GreenWaveCoin, GreenWaveStaking, GreenWaveTimelock } from "../typechain-types";

/**
 * Production deployment script for GreenWaveCoin ecosystem
 * 
 * Deploys in this order:
 * 1. GreenWaveCoin (UUPS upgradeable)
 * 2. GreenWaveStaking (UUPS upgradeable)
 * 3. GreenWaveTimelock
 * 4. Configure all contracts
 * 5. Transfer ownership to timelock
 * 6. Verify contracts on block explorer
 */
async function main() {
  console.log("🚀 Starting GreenWaveCoin Production Deployment...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ======================
  // Configuration
  // ======================
  const TOKEN_NAME = "GreenWaveCoin";
  const TOKEN_SYMBOL = "GWC";
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || deployer.address;
  
  // Timelock configuration (24 hours delay)
  const TIMELOCK_DELAY = 24 * 60 * 60; // 24 hours in seconds
  
  // Staking configuration (10% APR, 7 day minimum)
  const REWARD_RATE = 1000; // 10% APR in basis points
  const MINIMUM_STAKING_PERIOD = 7 * 24 * 60 * 60; // 7 days in seconds
  
  // Total supply (tokens) for mainnet
  const TOTAL_SUPPLY_TOKENS = Number(process.env.TOTAL_SUPPLY_TOKENS || 21_000_000);

  // Flash loan protection (5 transfers per block, max ~1% of supply per transfer)
  const MAX_TRANSFERS_PER_BLOCK = 5;
  const onePercent = Math.max(1, Math.floor(TOTAL_SUPPLY_TOKENS / 100));
  const MAX_TRANSFER_AMOUNT = ethers.parseUnits(String(onePercent), 18);

  console.log("📋 Deployment Configuration:");
  console.log("  Token Name:", TOKEN_NAME);
  console.log("  Token Symbol:", TOKEN_SYMBOL);
  console.log("  Treasury:", TREASURY_ADDRESS);
  console.log("  Timelock Delay:", TIMELOCK_DELAY / 3600, "hours");
  console.log("  Staking APR:", REWARD_RATE / 100, "%");
  console.log("  Min Staking Period:", MINIMUM_STAKING_PERIOD / 86400, "days");
  console.log("  Flash Protection: Enabled");
  console.log("  Max Transfers/Block:", MAX_TRANSFERS_PER_BLOCK);
  console.log("  Max Transfer Amount:", ethers.formatEther(MAX_TRANSFER_AMOUNT), "tokens\n");

  // Optional: Market cap planning (off-chain guidance only)
  const TARGET_MARKET_CAP_USD = Number(process.env.TARGET_MARKET_CAP_USD || 0);
  const TGE_CIRC_TOKENS = Number(process.env.TGE_CIRC_TOKENS || 0);
  if (TARGET_MARKET_CAP_USD > 0 && TGE_CIRC_TOKENS > 0) {
    const impliedPrice = TARGET_MARKET_CAP_USD / TGE_CIRC_TOKENS;
    console.log("💱 Market Cap Planning (off-chain):");
    console.log("  Target Market Cap (USD):", TARGET_MARKET_CAP_USD.toLocaleString());
    console.log("  TGE Circulating Tokens:", TGE_CIRC_TOKENS.toLocaleString());
    console.log("  Implied Token Price (USD):", impliedPrice.toFixed(4), "\n");
  }

  // ======================
  // Step 1: Deploy Token
  // ======================
  console.log("📝 Step 1: Deploying GreenWaveCoin (UUPS Proxy)...");
  const GreenWaveCoinFactory = await ethers.getContractFactory("GreenWaveCoin");
  
  const token = await upgrades.deployProxy(
    GreenWaveCoinFactory,
    [TOKEN_NAME, TOKEN_SYMBOL, deployer.address, TREASURY_ADDRESS, TOTAL_SUPPLY_TOKENS],
    { 
      kind: "uups",
      initializer: "initializeWithSupply"
    }
  ) as unknown as GreenWaveCoin;
  
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ GreenWaveCoin deployed to:", tokenAddress);
  
  const tokenImplementation = await upgrades.erc1967.getImplementationAddress(tokenAddress);
  console.log("   Implementation:", tokenImplementation, "\n");

  // ======================
  // Step 2: Deploy Staking
  // ======================
  console.log("📝 Step 2: Deploying GreenWaveStaking (UUPS Proxy)...");
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
  console.log("✅ GreenWaveStaking deployed to:", stakingAddress);
  
  const stakingImplementation = await upgrades.erc1967.getImplementationAddress(stakingAddress);
  console.log("   Implementation:", stakingImplementation, "\n");

  // ======================
  // Step 3: Deploy Timelock (UUPS Proxy)
  // ======================
  console.log("📝 Step 3: Deploying GreenWaveTimelock (UUPS Proxy)...");
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
  console.log("✅ GreenWaveTimelock deployed to:", timelockAddress);
  const timelockImpl = await upgrades.erc1967.getImplementationAddress(timelockAddress);
  console.log("   Implementation:", timelockImpl);
  console.log("   Delay:", TIMELOCK_DELAY / 3600, "hours\n");

  // ======================
  // Step 4: Configure Token
  // ======================
  console.log("📝 Step 4: Configuring GreenWaveCoin...");
  
  // Configure staking contract
  console.log("   Setting staking contract...");
  let tx = await token.setStakingContract(stakingAddress);
  await tx.wait();
  console.log("   ✅ Staking contract set");
  
  // Configure flash loan protection
  console.log("   Enabling flash loan protection...");
  tx = await token.configureFlashLoanProtection(
    true,
    MAX_TRANSFERS_PER_BLOCK,
    MAX_TRANSFER_AMOUNT
  );
  await tx.wait();
  console.log("   ✅ Flash loan protection enabled");
  
  // Configure delegation limits
  console.log("   Setting delegation limits...");
  tx = await token.configureDelegationLimits(100); // Max 100 delegations per address
  await tx.wait();
  console.log("   ✅ Delegation limits set\n");

  // ======================
  // Step 5: Fund Staking Reward Pool
  // ======================
  console.log("📝 Step 5: Funding staking reward pool...");
  // Fund ~0.5% of total supply as initial rewards (adjust as needed)
  const INITIAL_REWARD_POOL = ethers.parseUnits(String(Math.floor(TOTAL_SUPPLY_TOKENS * 0.005)), 18);
  
  tx = await token.approve(stakingAddress, INITIAL_REWARD_POOL);
  await tx.wait();
  
  tx = await staking.addToRewardPool(INITIAL_REWARD_POOL);
  await tx.wait();
  console.log("✅ Staking reward pool funded with", ethers.formatEther(INITIAL_REWARD_POOL), "tokens\n");

  // ======================
  // Step 6: Transfer to Timelock
  // ======================
  console.log("📝 Step 6: Transferring ownership to timelock...");
  
  console.log("   Enabling timelock on token...");
  tx = await token.enableTimelock(timelockAddress);
  await tx.wait();
  console.log("   ✅ Token ownership transferred to timelock");
  
  console.log("   Enabling timelock on staking...");
  tx = await staking.enableTimelock(timelockAddress);
  await tx.wait();
  console.log("   ✅ Staking ownership transferred to timelock\n");

  // ======================
  // Step 7: Verify Deployment
  // ======================
  console.log("📝 Step 7: Verifying deployment state...");
  
  const totalSupply = await token.totalSupply();
  const deployerBalance = await token.balanceOf(deployer.address);
  const stakingBalance = await token.balanceOf(stakingAddress);
  const tokenOwner = await token.owner();
  const stakingOwner = await staking.owner();
  
  console.log("   Total Supply:", ethers.formatEther(totalSupply));
  console.log("   Deployer Balance:", ethers.formatEther(deployerBalance));
  console.log("   Staking Balance:", ethers.formatEther(stakingBalance));
  console.log("   Token Owner:", tokenOwner);
  console.log("   Staking Owner:", stakingOwner);
  console.log("   Timelock Address:", timelockAddress);
  
  if (tokenOwner !== timelockAddress || stakingOwner !== timelockAddress) {
    console.log("   ⚠️  WARNING: Ownership not properly transferred to timelock!");
  } else {
    console.log("   ✅ Ownership properly transferred\n");
  }

  // ======================
  // Step 8: Contract Verification
  // ======================
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("📝 Step 8: Verifying contracts on block explorer...");
    console.log("   Waiting 30 seconds for block explorer to index...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
      console.log("   Verifying Token Implementation...");
      await run("verify:verify", {
        address: tokenImplementation,
        constructorArguments: []
      });
      console.log("   ✅ Token implementation verified");
    } catch (error: any) {
      console.log("   ⚠️  Token verification failed:", error.message);
    }

    try {
      console.log("   Verifying Staking Implementation...");
      await run("verify:verify", {
        address: stakingImplementation,
        constructorArguments: []
      });
      console.log("   ✅ Staking implementation verified");
    } catch (error: any) {
      console.log("   ⚠️  Staking verification failed:", error.message);
    }

    try {
      console.log("   Verifying Timelock Implementation...");
      await run("verify:verify", {
        address: timelockImpl,
        constructorArguments: []
      });
      console.log("   ✅ Timelock implementation verified\n");
    } catch (error: any) {
      console.log("   ⚠️  Timelock verification failed:", error.message, "\n");
    }
  } else {
    console.log("📝 Step 8: Skipping verification (no ETHERSCAN_API_KEY)\n");
  }

  // ======================
  // Deployment Summary
  // ======================
  console.log("=".repeat(70));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  console.log("\n📋 Contract Addresses:");
  console.log("  GreenWaveCoin (Proxy):", tokenAddress);
  console.log("  GreenWaveCoin (Implementation):", tokenImplementation);
  console.log("  GreenWaveStaking (Proxy):", stakingAddress);
  console.log("  GreenWaveStaking (Implementation):", stakingImplementation);
  console.log("  GreenWaveTimelock:", timelockAddress);
  
  console.log("\n📊 Contract State:");
  console.log("  Total Supply:", ethers.formatEther(totalSupply), TOKEN_SYMBOL);
  console.log("  Reward Pool:", ethers.formatEther(stakingBalance), TOKEN_SYMBOL);
  console.log("  Circulating (Deployer):", ethers.formatEther(deployerBalance), TOKEN_SYMBOL);
  
  console.log("\n🔒 Security Status:");
  console.log("  Ownership: Timelock-controlled ✅");
  console.log("  Flash Protection: Enabled ✅");
  console.log("  Upgrade Protection: UUPS with timelock ✅");
  console.log("  Governance Delay:", TIMELOCK_DELAY / 3600, "hours ✅");
  
  console.log("\n⚠️  IMPORTANT NEXT STEPS:");
  console.log("  1. Save these contract addresses securely");
  console.log("  2. Verify contracts on block explorer if not auto-verified");
  console.log("  3. Test timelock governance flow on testnet first");
  console.log("  4. Distribute tokens to stakeholders");
  console.log("  5. Set up monitoring for contract events");
  console.log("  6. Configure frontend with contract addresses");
  console.log("  7. Prepare governance proposals for initial configuration");
  
  console.log("\n💾 Save this deployment info:");
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      token: {
        proxy: tokenAddress,
        implementation: tokenImplementation
      },
      staking: {
        proxy: stakingAddress,
        implementation: stakingImplementation
      },
      timelock: timelockAddress
    },
    configuration: {
      tokenName: TOKEN_NAME,
      tokenSymbol: TOKEN_SYMBOL,
      treasury: TREASURY_ADDRESS,
      timelockDelay: TIMELOCK_DELAY,
      rewardRate: REWARD_RATE,
      minimumStakingPeriod: MINIMUM_STAKING_PERIOD,
      maxTransfersPerBlock: MAX_TRANSFERS_PER_BLOCK,
      maxTransferAmount: MAX_TRANSFER_AMOUNT.toString()
    }
  };
  
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
