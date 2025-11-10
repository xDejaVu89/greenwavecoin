# GreenWaveCoin Deployment Guide

This guide walks through deploying the complete GreenWaveCoin ecosystem: token, staking, and reward escrow contracts.

## Prerequisites

1. **Funded deployer wallet** with:
   - Polygon: ~5 MATIC for gas
   - Ethereum: ~0.05 ETH for gas
   - Mumbai testnet: Get free MATIC from faucet

2. **Private key** for deployment (create dedicated deployment wallet)

3. **RPC endpoints** (free options):
   - Polygon: https://polygon-rpc.com
   - Mumbai: https://rpc-mumbai.maticvigil.com
   - Ethereum: https://eth.llamarpc.com
   - Or use Infura/Alchemy for better reliability

## Environment Setup

Create `.env` in contracts directory:

```env
# Deployer private key (0x prefixed)
PRIVATE_KEY=0xYOURPRIVATEKEYHERE

# RPC endpoints
POLYGON_RPC_URL=https://polygon-rpc.com
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
ETHEREUM_RPC_URL=https://eth.llamarpc.com

# Optional: Block explorers (for verification)
POLYGONSCAN_API_KEY=
ETHERSCAN_API_KEY=

# Token parameters
INITIAL_SUPPLY=21000000
FOUNDER_ALLOCATION=5000000
FEE_COLLECTOR_ADDRESS=0xYourFeeCollectorAddress
```

## Deployment Steps

### 1. Deploy to Mumbai Testnet (Testing)

```powershell
cd contracts
npm run deploy -- --network mumbai
```

This will deploy:
1. GreenWaveCoin token (upgradeable)
2. SimpleStaking contract
3. RewardEscrowV2 contract

**Save the output addresses!**

### 2. Verify Contracts (Optional)

```powershell
npx hardhat verify --network mumbai <TOKEN_ADDRESS> <CONSTRUCTOR_ARGS>
npx hardhat verify --network mumbai <STAKING_ADDRESS> <TOKEN_ADDRESS>
npx hardhat verify --network mumbai <ESCROW_ADDRESS> <TOKEN_ADDRESS>
```

### 3. Test on Mumbai

- Add token to MetaMask: Use token address
- Send test tokens to your wallet
- Test staking: Stake some tokens
- Test compute flow: Run worker, submit results
- Test claiming: Generate Merkle proof and claim

### 4. Deploy to Polygon Mainnet

**⚠️ MAINNET DEPLOYMENT CHECKLIST:**
- [ ] All contracts tested on Mumbai
- [ ] Audit completed (if handling significant value)
- [ ] Deployer wallet funded with MATIC
- [ ] Founder wallet address confirmed
- [ ] Fee collector address confirmed
- [ ] Timelock/multisig setup for admin functions
- [ ] Emergency pause plan documented

```powershell
# Deploy to Polygon
npm run deploy -- --network polygon

# Verify contracts
npm run verify:polygon
```

### 5. Post-Deployment Configuration

**Update Desktop App:**

Edit `desktop/src/renderer/utils/contracts.ts`:

```typescript
export const CONTRACTS = {
  137: { // Polygon
    GWC_TOKEN: '0xYOUR_TOKEN_ADDRESS',
    REWARD_ESCROW: '0xYOUR_ESCROW_ADDRESS',
  },
  80001: { // Mumbai
    GWC_TOKEN: '0xYOUR_MUMBAI_TOKEN_ADDRESS',
    REWARD_ESCROW: '0xYOUR_MUMBAI_ESCROW_ADDRESS',
  },
};
```

**Update Backend:**

Edit `backend/.env`:

```env
TOKEN_ADDRESS=0xYOUR_TOKEN_ADDRESS
ESCROW_ADDRESS=0xYOUR_ESCROW_ADDRESS
STAKING_ADDRESS=0xYOUR_STAKING_ADDRESS
CHAIN_ID=137
RPC_URL=https://polygon-rpc.com
```

**Fund Contracts:**

```powershell
# Transfer GWC to escrow for rewards
# Via Hardhat console or desktop app once connected
```

### 6. Set Up Liquidity (Uniswap/QuickSwap)

**⚠️ IMPORTANT: Do this carefully to avoid price manipulation**

Option A: QuickSwap (Polygon) - Recommended for low budget
```
1. Go to https://quickswap.exchange
2. Connect founder wallet
3. Click "Pool" → "Add Liquidity"
4. Add GWC + MATIC pair
5. Suggested: 50,000 GWC + 50 MATIC (~$50 at $1/MATIC)
6. Review LP token receipt
7. Consider locking liquidity
```

Option B: Uniswap V3 (Ethereum) - Higher gas costs
```
1. Go to https://app.uniswap.org
2. Use concentrated liquidity for efficiency
3. Add GWC + ETH pair
4. Set price range carefully
```

### 7. Initialize Reward Distribution

**Configure Backend Epoch Job:**

```javascript
// Set reward parameters
const EPOCH_LENGTH = 24 * 60 * 60; // 24 hours
const MAX_DAILY_EMISSION = ethers.utils.parseEther('1000'); // 1000 GWC/day
```

**Start Backend:**

```powershell
cd backend
npm start
```

**Grant Backend Permission to Set Merkle Roots:**

Via Hardhat console or multisig:
```javascript
await escrow.grantRole(MERKLE_SETTER_ROLE, backendAddress);
```

## Security Considerations

### Admin Keys Management

1. **Deployment Key**: Rotate after deployment
2. **Timelock**: Use for admin functions (upgrade, pause, fee changes)
3. **Multisig**: Require 3-of-5 for critical operations
4. **Backend Key**: Separate key for Merkle root setting, monitor closely

### Monitoring

Set up alerts for:
- Large transfers (whale watching)
- Unusual claim patterns
- Contract balance drops
- Backend availability
- Worker submission anomalies

### Emergency Procedures

**If Exploit Detected:**
```powershell
# Pause token transfers
npx hardhat run scripts/pause.ts --network polygon

# Investigate via block explorer
# Prepare upgrade if needed
# Communicate with users
```

## Deployment Costs Estimate

**Mumbai (Testnet):** Free (faucet MATIC)

**Polygon Mainnet:**
- Token deployment: ~0.5 MATIC (~$0.50)
- Staking deployment: ~0.3 MATIC (~$0.30)
- Escrow deployment: ~0.4 MATIC (~$0.40)
- Configuration txs: ~0.2 MATIC (~$0.20)
- **Total: ~1.5 MATIC (~$1.50)**

**Ethereum Mainnet:**
- Token deployment: ~0.015 ETH (~$50)
- Staking deployment: ~0.008 ETH (~$27)
- Escrow deployment: ~0.01 ETH (~$33)
- Configuration: ~0.005 ETH (~$17)
- **Total: ~0.038 ETH (~$127)**

**Liquidity:**
- QuickSwap (Polygon): $50+ recommended
- Uniswap (Ethereum): $500+ recommended (higher gas)

## Troubleshooting

**"Insufficient funds"**
- Check deployer balance covers gas + initial supply
- Verify you're on correct network

**"Nonce too high"**
- Reset MetaMask account or clear pending transactions

**"Contract verification failed"**
- Check constructor arguments match exactly
- Ensure Solidity version matches

**"Transaction underpriced"**
- Increase gas price in hardhat.config.ts
- Wait for network congestion to clear

## Next Steps After Deployment

1. ✅ Update contract addresses in desktop app
2. ✅ Update backend configuration
3. ✅ Add liquidity to DEX
4. ✅ Test full flow: stake → compute → earn → claim
5. ✅ Announce token contract address
6. ✅ Submit to token listing sites (CoinGecko, CoinMarketCap)
7. ✅ Set up monitoring dashboards
8. ✅ Document for community

## Support

If deployment issues arise:
- Check Hardhat docs: https://hardhat.org
- Polygon docs: https://docs.polygon.technology
- Ethers.js docs: https://docs.ethers.org
