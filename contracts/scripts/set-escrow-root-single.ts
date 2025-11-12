import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const AMOY_RPC = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ESCROW = process.env.ESCROW_ADDRESS || "0x6a5e4DE78a5Be75c308fCb5833ECC35412511D86";
const GWC_TOKEN = "0x6D938b4C48300A29905FBa272cCdC1207538865f";

const ESCROW_ABI = [
  "function setMerkleRoot(uint256 epoch, bytes32 root, uint256 totalAmount) external",
  "function merkleRoots(uint256 epoch) view returns (bytes32)"
];

const GWC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function main() {
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set");
  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const account = wallet.address; // claim to owner account for test
  const index = 0n;
  const amount = "50.0"; // 50 GWC
  const amountWei = ethers.parseEther(amount);

  const leafHash = ethers.solidityPackedKeccak256(["uint256","address","uint256"],[index, account, amountWei]);
  const root = leafHash; // single-leaf tree root equals leaf

  const gwc = new ethers.Contract(GWC_TOKEN, GWC_ABI, provider);
  const decimals = await gwc.decimals();
  const escrowBalance = await gwc.balanceOf(ESCROW);
  console.log("Escrow balance:", ethers.formatUnits(escrowBalance, decimals));

  const escrow = new ethers.Contract(ESCROW, ESCROW_ABI, wallet);
  const epoch = Number(process.env.MERKLE_EPOCH ?? 0);
  console.log("Setting epoch", epoch, "root to", root);
  const tx = await escrow.setMerkleRoot(epoch, root, escrowBalance);
  console.log("tx:", tx.hash);
  await tx.wait();
  const onChain = await escrow.merkleRoots(epoch);
  console.log("On-chain root:", onChain);
}

main().catch(err => { console.error(err); process.exit(1); });
