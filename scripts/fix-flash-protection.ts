import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const gwcAddress = "0x7709cD433dCCf28467d2c9084f4d4db89f3E87B2";

  // Correct ABI - note parameter order: (bool enabled, uint256 maxTransfersPerBlock, uint256 maxTransferAmount)
  const gwcAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function flashProtectionEnabled() view returns (bool)",
    "function maxTransferAmount() view returns (uint256)",
    "function maxTransfersPerBlock() view returns (uint256)",
    "function configureFlashLoanProtection(bool enabled, uint256 maxTransfersPerBlock, uint256 maxTransferAmount)",
  ];

  const gwc = new ethers.Contract(gwcAddress, gwcAbi, deployer);

  // Current state
  const flashEnabled = await gwc.flashProtectionEnabled();
  const maxAmount = await gwc.maxTransferAmount();
  const maxPerBlock = await gwc.maxTransfersPerBlock();
  console.log(`\nCurrent state:`);
  console.log(`  flashProtectionEnabled: ${flashEnabled}`);
  console.log(`  maxTransfersPerBlock: ${maxPerBlock}`);
  console.log(`  maxTransferAmount: ${ethers.formatEther(maxAmount)} GWC`);

  // Fix: set correct values
  // maxTransfersPerBlock = 5 (anti flash loan)
  // maxTransferAmount = 210,000 GWC (1% of supply, allows normal trading and LP seeding)
  console.log(`\nFixing flash protection parameters...`);
  console.log(`  Setting maxTransfersPerBlock = 5`);
  console.log(`  Setting maxTransferAmount = 210,000 GWC`);

  const tx = await gwc.configureFlashLoanProtection(
    true,                           // enabled
    5,                              // maxTransfersPerBlock
    ethers.parseEther("210000")     // maxTransferAmount = 210,000 GWC
  );
  await tx.wait();
  console.log(`✅ Fixed. Tx: ${tx.hash}`);

  // Verify
  const newFlash = await gwc.flashProtectionEnabled();
  const newMax = await gwc.maxTransferAmount();
  const newPerBlock = await gwc.maxTransfersPerBlock();
  console.log(`\nVerified state:`);
  console.log(`  flashProtectionEnabled: ${newFlash}`);
  console.log(`  maxTransfersPerBlock: ${newPerBlock}`);
  console.log(`  maxTransferAmount: ${ethers.formatEther(newMax)} GWC`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
