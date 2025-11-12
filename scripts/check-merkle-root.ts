import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🔍 Checking RewardEscrow Merkle root...\n");

  // Load deployment info
  const deploymentsPath = path.join(__dirname, "..", "deployments");
  const deploymentFile = fs.readdirSync(deploymentsPath)
    .filter(f => f.startsWith("amoy-"))
    .sort()
    .reverse()[0];
  
  const deploymentPath = path.join(deploymentsPath, deploymentFile);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

  const escrowAddress = deployment.contracts.RewardEscrowV2.address;
  console.log(`📝 RewardEscrow: ${escrowAddress}\n`);

  // Connect to escrow contract
  const escrow = await ethers.getContractAt("RewardEscrowV2", escrowAddress);

  // Check epoch 0
  const epoch = 0;
  const root = await escrow.merkleRoots(epoch);
  const total = await escrow.epochTotals(epoch);
  
  console.log(`📊 Epoch ${epoch}:`);
  console.log(`   Root: ${root}`);
  console.log(`   Total: ${ethers.formatEther(total)} GWC`);
  
  if (root === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    console.log("\n⚠️  Root is not set yet!");
  } else {
    console.log("\n✅ Root is set and ready for claims!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
