# 🚀 GreenWaveCoin - Complete Deployment Workflow

**Quick Reference Guide**

---

## Current Status

✅ **Code:** Production-ready (59/59 tests passing)  
⏳ **Infrastructure:** Ready (scripts created)  
📋 **Checklist:** 1/9 required items complete

---

## Quick Start: 3-Step Path to Launch

### Phase 1: Testnet Validation (1-2 days)
```bash
# 1. Get Sepolia ETH from faucet
# 2. Configure .env (PRIVATE_KEY, ETHERSCAN_API_KEY)
# 3. Deploy
npx hardhat run scripts/deploy-testnet.ts --network sepolia

# 4. Test
npx hardhat run scripts/testnet-smoke-test.ts --network sepolia

# 5. Rehearse upgrade
# Follow: LAUNCH_READY.md > "Upgrade Rehearsal / Simulation"
```

### Phase 2: Production Setup (2-3 days)
```bash
# 1. Deploy Gnosis Safe (app.safe.global)
# 2. Update .env with GNOSIS_SAFE_ADDRESS
# 3. Configure monitoring (Discord/Slack webhook)
# 4. Fund mainnet deployer (0.5+ ETH)
# 5. Optional: Security audit (2-4 weeks, $15k-$50k)
```

### Phase 3: Mainnet Launch (1 hour)
```bash
# 1. Validate readiness
npx hardhat run scripts/pre-deployment-checklist.ts --network mainnet

# 2. Deploy (if 9/9 required items pass)
npx hardhat run scripts/deploy-production.ts --network mainnet

# 3. Monitor for 48 hours
# 4. Announce to community
```

---

## All Available Scripts

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `pre-deployment-checklist.ts` | Validate readiness | Before every deployment |
| `deploy-testnet.ts` | Deploy to Sepolia | After env setup |
| `testnet-smoke-test.ts` | Validate testnet deployment | After testnet deploy |
| `deploy-production.ts` | Deploy to mainnet | When checklist passes |
| `validate-storage-layout.ts` | Check upgrade safety | During upgrade rehearsal |

**Run any script:**
```bash
npx hardhat run scripts/SCRIPT_NAME.ts --network NETWORK_NAME
```

---

## Documentation Map

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview & quick start |
| `LAUNCH_READY.md` | Complete production deployment guide |
| `PRE_DEPLOYMENT_GUIDE.md` | **← START HERE** Step-by-step checklist walkthrough |
| `docs/MULTISIG_SETUP.md` | Gnosis Safe configuration |
| `docs/OPERATIONS_RUNBOOK.md` | Day-to-day operations |
| `docs/BUG_BOUNTY.md` | Security program details |
| `.env.example` | Environment variables template |

---

## Environment Setup (5 minutes)

```bash
# 1. Copy template
cp .env.example .env

# 2. Get Etherscan API key
# https://etherscan.io/myapikey

# 3. Edit .env and add:
PRIVATE_KEY=your_key_without_0x
ETHERSCAN_API_KEY=your_etherscan_key

# 4. Validate
npx hardhat run scripts/pre-deployment-checklist.ts --network localhost
```

---

## Testnet Deployment (15 minutes)

```bash
# 1. Get Sepolia ETH
# https://sepoliafaucet.com

# 2. Deploy
npx hardhat run scripts/deploy-testnet.ts --network sepolia
# ✅ Saves to: deployments/testnet-sepolia-[timestamp].json

# 3. Smoke test
npx hardhat run scripts/testnet-smoke-test.ts --network sepolia
# ✅ Expected: 8/8 tests passing

# 4. View on Etherscan
# Links printed after deployment
```

---

## Upgrade Rehearsal (30 minutes)

Full guide: `LAUNCH_READY.md` → "Upgrade Rehearsal / Simulation"

**Quick version:**
```bash
# 1. Capture baseline
npx hardhat run scripts/validate-storage-layout.ts

# 2. Create V2 (add new function, APPEND ONLY)
# 3. Validate no storage conflicts
# 4. Deploy V2 implementation
# 5. Upgrade via timelock
# 6. Re-run smoke tests (must pass)
# 7. Document in rehearsals/
```

---

## Mainnet Launch (1 hour + monitoring)

```bash
# Pre-flight check
npx hardhat run scripts/pre-deployment-checklist.ts --network mainnet
# Must show: ✅ Required: 9/9

# Deploy
npx hardhat run scripts/deploy-production.ts --network mainnet

# Post-deployment
# 1. Verify contracts on Etherscan
# 2. Transfer ownership to Timelock
# 3. Transfer Timelock admin to Gnosis Safe
# 4. Start monitoring
# 5. Announce launch
```

---

## Checklist Quick View

Run anytime: `npx hardhat run scripts/pre-deployment-checklist.ts --network localhost`

**Required items (9):**
1. ✅ Tests passing (59/59)
2. ⏳ Sepolia deployment
3. ⏳ Testnet smoke tests
4. ⏳ Upgrade rehearsal
5. ⏳ Environment variables (.env configured)
6. ⏳ Mainnet balance (0.5+ ETH)
7. ⏳ Gnosis Safe multisig
8. ⏳ Monitoring webhooks
9. ✅ Documentation complete

**Optional (1):**
- ⏳ External security audit ($15k-$50k, 2-4 weeks)

---

## Cost Breakdown

### Testnet (Free)
- Sepolia ETH: Free (faucets)
- Deployment: ~0.2 Sepolia ETH
- Testing: Free

### Mainnet
- Deployer wallet: **0.5 - 1.0 ETH** ($2,000 - $4,000 at $4k/ETH)
  - Deployment: ~0.15 ETH
  - Configuration: ~0.05 ETH
  - Buffer: ~0.3 ETH
- Gnosis Safe: ~0.01 ETH
- Audit (optional): **$15,000 - $50,000**

**Total:** $2,000 (no audit) to $52,000 (with audit)

---

## Network Configuration

Already configured in `hardhat.config.ts`:

| Network | RPC | Use Case |
|---------|-----|----------|
| `localhost` | Local | Development |
| `sepolia` | Public | Testnet |
| `mainnet` | LlamaRPC | Production |
| `polygon` | Public | Alt L1 (future) |
| `arbitrum` | Public | Alt L2 (future) |
| `base` | Public | Alt L2 (future) |

---

## Security Checklist

**Before mainnet:**
- [ ] Private key secured (hardware wallet or encrypted)
- [ ] `.env` never committed to git (in `.gitignore`)
- [ ] Gnosis Safe deployed with 3+ signers
- [ ] Timelock delay appropriate (24 hours production)
- [ ] Monitoring alerts configured and tested
- [ ] Testnet fully validated
- [ ] Upgrade rehearsal successful
- [ ] Team knows emergency procedures (pause, recover)

---

## Support & Resources

**Documentation:**
- Start: `PRE_DEPLOYMENT_GUIDE.md` ← **Step-by-step walkthrough**
- Reference: `LAUNCH_READY.md` ← **Complete guide**
- Operations: `docs/OPERATIONS_RUNBOOK.md`

**Getting Help:**
- Security: security@greenwavecoin.io (DO NOT post publicly)
- General: hello@greenwavecoin.io
- Bug Bounty: bounty@greenwavecoin.io

**External Resources:**
- Hardhat Docs: https://hardhat.org/
- OpenZeppelin Upgrades: https://docs.openzeppelin.com/upgrades-plugins
- Gnosis Safe: https://help.safe.global/
- Etherscan Verify: https://etherscan.io/verifyContract

---

## What's Next?

👉 **Read:** `PRE_DEPLOYMENT_GUIDE.md` for detailed step-by-step instructions

👉 **Quick path (testnet only):**
```bash
# 1. Setup (5 min)
cp .env.example .env
# Edit .env with PRIVATE_KEY and ETHERSCAN_API_KEY

# 2. Get Sepolia ETH (5 min)
# Visit: https://sepoliafaucet.com

# 3. Deploy (10 min)
npx hardhat run scripts/deploy-testnet.ts --network sepolia

# 4. Test (5 min)
npx hardhat run scripts/testnet-smoke-test.ts --network sepolia

# ✅ Testnet validated! Continue to mainnet prep.
```

👉 **Full production path:** Follow all 10 steps in `PRE_DEPLOYMENT_GUIDE.md`

---

**🎉 You're ready to launch when the checklist shows 9/9 required items complete!**

```bash
npx hardhat run scripts/pre-deployment-checklist.ts --network mainnet
```
