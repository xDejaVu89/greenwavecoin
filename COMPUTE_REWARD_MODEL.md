# GreenWaveCoin Compute-for-Rewards Model

## Overview
This document defines the initial model for distributing GWC tokens as rewards for compute contributions (e.g., Folding@home-style work) via the RewardEscrow contract and backend system.

## 1. Reward Pool Allocation
- **Source:** Rewards are distributed from a dedicated pool funded by the project or community (not from inflation).
- **Initial Pool:** e.g., 1,000,000 GWC (configurable, can be topped up by governance or treasury).
- **Max Daily Emission:** e.g., 2,000 GWC/day (configurable cap to control distribution rate).

## 2. Epochs & Claim Cadence
- **Epoch Length:** 24 hours (1 day) per reward epoch.
- **Merkle Root Publishing:** At the end of each epoch, the backend publishes a Merkle root of all valid claims for that period.
- **Claim Window:** Claims for each epoch are open for 30 days after root publication.

## 3. Reward Calculation
- **Task Validation:** Each compute task is redundantly validated by multiple clients.
- **Reward Formula:**
  - Each valid result = X points (weighting possible by task difficulty).
  - User's share = (user points / total points) * epoch reward pool.
- **Anti-Cheat:**
  - Minimum GWC stake required to claim (e.g., 100 GWC, staked in a separate contract).
  - Backend checks for duplicate/invalid submissions and slashing for fraud.

## 4. Merkle Claim Flow
- **Backend:** Aggregates results, computes rewards, builds Merkle tree, uploads root to RewardEscrow.
- **User:** Uses desktop app to fetch proof and claim via RewardEscrow contract.
- **Unclaimed Rewards:** After claim window, unclaimed tokens can be swept back to the pool or treasury.

## 5. Parameters (Configurable)
- Reward pool size and top-up policy
- Epoch length (default: 24h)
- Max daily emission
- Minimum stake for eligibility
- Claim window duration

## 6. Security & Governance
- Only Timelock or multisig can set Merkle roots.
- All parameters adjustable by governance.
- Transparent on-chain logs for all root publications and claims.

---

*This model is a starting point and can be tuned based on community feedback and observed usage.*
