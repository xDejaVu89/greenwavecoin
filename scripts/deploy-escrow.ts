import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying RewardEscrowV2 to Amoy testnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const deploymentFile = path.join(__dirname, "../deployments/amoy-20251110140958.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const gwcTokenAddress = deployment.contracts.GreenWaveCoin.proxy;

  console.log("Using GWC Token at:", gwcTokenAddress);

  console.log("Deploying RewardEscrowV2 (non-upgradeable)...");
  const RewardEscrow = await ethers.getContractFactory("RewardEscrowV2");
  const escrow = await RewardEscrow.deploy(gwcTokenAddress);
  
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  console.log(" RewardEscrowV2 deployed at:", escrowAddress);

  deployment.contracts.RewardEscrowV2 = {
    address: escrowAddress
  };
  deployment.timestamp = new Date().toISOString();

  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log(" Deployment info updated");
  console.log(`\nFund escrow with GWC tokens: ${escrowAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
