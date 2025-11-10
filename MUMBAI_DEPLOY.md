# Mumbai Testnet Deployment - Step by Step

## Prerequisites Checklist

- [ ] MetaMask installed with Mumbai network added
- [ ] Test MATIC from faucet: https://faucet.polygon.technology/
- [ ] Contracts directory accessible: `cd ..\contracts`
- [ ] Node.js dependencies installed: `npm install`

## Step 1: Get Mumbai Test MATIC

1. Add Mumbai to MetaMask:
   - Network Name: Mumbai Testnet
   - RPC URL: https://rpc-mumbai.maticvigil.com
   - Chain ID: 80001
   - Currency: MATIC
   - Block Explorer: https://mumbai.polygonscan.com

2. Get free test MATIC from faucet (0.5 MATIC = enough for deployment)

3. Export private key from MetaMask:
   - ⚠️ Use a TEST wallet only (not your main wallet)
   - Account details → Export Private Key
   - Copy the key (starts with 0x)

## Step 2: Configure Environment

In `contracts/.env`:

```env
# Deployer private key (TEST WALLET ONLY)
PRIVATE_KEY=0xYOURTESTWALLETPRIVATEKEY

# Mumbai RPC
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com

# Token parameters
INITIAL_SUPPLY=21000000
FOUNDER_ALLOCATION=5000000
FEE_COLLECTOR_ADDRESS=0xYourTestWalletAddress

# Optional: For contract verification
POLYGONSCAN_API_KEY=YourApiKey
```

## Step 3: Verify Hardhat Setup

```powershell
cd ..\contracts

# Check config
npx hardhat

# Should show available tasks (compile, test, deploy, etc.)
```

## Step 4: Compile Contracts

```powershell
npx hardhat compile
```

Expected output:
```
Compiled X Solidity files successfully
```

## Step 5: Run Tests (Optional but Recommended)

```powershell
npx hardhat test
```

All tests should pass. If any fail, review before deploying.

## Step 6: Deploy to Mumbai

```powershell
npx hardhat run scripts/deploy.js --network mumbai
```

**Save the output!** You'll see addresses like:
```
GreenWaveCoin deployed to: 0xABC...
SimpleStaking deployed to: 0xDEF...
RewardEscrowV2 deployed to: 0x123...
```

## Step 7: Verify Contracts on PolygonScan (Optional)

```powershell
# Token
npx hardhat verify --network mumbai 0xTOKEN_ADDRESS "Constructor args here"

# Staking
npx hardhat verify --network mumbai 0xSTAKING_ADDRESS 0xTOKEN_ADDRESS

# Escrow
npx hardhat verify --network mumbai 0xESCROW_ADDRESS 0xTOKEN_ADDRESS
```

## Step 8: Update Desktop App

Edit `desktop\src\renderer\utils\contracts.ts`:

```typescript
export const CONTRACTS = {
  80001: {
    GWC_TOKEN: '0xYourMumbaiTokenAddress',
    REWARD_ESCROW: '0xYourMumbaiEscrowAddress',
  },
  137: {
    GWC_TOKEN: '0x0000000000000000000000000000000000000000',
    REWARD_ESCROW: '0x0000000000000000000000000000000000000000',
  },
};
```

## Step 9: Update Backend

Edit `backend\.env`:

```env
TOKEN_ADDRESS=0xYourMumbaiTokenAddress
ESCROW_ADDRESS=0xYourMumbaiEscrowAddress
STAKING_ADDRESS=0xYourMumbaiStakingAddress
CHAIN_ID=80001
RPC_URL=https://rpc-mumbai.maticvigil.com
```

## Step 10: Test Full Flow

**A. Add Token to MetaMask:**
```
1. MetaMask → Import Tokens
2. Paste Mumbai token address
3. Should show: GreenWaveCoin (GWC), decimals 18
4. See your initial supply or founder allocation
```

**B. Test Desktop App:**
```powershell
cd ..\desktop
npm run dev
```

1. Connect wallet (should show Mumbai network)
2. Navigate to Dashboard
3. Click Refresh → Should show GWC balance
4. Try sending tokens to another test address
5. Check balance updates

**C. Test Compute Flow:**
```powershell
# Terminal 1: Backend
cd ..\backend
npm start

# Terminal 2: Desktop already running
# Click Compute → Start Worker

# Terminal 3: Submit test task
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/api/tasks/create" `
  -Body (@{payload=@{test="data"}} | ConvertTo-Json) -ContentType "application/json"

# Check worker logs in desktop console
# Check results endpoint
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/results"
```

**D. Test Rewards (Manual Simulation):**
```powershell
# In Hardhat console (cd ..\contracts)
npx hardhat console --network mumbai

# Transfer GWC to escrow
const Token = await ethers.getContractAt("GreenWaveCoin", "0xYourTokenAddress");
await Token.transfer("0xEscrowAddress", ethers.utils.parseEther("10000"));

# TODO: Backend generates Merkle root and publishes it
# Then test claim in desktop app
```

## Troubleshooting

**"Insufficient funds for gas"**
- Get more test MATIC from faucet
- Wait a few minutes and retry

**"Invalid nonce"**
- Reset MetaMask account (Settings → Advanced → Reset Account)

**"Contract not found"**
- Check network is Mumbai (Chain ID 80001)
- Verify contract address is correct

**Desktop app shows 0 balance**
- Ensure Mumbai network selected in MetaMask
- Check contract addresses are updated in contracts.ts
- Click Refresh button
- Check browser console for errors

**Worker not starting**
- Ensure worker is compiled: `cd ..\compute-worker; cargo build --release`
- Check worker .env has correct BACKEND_URL
- Check desktop console for error messages

## Next Steps After Mumbai Success

1. ✅ Contracts deployed and verified
2. ✅ Desktop app shows balances
3. ✅ Worker can submit results
4. Test claim flow with manual Merkle proof
5. Prepare for Polygon mainnet deployment
6. Add liquidity when ready

## Resources

- Mumbai Faucet: https://faucet.polygon.technology/
- Mumbai Explorer: https://mumbai.polygonscan.com
- Polygon Docs: https://docs.polygon.technology
- Hardhat Docs: https://hardhat.org/docs
