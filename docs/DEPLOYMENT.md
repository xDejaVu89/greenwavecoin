# Deployment Guide

## Prerequisites
- Node.js (>=18) and npm
- A funded deployer account (private key in `.env`)
- RPC URL for the target network in `.env` (optional; hardhat.config.ts has defaults)

## Local deployment

1. Start a local node

```powershell
npx hardhat node
```

2. Deploy to the local network

```powershell
npx hardhat deploy --network localhost
```

3. Interact with the deployed contracts via `hardhat console` or scripts.

## Testnet / Mainnet deployment (example: Polygon Mumbai)

1. Add RPC and API keys to `.env`:

```
PRIVATE_KEY=0x...
POLYGONSCAN_API_KEY=...
```

2. Deploy:

```powershell
npx hardhat deploy --network mumbai
```

3. If explorer API key is configured in `.env`, verification will be attempted automatically by the deploy script.

Notes
- Use a timelock or multisig on the owner that can authorize upgrades before performing any upgrade on mainnet.
- For repeated deployments, prefer using deterministic deployment addresses or tracking addresses in `deployments/`.
