import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Funding RewardEscrow with GWC tokens...\n");

  // Load deployment info
  const deploymentsPath = path.join(__dirname, "..", "deployments");
  const deploymentFile = fs.readdirSync(deploymentsPath)
    .filter(f => f.startsWith("amoy-"))
    .sort()
    .reverse()[0]; // Get latest
  
  const deploymentPath = path.join(deploymentsPath, deploymentFile);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

  const gwcAddress = deployment.contracts.GreenWaveCoin.proxy;
  const escrowAddress = deployment.contracts.RewardEscrowV2.address;

  console.log("📝 Contract Addresses:");
  console.log(`   GWC Token: ${gwcAddress}`);
  console.log(`   Escrow: ${escrowAddress}\n`);

  // Get deployer wallet
  const [deployer] = await ethers.getSigners();
  console.log(`💰 Deployer: ${deployer.address}`);

  // Connect to GWC token
  const gwc = await ethers.getContractAt("GreenWaveCoin", gwcAddress);

  // Check deployer balance
  const balance = await gwc.balanceOf(deployer.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} GWC\n`);

  // Transfer amount (100,000 GWC for rewards pool)
  const transferAmount = ethers.parseEther("100000");
  
  console.log(`📤 Transferring ${ethers.formatEther(transferAmount)} GWC to escrow...`);
  
  const tx = await gwc.transfer(escrowAddress, transferAmount);
  console.log(`   Transaction: ${tx.hash}`);
  
  await tx.wait();
  console.log("   ✅ Transfer confirmed!\n");

  // Verify escrow balance
  const escrowBalance = await gwc.balanceOf(escrowAddress);
  console.log(`✅ Escrow funded with ${ethers.formatEther(escrowBalance)} GWC`);
  
  // Check deployer remaining balance
  const remainingBalance = await gwc.balanceOf(deployer.address);
  console.log(`💰 Deployer remaining: ${ethers.formatEther(remainingBalance)} GWC`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
