#!/usr/bin/env ts-node
import { ethers } from "hardhat";

async function main() {
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
  if (!TOKEN_ADDRESS || !ethers.isAddress(TOKEN_ADDRESS)) {
    throw new Error("TOKEN_ADDRESS is required in .env and must be a valid address");
  }

  // Uniswap v2 Router (mainnet)
  const UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  
  // Amount to approve
  // Prefer budget/price-driven amount for small LPs: TOKEN_AMOUNT = BUDGET_USD / PRICE_USD
  const BUDGET_USD = process.env.BUDGET_USD ? Number(process.env.BUDGET_USD) : undefined;
  const PRICE_USD = process.env.PRICE_USD ? Number(process.env.PRICE_USD) : undefined;
  const FALLBACK_LP_TOKENS = (Number(process.env.LP_TOKENS_PERCENT || 15) * Number(process.env.TGE_CIRC_TOKENS || 300000)) / 100;
  const LP_TOKENS = (BUDGET_USD && PRICE_USD && BUDGET_USD > 0 && PRICE_USD > 0)
    ? (BUDGET_USD / PRICE_USD)
    : FALLBACK_LP_TOKENS;
  const AMOUNT = ethers.parseUnits(String(LP_TOKENS), 18);

  const [signer] = await ethers.getSigners();
  console.log("Approving tokens for liquidity provisioning...");
  console.log("  Signer:", signer.address);
  console.log("  Token:", TOKEN_ADDRESS);
  console.log("  Router:", UNISWAP_V2_ROUTER);
  console.log("  Amount:", ethers.formatUnits(AMOUNT, 18), "GWC");

  const token = await ethers.getContractAt("GreenWaveCoin", TOKEN_ADDRESS);
  
  const tx = await token.approve(UNISWAP_V2_ROUTER, AMOUNT);
  console.log("\n⏳ Waiting for confirmation...");
  await tx.wait();
  
  console.log("✅ Approval successful!");
  console.log("   Tx hash:", tx.hash);
  console.log("\n📝 Next: Add liquidity via Uniswap interface or call addLiquidityETH on the router.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Approval failed:", error);
    process.exit(1);
  });
