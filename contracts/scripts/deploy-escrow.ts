import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const AMOY_RPC = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const GWC_TOKEN = "0x6D938b4C48300A29905FBa272cCdC1207538865f";
const REWARD_ESCROW_ABI = [
  "constructor(address token)",
  "function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof)",
  "function setMerkleRoot(uint256 epoch, bytes32 root) external",
  "function merkleRoots(uint256 epoch) view returns (bytes32)",
  "function isClaimed(uint256 index) view returns (bool)",
  "function owner() view returns (address)",
  "function token() view returns (address)",
];

async function main() {
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");
  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  // Deploy RewardEscrow
  const bytecode = fs.readFileSync("../artifacts/contracts/RewardEscrowV2.sol/RewardEscrowV2.json", "utf8");
  const artifact = JSON.parse(bytecode);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("Deploying RewardEscrowV2...");
  const escrow = await factory.deploy(GWC_TOKEN);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("Deployed RewardEscrowV2 at:", escrowAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
