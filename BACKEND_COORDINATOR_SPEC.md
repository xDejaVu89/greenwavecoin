# Backend Coordinator Spec: GreenWaveCoin Compute Rewards

## Purpose
The backend coordinator is a Node.js service responsible for:
- Managing the compute task queue
- Validating and aggregating compute results
- Scoring user reputation
- Calculating reward allocations per epoch
- Generating and publishing Merkle roots for RewardEscrowV2

## Architecture Overview
- **Task Queue:**
  - Stores pending compute tasks (e.g., protein folding subtasks)
  - Assigns tasks to clients, tracks status
- **Result Validation:**
  - Receives results from multiple clients for redundancy
  - Compares hashes, flags discrepancies, rejects invalid submissions
- **Reputation System:**
  - Tracks user reliability, penalizes bad/fraudulent submissions
  - May weight rewards by reputation in future
- **Epoch Aggregator:**
  - At end of each epoch (e.g., 24h), aggregates all valid results
  - Computes user points, calculates reward shares
  - Builds Merkle tree of (index, account, amount) tuples
  - Publishes Merkle root and total to RewardEscrowV2 (via Timelock or multisig)
  - Stores proofs for user claims
- **API Layer:**
  - REST/GraphQL endpoints for:
    - Task assignment
    - Result submission
    - Proof retrieval for claims
    - User stats and reward history
- **Admin Tools:**
  - Manual override for task/result disputes
  - Emergency pause, root re-publish, or reward sweep

## Data Flow
1. **Task Assignment:**
   - Client requests task → backend assigns and records
2. **Result Submission:**
   - Client submits result (hash, signature) → backend validates
3. **Epoch End:**
   - Backend aggregates, scores, and computes rewards
   - Builds Merkle tree, publishes root to chain
   - Stores proofs for user claims
4. **User Claim:**
   - User fetches proof from backend, claims on-chain

## Security & Reliability
- All critical actions logged and auditable
- Redundant validation to prevent fraud
- Timelock/multisig required for Merkle root publishing
- Rate limiting and anti-spam on API

## Stack
- Node.js (TypeScript)
- Express or Fastify for API
- Postgres (task/result/reward state)
- Redis (task queue, ephemeral state)
- Merkle tree: merkletreejs or custom

---

*This spec is a starting point for backend implementation. Details can be expanded as needed for MVP or production.*
