import { ethers } from "ethers";
import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const AMOY_RPC = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NEW_ESCROW = process.env.ESCROW_ADDRESS || "0x9Ad4250d363DC6781717B731242ac9EC1F3B2a3b";
const GWC_TOKEN = "0x6D938b4C48300A29905FBa272cCdC1207538865f";
const USERNAME = process.env.FAH_USERNAME || "Anonymous";
const USE_SINGLE_LEAF = process.env.SINGLE_LEAF === "1";

const ESCROW_ABI = [
  "function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof)",
];

const GWC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
];

async function main() {
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");

  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";

  // Pre: read balances
  const token = new ethers.Contract(GWC_TOKEN, GWC_ABI, provider);
  const symbol = await token.symbol();
  const before = await token.balanceOf(wallet.address);
  console.log("Wallet:", wallet.address);
  console.log("Balance before:", ethers.formatEther(before), symbol);

  let index: number;
  const account: string = wallet.address;
  let amountStr: string;
  let proof: string[];

  if (USE_SINGLE_LEAF) {
    // Use a direct single-leaf claim: (index=0, amount=50.0, proof=[])
    index = 0;
    amountStr = "50.0";
    proof = [];
    console.log("Using single-leaf claim params (no backend)");
  } else {
    // Fetch proof from backend
    const proofUrl = `${backendUrl}/api/fah/proof/${wallet.address}/${encodeURIComponent(USERNAME)}`;
    console.log("Fetching proof:", proofUrl);
    const { data } = await axios.get(proofUrl);
    if (!data.success) {
      throw new Error(data.error || "Failed to get proof");
    }
    index = data.index;
    amountStr = data.amount; // decimal string
    proof = data.proof;
  }

  const amountWei = ethers.parseEther(amountStr);

  console.log("Claim params:", { index, account, amount: amountStr, proofLen: proof.length });

  // Claim
  const escrow = new ethers.Contract(NEW_ESCROW, ESCROW_ABI, wallet);
  const tx = await escrow.claim(index, account, amountWei, proof);
  console.log("Transaction submitted:", tx.hash);
  await tx.wait();
  console.log("Claim confirmed.");

  const after = await token.balanceOf(wallet.address);
  console.log("Balance after:", ethers.formatEther(after), symbol);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
