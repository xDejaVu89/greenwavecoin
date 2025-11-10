# GreenWaveCoin Desktop

Desktop application for GreenWaveCoin featuring wallet management, DEX trading, and compute rewards.

## Features

- **Wallet Management**: 
  - Connect via MetaMask (browser extension required)
  - View native token balance (ETH/MATIC)
  - View GWC token balance
  - Switch between Polygon and Ethereum networks
  - Copy address, disconnect wallet
- **DEX Trading**: 
  - Swap tokens on Polygon using 0x Protocol aggregator
  - Real-time quotes with price display
  - Support for MATIC, USDC, USDT, WETH, WBTC, DAI
  - Automatic approval flow for ERC20 tokens
  - 1% slippage tolerance, gas estimation
- **Compute Rewards**: 
  - Run background compute tasks
  - Earn GWC rewards
  - View pending rewards from backend
  - Claim rewards on-chain (requires contract deployment)
- **Multi-Network**: Support for Polygon and Ethereum networks

## Prerequisites

- Node.js 18+ and npm
- **MetaMask browser extension** (for wallet connection)
- For compute worker: Rust toolchain (rustc, cargo)

## Development

```powershell
# Install dependencies
cd desktop
npm install

# Run in development mode (hot reload)
npm run dev
```

This will start:
1. Vite dev server on http://127.0.0.1:5173 (renderer process)
2. Electron app loading from dev server

## Build

```powershell
# Build everything (worker + desktop)
.\build-all.ps1

# Or build individually:

# Build Rust worker first
cd ..\compute-worker
cargo build --release

# Then build desktop
cd ..\desktop
npm run build

# Package for Windows
npm run package
```

Installer will be created in `release/` directory.

**Note:** The desktop app requires the Rust worker to be pre-built. See `INTEGRATION.md` for details.

## Project Structure

```
desktop/
├── src/
│   ├── main/          # Electron main process
│   │   └── main.ts    # App initialization, IPC handlers
│   ├── preload/       # Preload script (IPC bridge)
│   │   ├── preload.ts
│   │   └── preload.d.ts
│   └── renderer/      # React UI
│       ├── pages/     # Dashboard, Wallet, Trade, Compute
│       ├── App.tsx
│       └── main.tsx
├── dist/              # Compiled output
├── package.json
└── vite.config.ts
```

## Architecture

- **Main Process**: Manages windows, spawns compute worker (Rust), handles IPC
- **Preload Script**: Secure IPC bridge using `contextBridge`
- **Renderer Process**: React UI with routing (Dashboard, Wallet, Trade, Compute)
  - **Wallet Store** (Zustand): MetaMask connection, balance fetching, network switching
  - **Contract Utils**: ethers.js helpers for GWC token and RewardEscrow interactions
- **Compute Worker**: Rust binary polling backend for tasks, submitting signed results

## Security

- Context isolation enabled
- Node integration disabled in renderer
- Content Security Policy headers
- Private keys handled only in main process (future: hardware wallet support)

## Integration Points

- **Backend API**: `http://127.0.0.1:3000` (tasks, results, rewards)
- **Blockchain**: Polygon/Ethereum via ethers.js
- **DEX**: Planned integration with 0x/1inch aggregator APIs
- **Compute Worker**: IPC spawn/kill via main process

## TODOs

- [x] Spawn/control Rust compute worker from main process
- [x] IPC handlers for worker start/stop/status
- [x] MetaMask wallet connection and balance display
- [x] Network switching (Polygon/Ethereum)
- [x] GWC token balance fetching
- [x] Dashboard shows pending rewards from backend
- [x] DEX integration with 0x Protocol (swap, quotes, approvals)
- [ ] Add GWC token to DEX token list (needs deployment)
- [ ] Complete reward claim transaction flow (needs contract addresses)
- [ ] Stream worker logs to Compute page UI
- [ ] Add WebSocket live updates for compute status
- [ ] Add hardware wallet support (Ledger/Trezor)
- [ ] Bundle worker binary in production build (electron-builder extraResources)
- [ ] Code signing for Windows installer
- [ ] Auto-update mechanism

## License

MIT
