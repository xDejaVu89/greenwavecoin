# GreenWaveCoin (GWC)

> **Your PC advances AI research. You earn crypto.**

[![Website](https://img.shields.io/badge/website-greenwavecoin.com-00c896?style=flat-square)](https://www.greenwavecoin.com)
[![Tests](https://img.shields.io/badge/tests-59%20passing-brightgreen?style=flat-square)]()
[![Contract](https://img.shields.io/badge/Polygon%20Mainnet-0x74e4F6...513585-8247e5?style=flat-square)](https://polygonscan.com/address/0x74e4F6597095d0807b77D7080E93B77331513585)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Security](https://img.shields.io/badge/security-hardened-blue?style=flat-square)]()

GreenWaveCoin is a **distributed AI research network** where anyone can contribute idle CPU/GPU compute to run Neural Architecture Search (NAS) experiments — and earn GWC tokens for every task completed. Think Folding@home, but for AI research.

---

## How It Works

```
Your PC  →  Download Worker  →  Run AI Tasks  →  Earn GWC Tokens
                                     ↓
                         Coordinator validates results
                                     ↓
                         Smart contract releases rewards
```

1. **Download the worker** — a lightweight desktop app for Windows
2. **Run it in the background** — it picks up neural architecture search tasks from the coordinator
3. **Earn GWC** — rewards are paid automatically to your wallet on Polygon

---

## Live Network

| Component | Status | Link |
|-----------|--------|------|
| GWC Token (Polygon Mainnet) | ✅ Deployed | [Polygonscan](https://polygonscan.com/address/0x74e4F6597095d0807b77D7080E93B77331513585) |
| Staking Contract | ✅ Deployed | [Polygonscan](https://polygonscan.com/address/0x74e4F6597095d0807b77D7080E93B77331513585) |
| Landing Page | ✅ Live | [greenwavecoin.com](https://www.greenwavecoin.com) |
| Worker (Windows) | ✅ Available | [Download](https://www.greenwavecoin.com/#download) |
| Coordinator Server | 🔜 Launching | — |

---

## Tokenomics

| Parameter | Value |
|-----------|-------|
| Total Supply | 21,000,000 GWC (fixed) |
| Network | Polygon (MATIC) |
| Transaction Fee | 1% |
| Fee Split | 20% burn / 30% staking rewards / 50% treasury |
| Staking APR | 10% |
| Minimum Stake | 7 days |

---

## Project Structure

```
greenwavecoin/
├── contracts/
│   ├── GreenWaveCoin.sol        ← ERC20 token (UUPS upgradeable)
│   ├── GreenWaveStaking.sol     ← Staking rewards contract
│   └── GreenWaveTimelock.sol    ← Governance timelock (24h delay)
├── ai-worker/
│   ├── worker.py                ← Python AI compute worker
│   └── task_generator.py        ← Neural architecture search engine
├── backend/
│   └── src/                     ← Task coordinator & anti-cheat system
├── desktop/
│   └── src/                     ← Electron desktop app
├── scripts/
│   ├── deploy-production.ts     ← Mainnet deployment
│   └── monitor.ts               ← Contract health monitoring
└── test/                        ← 59 tests (100% passing)
```

---

## Smart Contract Architecture

```
GreenWaveCoin (UUPS Proxy)
├── ERC20Upgradeable
├── ERC20VotesUpgradeable     ← On-chain governance
├── ERC20PermitUpgradeable    ← Gasless approvals
├── PausableUpgradeable       ← Emergency circuit breaker
└── OwnableUpgradeable        ← Timelock-controlled

GreenWaveStaking (UUPS Proxy)
├── Time-based APR rewards
├── Minimum staking period enforcement
└── Emergency withdrawal

GreenWaveTimelock
├── 24-hour delay on all admin actions
└── Multisig governance (3-of-5 Gnosis Safe)
```

---

## Security

- **59/59 tests passing** — full coverage of core functionality
- **Flash loan protection** — per-block transfer limits
- **Reentrancy guards** — on all external functions
- **Timelock governance** — 24-hour delay on all upgrades
- **Emergency pause** — circuit breaker for security incidents
- **UUPS proxy** — storage-validated upgrade pattern
- **External audit** — planned at TVL > $1M

```bash
# Run all tests
npm test

# Security analysis (requires Slither)
slither . --filter-paths "node_modules|test" --exclude-dependencies
```

---

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npm test

# Deploy to testnet
cp .env.example .env
# Fill in POLYGON_AMOY_RPC_URL, PRIVATE_KEY, POLYGONSCAN_API_KEY
npx hardhat run scripts/deploy-production.ts --network amoy
```

---

## Contributing

1. Fork the repo and create a feature branch
2. Ensure all 59 tests still pass: `npm test`
3. Run Slither security analysis
4. Add tests for any new functionality
5. Open a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) before contributing.

---

## Links

- **Website**: [greenwavecoin.com](https://www.greenwavecoin.com)
- **Contract**: [Polygonscan](https://polygonscan.com/address/0x74e4F6597095d0807b77D7080E93B77331513585)
- **Join Waitlist**: [greenwavecoin.com/#waitlist](https://www.greenwavecoin.com/#waitlist)

---

**License**: MIT | **Network**: Polygon | **Version**: 1.0.0
