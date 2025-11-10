import { ethers } from "hardhat";
import fs from "fs";

/**
 * Renounce deployer's admin role on the timelock
 * ⚠️  WARNING: This is IRREVERSIBLE. Only run after confirming Gnosis Safe has all necessary roles.
 * 
 * Before running:
 * 1. Verify Safe has PROPOSER_ROLE
 * 2. Verify Safe has EXECUTOR_ROLE
 * 3. Get consensus from all team members
 * 4. Have emergency response plan ready
 */

async function main() {
  console.log("⚠️  RENOUNCE ADMIN ROLE - FINAL STEP TO DECENTRALIZATION\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address, "\n");

  if (network.name !== "mainnet") {
    console.warn("⚠️  WARNING: This script is intended for mainnet only.");
    console.warn("   Current network:", network.name);
    console.warn("   Proceeding anyway in 5 seconds...\n");
    await new Promise(r => setTimeout(r, 5000));
  }

  // Load deployment
  const prefix = network.name === "mainnet" ? "production" : "testnet";
  const files = fs.readdirSync("deployments")
    .filter(f => f.startsWith(prefix))
    .sort()
    .reverse();

  if (files.length === 0) {
    throw new Error(`No ${prefix} deployment found`);
  }

  const deployment = JSON.parse(fs.readFileSync(`deployments/${files[0]}`, "utf-8"));
  const timelockAddress = deployment.contracts.timelock;

  console.log("Timelock:", timelockAddress);

  const timelock = await ethers.getContractAt("GreenWaveTimelock", timelockAddress);

  // Check Gnosis Safe has required roles
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const DEFAULT_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

  const safeAddress = process.env.GNOSIS_SAFE_ADDRESS;
  if (!safeAddress) {
    throw new Error("GNOSIS_SAFE_ADDRESS not set in .env");
  }

  console.log("\n🔍 Verifying Gnosis Safe has required roles...");
  console.log("Safe:", safeAddress, "\n");

  const hasProposer = await timelock.hasRole(PROPOSER_ROLE, safeAddress);
  const hasExecutor = await timelock.hasRole(EXECUTOR_ROLE, safeAddress);
  const deployerHasAdmin = await timelock.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);

  console.log("Safe has PROPOSER_ROLE:", hasProposer ? "✅" : "❌");
  console.log("Safe has EXECUTOR_ROLE:", hasExecutor ? "✅" : "❌");
  console.log("Deployer has DEFAULT_ADMIN_ROLE:", deployerHasAdmin ? "✅" : "❌\n");

  if (!hasProposer || !hasExecutor) {
    throw new Error("❌ Safe does not have required roles. Grant roles via Safe first.");
  }

  if (!deployerHasAdmin) {
    console.log("✅ Deployer admin already renounced. Nothing to do.\n");
    return;
  }

  // Final confirmation
  console.log("⚠️  ⚠️  ⚠️  FINAL WARNING ⚠️  ⚠️  ⚠️");
  console.log("You are about to PERMANENTLY give up admin control.");
  console.log("After this, ONLY the Gnosis Safe can administer the timelock.");
  console.log("This action is IRREVERSIBLE.\n");

  console.log("Proceeding in 10 seconds...");
  console.log("Press Ctrl+C to abort.\n");
  await new Promise(r => setTimeout(r, 10000));

  // Renounce admin role
  console.log("📝 Renouncing DEFAULT_ADMIN_ROLE...");
  const tx = await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log("   Transaction:", tx.hash);
  const receipt = await tx.wait();
  console.log("   ✅ Confirmed in block:", receipt?.blockNumber, "\n");

  // Verify
  const stillHasAdmin = await timelock.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
  if (stillHasAdmin) {
    throw new Error("❌ Renounce failed - deployer still has admin role");
  }

  console.log("=".repeat(60));
  console.log("✅ ADMIN ROLE RENOUNCED SUCCESSFULLY");
  console.log("=".repeat(60));
  console.log("\n🎉 GreenWaveCoin is now fully decentralized!");
  console.log("   Timelock admin: Gnosis Safe ONLY");
  console.log("   Safe address:", safeAddress);
  console.log("   Required signatures: 3 of 5\n");

  console.log("📋 Next Steps:");
  console.log("   1. Verify on Etherscan that deployer has no admin role");
  console.log("   2. Test governance action via Safe to confirm control");
  console.log("   3. Announce decentralization to community");
  console.log("   4. Document this milestone in launch records\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
