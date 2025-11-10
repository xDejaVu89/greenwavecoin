import { ethers, upgrades } from "hardhat";
import fs from "fs";

/**
 * Schedule a no-op upgrade through the Timelock to test governance path.
 * It queues an upgradeTo() to the CURRENT implementation address, so execution is safe.
 * Requires: TOKEN_ADDRESS and TIMELOCK_ADDRESS set via latest deployments file or .env
 */
async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`\n🧪 Scheduling NO-OP upgrade on ${network.name}`);
  console.log('Proposer/Executor account:', signer.address);

  // Resolve addresses
  let tokenProxy: string | undefined = process.env.TOKEN_ADDRESS;
  let timelockAddr: string | undefined = process.env.TIMELOCK_ADDRESS;

  try {
    if (!tokenProxy || !timelockAddr) {
      const prefix = network.name === 'mainnet' ? 'production' : 'testnet';
      const files = fs.readdirSync('deployments').filter(f => f.startsWith(prefix)).sort().reverse();
      if (files.length) {
        const d = JSON.parse(fs.readFileSync(`deployments/${files[0]}`, 'utf-8'));
        tokenProxy = tokenProxy || d.contracts.token.proxy;
        timelockAddr = timelockAddr || d.contracts.timelock;
        console.log('Using deployment file:', files[0]);
      }
    }
  } catch {}

  if (!tokenProxy || !timelockAddr) throw new Error('Missing TOKEN_ADDRESS or TIMELOCK_ADDRESS');

  // Compute current impl and encode upgradeTo(currentImpl)
  const currentImpl = await upgrades.erc1967.getImplementationAddress(tokenProxy);
  const token = await ethers.getContractAt('GreenWaveCoin', tokenProxy);
  const timelock = await ethers.getContractAt('GreenWaveTimelock', timelockAddr);

  const calldata = token.interface.encodeFunctionData('upgradeTo', [currentImpl]);
  const predecessor = ethers.ZeroHash;
  const salt = ethers.hexlify(ethers.randomBytes(32));
  const minDelay = await timelock.getMinDelay();
  const opId = await timelock.hashOperation(tokenProxy, 0, calldata, predecessor, salt);

  console.log('Token proxy:', tokenProxy);
  console.log('Timelock:', timelockAddr);
  console.log('Current implementation:', currentImpl);
  console.log('Operation ID:', opId);
  console.log('Min delay (s):', minDelay.toString());

  // Schedule operation
  console.log('\n🗓️  Scheduling...');
  const tx = await timelock.schedule(tokenProxy, 0, calldata, predecessor, salt, minDelay);
  await tx.wait();
  console.log('✅ Scheduled. Wait for ETA, then run execute-noop-upgrade.ts');

  // Save artifact
  const out = {
    network: network.name,
    tokenProxy,
    timelock: timelockAddr,
    implementation: currentImpl,
    operationId: opId,
    salt,
    minDelay: minDelay.toString(),
    timestamp: new Date().toISOString()
  };
  fs.mkdirSync('rehearsals', { recursive: true });
  fs.writeFileSync(`rehearsals/noop-${network.name}-${Date.now()}.json`, JSON.stringify(out, null, 2));
}

main().catch(e => { console.error('❌ Noop scheduler failed:', e); process.exit(1); });
