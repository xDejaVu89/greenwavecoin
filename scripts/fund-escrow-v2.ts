import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Funding RewardEscrow with GWC tokens (v2 — with diagnostics)...\n");

  const deploymentPath = path.join(__dirname, "..", "deployments", "polygon-mainnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

  const gwcAddress = deployment.token;
  const escrowAddress = deployment.rewardEscrow;

  console.log("📝 Contract Addresses:");
  console.log(`   GWC Token: ${gwcAddress}`);
  console.log(`   Escrow: ${escrowAddress}\n`);

  const [deployer] = await ethers.getSigners();
  console.log(`💰 Deployer: ${deployer.address}`);

  // Use the full ABI to interact with the proxy
  const gwcAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function maxTransferAmount() view returns (uint256)",
    "function flashProtectionEnabled() view returns (bool)",
    "function maxTransfersPerBlock() view returns (uint256)",
    "function configureFlashLoanProtection(bool enabled, uint256 maxAmount, uint256 maxPerBlock)",
    "function owner() view returns (address)",
    "function isExemptFromLimits(address) view returns (bool)",
  ];

  const gwc = new ethers.Contract(gwcAddress, gwcAbi, deployer);

  // Diagnostics
  const balance = await gwc.balanceOf(deployer.address);
  console.log(`   GWC Balance: ${ethers.formatEther(balance)} GWC`);

  let maxAmount = BigInt(0);
  let flashEnabled = false;
  let maxPerBlock = BigInt(0);

  try {
    maxAmount = await gwc.maxTransferAmount();
    flashEnabled = await gwc.flashProtectionEnabled();
    maxPerBlock = await gwc.maxTransfersPerBlock();
    console.log(`\n🔍 Flash Loan Protection:`);
    console.log(`   Enabled: ${flashEnabled}`);
    console.log(`   Max Transfer Amount: ${ethers.formatEther(maxAmount)} GWC`);
    console.log(`   Max Transfers Per Block: ${maxPerBlock}`);
  } catch (e) {
    console.log("   (Could not read flash protection settings)");
  }

  // Check if escrow is exempt
  try {
    const isExempt = await gwc.isExemptFromLimits(escrowAddress);
    console.log(`   Escrow Exempt: ${isExempt}`);
  } catch (e) {
    console.log("   (isExemptFromLimits not available)");
  }

  const transferAmount = ethers.parseEther("5000000");
  console.log(`\n📤 Attempting to transfer ${ethers.formatEther(transferAmount)} GWC to escrow...`);

  // If flash protection is enabled and maxAmount is too low, configure it first
  if (flashEnabled && maxAmount < transferAmount) {
    console.log(`\n⚠️  maxTransferAmount (${ethers.formatEther(maxAmount)}) is less than transfer amount.`);
    console.log(`   Increasing maxTransferAmount to 10,000,000 GWC...`);
    const tx = await gwc.configureFlashLoanProtection(true, ethers.parseEther("10000000"), maxPerBlock);
    await tx.wait();
    console.log(`   ✅ maxTransferAmount updated. Tx: ${tx.hash}`);
  }

  // If flash protection is disabled but maxAmount is 0 (default), just try the transfer
  // The revert might be from something else — try with explicit gas limit
  try {
    const tx = await gwc.transfer(escrowAddress, transferAmount, {
      gasLimit: 500000,
    });
    console.log(`   Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`   ✅ Transfer confirmed! Block: ${receipt?.blockNumber}`);
  } catch (err: any) {
    console.error(`\n❌ Transfer failed: ${err.message}`);
    
    // Try smaller amount to diagnose
    console.log("\n🔬 Trying smaller transfer (1000 GWC) to diagnose...");
    try {
      const smallTx = await gwc.transfer(escrowAddress, ethers.parseEther("1000"), {
        gasLimit: 200000,
      });
      await smallTx.wait();
      console.log("   ✅ Small transfer succeeded — the issue is with the large amount");
      
      // Now try to figure out the limit
      for (const amount of [100000, 500000, 1000000, 2000000, 5000000]) {
        try {
          await gwc.transfer.staticCall(escrowAddress, ethers.parseEther(amount.toString()));
          console.log(`   ✅ ${amount.toLocaleString()} GWC transfer would succeed`);
        } catch {
          console.log(`   ❌ ${amount.toLocaleString()} GWC transfer would fail`);
        }
      }
    } catch (err2: any) {
      console.error(`   Small transfer also failed: ${err2.message}`);
    }
    process.exit(1);
  }

  // Verify escrow balance
  const escrowBalance = await gwc.balanceOf(escrowAddress);
  console.log(`\n✅ Escrow funded with ${ethers.formatEther(escrowBalance)} GWC`);

  const remainingBalance = await gwc.balanceOf(deployer.address);
  console.log(`💰 Deployer remaining: ${ethers.formatEther(remainingBalance)} GWC`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
