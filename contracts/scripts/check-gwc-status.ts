import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const AMOY_RPC = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const GWC_TOKEN = "0x6D938b4C48300A29905FBa272cCdC1207538865f";
const OLD_ESCROW = "0x2F3F050Ba9701c18E852011258fe6FF858BC0ED0";
const NEW_ESCROW = "0x9Ad4250d363DC6781717B731242ac9EC1F3B2a3b";

const GWC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

const ESCROW_ABI = [
  "function merkleRoots(uint256 epoch) view returns (bytes32)",
  "function owner() view returns (address)",
  "function token() view returns (address)",
];

async function main() {
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set");
  
  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const walletAddress = wallet.address;

  console.log("\n=== GreenWaveCoin Testnet Status ===\n");
  console.log("Network: Polygon Amoy Testnet");
  console.log("Wallet:", walletAddress);
  console.log("\n--- GWC Token ---");
  console.log("Address:", GWC_TOKEN);

  const gwc = new ethers.Contract(GWC_TOKEN, GWC_ABI, provider);
  
  try {
    const symbol = await gwc.symbol();
    const decimals = await gwc.decimals();
    const totalSupply = await gwc.totalSupply();
    const walletBalance = await gwc.balanceOf(walletAddress);
    const oldEscrowBalance = await gwc.balanceOf(OLD_ESCROW);
    const newEscrowBalance = await gwc.balanceOf(NEW_ESCROW);

    console.log("Symbol:", symbol);
    console.log("Total Supply:", ethers.formatEther(totalSupply), symbol);
    console.log("Your Balance:", ethers.formatEther(walletBalance), symbol);

    console.log("\n--- Old RewardEscrow ---");
    console.log("Address:", OLD_ESCROW);
    console.log("Balance:", ethers.formatEther(oldEscrowBalance), symbol);
    
    const oldEscrow = new ethers.Contract(OLD_ESCROW, ESCROW_ABI, provider);
    try {
      const oldOwner = await oldEscrow.owner();
      const oldRoot = await oldEscrow.merkleRoots(0);
      console.log("Owner:", oldOwner);
      console.log("Merkle Root (epoch 0):", oldRoot);
    } catch (e: any) {
      console.log("Could not read old escrow details:", e.message);
    }

    console.log("\n--- New RewardEscrow ---");
    console.log("Address:", NEW_ESCROW);
    console.log("Balance:", ethers.formatEther(newEscrowBalance), symbol);
    
    const newEscrow = new ethers.Contract(NEW_ESCROW, ESCROW_ABI, provider);
    const newOwner = await newEscrow.owner();
    const newRoot = await newEscrow.merkleRoots(0);
    console.log("Owner:", newOwner);
    console.log("Merkle Root (epoch 0):", newRoot);
    console.log("Owner matches wallet:", newOwner.toLowerCase() === walletAddress.toLowerCase() ? "✅ YES" : "❌ NO");

    console.log("\n--- Status Summary ---");
    console.log("✅ GWC Token: Deployed and functional");
    console.log(parseFloat(ethers.formatEther(newEscrowBalance)) > 0 ? "✅" : "❌", "New Escrow Funded:", ethers.formatEther(newEscrowBalance), symbol);
    console.log(newRoot !== ethers.ZeroHash ? "✅" : "❌", "Merkle Root Set:", newRoot === ethers.ZeroHash ? "Not set" : "Set");
    
  } catch (error: any) {
    console.error("Error checking status:", error.message);
  }
}

main().catch(console.error);
