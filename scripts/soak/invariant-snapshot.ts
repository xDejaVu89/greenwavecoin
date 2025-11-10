import { ethers } from "hardhat";
import fs from "fs";

/**
 * Read-only invariant snapshot for live testnet/mainnet.
 * Does NOT mutate state. Designed for soak period tracking.
 *
 * Captures:
 *  - totalSupply
 *  - balances (treasury, staking, deployer)
 *  - fee params (fee, burnShare, stakingShare)
 *  - flash protection settings
 *  - paused state
 *  - staking totals (totalStaked, rewardPool)
 *  - invariant assertions (non-throwing: recorded as failed conditions)
 */
async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`\n🔍 Invariant snapshot on ${network.name}`);

  // Resolve latest deployment
  let deployment: any;
  try {
    const prefix = network.name === 'mainnet' ? 'production' : 'testnet';
    const files = fs.readdirSync('deployments').filter(f => f.startsWith(prefix)).sort().reverse();
    if (!files.length) throw new Error(`No ${prefix} deployment found`);
    deployment = JSON.parse(fs.readFileSync(`deployments/${files[0]}`, 'utf-8'));
  } catch (e: any) {
    console.error('❌ Cannot load deployment:', e.message);
    process.exit(1);
  }

  const tokenAddr = deployment.contracts.token.proxy;
  const stakingAddr = deployment.contracts.staking.proxy;
  const timelockAddr = deployment.contracts.timelock;

  const token = await ethers.getContractAt('GreenWaveCoin', tokenAddr);
  const staking = await ethers.getContractAt('GreenWaveStaking', stakingAddr);

  // Collect data
  const [totalSupply, treasury, transactionFee, burnShare, stakingShare, paused, flashEnabled, maxTransfersPerBlock, maxTransferAmount, stakingContractSet] = await Promise.all([
    token.totalSupply(),
    token.treasury(),
    token.transactionFee(),
    token.burnShare(),
    token.stakingShare(),
    token.paused(),
    token.flashProtectionEnabled(),
    token.maxTransfersPerBlock(),
    token.maxTransferAmount(),
    token.stakingContract()
  ]);

  const [rewardPool, totalStaked, deployer] = await Promise.all([
    staking.rewardPool(),
    staking.totalStaked(),
    (await ethers.getSigners())[0].getAddress()
  ]);

  const deployerBalance = await token.balanceOf(deployer);
  const stakingBalance = await token.balanceOf(stakingAddr);
  const treasuryBalance = await token.balanceOf(treasury);

  // Invariant evaluations (non-reverting)
  const failures: string[] = [];
  // Fee shares sum ≤ 100% (10000 bps)
  if (burnShare + stakingShare > 10000n) failures.push('Fee shares exceed 100%');
  // Staking balance should be ≥ totalStaked
  if (totalStaked > stakingBalance) failures.push('totalStaked exceeds staking token balance');
  // Reward pool non-negative (always true on chain, but guard if reading bug)
  if (rewardPool < 0) failures.push('Reward pool negative');
  // Ownership expected timelock
  const tokenOwner = await token.owner();
  if (timelockAddr && tokenOwner.toLowerCase() !== timelockAddr.toLowerCase()) failures.push('Token owner != timelock');

  const snapshot = {
    timestamp: new Date().toISOString(),
    network: network.name,
    contracts: { token: tokenAddr, staking: stakingAddr, timelock: timelockAddr },
    supply: totalSupply.toString(),
    balances: {
      deployer: deployerBalance.toString(),
      treasury: treasuryBalance.toString(),
      staking: stakingBalance.toString()
    },
    fees: {
      transactionFee: transactionFee.toString(),
      burnShare: burnShare.toString(),
      stakingShare: stakingShare.toString()
    },
    staking: {
      totalStaked: totalStaked.toString(),
      rewardPool: rewardPool.toString()
    },
    flashProtection: {
      enabled: flashEnabled,
      maxTransfersPerBlock: maxTransfersPerBlock.toString(),
      maxTransferAmount: maxTransferAmount.toString()
    },
    paused,
    stakingContractSet,
    invariants: {
      failures
    }
  };

  fs.mkdirSync('monitoring', { recursive: true });
  const file = `monitoring/invariant-${network.name}-${Date.now()}.json`;
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));

  console.log('📝 Snapshot saved:', file);
  if (failures.length) {
    console.log('⚠️  Invariant failures detected:');
    failures.forEach(f => console.log('   -', f));
    process.exitCode = 1;
  } else {
    console.log('✅ No invariant failures');
  }
}

main().catch(e => { console.error('❌ Snapshot failed:', e); process.exit(1); });
