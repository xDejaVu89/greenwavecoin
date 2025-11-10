import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const address = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(address);
  
  console.log("\n=== Wallet Information ===");
  console.log("Address:", address);
  console.log("Balance:", ethers.formatEther(balance), "MATIC");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
  
  const balanceNum = parseFloat(ethers.formatEther(balance));
  if (balanceNum < 0.1) {
    console.log("\n⚠️  WARNING: Low balance!");
    console.log("Get test MATIC from:");
    console.log("• https://faucet.polygon.technology/ (Polygon Amoy)");
    console.log("• https://www.alchemy.com/faucets/polygon-amoy");
  } else {
    console.log("\n✅ Sufficient balance for deployment!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
