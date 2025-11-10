import { ethers, upgrades } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Governance no-op orchestrator (idempotent)
 * - If a pending no-op exists: do nothing
 * - If a ready no-op exists: execute it
 * - If no recent noop exists: schedule a new one to current impl
 *
 * Safe to run on a cron (e.g., every 30 mins) during the soak.
 */
async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const isMainnet = network.name === 'mainnet';

  console.log(`\n🧭 Governance NO-OP orchestrator on ${network.name}`);
  console.log('Operator:', signer.address);

  // Resolve addresses
  let tokenProxy: string | undefined = process.env.TOKEN_ADDRESS;
  let timelockAddr: string | undefined = process.env.TIMELOCK_ADDRESS;

  try {
    if (!tokenProxy || !timelockAddr) {
      const prefix = isMainnet ? 'production' : 'testnet';
      const files = fs.readdirSync('deployments').filter(f => f.startsWith(prefix)).sort().reverse();
      if (!files.length) throw new Error(`No ${prefix} deployment found`);
      const d = JSON.parse(fs.readFileSync(path.join('deployments', files[0]), 'utf-8'));
      tokenProxy = tokenProxy || d.contracts.token.proxy;
      timelockAddr = timelockAddr || d.contracts.timelock;
      console.log('Using deployment file:', files[0]);
    }
  } catch (e: any) {
    console.error('❌ Failed to resolve addresses:', e.message);
    process.exit(1);
  }

  if (!tokenProxy || !timelockAddr) throw new Error('Missing TOKEN_ADDRESS or TIMELOCK_ADDRESS');

  const token = await ethers.getContractAt('GreenWaveCoin', tokenProxy);
  const timelock = await ethers.getContractAt('GreenWaveTimelock', timelockAddr);

  // Determine current impl and calldata
  const currentImpl = await upgrades.erc1967.getImplementationAddress(tokenProxy);
  const calldata = token.interface.encodeFunctionData('upgradeTo', [currentImpl]);
  const predecessor = ethers.ZeroHash;

  // Load latest noop artifact for this network if present
  let latestArtifact: any | undefined;
  try {
    const files = fs.readdirSync('rehearsals')
      .filter(f => f.startsWith('noop-') && f.includes(network.name))
      .sort().reverse();
    if (files.length) {
      latestArtifact = JSON.parse(fs.readFileSync(path.join('rehearsals', files[0]), 'utf-8'));
      console.log('Found latest noop artifact:', files[0]);
    }
  } catch {}

  // If we have an artifact, reuse its salt; otherwise create a new one
  let salt: string;
  if (latestArtifact && latestArtifact.salt) {
    salt = latestArtifact.salt;
  } else {
    salt = ethers.hexlify(ethers.randomBytes(32));
  }

  const opId = await timelock.hashOperation(tokenProxy, 0, calldata, predecessor, salt);
  const pending = await timelock.isOperationPending(opId);
  const ready = await timelock.isOperationReady(opId);
  const done = await timelock.isOperationDone(opId);

  console.log('Token proxy:', tokenProxy);
  console.log('Timelock:', timelockAddr);
  console.log('Current implementation:', currentImpl);
  console.log('Operation ID:', opId);
  console.log('Status: pending=', pending, ' ready=', ready, ' done=', done);

  const outDir = 'rehearsals';
  fs.mkdirSync(outDir, { recursive: true });

  if (ready) {
    console.log('🚀 Ready to execute NO-OP upgrade...');
    const tx = await timelock.execute(tokenProxy, 0, calldata, predecessor, salt);
    const receipt = await tx.wait();
    console.log('✅ Executed tx:', receipt?.hash);

    const out = {
      kind: 'noop',
      action: 'executed',
      network: network.name,
      tokenProxy,
      timelock: timelockAddr,
      implementation: currentImpl,
      operationId: opId,
      salt,
      timestamp: new Date().toISOString(),
      txHash: receipt?.hash
    };
    fs.writeFileSync(path.join(outDir, `noop-executed-${network.name}-${Date.now()}.json`), JSON.stringify(out, null, 2));
    return;
  }

  if (pending) {
    console.log('⏳ Operation already pending. Waiting for ETA; nothing to do.');
    return;
  }

  if (!done) {
    // If not pending and not ready and not done, schedule a fresh op (with current salt)
    const minDelay = await timelock.getMinDelay();
    console.log('🗓️  Scheduling NO-OP upgrade. Min delay (s):', minDelay.toString());
    const tx = await timelock.schedule(tokenProxy, 0, calldata, predecessor, salt, minDelay);
    await tx.wait();

    const out = {
      kind: 'noop',
      action: 'scheduled',
      network: network.name,
      tokenProxy,
      timelock: timelockAddr,
      implementation: currentImpl,
      operationId: opId,
      salt,
      minDelay: minDelay.toString(),
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(path.join(outDir, `noop-scheduled-${network.name}-${Date.now()}.json`), JSON.stringify(out, null, 2));
    console.log('✅ Scheduled. Will execute after the delay.');
    return;
  }

  // done == true and not pending/ready -> schedule a new cycle with a fresh salt
  const newSalt = ethers.hexlify(ethers.randomBytes(32));
  const newOpId = await timelock.hashOperation(tokenProxy, 0, calldata, predecessor, newSalt);
  const minDelay2 = await timelock.getMinDelay();
  console.log('🔁 Previous noop done. Scheduling a new cycle...');
  const tx2 = await timelock.schedule(tokenProxy, 0, calldata, predecessor, newSalt, minDelay2);
  await tx2.wait();
  const out2 = {
    kind: 'noop',
    action: 'scheduled',
    network: network.name,
    tokenProxy,
    timelock: timelockAddr,
    implementation: currentImpl,
    operationId: newOpId,
    salt: newSalt,
    minDelay: minDelay2.toString(),
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outDir, `noop-scheduled-${network.name}-${Date.now()}.json`), JSON.stringify(out2, null, 2));
  console.log('✅ New noop scheduled.');
}

main().catch(e => { console.error('❌ Governance NO-OP failed:', e); process.exit(1); });
