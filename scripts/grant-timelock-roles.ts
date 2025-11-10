import { ethers } from "hardhat";
import fs from "fs";

/**
 * Grants PROPOSER and EXECUTOR roles on the Timelock to GNOSIS_SAFE_ADDRESS from .env
 *
 * Usage:
 *   npx hardhat run scripts/grant-timelock-roles.ts --network <network>
 *
 * Notes:
 * - Reads latest deployment file for the selected network (production-* for mainnet, testnet-* otherwise)
 * - Safe address must be set in .env as GNOSIS_SAFE_ADDRESS
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("🔐 Granting Timelock Roles\n");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);

  const safe = process.env.GNOSIS_SAFE_ADDRESS;
  if (!safe) {
    throw new Error("GNOSIS_SAFE_ADDRESS is not set in .env");
  }
  console.log("Gnosis Safe:", safe);

  // Load latest deployment for this network
  const prefix = network.name === "mainnet" ? "production" : "testnet";
  const files = fs.readdirSync("deployments").filter(f => f.startsWith(prefix)).sort().reverse();
  if (files.length === 0) throw new Error(`No ${prefix} deployments found.`);
  const deployment = JSON.parse(fs.readFileSync(`deployments/${files[0]}`, "utf-8"));

  const timelockAddress = deployment.contracts.timelock;
  if (!timelockAddress) throw new Error("Timelock address not found in deployment file");

  console.log("Timelock:", timelockAddress);

  const timelock = await ethers.getContractAt("GreenWaveTimelock", timelockAddress);

  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();

  const hasProposer = await timelock.hasRole(PROPOSER_ROLE, safe);
  const hasExecutor = await timelock.hasRole(EXECUTOR_ROLE, safe);

  console.log("\nCurrent Roles:");
  console.log("  Safe has PROPOSER_ROLE:", hasProposer ? "✅" : "❌");
  console.log("  Safe has EXECUTOR_ROLE:", hasExecutor ? "✅" : "❌");

  if (!hasProposer) {
    console.log("📝 Granting PROPOSER_ROLE to Safe...");
    const tx = await timelock.grantRole(PROPOSER_ROLE, safe);
    console.log("   tx:", tx.hash);
    await tx.wait();
    console.log("   ✅ Granted PROPOSER_ROLE");
  } else {
    console.log("   ℹ️  PROPOSER_ROLE already granted");
  }

  if (!hasExecutor) {
    console.log("📝 Granting EXECUTOR_ROLE to Safe...");
    const tx = await timelock.grantRole(EXECUTOR_ROLE, safe);
    console.log("   tx:", tx.hash);
    await tx.wait();
    console.log("   ✅ Granted EXECUTOR_ROLE");
  } else {
    console.log("   ℹ️  EXECUTOR_ROLE already granted");
  }

  console.log("\n✅ Role grant process complete.");
}

main().catch((e) => { console.error("❌ Failed:", e); process.exit(1); });
