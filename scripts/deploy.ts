import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying GreenWaveCoin with account:", deployer.address);

  const GreenWaveCoin = await ethers.getContractFactory("GreenWaveCoin");
  const token = await GreenWaveCoin.deploy();
  await token.waitForDeployment();

  console.log("GreenWaveCoin deployed to:", await token.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });