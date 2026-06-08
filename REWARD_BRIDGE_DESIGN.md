# GreenWaveCoin Reward Distribution Bridge

**Date**: June 8, 2026
**Status**: 🟢 Implemented and Ready

## Overview

The reward distribution bridge is the critical link between the off-chain AI research workers and the on-chain `RewardEscrowV2` smart contract. It automatically calculates how much GWC each worker has earned, builds a cryptographic proof (Merkle Tree), and publishes it to the blockchain so workers can claim their tokens.

## Architecture

### 1. The Reward Service (`reward.service.ts`)
This service runs on the backend coordinator and manages the **Epoch** lifecycle:
- **Calculation**: Queries the SQLite database for all valid AI results submitted since the last epoch.
- **Formula**: Rewards are calculated as `(Base + Accuracy Bonus) * Tasks Completed`.
  - Base: 1 GWC per task (configurable via `GWC_PER_TASK`)
  - Bonus: Up to 0.5 GWC for 100% accuracy (configurable via `GWC_ACCURACY_MULTIPLIER`)
- **Merkle Tree**: Generates a Merkle tree where each leaf is a hash of `(claim_index, wallet_address, amount_wei)`.
- **Persistence**: Stores the generated tree, root, and individual worker proofs in the SQLite database (`reward_epochs` and `reward_claims` tables).

### 2. The Chain Service (`chain.service.ts`)
Handles the actual Ethereum/L2 transaction using `ethers.js`:
- Connects to the RPC endpoint specified in `.env`.
- Signs the transaction using the `TREASURY_PRIVATE_KEY`.
- Calls `setMerkleRoot(epoch, root, totalAmount)` on the `RewardEscrowV2` contract.
- Includes automatic gas estimation and ownership verification to prevent failed transactions.

### 3. The Auto-Scheduler (`index.ts`)
The backend now includes a `setInterval` loop that automatically finalises and publishes epochs.
- Default interval is **24 hours** (configurable via `EPOCH_INTERVAL_HOURS`).
- If no new valid results exist, it skips the epoch to save gas.
- If the chain service is not configured, it still calculates the rewards and saves them to the database, allowing an admin to publish them manually later.

### 4. The API Routes (`rewards.routes.ts`)
Exposes the data to workers and admins:
- `GET /api/rewards/:wallet` — Workers call this to get their pending GWC balance and the Merkle proof needed to call `claim()` on the smart contract.
- `GET /api/rewards/preview` — Shows what workers *would* earn if the epoch were finalised right now.
- `POST /api/rewards/finalise-epoch` — Admin override to force an epoch calculation.
- `POST /api/rewards/publish-epoch` — Admin override to force an on-chain publish.

## Security Considerations

- **Transaction Reverts**: Gas is estimated before sending. If the treasury wallet is out of ETH, or is not the contract owner, the transaction is aborted cleanly and the epoch is marked as `failed` in the database for manual intervention.
- **Precision**: All internal math uses standard floats for GWC amounts, but converts to `BigInt` (Wei) for the Merkle tree and database storage to ensure exact matching with Solidity.
- **Idempotency**: The `reward_claims` table uses `(epoch, claim_index)` as a primary key to prevent duplicate claims from being generated.

## Next Steps

To activate this in production:
1. Deploy the `RewardEscrowV2` contract to your target network.
2. Update `.env` on the backend server with:
   - `RPC_URL`
   - `TREASURY_PRIVATE_KEY`
   - `ESCROW_ADDRESS`
3. Start the backend. The scheduler will automatically handle the rest.
