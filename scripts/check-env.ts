import 'dotenv/config';
import { config as load } from 'dotenv';
import { ethers } from 'hardhat';

load();

interface EnvRequirement {
  key: string;
  requiredOn: ('testnet' | 'mainnet')[];
  description: string;
  secret?: boolean;
}

const requirements: EnvRequirement[] = [
  { key: 'PRIVATE_KEY', requiredOn: ['testnet', 'mainnet'], description: 'Deployer account private key', secret: true },
  { key: 'SEPOLIA_RPC', requiredOn: ['testnet'], description: 'Sepolia RPC endpoint' },
  { key: 'MAINNET_RPC', requiredOn: ['mainnet'], description: 'Mainnet RPC endpoint' },
  { key: 'ETHERSCAN_API_KEY', requiredOn: ['testnet', 'mainnet'], description: 'Etherscan API key for verification', secret: true },
  { key: 'TREASURY_ADDRESS', requiredOn: ['mainnet'], description: 'Treasury address receiving fees' },
  { key: 'GNOSIS_SAFE_ADDRESS', requiredOn: ['mainnet'], description: 'Multisig governance contract address' },
  { key: 'ALERT_WEBHOOK_URL', requiredOn: ['mainnet'], description: 'Webhook for alert notifications (Slack/Discord)' },
  { key: 'TOKEN_ADDRESS', requiredOn: ['mainnet'], description: 'Token proxy (after deployment)' },
  { key: 'STAKING_ADDRESS', requiredOn: ['mainnet'], description: 'Staking proxy (after deployment)' },
  { key: 'TIMELOCK_ADDRESS', requiredOn: ['mainnet'], description: 'Timelock proxy (after deployment)' }
];

function classifyNetwork(argv: string[]): 'testnet' | 'mainnet' {
  const networkFlag = argv.find(a => a.startsWith('--network'));
  if (!networkFlag) return 'testnet';
  if (networkFlag.includes('mainnet')) return 'mainnet';
  return 'testnet';
}

async function main() {
  const mode = classifyNetwork(process.argv.slice(2));
  console.log(`\n🔍 Environment Validation (${mode})\n`);

  const missing: EnvRequirement[] = [];
  const warnings: string[] = [];

  for (const req of requirements) {
    if (!req.requiredOn.includes(mode)) continue;
    const value = process.env[req.key];
    const present = !!value && value.trim() !== '';
    const display = req.secret && present ? '[SET]' : (value || '[EMPTY]');
    console.log(`• ${req.key}: ${display}`);
    if (!present) missing.push(req);
  }

  // Address format sanity checks
  const addressKeys = ['TREASURY_ADDRESS', 'GNOSIS_SAFE_ADDRESS', 'TOKEN_ADDRESS', 'STAKING_ADDRESS', 'TIMELOCK_ADDRESS'];
  for (const k of addressKeys) {
    const v = process.env[k];
    if (v && !ethers.isAddress(v)) warnings.push(`${k} has invalid address format: ${v}`);
  }

  if (missing.length) {
    console.log('\n❌ Missing required environment variables:');
    for (const m of missing) {
      console.log(`   - ${m.key}: ${m.description}`);
    }
  } else {
    console.log('\n✅ All required env vars present for', mode);
  }

  if (warnings.length) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log('   -', w));
  }

  console.log('\n📌 Next Steps:');
  if (mode === 'testnet') {
    console.log('  1. Deploy: npx hardhat run scripts/deploy-testnet.ts --network sepolia');
    console.log('  2. Set TOKEN_ADDRESS, STAKING_ADDRESS, TIMELOCK_ADDRESS after deploy');
    console.log('  3. Run upgrade rehearsal');
  } else {
    console.log('  1. Fund deployer ≥0.5 ETH');
    console.log('  2. Ensure Gnosis Safe deployed & GNOSIS_SAFE_ADDRESS set');
    console.log('  3. Deploy: npx hardhat run scripts/deploy-production.ts --network mainnet');
    console.log('  4. Grant timelock roles to Safe & renounce deployer');
  }

  if (missing.length) process.exit(1);
}

main().catch(e => { console.error('Validation crash:', e); process.exit(1); });
