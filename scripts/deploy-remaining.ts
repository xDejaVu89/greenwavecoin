import { ethers, upgrades } from "hardhat";

// Already deployed
const GWC_TOKEN_ADDRESS = "0x7709cD433dCCf28467d2c9084f4d4db89f3E87B2";
const GWC_STAKING_ADDRESS = "0x6a5e4DE78a5Be75c308fCb5833ECC35412511D86";
const GWC_TIMELOCK_ADDRESS = "0xC3F5B6f9E9b531146D23F702AbE930318159Ed02";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendTxWithRetry(txFn: () => Promise<any>, label: string, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`  Attempt ${i + 1}/${maxRetries} for ${label}...`);
      const tx = await txFn();
      await tx.wait();
      return tx;
    } catch (err: any) {
      if (i === maxRetries - 1) throw err;
      console.log(`  ⚠️  Attempt ${i + 1} failed: ${err.message?.substring(0, 100)}`);
      console.log(`  Retrying in 15 seconds...`);
      await sleep(15000);
    }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Resuming GreenWaveCoin Deployment (Steps 4-5)...\n");
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MATIC\n");
  console.log("✅ Using existing GWC Token:   ", GWC_TOKEN_ADDRESS);
  console.log("✅ Using existing GWC Staking: ", GWC_STAKING_ADDRESS);
  console.log("✅ Using existing GWC Timelock:", GWC_TIMELOCK_ADDRESS, "\n");

  // Step 4: Configure Token
  console.log("📝 Step 4: Configuring GreenWaveCoin...");
  const token = await ethers.getContractAt("GreenWaveCoin", GWC_TOKEN_ADDRESS);

  // Check if staking contract is already set
  let currentStaking: string;
  try {
    currentStaking = await token.stakingContract();
    console.log("   Current staking contract:", currentStaking);
  } catch {
    currentStaking = ethers.ZeroAddress;
  }

  if (currentStaking.toLowerCase() !== GWC_STAKING_ADDRESS.toLowerCase()) {
    await sendTxWithRetry(() => token.setStakingContract(GWC_STAKING_ADDRESS), "setStakingContract");
    console.log("   ✅ Staking contract set");
  } else {
    console.log("   ✅ Staking contract already set (skipping)");
  }

  await sendTxWithRetry(
    () => token.configureFlashLoanProtection(true, 5, ethers.parseEther("210000")),
    "configureFlashLoanProtection"
  );
  console.log("   ✅ Flash loan protection configured\n");

  // Step 5: Fund Staking Reward Pool
  console.log("📝 Step 5: Funding staking reward pool...");
  const REWARD_POOL_AMOUNT = ethers.parseEther("2100000"); // 10% of supply
  await sendTxWithRetry(() => token.transfer(GWC_STAKING_ADDRESS, REWARD_POOL_AMOUNT), "fundRewardPool");
  console.log("   ✅ Funded staking pool with 2,100,000 GWC\n");

  // Final Summary
  console.log("\n🎉 ============================================");
  console.log("   DEPLOYMENT COMPLETE - POLYGON MAINNET");
  console.log("============================================");
  console.log("GWC Token:        ", GWC_TOKEN_ADDRESS);
  console.log("GWC Staking:      ", GWC_STAKING_ADDRESS);
  console.log("GWC Timelock:     ", GWC_TIMELOCK_ADDRESS);
  console.log("============================================\n");

  // Save addresses
  const fs = require("fs");
  const addresses = {
    network: "polygon",
    chainId: 137,
    token: GWC_TOKEN_ADDRESS,
    staking: GWC_STAKING_ADDRESS,
    timelock: GWC_TIMELOCK_ADDRESS,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync("deployments/polygon-mainnet.json", JSON.stringify(addresses, null, 2));
  console.log("📄 Addresses saved to deployments/polygon-mainnet.json");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
