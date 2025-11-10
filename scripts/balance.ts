import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const addr = process.argv[2] || signer.address;

  if (!addr) {
    console.error("Provide an address as the first argument or ensure the signer exists.");
    process.exit(1);
  }

  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    console.error("Set TOKEN_ADDRESS in your .env to the deployed GreenWaveCoin contract address.");
    process.exit(1);
  }

  const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
  const token = await ethers.getContractAt(abi, tokenAddress as string, signer);

  const raw = await token.balanceOf(addr);
  const decimals = await token.decimals();
  const human = ethers.formatUnits(raw, decimals);

  console.log(`Balance of ${addr}: ${human} tokens (${raw.toString()} raw)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});