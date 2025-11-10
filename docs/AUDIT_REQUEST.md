# Audit Request: GreenWaveCoin

Purpose
-------
Request a security audit for the `GreenWaveCoin` contract suite and associated deployment artifacts.

Scope
-----
- `contracts/GreenWaveCoin.sol` (primary)
- Any auxiliary contracts used in tests or deployment (timelock, staking wrappers)
- Upgradeability (UUPS pattern and `_authorizeUpgrade` logic)
- Emergency controls (timelock, pause, emergencyWithdraw)
- Flash loan protection mechanism and delegation limits
- ERC20Votes integration and delegation accounting
- Batch operations and input validation

Artifacts to provide
-------------------
- Full source tree (this repo)
- Test suite and reproduction scripts (`npx hardhat test`)
- ABI and deployed proxy address (if available)
- Upgrade scripts and any multisig/timelock addresses

Acceptance criteria
------------------
- Critical and high severity issues resolved or mitigated
- Confirmed upgrade safety and storage layout
- Gas/complexity hotspots identified
- Short remediation report and suggested code patches

Contact & Timeline
------------------
Provide an estimated timeline and cost. Preferred deliverables: report PDF, issue tracker labels, and a remediation call.
