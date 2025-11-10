import { ethers, upgrades, run } from "hardhat";
import fs from "fs";

/**
 * Upgrade script: GreenWaveCoin -> GreenWaveCoinV2 via Timelock
 * Assumes token ownership is the TimelockController and deployer has proposer/executor roles.
 */
async function main() {
  console.log("🆙 Starting Upgrade to GreenWaveCoinV2...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, `(chainId: ${network.chainId})`);
  console.log("Deployer:", deployer.address, "\n");

  // Resolve addresses from latest testnet deployment or environment
  let tokenProxy: string | undefined;
  let timelockAddress: string | undefined;

  try {
    const files = fs.readdirSync("deployments").filter(f => f.startsWith("testnet-"));
    if (files.length > 0) {
      const latest = files.sort().reverse()[0];
      const deployment = JSON.parse(fs.readFileSync(`deployments/${latest}`, "utf-8"));
      tokenProxy = deployment.contracts.token.proxy;
      timelockAddress = deployment.contracts.timelock;
      console.log("Using deployment file:", latest);
    }
  } catch {}

  tokenProxy = process.env.TOKEN_ADDRESS || tokenProxy;
  timelockAddress = process.env.TIMELOCK_ADDRESS || timelockAddress;

  if (!tokenProxy || !timelockAddress) {
    throw new Error("Missing TOKEN_ADDRESS or TIMELOCK_ADDRESS (env or deployments/)");
  }

  console.log("Token Proxy:", tokenProxy);
  console.log("Timelock:", timelockAddress, "\n");

  // Prepare new implementation
  console.log("📝 Deploying V2 implementation (prepareUpgrade)...");
  const V2Factory = await ethers.getContractFactory("GreenWaveCoinV2");
  // Specify kind explicitly for UUPS proxy
  const newImpl = await upgrades.prepareUpgrade(tokenProxy, V2Factory, { kind: "uups" });
  console.log("✅ New Implementation:", newImpl);

  // Optionally verify implementation
  if (process.env.ETHERSCAN_API_KEY) {
    try {
      console.log("🔍 Verifying V2 implementation...");
      await run("verify:verify", { address: newImpl, constructorArguments: [] });
      console.log("   ✅ Verified\n");
    } catch (e: any) {
      console.log("   ⚠️  Verification skipped/failed:", e.message, "\n");
    }
  }

  // Build timelock operation
  const token = await ethers.getContractAt("GreenWaveCoin", tokenProxy);
  const timelock = await ethers.getContractAt("GreenWaveTimelock", timelockAddress);

  const data = token.interface.encodeFunctionData("upgradeTo", [newImpl]);
  const predecessor = ethers.ZeroHash;
  const salt = ethers.hexlify(ethers.randomBytes(32));
  const minDelay = await timelock.getMinDelay();

  const id = await timelock.hashOperation(tokenProxy, 0, data, predecessor, salt);
  console.log("Operation ID:", id);
  console.log("Min Delay (s):", minDelay.toString());

  // Schedule
  console.log("🗓️  Scheduling upgrade...");
  let tx = await timelock.schedule(tokenProxy, 0, data, predecessor, salt, minDelay);
  await tx.wait();
  console.log("   ✅ Scheduled");

  // Wait until ready (on public testnet you'll need to wait wall-clock time)
  console.log("⏳ Waiting for ETA to elapse...");
  const intervalMs = 10000;
  while (!(await timelock.isOperationReady(id))) {
    await new Promise(r => setTimeout(r, intervalMs));
    process.stdout.write(".");
  }
  console.log("\n✅ Operation ready");

  // Execute
  console.log("🚀 Executing upgrade via Timelock...");
  tx = await timelock.execute(tokenProxy, 0, data, predecessor, salt);
  const receipt = await tx.wait();
  console.log("   ✅ Executed in tx:", receipt?.hash);

  // Post-check
  const implAfter = await upgrades.erc1967.getImplementationAddress(tokenProxy);
  console.log("Implementation after:", implAfter);
  // normalize addresses (newImpl may be returned as object depending on plugin version)
  const newImplAddress = typeof newImpl === 'string' ? newImpl : (newImpl as any).toString();
  if (implAfter.toLowerCase() !== newImplAddress.toLowerCase()) {
    throw new Error("Upgrade did not take effect");
  }

  console.log("🧪 Verifying new function...");
  const v2 = await ethers.getContractAt("GreenWaveCoinV2", tokenProxy);
  const version = await v2.version();
  console.log("version():", version.toString());
  if (version !== 2n) throw new Error("version() did not return 2");

  console.log("\n🎉 UPGRADE SUCCESSFUL");
}

main().catch((e) => {
  console.error("❌ Upgrade failed:", e);
  process.exit(1);
});
