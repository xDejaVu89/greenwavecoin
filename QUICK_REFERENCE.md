# 🚀 GreenWaveCoin Quick Command Reference

## 📦 Setup

```powershell
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run all tests
npm test
```

## 🧪 Testnet (Sepolia)

```powershell
# Deploy to Sepolia
npx hardhat run scripts/deploy-testnet.ts --network sepolia

# Run smoke tests
npx hardhat run scripts/testnet-smoke-test.ts --network sepolia

# Monitor contracts
npx hardhat run scripts/monitor-contracts.ts --network sepolia

# Validate storage layout
npx hardhat run scripts/validate-storage-layout.ts --network sepolia

# Upgrade to V2 (rehearsal)
npx hardhat run scripts/upgrade-to-v2.ts --network sepolia
```

## 🌐 Mainnet

```powershell
# Pre-deployment checklist
npx hardhat run scripts/pre-deployment-checklist.ts --network mainnet

# Deploy to mainnet
npx hardhat run scripts/deploy-production.ts --network mainnet

# Run smoke tests
npx hardhat run scripts/testnet-smoke-test.ts --network mainnet

# Monitor contracts
npx hardhat run scripts/monitor-contracts.ts --network mainnet

# Renounce admin (⚠️ IRREVERSIBLE)
npx hardhat run scripts/renounce-admin.ts --network mainnet
```

## 📊 Monitoring

```powershell
# One-time health check
npx hardhat run scripts/monitor-contracts.ts --network <network>

# Start continuous monitoring with PM2
pm2 start ecosystem.config.json
pm2 list
pm2 logs greenwavecoin-monitor-mainnet

# Stop monitoring
pm2 stop greenwavecoin-monitor-mainnet

# Auto-start on boot
pm2 startup
pm2 save
```

## 🧩 Development

```powershell
# Run specific test file
npx hardhat test test/security.test.ts

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test

# Get contract size
npx hardhat size-contracts

# Open Hardhat console
npx hardhat console --network <network>

# Clean artifacts
npx hardhat clean
```

## 🔍 Verification

```powershell
# Verify contract on Etherscan (auto during deploy)
npx hardhat verify --network mainnet <CONTRACT_ADDRESS>

# Check balance
npx hardhat console --network mainnet
# Then: ethers.formatEther(await ethers.provider.getBalance("0xYourAddress"))
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `.env` | Private keys, API keys, addresses |
| `hardhat.config.ts` | Network configuration |
| `ecosystem.config.json` | PM2 monitoring config |
| `deployments/` | Deployment artifacts |
| `monitoring/` | Health metrics |
| `rehearsals/` | Upgrade test results |

## 🌐 Deployed Contracts (Sepolia Testnet)

| Contract | Address |
|----------|---------|
| Token Proxy | `0x6a5e4DE78a5Be75c308fCb5833ECC35412511D86` |
| Staking Proxy | `0xf22381517A98206831691fd6A8c020B982a939a1` |
| Timelock | `0xC3F5B6f9E9b531146D23F702AbE930318159Ed02` |

View on Etherscan:
- Token: https://sepolia.etherscan.io/address/0x6a5e4DE78a5Be75c308fCb5833ECC35412511D86
- Staking: https://sepolia.etherscan.io/address/0xf22381517A98206831691fd6A8c020B982a939a1
- Timelock: https://sepolia.etherscan.io/address/0xC3F5B6f9E9b531146D23F702AbE930318159Ed02

## 🔐 Environment Variables

Required in `.env`:

```bash
# Deployment
PRIVATE_KEY=your_private_key_here
GNOSIS_SAFE_ADDRESS=0xYourSafeAddress
TREASURY_ADDRESS=0xYourTreasuryAddress

# Verification
ETHERSCAN_API_KEY=your_etherscan_key

# Monitoring
ALERT_WEBHOOK_URL=https://your-webhook-url
SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/yourkey

# Optional
TOKEN_ADDRESS=0x...  # Auto-populated after deploy
TIMELOCK_ADDRESS=0x...  # Auto-populated after deploy
```

## 🚨 Emergency Commands

```powershell
# Pause contracts (via timelock, requires Safe signatures)
# Use Gnosis Safe UI to schedule/execute pause()

# Check if paused
npx hardhat console --network mainnet
# Then: (await ethers.getContractAt("GreenWaveCoin", "0xTokenAddress")).paused()

# Emergency withdrawal (when paused)
# Users can call emergencyWithdraw() on staking contract
```

## 📚 Documentation Quick Links

- **Launch Ready**: `LAUNCH_READY.md`
- **Mainnet Checklist**: `docs/MAINNET_CHECKLIST.md`
- **Monitoring Setup**: `docs/MONITORING.md`
- **Safe Setup**: `docs/GNOSIS_SAFE_SETUP.md`
- **Security Policy**: `SECURITY.md`
- **Audit Decision**: `audits/AUDIT_DECISION.md`
- **Complete Report**: `MAINNET_READY_REPORT.md`

## 💡 Pro Tips

1. **Always verify network before running commands**
   ```powershell
   npx hardhat console --network <network>
   # Check: (await ethers.provider.getNetwork()).name
   ```

2. **Keep deployment artifacts safe**
   - Backup `deployments/` directory
   - Commit to private repo (never public with keys)

3. **Monitor after every action**
   ```powershell
   npx hardhat run scripts/monitor-contracts.ts --network <network>
   ```

4. **Test on Sepolia first**
   - Always rehearse upgrades on testnet
   - Validate with smoke tests
   - Then apply to mainnet

5. **Use PM2 for production**
   - Reliable process management
   - Auto-restart on failure
   - Log rotation built-in

---

**For full documentation, see README.md and docs/ directory**
