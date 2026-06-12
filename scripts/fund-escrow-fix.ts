import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Funding RewardEscrow (with flash protection fix)...\n");

  const deploymentPath = path.join(__dirname, "..", "deployments", "polygon-mainnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

  const gwcAddress = deployment.token;
  const escrowAddress = deployment.rewardEscrow;

  console.log(`GWC Token: ${gwcAddress}`);
  console.log(`Escrow:    ${escrowAddress}\n`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const gwcAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function flashProtectionEnabled() view returns (bool)",
    "function maxTransferAmount() view returns (uint256)",
    "function maxTransfersPerBlock() view returns (uint256)",
    "function configureFlashLoanProtection(bool enabled, uint256 maxAmount, uint256 maxPerBlock)",
    "function owner() view returns (address)",
  ];

  const gwc = new ethers.Contract(gwcAddress, gwcAbi, deployer);

  const balance = await gwc.balanceOf(deployer.address);
  console.log(`GWC Balance: ${ethers.formatEther(balance)} GWC`);

  const flashEnabled = await gwc.flashProtectionEnabled();
  const maxAmount = await gwc.maxTransferAmount();
  const maxPerBlock = await gwc.maxTransfersPerBlock();
  console.log(`\nFlash Protection: enabled=${flashEnabled}, maxAmount=${ethers.formatEther(maxAmount)}, maxPerBlock=${maxPerBlock}`);

  const transferAmount = ethers.parseEther("5000000");

  // Step 1: Temporarily disable flash protection (or raise the limit)
  if (flashEnabled) {
    console.log("\n⚙️  Temporarily disabling flash protection for the funding transfer...");
    const tx1 = await gwc.configureFlashLoanProtection(false, 0, 0);
    await tx1.wait();
    console.log(`   ✅ Flash protection disabled. Tx: ${tx1.hash}`);
  }

  // Step 2: Transfer GWC to escrow
  console.log(`\n📤 Transferring ${ethers.formatEther(transferAmount)} GWC to escrow...`);
  const tx2 = await gwc.transfer(escrowAddress, transferAmount, { gasLimit: 300000 });
  console.log(`   Transaction: ${tx2.hash}`);
  await tx2.wait();
  console.log(`   ✅ Transfer confirmed!`);

  // Step 3: Re-enable flash protection with sensible limits
  // maxTransferAmount: 210,000 GWC (1% of supply per transfer)
  // maxTransfersPerBlock: 5
  console.log("\n⚙️  Re-enabling flash protection with sensible limits...");
  const tx3 = await gwc.configureFlashLoanProtection(
    true,
    ethers.parseEther("210000"), // 1% of 21M supply
    5
  );
  await tx3.wait();
  console.log(`   ✅ Flash protection re-enabled. Tx: ${tx3.hash}`);

  // Verify
  const escrowBalance = await gwc.balanceOf(escrowAddress);
  const remaining = await gwc.balanceOf(deployer.address);
  console.log(`\n✅ Escrow balance: ${ethers.formatEther(escrowBalance)} GWC`);
  console.log(`💰 Deployer remaining: ${ethers.formatEther(remaining)} GWC`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
