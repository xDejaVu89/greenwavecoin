# GreenWaveCoin Thursday Launch Runbook (Budget Mode)

Goal: Deploy mainnet contracts and seed a minimal Uniswap liquidity pool using a $50 USD equivalent budget.

---
## 0. Preconditions
- .env configured:
  - PRIVATE_KEY= < funded mainnet deployer >
  - TOTAL_SUPPLY_TOKENS=21000000
  - TGE_CIRC_TOKENS=10000
  - BUDGET_USD=50
  - PRICE_USD=0.05
  - ETH_PRICE_USD= (update to live price morning of launch, e.g. 3500)
  - TREASURY_ADDRESS= < treasury or same deployer temporarily >
  - GNOSIS_SAFE_ADDRESS= < if ready; else fill post-launch >
- Deployer funded with:
  - Deployment gas (~0.02–0.05 ETH)
  - LP ETH (~ BUDGET_USD / ETH_PRICE_USD ≈ 0.0143 ETH at $3,500)
- Monitoring webhooks set (Slack/Discord) if desired.

---
## 1. Dry-run sanity (optional)
```powershell
npx hardhat compile
npx hardhat test --grep "Deployment"
```

---
## 2. Production Deployment
```powershell
npx hardhat run scripts/deploy-production.ts --network mainnet
```
Record the addresses output. Save deployment JSON to a secure backup.

Verify ownership transferred to timelock; if not, investigate before proceeding.

---
## 3. Prepare LP Tokens
From deployer (now holding full 21M supply):
- Decide LP token amount: budget mode has calculated 1,000 GWC (BUDGET_USD=50 / PRICE_USD=0.05).
- (Optional) Transfer 1,000 GWC to a dedicated LP wallet (or keep in deployer if acceptable):
```powershell
# Example using hardhat console
npx hardhat console --network mainnet
> const token = await ethers.getContractAt("GreenWaveCoin", "<TOKEN_ADDRESS>");
> await token.transfer("<LP_WALLET>", ethers.parseUnits("1000", 18));
```

---
## 4. Approve Router
```powershell
# If LP_WALLET != deployer, set PRIVATE_KEY to that wallet or use a signer tool
npx hardhat run scripts/approve-for-lp.ts --network mainnet
```
This uses BUDGET_USD/PRICE_USD to approve 1,000 tokens.

---
## 5. Add Liquidity (Uniswap v2 UI)
1. Open https://app.uniswap.org
2. Select "Pool" > "Add Liquidity" > Choose GWC / ETH.
3. Input:
   - Token amount: 1,000 GWC
   - ETH amount: ≈ 0.0143 ETH (adjust to exactly match $50 / updated ETH price)
4. Set slippage tolerance: 2–3%.
5. Confirm transaction.

Alternatively via router: `addLiquidityETH(token, amountTokenDesired, amountTokenMin, amountETHMin, to, deadline)`.

---
## 6. Lock Trust (LP Tokens)
After liquidity is added you receive LP tokens:
- Option A: Burn (send to 0x000000000000000000000000000000000000dEaD)
- Option B: Timelock (transfer to timelock with a long delay proposal)
- Option C: Multi-sig custody (less trust-minimized)

Recommended: Timelock or burn. Provide public proof (Etherscan links).

---
## 7. Activate Monitoring
If monitoring scripts are already scheduled via PM2 on a server:
- Update .env with TOKEN_ADDRESS, STAKING_ADDRESS, TIMELOCK_ADDRESS
- Run implementation verifier:
```powershell
npx ts-node scripts/verify-implementations.ts --network mainnet
```
- Circulating snapshot:
```powershell
npx ts-node scripts/circulating-supply.ts --network mainnet
```

---
## 8. Post-Launch Checklist (First 24h)
- Confirm no unexpected large transfers.
- Confirm timelock delay functioning (schedule a harmless proposal if ready).
- Publish contract + pool links:
  - Token: <TOKEN_ADDRESS>
  - Pool: Uniswap link
  - Timelock: <TIMELOCK_ADDRESS>
- Community message: supply (21M), circulating (10k), initial LP (1k GWC + ~$50 ETH), future traction goals.

---
## 9. Scaling Plan (Later)
- Add second liquidity addition (another $50–$100) if volume picks up.
- Consider a stablecoin pool (GWC/USDC) for USD anchoring.
- Introduce small staking rewards emission once holder base forms.
- Assess listing on DEX aggregators / analytics dashboards.

---
## Quick Reference Commands
```powershell
# Recalculate with updated ETH price
npx ts-node scripts/lp-calculator.ts

# Tokenomics implied values
npx ts-node scripts/tokenomics-calc.ts

# Approval (re-run if amount changes)
npx hardhat run scripts/approve-for-lp.ts --network mainnet
```

---
## Troubleshooting
| Issue | Action |
|-------|--------|
| LP txn pending long | Check gas price; speed up via wallet UI |
| Wrong token price | Remove liquidity quickly (before locking) and re-add with corrected ratio |
| Insufficient ETH | Reduce token amount proportionally; keep target price intact |
| Ownership mismatch | Re-run enableTimelock or verify timelock address assignment |
| Verification fails | Retry after a few blocks; ensure ETHERSCAN_API_KEY set |

---
Prepared automatically. Adjust addresses and final ETH amount on launch day.
