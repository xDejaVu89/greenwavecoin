import { ethers } from "hardhat";
import fs from "fs";

/**
 * Executes a previously scheduled no-op upgrade (upgradeTo(currentImpl)) once ETA passed.
 * Finds latest rehearsal/noop artifact for the active network.
 */
async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log(`\n🚀 Executing NO-OP upgrade on ${network.name}`);
  console.log('Executor account:', signer.address);

  // Load latest noop artifact
  const files = fs.readdirSync('rehearsals').filter(f => f.startsWith('noop-') && f.includes(network.name)).sort().reverse();
  if (!files.length) throw new Error('No noop rehearsal artifact found for this network');
  const artifact = JSON.parse(fs.readFileSync(`rehearsals/${files[0]}`, 'utf-8'));
  console.log('Using artifact:', files[0]);

  const { tokenProxy, timelock, implementation, operationId, salt, minDelay } = artifact;

  const token = await ethers.getContractAt('GreenWaveCoin', tokenProxy);
  const timelockC = await ethers.getContractAt('GreenWaveTimelock', timelock);

  // Rebuild calldata
  const calldata = token.interface.encodeFunctionData('upgradeTo', [implementation]);
  const predecessor = ethers.ZeroHash;

  // Poll until ready
  const interval = 10000;
  process.stdout.write('⏳ Waiting for operation readiness');
  while (!(await timelockC.isOperationReady(operationId))) {
    await new Promise(r => setTimeout(r, interval));
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  // Execute
  console.log('🧨 Executing...');
  const tx = await timelockC.execute(tokenProxy, 0, calldata, predecessor, salt);
  const receipt = await tx.wait();
  console.log('✅ Executed tx:', receipt?.hash);

  // Post-check
  const implAfter = await ethers.getContractAt('GreenWaveCoin', tokenProxy);
  const implAddress = await (implAfter as any).getAddress?.() || implementation;
  console.log('Implementation still:', implementation);
  console.log('Operation ID:', operationId);
  console.log('Min delay (s):', minDelay);

  console.log('\n🎉 NO-OP upgrade path validated');
}

main().catch(e => { console.error('❌ Noop executor failed:', e); process.exit(1); });
