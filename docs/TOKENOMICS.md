# GreenWaveCoin Tokenomics (Draft)

> Status: Draft – align parameters before mainnet deploy.

## Overview
GreenWaveCoin is designed with sustainable governance, staking incentives, and a conservative initial float aimed at establishing a $21M initial circulating market capitalization ("target market cap") while preserving long-term upside and distribution fairness.

## Objectives
- Establish an initial implied price consistent with target market cap.
- Prevent excessive early float to mitigate volatility and price impact.
- Provide transparent allocation, vesting, and lock mechanics prior to launch.
- Facilitate governance decentralization over time via controlled emissions.

## Supply & Valuation Assumptions
| Parameter | Value | Notes |
|-----------|-------|-------|
| Total Max Supply | 21,000,000 | Hard cap; immutable after initial mint. |
| Target Circulating at TGE | 300,000 | Freely tradable at launch (1.43% of total). |
| Target Market Cap (USD) | $21,000,000 | Initial market cap target at TGE. |
| Implied TGE Price (USD) | $70.00 | Derived = $21M / 300k tokens. |
| Liquidity Pool Seed % | 15% | Portion of circulating tokens placed in LP. |
| LP Token Amount | 45,000 | 15% of 300,000 circulating tokens. |
| Implied FDV (USD) | $1,470,000,000 | If max supply fully diluted at implied price. |

**Configuration**: Set these values in `.env` as `TARGET_MARKET_CAP_USD=21000000`, `TGE_CIRC_TOKENS=300000`, `TOTAL_SUPPLY_TOKENS=21000000`. Recompute at any time using `ts-node scripts/tokenomics-calc.ts`.

## Allocation Breakdown
| Category | % of Total Supply | Tokens | Unlock / Vesting |
|----------|-------------------|--------|------------------|
| **Circulating (Public Float)** | 1.43% | 300,000 | Fully liquid at TGE |
| Liquidity Pool (subset of above) | 0.21% | 45,000 | Locked in LP position |
| **Treasury Reserve** | 25.00% | 5,250,000 | Timelock; gradual strategic use |
| **Staking Rewards Pool** | 30.00% | 6,300,000 | Emitted via staking over time |
| **Team & Advisors** | 15.00% | 3,150,000 | 12m cliff, 36m linear vesting |
| **Ecosystem / Grants** | 15.00% | 3,150,000 | Vesting schedule (proposals) |
| **Community / Airdrops** | 8.00% | 1,680,000 | Tranches; anti-sybil filters |
| **Strategic Partners** | 5.00% | 1,050,000 | 6m cliff, 18m vesting |
| **Reserve / Future Use** | 0.57% | 120,000 | Burn / Protocol incentives |
| **Total** | **100.00%** | **21,000,000** | |

**Notes**:
- Initial deployer balance = circulating (300k) + treasury (5.25M) + staking rewards (6.3M initially funded at ~0.5% = 105k) = majority held pre-distribution.
- Actual deploy script mints 21M to deployer; manual or scripted transfers required to distribute locked allocations (team, ecosystem, partners) to vesting contracts.
- Circulating supply tracker (`scripts/circulating-supply.ts`) excludes treasury, timelock, staking contract, vesting contracts, and burn addresses.

## Vesting & Locking Principles
- Timelock enforced for treasury moves and strategic reallocations.
- Linear vesting contracts recommended (e.g., OpenZeppelin Vesting) for Team/Advisor allocations.
- Cliff durations reduce short-term sell pressure.
- Staking reward emissions should target sustainable APR declining as participation grows.

## Liquidity Strategy
- Seed initial DEX (e.g., Uniswap v3) with LP Token Amount and proportional ETH.
- Use implied price as guidance; allow market discovery post-launch.
- Consider a dual-phase liquidity approach: initial depth then incremental reinforcement.
- Monitor early slippage and widen price ranges if volatility spikes.

## Circulating Supply Tracking
Exclude these from circulating metrics:
- Treasury address
- Timelock controller
- Staking contract
- Vesting contracts (locked allocations)
- Burn address / dead address

Implement a script (future) to compute circulating supply dynamically by querying balances minus exclusions and writing JSON snapshots for monitoring.

## Governance Considerations
- Early on-chain proposals guarded by Timelock & possibly multi-sig Safe.
- Progressive decentralization via increased voting power distribution as staking and emissions allocate tokens.
- Clear upgrade path rehearsed (UUPS) – maintain invariant tracking.

## Risk Mitigations
| Risk | Mitigation |
|------|------------|
| Low float volatility | Stagger secondary unlocks; monitor slippage; adaptive LP provisioning |
| Concentration | Vesting + timelock + gradual emissions |
| Liquidity drain | Fee mechanism & monitoring alerts on large transfers |
| Upgrade risk | Rehearsed, invariant snapshot checks, implementation verification |
| Governance capture | Diverse initial distribution + staking participation incentives |

## Operational Checklist Tie-in
- Ensure `.env` contains tokenomics planning variables before final mainnet deploy dry-run.
- Run `ts-node scripts/tokenomics-calc.ts` and archive JSON output in `monitoring/`.
- Update `deploy-production.ts` if initial mint distributions require scripted transfers.

## Next Steps
1. ✅ **Finalized** total supply (21,000,000 tokens) and allocation percentages.
2. Add vesting contract deployments to production script (if automated) or manual distribution plan.
3. Implement/test circulating supply tracker script (already created: `scripts/circulating-supply.ts`).
4. Parameterize staking APR to align with long-term emission targets (currently 10% APR).
5. Produce public summary & auditor review of tokenomics prior to mainnet launch.
6. Execute liquidity provisioning per `docs/LIQUIDITY_PLAN.md`.

---
**Status**: Production-ready draft. Review allocations with stakeholders and finalize vesting contract addresses before mainnet deploy.
