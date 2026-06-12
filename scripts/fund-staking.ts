import { ethers } from "hardhat";

// Already deployed
const GWC_TOKEN_ADDRESS = "0x11b48853Ce85Ebf4b1a0AEd9cbE1c951017E16F9";
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
  console.log("🚀 Funding Staking Reward Pool...\n");
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MATIC\n");

  const token = await ethers.getContractAt("GreenWaveCoin", GWC_TOKEN_ADDRESS);

  const deployerBal = await token.balanceOf(deployer.address);
  const stakingBal = await token.balanceOf(GWC_STAKING_ADDRESS);
  console.log("Deployer GWC balance:", ethers.formatEther(deployerBal));
  console.log("Staking GWC balance:", ethers.formatEther(stakingBal));

  const REWARD_POOL_AMOUNT = ethers.parseEther("2100000"); // 10% of supply

  if (stakingBal >= REWARD_POOL_AMOUNT) {
    console.log("✅ Staking pool already funded with enough tokens. Skipping.");
  } else {
    // Step 1: Increase max transfer amount to allow the large transfer
    // Set it to 3,000,000 GWC (enough for reward pool + some buffer)
    console.log("📝 Step 1: Increasing max transfer amount to allow large transfer...");
    await sendTxWithRetry(
      () => token.configureFlashLoanProtection(true, 5, ethers.parseEther("3000000")),
      "increaseMaxTransfer"
    );
    console.log("   ✅ Max transfer amount increased to 3,000,000 GWC");

    // Step 2: Fund staking reward pool
    console.log("📝 Step 2: Funding staking reward pool with 2,100,000 GWC...");
    await sendTxWithRetry(
      () => token.transfer(GWC_STAKING_ADDRESS, REWARD_POOL_AMOUNT),
      "fundRewardPool"
    );
    console.log("   ✅ Funded staking pool with 2,100,000 GWC");

    // Step 3: Restore max transfer amount to 210,000 GWC (1% of supply)
    console.log("📝 Step 3: Restoring max transfer amount to 210,000 GWC...");
    await sendTxWithRetry(
      () => token.configureFlashLoanProtection(true, 5, ethers.parseEther("210000")),
      "restoreMaxTransfer"
    );
    console.log("   ✅ Max transfer amount restored to 210,000 GWC");
  }

  // Final balances
  const deployerBalFinal = await token.balanceOf(deployer.address);
  const stakingBalFinal = await token.balanceOf(GWC_STAKING_ADDRESS);
  console.log("\nFinal Deployer GWC balance:", ethers.formatEther(deployerBalFinal));
  console.log("Final Staking GWC balance:", ethers.formatEther(stakingBalFinal));

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
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync("deployments/polygon-mainnet.json", JSON.stringify(addresses, null, 2));
  console.log("📄 Addresses saved to deployments/polygon-mainnet.json");
}

main().catch((error) => {
  console.error("❌ Failed:", error);
  process.exit(1);
});
