# Epoch Reward Distributor — Setup Guide

This document explains how to wire the GreenWaveCoin coordinator to automatically
distribute rewards on-chain at the end of each epoch.

---

## How It Works

1. Workers complete NAS tasks and submit results to the coordinator.
2. Every 24 hours (configurable), the coordinator:
   - Reads all valid task results from the database
   - Calculates each worker's GWC reward proportional to tasks completed + accuracy
   - Builds a Merkle tree of all (index, wallet, amount) tuples
   - Calls `setMerkleRoot(epoch, root, total)` on the `RewardEscrowV2` contract
3. Workers visit `/claim` on the website, connect MetaMask, and claim their GWC.

---

## Required Environment Variables

Set these in the coordinator's `.env` file on your server (`/home/ubuntu/greenwavecoin/backend/.env`):

```env
# Polygon Mainnet RPC (use a reliable provider — Alchemy or QuickNode recommended)
RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Private key of the deployer/owner wallet (the wallet that deployed the contracts)
# This wallet must be the owner of the RewardEscrowV2 contract
TREASURY_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# The RewardEscrowV2 contract address
# NOTE: The GreenWaveStaking contract at 0x6a5e4DE78a5Be75c308fCb5833ECC35412511D86
# is a staking contract, NOT the RewardEscrowV2.
# You need to deploy RewardEscrowV2 separately (see below).
ESCROW_ADDRESS=0xYOUR_REWARD_ESCROW_V2_ADDRESS

# How often to run an epoch (in hours). Default is 24.
EPOCH_INTERVAL_HOURS=24

# Admin API key — used to protect the /finalise-epoch and /publish-epoch endpoints
ADMIN_API_KEY=choose_a_strong_random_key_here
```

---

## Step 1 — Deploy RewardEscrowV2

The `GreenWaveStaking` contract handles staking rewards (for people who stake GWC).
The `RewardEscrowV2` contract handles **compute rewards** (for workers who run tasks).

You need to deploy `RewardEscrowV2` and fund it with GWC tokens.

```bash
cd /home/ubuntu/greenwavecoin
PRIVATE_KEY="your_private_key" npx hardhat run scripts/deploy-escrow.ts --network polygon
```

This will output the `RewardEscrowV2` address — add it to your `.env` as `ESCROW_ADDRESS`.

Then fund it with GWC tokens (e.g. 5,000,000 GWC for the first year of rewards):

```bash
PRIVATE_KEY="your_private_key" npx hardhat run scripts/fund-escrow.ts --network polygon
```

---

## Step 2 — Configure the Coordinator

SSH into your coordinator server and add the env vars:

```bash
ssh root@206.81.5.13
cd /home/ubuntu/greenwavecoin/backend
nano .env
# Add RPC_URL, TREASURY_PRIVATE_KEY, ESCROW_ADDRESS, EPOCH_INTERVAL_HOURS, ADMIN_API_KEY
pm2 restart coordinator
```

---

## Step 3 — Verify Chain Configuration

Once the coordinator is running with the env vars set, check the chain status:

```bash
curl -H "X-Admin-Key: YOUR_ADMIN_API_KEY" \
  https://206.81.5.13.nip.io/api/rewards/chain-status
```

Expected response:
```json
{
  "configured": true,
  "escrowAddress": "0x...",
  "treasury": {
    "address": "0x6D51d80017C66afBeD44D50c775f46C60Bbb56af",
    "balanceEth": "0.05",
    "isContractOwner": true
  }
}
```

If `isContractOwner` is `false`, the `TREASURY_PRIVATE_KEY` does not match the contract owner.

---

## Step 4 — Preview Rewards Before Publishing

Before running the first epoch, preview what workers would earn:

```bash
curl https://206.81.5.13.nip.io/api/rewards/preview
```

This shows the current reward calculation without writing anything to the database.

---

## Step 5 — Manual Epoch Run (First Time)

For the first epoch, run it manually to verify everything works:

```bash
# Step 1: Finalise the epoch (builds Merkle tree, stores in DB)
curl -X POST \
  -H "X-Admin-Key: YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  https://206.81.5.13.nip.io/api/rewards/finalise-epoch

# Step 2: Publish the Merkle root on-chain
curl -X POST \
  -H "X-Admin-Key: YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"epoch": 0}' \
  https://206.81.5.13.nip.io/api/rewards/publish-epoch
```

After `publish-epoch` succeeds, workers can visit `/claim` on the website and claim their GWC.

---

## Automatic Epochs

Once `EPOCH_INTERVAL_HOURS` is set and the coordinator is restarted, epochs run automatically.
The coordinator logs will show:

```
[EPOCH] Auto-finalising epoch with 47 worker(s)...
[EPOCH] Epoch 1 finalised — 234.50 GWC across 47 workers
[EPOCH] Publishing epoch 1 on-chain...
[EPOCH] Epoch 1 published on-chain: 0xabc123...
```

---

## Reward Calculation

| Parameter | Value |
|---|---|
| Base reward per task | 0.1 GWC |
| Accuracy multiplier | up to 0.5 GWC per task (at 100% accuracy) |
| Max reward per task | 0.6 GWC |
| Epoch interval | 24 hours (configurable) |

A worker completing 100 tasks at 80% accuracy earns approximately:
`(0.1 + 0.8 × 0.5) × 100 = 50 GWC per epoch`

---

## Troubleshooting

**"Chain service not configured"** — `RPC_URL`, `TREASURY_PRIVATE_KEY`, or `ESCROW_ADDRESS` is missing from `.env`.

**"Signer is not the contract owner"** — The `TREASURY_PRIVATE_KEY` does not correspond to the wallet that deployed `RewardEscrowV2`. Check the contract owner on Polygonscan.

**"No valid results to reward"** — No workers have submitted results yet. Check `/api/rewards/preview` to see the current state.

**"transfer failed"** — The `RewardEscrowV2` contract does not have enough GWC tokens. Fund it using `scripts/fund-escrow.ts`.
