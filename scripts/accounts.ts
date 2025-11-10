import { ethers } from "hardhat";

async function main() {
  console.log("\nNetwork accounts:");
  console.log("================");
  
  const signers = await ethers.getSigners();
  
  for (const signer of signers) {
    const balance = await ethers.provider.getBalance(signer.address);
    console.log(
      `Address: ${signer.address}
      Balance: ${ethers.formatEther(balance)} ETH\n`
    );
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}