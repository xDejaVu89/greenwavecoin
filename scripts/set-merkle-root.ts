import { ethers } from "hardhat";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🔐 Setting Merkle root on RewardEscrow contract...\n");

  // Load deployment info
  const deploymentsPath = path.join(__dirname, "..", "deployments");
  const deploymentFile = fs.readdirSync(deploymentsPath)
    .filter(f => f.startsWith("amoy-"))
    .sort()
    .reverse()[0]; // Get latest
  
  const deploymentPath = path.join(deploymentsPath, deploymentFile);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

  const escrowAddress = deployment.contracts.RewardEscrowV2.address;
  console.log(`📝 RewardEscrow: ${escrowAddress}\n`);

  // Get Merkle root from backend
  console.log("🌳 Fetching Merkle root from backend...");
  try {
    const response = await axios.get("http://localhost:3000/api/fah/merkle-root");
    
    if (!response.data.success) {
      console.error("❌ Failed to get Merkle root from backend");
      process.exit(1);
    }

    const merkleRoot = response.data.root;
    const claimCount = response.data.claimCount || 'unknown';
    
    console.log(`   Root: ${merkleRoot}`);
    console.log(`   Claims: ${claimCount}\n`);

    if (merkleRoot === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log("⚠️  No claims in tree - cannot set root (would allow anyone to claim)");
      console.log("   First, verify some FAH usernames to create claims");
      process.exit(1);
    }

    // Get deployer wallet
    const [deployer] = await ethers.getSigners();
    console.log(`💰 Deployer: ${deployer.address}\n`);

    // Connect to escrow contract
    const escrow = await ethers.getContractAt("RewardEscrowV2", escrowAddress);

    // Check if we're the owner
    try {
      const owner = await escrow.owner();
      if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error(`❌ Not the owner! Owner is ${owner}`);
        process.exit(1);
      }
    } catch (e: any) {
      console.log("   (Contract may not have owner() function, continuing...)");
    }

    // Set Merkle root
    console.log("📤 Setting Merkle root on contract...");
    
    // Epoch 0 for initial setup, total amount will be calculated from database
    const epoch = 0;
    // For now, use a large total (we have 100K GWC in escrow)
    const totalAmount = ethers.parseEther("100000");
    
    const tx = await escrow.setMerkleRoot(epoch, merkleRoot, totalAmount);
    console.log(`   Transaction: ${tx.hash}`);
    
    await tx.wait();
    console.log("   ✅ Merkle root set!\n");

    // Verify it was set
    const currentRoot = await escrow.merkleRoots(epoch);
    console.log(`✅ Current root for epoch ${epoch}: ${currentRoot}`);
    
    if (currentRoot === merkleRoot) {
      console.log("🎉 Merkle root successfully set and verified!");
    } else {
      console.error("❌ Root mismatch - something went wrong!");
    }

  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error("❌ Backend not running! Start it with: cd backend && npm run dev");
    } else {
      console.error("❌ Error:", error.message);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
