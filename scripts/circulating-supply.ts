#!/usr/bin/env ts-node
import 'dotenv/config';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';
import fs from 'fs';
import path from 'path';

function parseAddresses(input?: string): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && ethers.isAddress(s));
}

function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

(async () => {
  const tokenAddress = process.env.TOKEN_ADDRESS || '';
  if (!ethers.isAddress(tokenAddress)) {
    throw new Error('TOKEN_ADDRESS is required in .env');
  }

  const network = await ethers.provider.getNetwork();
  const chainName = (await ethers.provider.getNetwork()).name || 'unknown';

  const exclude = uniq(
    [
      process.env.TIMELOCK_ADDRESS,
      process.env.TREASURY_ADDRESS,
      process.env.STAKING_ADDRESS,
      ...parseAddresses(process.env.EXCLUDE_ADDRESSES),
    ].filter((a): a is string => !!a && ethers.isAddress(a))
  );

  const token: Contract = await ethers.getContractAt('GreenWaveCoin', tokenAddress);
  const [name, symbol, decimalsBN, totalSupplyBN] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
    token.totalSupply(),
  ]);

  const decimals = Number(decimalsBN);
  const totalSupply = Number(ethers.formatUnits(totalSupplyBN, decimals));

  let excludedTotal = 0;
  const byAddress: Record<string, number> = {};

  for (const addr of exclude) {
    try {
      const bal = await token.balanceOf(addr);
      const amt = Number(ethers.formatUnits(bal, decimals));
      byAddress[addr] = amt;
      excludedTotal += amt;
    } catch (e) {
      console.warn(`⚠️  Failed to fetch balance for ${addr}:`, (e as Error).message);
    }
  }

  const circulating = Math.max(0, totalSupply - excludedTotal);

  const result = {
    timestamp: new Date().toISOString(),
    network: {
      chainId: Number(network.chainId),
      name: chainName,
    },
    token: { address: tokenAddress, name, symbol, decimals },
    totals: {
      totalSupply,
      excluded: excludedTotal,
      circulating,
    },
    excludedBreakdown: byAddress,
  };

  const outDir = path.join(process.cwd(), 'monitoring');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const file = `circulating-${chainName}-${Date.now()}.json`;
  const outPath = path.join(outDir, file);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log('🏦 Circulating Supply Snapshot');
  console.log(`  Token: ${name} (${symbol}) @ ${tokenAddress}`);
  console.log('  Total Supply     :', totalSupply.toLocaleString());
  console.log('  Excluded (sum)   :', excludedTotal.toLocaleString());
  console.log('  Circulating      :', circulating.toLocaleString());
  if (exclude.length) {
    console.log('  Exclusions:');
    for (const addr of exclude) {
      const amt = byAddress[addr] ?? 0;
      console.log(`   - ${addr}: ${amt.toLocaleString()}`);
    }
  }
  console.log(`\n📝 Saved: ${outPath}`);
})();
