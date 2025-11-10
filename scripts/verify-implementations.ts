import { ethers, upgrades, run } from "hardhat";
import fs from "fs";

/**
 * Re-verify current implementation addresses for deployed proxies using the latest deployment file
 * Usage:
 *   npx hardhat run scripts/verify-implementations.ts --network <network>
 */
async function main() {
  const network = await ethers.provider.getNetwork();
  const prefix = network.name === 'mainnet' ? 'production' : 'testnet';

  let deployment: any;
  try {
    const files = fs.readdirSync('deployments').filter(f => f.startsWith(prefix)).sort().reverse();
    if (files.length === 0) throw new Error(`No ${prefix} deployment found`);
    deployment = JSON.parse(fs.readFileSync(`deployments/${files[0]}`, 'utf-8'));
  } catch (e: any) {
    console.error('❌ Failed to load deployment:', e.message);
    process.exit(1);
  }

  console.log(`\n🔍 Verifying current implementations on ${network.name}`);
  console.log('Token proxy:', deployment.contracts.token.proxy);
  console.log('Staking proxy:', deployment.contracts.staking.proxy);

  const tokenImpl = await upgrades.erc1967.getImplementationAddress(deployment.contracts.token.proxy);
  const stakingImpl = await upgrades.erc1967.getImplementationAddress(deployment.contracts.staking.proxy);

  console.log('Token implementation:', tokenImpl);
  console.log('Staking implementation:', stakingImpl);

  if (!process.env.ETHERSCAN_API_KEY) {
    console.log('\nℹ️  ETHERSCAN_API_KEY not set. Printing impl addresses only.');
    return;
  }

  // Wait a bit in case just upgraded
  await new Promise(r => setTimeout(r, 15000));

  for (const [name, addr] of [['Token', tokenImpl], ['Staking', stakingImpl]] as const) {
    try {
      console.log(`\n🔎 Verifying ${name} implementation...`);
      await run('verify:verify', { address: addr, constructorArguments: [] });
      console.log(`✅ ${name} implementation verified`);
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('already verified')) {
        console.log(`ℹ️  ${name} already verified`);
      } else {
        console.log(`⚠️  ${name} verification failed:`, e.message);
      }
    }
  }
}

main().catch(e => { console.error('❌ Verification script failed:', e); process.exit(1); });
