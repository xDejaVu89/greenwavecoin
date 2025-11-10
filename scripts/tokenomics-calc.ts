#!/usr/bin/env ts-node
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

function assert(condition: any, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function toNumber(envName: string, def?: number): number | undefined {
  const raw = process.env[envName];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!isFinite(n)) throw new Error(`Invalid number for ${envName}: ${raw}`);
  return n;
}

(async () => {
  const TARGET_MARKET_CAP_USD = toNumber('TARGET_MARKET_CAP_USD');
  const TGE_CIRC_TOKENS = toNumber('TGE_CIRC_TOKENS');
  const LP_TOKENS_PERCENT = toNumber('LP_TOKENS_PERCENT', 15)!;
  const ETH_PRICE_USD = toNumber('ETH_PRICE_USD');
  const TOTAL_SUPPLY_TOKENS = toNumber('TOTAL_SUPPLY_TOKENS');

  assert(TARGET_MARKET_CAP_USD && TARGET_MARKET_CAP_USD > 0, 'Set TARGET_MARKET_CAP_USD in your .env');
  assert(TGE_CIRC_TOKENS && TGE_CIRC_TOKENS > 0, 'Set TGE_CIRC_TOKENS in your .env');

  const impliedTokenPriceUSD = TARGET_MARKET_CAP_USD! / TGE_CIRC_TOKENS!;
  const lpTokens = (TGE_CIRC_TOKENS! * LP_TOKENS_PERCENT) / 100;
  let requiredETHForLP: number | undefined = undefined;
  if (ETH_PRICE_USD && ETH_PRICE_USD > 0) {
    requiredETHForLP = (impliedTokenPriceUSD * lpTokens) / ETH_PRICE_USD;
  }

  const fdvUSD = TOTAL_SUPPLY_TOKENS && TOTAL_SUPPLY_TOKENS > 0
    ? impliedTokenPriceUSD * TOTAL_SUPPLY_TOKENS
    : undefined;

  const result = {
    timestamp: new Date().toISOString(),
    targetMarketCapUSD: TARGET_MARKET_CAP_USD,
    tgeCirculatingTokens: TGE_CIRC_TOKENS,
    impliedTokenPriceUSD: Number(impliedTokenPriceUSD.toFixed(6)),
    lpTokensPercent: LP_TOKENS_PERCENT,
    lpTokensAmount: Number(lpTokens.toFixed(6)),
    ethPriceUSD: ETH_PRICE_USD ?? null,
    requiredETHForLP: requiredETHForLP ? Number(requiredETHForLP.toFixed(6)) : null,
    totalSupplyTokens: TOTAL_SUPPLY_TOKENS ?? null,
    impliedFDV_USD: fdvUSD ? Number(fdvUSD.toFixed(2)) : null,
    notes: [
      'This is off-chain planning guidance. Actual price discovery happens via liquidity provisioning and market trades.',
      'Consider seeding 10-25% of circulating tokens into the initial liquidity pool to balance depth vs. capital efficiency.',
      'Revisit ETH_PRICE_USD near TGE to refine the required ETH amount.',
    ],
  };

  const outDir = path.join(process.cwd(), 'monitoring');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const fname = `tokenomics-plan-${Date.now()}.json`;
  const outPath = path.join(outDir, fname);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  // Human-friendly console summary
  console.log('🎯 Tokenomics Plan');
  console.log('  Target Market Cap (USD):', TARGET_MARKET_CAP_USD!.toLocaleString());
  console.log('  TGE Circulating Tokens :', TGE_CIRC_TOKENS!.toLocaleString());
  console.log('  Implied Price (USD)    :', result.impliedTokenPriceUSD);
  if (TOTAL_SUPPLY_TOKENS) console.log('  Implied FDV (USD)      :', fdvUSD!.toLocaleString());
  console.log('  LP Seed % of Circ.     :', `${LP_TOKENS_PERCENT}%`);
  console.log('  LP Token Amount        :', result.lpTokensAmount.toLocaleString());
  if (requiredETHForLP !== undefined) {
    console.log('  ETH Price (USD)        :', ETH_PRICE_USD);
    console.log('  Required ETH for LP    :', result.requiredETHForLP);
  } else {
    console.log('  Tip: set ETH_PRICE_USD to estimate required ETH for LP seeding.');
  }
  console.log(`\n📝 Saved: ${outPath}`);
})();
