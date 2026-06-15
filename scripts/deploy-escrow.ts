import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying RewardEscrowV2 to Amoy testnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Polygon Mainnet GWC token address
  const gwcTokenAddress = "0x7709cD433dCCf28467d2c9084f4d4db89f3E87B2";
  console.log("Using GWC Token at:", gwcTokenAddress);

  console.log("Deploying RewardEscrowV2 (non-upgradeable)...");
  const RewardEscrow = await ethers.getContractFactory("RewardEscrowV2");
  const escrow = await RewardEscrow.deploy(gwcTokenAddress);
  
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  console.log(" RewardEscrowV2 deployed at:", escrowAddress);

  // Save to mainnet deployment file
  const mainnetFile = path.join(__dirname, "../deployments/polygon-mainnet.json");
  let mainnetDeployment: any = {};
  if (fs.existsSync(mainnetFile)) {
    mainnetDeployment = JSON.parse(fs.readFileSync(mainnetFile, "utf-8"));
  }
  mainnetDeployment.rewardEscrow = escrowAddress;
  mainnetDeployment.rewardEscrowDeployedAt = new Date().toISOString();
  fs.writeFileSync(mainnetFile, JSON.stringify(mainnetDeployment, null, 2));
  console.log(" Deployment info saved to deployments/polygon-mainnet.json");

  console.log("\n📋 Next steps:");
  console.log("1. Add to coordinator .env:  ESCROW_ADDRESS=" + escrowAddress);
  console.log("2. Fund escrow: PRIVATE_KEY='...' npx hardhat run scripts/fund-escrow.ts --network polygon");
  console.log("3. Verify: npx hardhat verify --network polygon " + escrowAddress + " " + gwcTokenAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
