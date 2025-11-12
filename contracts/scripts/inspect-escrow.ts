import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const AMOY_RPC = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const ESCROW = "0x9Ad4250d363DC6781717B731242ac9EC1F3B2a3b";

const ABI = [
  "function merkleRoots(uint256) view returns (bytes32)",
  "function owner() view returns (address)",
  "function isClaimed(uint256) view returns (bool)",
  "function currentEpoch() view returns (uint256)",
  "function epoch() view returns (uint256)",
  "function activeEpoch() view returns (uint256)",
  "function getCurrentEpoch() view returns (uint256)",
  "function setCurrentEpoch(uint256) external",
  "function setEpoch(uint256) external",
  "function activateEpoch(uint256) external",
  "function token() view returns (address)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  const c = new ethers.Contract(ESCROW, ABI, provider);
  const tryCall = async (name: string, args: any[] = []) => {
    try {
      const v = await c[name](...args);
      console.log(name + ":", v.toString ? v.toString() : v);
    } catch (e: any) {
      console.log(name + ":", "(n/a)");
    }
  };

  await tryCall("owner");
  await tryCall("merkleRoots", [0]);
  await tryCall("merkleRoots", [1]);
  await tryCall("currentEpoch");
  await tryCall("epoch");
  await tryCall("activeEpoch");
  await tryCall("getCurrentEpoch");
}

main().catch(console.error);
