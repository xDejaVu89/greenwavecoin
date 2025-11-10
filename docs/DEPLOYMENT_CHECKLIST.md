# Deployment Readiness Checklist

This checklist prepares GreenWaveCoin for mainnet deployment.

Pre-deployment
--------------
- [ ] External security audit completed and issues resolved
- [ ] Multisig (Gnosis) ownership configured for `owner` role
- [ ] Timelock contract deployed and timelock address set in config
- [ ] Governance addresses and initial parameters reviewed
- [ ] Proxy & implementation addresses documented
- [ ] CI passing (lint, tests, static analysis)
- [ ] Monitoring and alert webhooks configured (Discord/Slack)

On deployment day
-----------------
- [ ] Deploy implementation and proxy using OpenZeppelin upgrades
- [ ] Verify proxy via block explorer (Etherscan/Polygonscan)
- [ ] Transfer ownership to multisig or timelock as per governance plan
- [ ] Fund monitoring node (RPC, API keys, etc.)
- [ ] Run sanity checks: totalSupply, balances of treasury, deployer
- [ ] Post-deploy announcement and audit summary

Post-deployment
---------------
- [ ] Enable monitoring & alerts (large transfers, upgrades)
- [ ] Schedule upgrade and emergency procedures with multisig
- [ ] Perform a staged upgrade test on testnet (if required)
- [ ] Add contract and ABI to monitoring configuration

Notes
-----
- Never perform direct upgrades without a timelock and multisig in place.
- Keep private keys and `PRIVATE_KEY` out of source control; use environment secrets.
