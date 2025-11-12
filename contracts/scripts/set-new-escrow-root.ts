import { ethers } from "ethers";
import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const AMOY_RPC = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NEW_ESCROW = process.env.ESCROW_ADDRESS || "0x9Ad4250d363DC6781717B731242ac9EC1F3B2a3b";
const GWC_TOKEN = "0x6D938b4C48300A29905FBa272cCdC1207538865f";

const ESCROW_ABI = [
  "function setMerkleRoot(uint256 epoch, bytes32 root, uint256 totalAmount) external",
  "function merkleRoots(uint256 epoch) view returns (bytes32)",
];

const GWC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function main() {
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");

  // Read backend merkle root
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
  console.log("Fetching merkle root from backend at", `${backendUrl}/api/merkle/root`);
  const res = await axios.get(`${backendUrl}/api/merkle/root`);
  if (!res.data || !res.data.merkleRoot) {
    throw new Error("Backend did not return a merkle root");
  }
  const root: string = res.data.merkleRoot;
  console.log("Backend root:", root);

  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  // Read escrow token balance to use as totalAmount
  const gwc = new ethers.Contract(GWC_TOKEN, GWC_ABI, provider);
  const decimals = await gwc.decimals();
  const escrowBalance = await gwc.balanceOf(NEW_ESCROW);
  console.log("Escrow token balance:", ethers.formatUnits(escrowBalance, decimals));

  const totalAmount = escrowBalance; // use actual escrow balance as totalAmount

  const escrow = new ethers.Contract(NEW_ESCROW, ESCROW_ABI, wallet);

  // Set merkle root on desired epoch (use 1 if 0 already set)
  const epoch = Number(process.env.MERKLE_EPOCH ?? 1);
  console.log(`Setting merkle root on new escrow (epoch ${epoch})`);
  const tx = await escrow.setMerkleRoot(epoch, root, totalAmount);
  console.log("Transaction submitted:", tx.hash);
  await tx.wait();
  console.log("Merkle root set.");

  const onChainRoot = await escrow.merkleRoots(epoch);
  console.log(`On-chain root for epoch ${epoch}:`, onChainRoot);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
