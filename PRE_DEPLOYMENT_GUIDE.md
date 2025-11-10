# Pre-Deployment Checklist - Action Items

This document provides step-by-step instructions for completing the pre-deployment checklist before mainnet launch.

## Current Status

Run the checklist validator at any time:
```bash
npx hardhat run scripts/pre-deployment-checklist.ts --network localhost
```

---

## ✅ Step 1: Configure Environment Variables

**Status:** Required  
**File:** `.env`

1. Copy `.env.example` to `.env`
2. Fill in required values:

```bash
# Get Etherscan API key
# 1. Go to https://etherscan.io/
# 2. Sign up / log in
# 3. Navigate to: My Profile > API Keys
# 4. Create new API key
ETHERSCAN_API_KEY=your_key_here

# Add your deployment wallet private key (NEVER commit this!)
PRIVATE_KEY=your_private_key_without_0x_prefix

# Production addresses (to be filled after multisig setup)
GNOSIS_SAFE_ADDRESS=0x...  # Fill after Step 5
TREASURY_ADDRESS=0x...      # Your treasury wallet

# Monitoring webhook (Discord/Slack/custom)
ALERT_WEBHOOK_URL=https://...
```

---

## ✅ Step 2: Get Testnet ETH

**Status:** Required  
**Network:** Sepolia  

### Option 1: Sepolia Faucets
- https://sepoliafaucet.com (Alchemy - requires login)
- https://www.infura.io/faucet/sepolia (Infura - requires login)
- https://faucet.quicknode.com/ethereum/sepolia (QuickNode)

### Option 2: Bridge from other networks
- Use Sepolia bridge if you have testnet tokens elsewhere

**Minimum:** 0.5 SepoliaETH recommended for full deployment + testing

---

## ✅ Step 3: Deploy to Sepolia Testnet

**Status:** Required  
**Estimated time:** 10-15 minutes  
**Estimated cost:** ~0.1-0.2 SepoliaETH

```bash
# 1. Ensure .env has PRIVATE_KEY and ETHERSCAN_API_KEY
# 2. Run deployment
npx hardhat run scripts/deploy-testnet.ts --network sepolia

# 3. Wait for deployment + verification to complete
# 4. Save the output addresses (they'll be in deployments/)
```

**Output:** 
- Deployment JSON saved to `deployments/testnet-sepolia-[timestamp].json`
- Verified contracts on Sepolia Etherscan
- Token, Staking, and Timelock deployed and configured

---

## ✅ Step 4: Run Testnet Smoke Tests

**Status:** Required  
**Depends on:** Step 3 (Sepolia deployment)  
**Estimated time:** 5 minutes

```bash
# Automatically uses latest deployment from deployments/
npx hardhat run scripts/testnet-smoke-test.ts --network sepolia
```

**Tests performed:**
1. ✅ Token metadata (name, symbol, decimals)
2. ✅ Transfer with fee deduction
3. ✅ Staking tokens
4. ✅ Rewards calculation
5. ✅ Early unstake prevention
6. ✅ Timelock ownership
7. ✅ Flash loan protection
8. ✅ Fee configuration

**Expected:** 8/8 tests passing

---

## ✅ Step 5: Execute Upgrade Rehearsal

**Status:** Required  
**Depends on:** Step 4 (smoke tests passing)  
**Estimated time:** 30-60 minutes  
**Reference:** `LAUNCH_READY.md` - "Upgrade Rehearsal / Simulation" section

### Quick Rehearsal Guide

#### Phase 1: Baseline Capture
```bash
# Create rehearsal directory
mkdir rehearsals/$(date +%Y%m%d)

# Run storage validator on current deployment
npx hardhat run scripts/validate-storage-layout.ts --network sepolia

# Save baseline
cp storage-layouts/*.current.json rehearsals/$(date +%Y%m%d)/baseline.json
```

#### Phase 2: Create V2 Implementation
1. Create `contracts/GreenWaveCoinV2.sol` (copy from GreenWaveCoin.sol)
2. Add a trivial new feature (e.g., `function version() external pure returns (uint256) { return 2; }`)
3. **CRITICAL:** Only append new state variables, never reorder/delete
4. Compile: `npx hardhat compile`

#### Phase 3: Validate Storage Compatibility
```bash
# Run storage diff validator
npx hardhat run scripts/validate-storage-layout.ts --network sepolia

# Output MUST show: "✅ APPEND-ONLY" or "✅ NO CONFLICTS"
# If it shows reordering/collisions: ABORT, redesign V2
```

#### Phase 4: Deploy V2 and Upgrade
```bash
# Deploy V2 implementation
npx hardhat run scripts/upgrade-to-v2.ts --network sepolia

# Verify V2 functions
npx hardhat console --network sepolia
> const token = await ethers.getContractAt("GreenWaveCoinV2", "PROXY_ADDRESS")
> await token.version()  // Should return: 2
```

#### Phase 5: Verify Invariants
```bash
# Re-run smoke tests on upgraded contract
npx hardhat run scripts/testnet-smoke-test.ts --network sepolia

# All 8 tests MUST pass
```

#### Phase 6: Document
```bash
# Save results
echo "Rehearsal complete: $(date)" > rehearsals/$(date +%Y%m%d)/report.md
echo "Storage diff: APPEND-ONLY ✅" >> rehearsals/$(date +%Y%m%d)/report.md
echo "Smoke tests: 8/8 PASS ✅" >> rehearsals/$(date +%Y%m%d)/report.md
```

---

## ✅ Step 6: Set Up Gnosis Safe Multisig

**Status:** Required  
**Network:** Ethereum Mainnet  
**Reference:** `docs/MULTISIG_SETUP.md`

1. Go to https://app.safe.global
2. Connect wallet
3. Click "Create Safe"
4. Select "Ethereum Mainnet"
5. Add 3-5 signers (trusted team members)
6. Set threshold: 3-of-5 recommended (60% required)
7. Review and deploy (costs ~0.01 ETH)
8. **Save Safe address to .env:**
   ```bash
   GNOSIS_SAFE_ADDRESS=0xYourSafeAddress
   ```

**Signers should be:**
- Hardware wallets (Ledger/Trezor) preferred
- Geographically distributed
- Different team members
- Backed up securely

---

## ✅ Step 7: Configure Monitoring

**Status:** Required  
**Reference:** `docs/OPERATIONS_RUNBOOK.md`

### Option 1: Discord Webhook
1. In Discord server settings → Integrations → Webhooks
2. Create webhook for #alerts channel
3. Copy webhook URL
4. Add to .env: `ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...`

### Option 2: Slack Webhook
1. Go to https://api.slack.com/apps
2. Create new app → Incoming Webhooks
3. Activate and create webhook for #alerts channel
4. Add to .env: `ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...`

### Option 3: Custom Endpoint
```javascript
// Your server receives POST requests with:
{
  "event": "PauseTriggered" | "OwnershipTransferred" | "LargeTransfer",
  "contract": "0x...",
  "details": {...}
}
```

### Install PM2 for monitoring scripts:
```bash
npm install -g pm2
pm2 start scripts/monitor.ts --name gwc-monitor
pm2 save
pm2 startup  # Set up autostart
```

---

## ⚠️ Step 8: Security Audit (Optional but Recommended)

**Status:** Optional (highly recommended for $10M+ projects)  
**Cost:** $15,000 - $50,000  
**Timeline:** 2-4 weeks

### Recommended Firms:
1. **OpenZeppelin** - https://openzeppelin.com/security-audits
2. **Trail of Bits** - https://www.trailofbits.com/
3. **Consensys Diligence** - https://consensys.net/diligence/
4. **Certik** - https://www.certik.com/
5. **Hacken** - https://hacken.io/

### Process:
1. Contact firm with project details
2. Provide codebase access
3. Complete audit (2-4 weeks)
4. Address findings
5. Re-audit critical issues
6. Publish audit report in `audits/` directory

**Skip if:** 
- Limited budget
- Small initial market cap (<$1M)
- Plan to audit after initial traction

---

## ✅ Step 9: Fund Mainnet Deployer

**Status:** Required  
**Amount:** 0.5 - 1.0 ETH recommended

Transfer ETH to your deployer wallet address:
- Get address: `npx hardhat console` → `(await ethers.getSigners())[0].address`
- Send from exchange or existing wallet
- Verify: Check balance on Etherscan

**Cost breakdown:**
- Token deployment: ~0.05 ETH
- Staking deployment: ~0.05 ETH
- Timelock deployment: ~0.01 ETH
- Configuration transactions: ~0.05 ETH
- Contract verification: Free
- Buffer for gas spikes: 0.3 ETH

---

## ✅ Step 10: Final Verification

**Status:** Required  

Run the complete checklist validator:
```bash
npx hardhat run scripts/pre-deployment-checklist.ts --network mainnet
```

**Expected output:**
```
✅ Required: 9/9
ℹ️  Optional: 0/1 (or 1/1 if audited)

🎉 ALL REQUIRED ITEMS COMPLETE
✅ Ready for mainnet deployment!
```

If any items fail, revisit the corresponding steps above.

---

## 🚀 Step 11: Deploy to Mainnet

**Status:** Production deployment  
**POINT OF NO RETURN**

```bash
# Final checklist
npx hardhat run scripts/pre-deployment-checklist.ts --network mainnet

# If all green, deploy
npx hardhat run scripts/deploy-production.ts --network mainnet

# Monitor deployment closely
# Save all output addresses
# Verify contracts on Etherscan
```

**Immediately after:**
1. Transfer token ownership to Timelock
2. Transfer Timelock admin to Gnosis Safe
3. Start monitoring services
4. Monitor for first 48 hours
5. Announce to community

---

## Support

**Questions?** Review:
- `LAUNCH_READY.md` - Complete deployment guide
- `docs/MULTISIG_SETUP.md` - Multisig details
- `docs/OPERATIONS_RUNBOOK.md` - Operational procedures
- `docs/BUG_BOUNTY.md` - Security program

**Security issues?**
- Email: security@greenwavecoin.io
- DO NOT post publicly
