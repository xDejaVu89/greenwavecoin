import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const AMOY_RPC = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const GWC_TOKEN = "0x6D938b4C48300A29905FBa272cCdC1207538865f";
const NEW_ESCROW = process.env.ESCROW_ADDRESS || "0x9Ad4250d363DC6781717B731242ac9EC1F3B2a3b";

const GWC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in .env");

  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const gwc = new ethers.Contract(GWC_TOKEN, GWC_ABI, wallet);

  const decimals = await gwc.decimals();
  const amount = ethers.parseUnits("200", decimals); // 200 GWC

  console.log(`Transferring 200 GWC to escrow ${NEW_ESCROW} from ${wallet.address}`);
  const tx = await gwc.transfer(NEW_ESCROW, amount);
  console.log("Transaction submitted:", tx.hash);
  await tx.wait();
  console.log("Transfer confirmed.");

  const newBalance = await gwc.balanceOf(NEW_ESCROW);
  console.log("New escrow balance:", ethers.formatUnits(newBalance, decimals));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
