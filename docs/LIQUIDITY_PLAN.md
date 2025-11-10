# GreenWaveCoin Liquidity Provisioning Plan

> **Status**: Production-ready guidance for initial DEX liquidity setup to achieve $21M market cap target.

## Overview
This document outlines the strategy for seeding initial liquidity on a decentralized exchange (DEX) such as Uniswap v3 or Uniswap v2 to establish GreenWaveCoin's initial market price and enable trading at launch.

## Objectives
- Establish an initial market price aligned with the $21M market cap target ($70 per token).
- Provide sufficient liquidity depth to minimize slippage for early adopters.
- Balance capital efficiency with price stability during the initial launch window.

## Parameters (from Tokenomics)
| Parameter | Value | Notes |
|-----------|-------|-------|
| Target Market Cap (USD) | $21,000,000 | Based on initial circulating supply. |
| TGE Circulating Supply | 300,000 tokens | Freely tradable at launch. |
| Implied Token Price | $70.00 | $21M / 300k tokens. |
| LP Seed % (of circulating) | 15% | Recommended 10-25% range. |
| LP Token Amount | 45,000 tokens | 15% × 300,000 tokens. |

## Required Capital Calculation
To seed a liquidity pool with 45,000 tokens at an implied price of $70/token on a constant-product AMM (e.g., Uniswap v2 or similar), we need equal value in the paired asset (typically ETH or a stablecoin).

### Option A: Token/ETH Pair (Uniswap v3 or v2)
Assuming ETH price = $3,500 at deployment:

- **Token side**: 45,000 GWC
- **Token value**: 45,000 × $70 = **$3,150,000**
- **ETH required**: $3,150,000 / $3,500 = **900 ETH**

**Liquidity provision formula (constant-product k = x × y)**:
- x = 45,000 tokens
- y = 900 ETH
- k = 40,500,000

Initial price: 900 ETH / 45,000 tokens = 0.02 ETH per token = $70 per token (at $3,500 ETH).

### Option B: Token/USDC or Token/DAI Pair
If using a stablecoin pair (1:1 USD peg):

- **Token side**: 45,000 GWC
- **Token value**: 45,000 × $70 = **$3,150,000**
- **Stablecoin required**: **3,150,000 USDC or DAI**

**Advantages of stablecoin pair**:
- Price directly anchored to USD; no ETH volatility impact.
- Clearer $70 price signal for traders.
- Lower arbitrage complexity during initial launch.

**Disadvantages**:
- Requires significant stablecoin capital.
- May have lower organic volume if ETH is more commonly traded.

### Option C: Dual Liquidity (Token/ETH + Token/USDC)
Split LP seeding across two pools:

- **Pool 1 (Token/ETH)**: 25,000 GWC + 500 ETH (~$1,750,000 total value)
- **Pool 2 (Token/USDC)**: 20,000 GWC + 1,400,000 USDC (~$2,800,000 total value)

This diversifies liquidity and enables both ETH-native and stablecoin-native traders to participate.

## Uniswap v3 Considerations
If using Uniswap v3 (concentrated liquidity):

- **Price range selection**: Set a tight range around $70 (e.g., $60–$85) to maximize capital efficiency.
- **Capital savings**: Can achieve similar depth with ~40-60% less capital compared to v2 (full-range liquidity).
- **Active management**: Requires rebalancing if price moves outside the range.

**Example v3 position**:
- Price range: $60–$85
- Token amount: 45,000 GWC
- ETH required: ~600 ETH (vs. 900 ETH for v2, assuming narrow range efficiency)

Consult Uniswap v3 calculator tools (e.g., `uniswap.fish`, `revert.finance`) to model exact capital requirements for your chosen range.

## Execution Steps

### 1. Pre-Deployment
- [ ] Confirm ETH price near deployment date (update `ETH_PRICE_USD` in `.env`).
- [ ] Run `ts-node scripts/tokenomics-calc.ts` to verify implied price and LP requirements.
- [ ] Acquire required ETH or stablecoins for LP seeding (e.g., 900 ETH or 3.15M USDC).
- [ ] Prepare multi-sig wallet or deployer EOA with LP capital.

### 2. Deployment & Token Allocation
- [ ] Deploy GreenWaveCoin using `deploy-production.ts` (mints 21M tokens to deployer).
- [ ] Transfer 45,000 tokens to LP seeding wallet (if different from deployer).
- [ ] Retain remaining circulating tokens (255,000) for initial distribution, airdrops, or reserves.

### 3. Liquidity Pool Creation
Choose your DEX and pool type:

#### Uniswap v2 (or forks: SushiSwap, PancakeSwap)
```bash
# Approve tokens
npx hardhat run scripts/approve-for-lp.ts --network mainnet

# Add liquidity via Uniswap v2 Router
# Use Etherscan or Uniswap interface to call addLiquidityETH:
# - token: <GWC_ADDRESS>
# - amountTokenDesired: 45000000000000000000000 (45k tokens in wei)
# - amountTokenMin: 44000000000000000000000 (allow 2% slippage)
# - amountETHMin: 882000000000000000000 (882 ETH min, 2% slippage)
# - to: <LP_RECIPIENT_ADDRESS>
# - deadline: <UNIX_TIMESTAMP + 20 minutes>
# Send 900 ETH with the transaction
```

#### Uniswap v3
Use the Uniswap v3 interface (app.uniswap.org) or NonfungiblePositionManager contract:
1. Create pool (if not exists): `createAndInitializePoolIfNecessary(tokenA, tokenB, fee, sqrtPriceX96)`
2. Mint position: `mint((token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired, ...))`
3. Set price range ticks corresponding to $60–$85.

Alternatively, use a frontend like Uniswap's interface to create the position interactively.

### 4. Lock or Retain LP Tokens
After adding liquidity:

- **Option A (Burn LP tokens)**: Send LP tokens to `0x000000000000000000000000000000000000dEaD` for permanent lock.
- **Option B (Timelock LP tokens)**: Transfer LP tokens to the GreenWaveTimelock contract with a long unlock period (e.g., 6-12 months).
- **Option C (Multi-sig control)**: Hold LP tokens in Gnosis Safe for potential future adjustments (less trust-minimized).

**Recommendation**: Burn or timelock LP tokens to signal long-term commitment and prevent rug-pull concerns.

### 5. Announce and Monitor
- [ ] Publish contract addresses and liquidity pool links (Etherscan, Uniswap).
- [ ] Monitor initial trading volume and slippage using DEX analytics (e.g., Dune, DexScreener).
- [ ] Run `ts-node scripts/circulating-supply.ts` to verify circulating metrics post-LP.
- [ ] Alert community via social channels and enable trading.

## Alternative Strategies

### Gradual Liquidity Injection (Staged Launch)
Instead of seeding all 45k tokens at once:
1. **Phase 1 (Day 1)**: Seed 15k tokens + 300 ETH (1/3 of target LP).
2. **Phase 2 (Day 3-7)**: Add 15k tokens + 300 ETH (monitor price stability).
3. **Phase 3 (Day 14)**: Add final 15k tokens + 300 ETH.

**Pros**: Lower initial capital requirement; ability to adjust strategy based on early price action.  
**Cons**: Shallower initial liquidity; higher slippage for early trades; more complex execution.

### Liquidity Mining / Incentivized Pools
Offer additional GWC rewards to LPs who provide liquidity:
- Allocate a portion of staking rewards or ecosystem allocation to liquidity mining.
- Use platforms like Merkl, Arrakis, or native staking contracts to distribute incentives.
- Typical APR: 20-50% in GWC rewards for first 30-90 days.

This bootstraps liquidity without committing deployer capital upfront but dilutes token supply over time.

### Private Sale / OTC Liquidity Bootstrapping
Conduct a small private sale to strategic investors/VCs at $70/token:
- Raise 900 ETH by selling 45k tokens privately.
- Use raised ETH + remaining tokens from circulation to seed LP at same price.

**Advantage**: No deployer capital required for LP.  
**Disadvantage**: Reduces truly "circulating" supply; introduces early whale holders.

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| **Price volatility post-launch** | Use tighter Uniswap v3 range; monitor and provide additional depth if needed. |
| **Insufficient LP depth (high slippage)** | Increase LP seed % to 20-25% of circulating; consider dual pools (ETH + stablecoin). |
| **ETH price fluctuation affecting implied GWC price** | Use stablecoin pair (USDC/DAI) for direct USD price anchor. |
| **Rug pull concerns** | Burn or timelock LP tokens; publish proof on-chain. |
| **Arbitrage bots front-running LP seeding** | Use private mempool (Flashbots) or MEV protection when adding liquidity. |
| **Liquidity fragmentation across DEXs** | Focus on single primary DEX (Uniswap) initially; expand gradually. |

## Capital Requirements Summary

| Scenario | Token Amount | ETH Required (@ $3,500) | Stablecoin Alternative | Notes |
|----------|--------------|-------------------------|------------------------|-------|
| **v2 Full Range (ETH)** | 45,000 | 900 ETH | – | Simple, predictable. |
| **v2 Full Range (USDC)** | 45,000 | – | 3,150,000 USDC | USD-anchored price. |
| **v3 Narrow Range (ETH)** | 45,000 | ~600 ETH | – | Capital efficient; requires active mgmt. |
| **Dual Pool (ETH+USDC)** | 45,000 (split) | 500 ETH | 1,400,000 USDC | Diversified liquidity. |
| **Staged (Phase 1 only)** | 15,000 | 300 ETH | 1,050,000 USDC | Lower upfront cost; shallower depth. |

## Tooling & Scripts

### Approval Script (`scripts/approve-for-lp.ts`)
Creates an approval for the DEX router to spend GWC tokens:

```typescript
import { ethers } from "hardhat";

async function main() {
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS!;
  const ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Uniswap v2 Router
  const AMOUNT = ethers.parseUnits("45000", 18);

  const [signer] = await ethers.getSigners();
  const token = await ethers.getContractAt("GreenWaveCoin", TOKEN_ADDRESS);

  console.log("Approving", ethers.formatUnits(AMOUNT, 18), "tokens for router", ROUTER_ADDRESS);
  const tx = await token.approve(ROUTER_ADDRESS, AMOUNT);
  await tx.wait();
  console.log("✅ Approved. Tx:", tx.hash);
}

main().catch(console.error);
```

Run: `npx hardhat run scripts/approve-for-lp.ts --network mainnet`

### LP Calculator (`scripts/lp-calculator.ts`)
Computes required ETH or stablecoin for a given token amount and target price:

```typescript
import 'dotenv/config';

const TOKEN_AMOUNT = Number(process.env.LP_TOKENS_PERCENT || 15) * Number(process.env.TGE_CIRC_TOKENS || 300000) / 100;
const IMPLIED_PRICE = Number(process.env.TARGET_MARKET_CAP_USD || 21000000) / Number(process.env.TGE_CIRC_TOKENS || 300000);
const ETH_PRICE = Number(process.env.ETH_PRICE_USD || 3500);

const requiredValueUSD = TOKEN_AMOUNT * IMPLIED_PRICE;
const requiredETH = requiredValueUSD / ETH_PRICE;

console.log("💧 Liquidity Provisioning Calculator");
console.log("  Token Amount:", TOKEN_AMOUNT.toLocaleString());
console.log("  Implied Price (USD):", IMPLIED_PRICE.toFixed(2));
console.log("  Required Value (USD):", requiredValueUSD.toLocaleString());
console.log("  Required ETH (@ $" + ETH_PRICE + "):", requiredETH.toFixed(2));
console.log("  Alternative: " + requiredValueUSD.toLocaleString() + " USDC/DAI");
```

Run: `ts-node scripts/lp-calculator.ts`

## Post-Launch Monitoring
- Track pool depth and trading volume on Dune Analytics or DexScreener.
- Monitor for large buys/sells that may cause slippage spikes.
- Use `scripts/circulating-supply.ts` to report circulating supply excluding LP tokens.
- Alert on abnormal price deviations via monitoring scripts (`scripts/monitor-contracts.ts`).

## Final Checklist
- [ ] Finalize DEX choice (Uniswap v2 vs. v3 vs. alternative).
- [ ] Determine ETH vs. stablecoin pairing.
- [ ] Confirm capital availability (900 ETH or 3.15M USDC).
- [ ] Deploy token and verify addresses.
- [ ] Approve token spending for router.
- [ ] Execute addLiquidity transaction.
- [ ] Lock or burn LP tokens.
- [ ] Publish proof and announce launch.
- [ ] Enable contract monitoring alerts.

---
**Document Status**: Production-ready. Review with treasury/operations team and execute per mainnet deployment schedule.
