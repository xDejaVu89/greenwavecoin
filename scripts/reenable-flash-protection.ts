import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const gwcAddress = "0x11b48853Ce85Ebf4b1a0AEd9cbE1c951017E16F9";

  const gwcAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function flashProtectionEnabled() view returns (bool)",
    "function maxTransferAmount() view returns (uint256)",
    "function maxTransfersPerBlock() view returns (uint256)",
    "function configureFlashLoanProtection(bool enabled, uint256 maxAmount, uint256 maxPerBlock)",
  ];

  const gwc = new ethers.Contract(gwcAddress, gwcAbi, deployer);

  const flashEnabled = await gwc.flashProtectionEnabled();
  console.log(`Flash protection currently: ${flashEnabled}`);

  const deployerBalance = await gwc.balanceOf(deployer.address);
  console.log(`Deployer GWC balance: ${ethers.formatEther(deployerBalance)} GWC`);

  const escrowBalance = await gwc.balanceOf("0xB73385634051a14Be22B2973Fc530A122e3548B0");
  console.log(`Escrow GWC balance: ${ethers.formatEther(escrowBalance)} GWC`);

  if (!flashEnabled) {
    console.log("\nRe-enabling flash protection with sensible limits...");
    // maxTransferAmount: 210,000 GWC (1% of 21M supply) — allows normal trading
    // maxTransfersPerBlock: 5 — prevents flash loan attacks
    const tx = await gwc.configureFlashLoanProtection(
      true,
      ethers.parseEther("210000"),
      5
    );
    await tx.wait();
    console.log(`✅ Flash protection re-enabled. Tx: ${tx.hash}`);

    const newMax = await gwc.maxTransferAmount();
    const newPerBlock = await gwc.maxTransfersPerBlock();
    console.log(`   maxTransferAmount: ${ethers.formatEther(newMax)} GWC`);
    console.log(`   maxTransfersPerBlock: ${newPerBlock}`);
  } else {
    console.log("Flash protection is already enabled.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
