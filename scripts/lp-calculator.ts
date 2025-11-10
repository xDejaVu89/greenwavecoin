#!/usr/bin/env ts-node
import 'dotenv/config';

// Two modes:
// A) Budget + Price mode (preferred for small LP):
//    - BUDGET_USD (e.g., 50), PRICE_USD (e.g., 0.05), ETH_PRICE_USD
// B) Percentage-of-circulating mode (fallback):
//    - LP_TOKENS_PERCENT, TGE_CIRC_TOKENS, TARGET_MARKET_CAP_USD

const ETH_PRICE = Number(process.env.ETH_PRICE_USD || 3500);
const BUDGET_USD = process.env.BUDGET_USD ? Number(process.env.BUDGET_USD) : undefined;
const PRICE_USD = process.env.PRICE_USD ? Number(process.env.PRICE_USD) : undefined;

let TOKEN_AMOUNT: number;
let IMPLIED_PRICE: number;

if (BUDGET_USD && PRICE_USD && BUDGET_USD > 0 && PRICE_USD > 0) {
  // Budget-driven LP sizing
  TOKEN_AMOUNT = BUDGET_USD / PRICE_USD; // token side equals the dollar budget divided by price
  IMPLIED_PRICE = PRICE_USD;
} else {
  // Fallback to percentage-of-circulating approach
  TOKEN_AMOUNT = (Number(process.env.LP_TOKENS_PERCENT || 15) * Number(process.env.TGE_CIRC_TOKENS || 300000)) / 100;
  IMPLIED_PRICE = Number(process.env.TARGET_MARKET_CAP_USD || 21000000) / Number(process.env.TGE_CIRC_TOKENS || 300000);
}

const requiredValueUSD = TOKEN_AMOUNT * IMPLIED_PRICE; // value on token side
const requiredETH = requiredValueUSD / ETH_PRICE; // matched by ETH side
const requiredStablecoin = requiredValueUSD;

console.log("💧 Liquidity Provisioning Calculator\n");
console.log("  LP Token Amount       :", TOKEN_AMOUNT.toLocaleString(), "GWC");
console.log("  Price (USD)           : $" + IMPLIED_PRICE.toFixed(6));
console.log("  Token-side Value (USD): $" + requiredValueUSD.toLocaleString());
console.log("\n📊 Capital Requirements (provide the other half):");
console.log("  Option A (ETH pair)   :", requiredETH.toFixed(6), "ETH (@ $" + ETH_PRICE.toLocaleString() + " per ETH)");
console.log("  Option B (Stablecoin) :", requiredStablecoin.toLocaleString(), "USDC/DAI");
console.log("\n💡 Tip: Uniswap v3 narrow range can reduce capital ~30-40%. Update ETH_PRICE_USD near launch.");
