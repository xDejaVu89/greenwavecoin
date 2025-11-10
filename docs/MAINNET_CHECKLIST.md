# Mainnet Deployment Checklist

## Pre-Deployment (Complete Before Mainnet)

### Environment & Infrastructure

- [ ] **Gnosis Safe Created**
  - [ ] Deployed on Ethereum mainnet
  - [ ] 5 signers configured (with hardware wallets)
  - [ ] 3-of-5 threshold set
  - [ ] Test transaction completed
  - [ ] Safe address added to `.env`
  - [ ] Signer contact information documented
  - See: `docs/GNOSIS_SAFE_SETUP.md`

- [ ] **Environment Variables Configured**
  - [ ] `PRIVATE_KEY` (deployer wallet, funded with ≥0.5 ETH)
  - [ ] `ETHERSCAN_API_KEY` (for contract verification)
  - [ ] `GNOSIS_SAFE_ADDRESS` (multisig admin)
  - [ ] `TREASURY_ADDRESS` (fee recipient)
  - [ ] `ALERT_WEBHOOK_URL` (monitoring alerts)
  - [ ] `MAINNET_RPC` (optional, recommended: Alchemy/Infura)

- [ ] **Deployer Wallet Funded**
  - [ ] Minimum 0.5 ETH for deployment + buffer
  - [ ] Wallet secured with hardware wallet or secure vault
  - [ ] Backup of private key stored securely
  - [ ] Address: `_________________`

- [ ] **Monitoring Setup**
  - [ ] PM2 installed (`npm install -g pm2`)
  - [ ] Webhook configured (Discord/Slack)
  - [ ] Test alert sent successfully
  - [ ] `ecosystem.config.json` reviewed
  - [ ] Logs directory created

### Testing & Validation

- [ ] **Testnet Deployment Verified**
  - [ ] Sepolia deployment successful
  - [ ] Smoke tests: 8/8 passed
  - [ ] Upgrade rehearsal completed
  - [ ] Contracts monitored for 24+ hours
  - [ ] No issues detected

- [ ] **Local Tests Passing**
  - [ ] Run: `npx hardhat test`
  - [ ] Expected: 59/59 tests pass
  - [ ] No warnings or errors

- [ ] **Pre-Deployment Checklist Script**
  - [ ] Run: `npx hardhat run scripts/pre-deployment-checklist.ts --network mainnet`
  - [ ] Expected: 9/9 required checks pass
  - [ ] Review output and address any warnings

- [ ] **Storage Layout Validation**
  - [ ] Baseline snapshots generated
  - [ ] No unexpected changes detected
  - [ ] Gap storage verified (50 slots reserved)

### Security & Documentation

- [ ] **Security Review Complete**
  - [ ] Code review completed
  - [ ] Test coverage verified
  - [ ] Known risks documented
  - [ ] Emergency procedures defined
  - [ ] See: `SECURITY.md` and `audits/AUDIT_DECISION.md`

- [ ] **Audit Decision Approved**
  - [ ] Self-audit rationale reviewed
  - [ ] Triggers for external audit defined
  - [ ] Post-launch security plan documented

- [ ] **Documentation Updated**
  - [ ] README.md reflects mainnet status
  - [ ] LAUNCH_READY.md reviewed
  - [ ] API documentation current
  - [ ] Upgrade procedures documented

### Team Coordination

- [ ] **Launch Team Briefed**
  - [ ] Deployment timeline communicated
  - [ ] Roles and responsibilities assigned
  - [ ] Emergency contacts shared
  - [ ] Incident response procedure reviewed

- [ ] **Gnosis Safe Signers Ready**
  - [ ] All 5 signers confirmed availability
  - [ ] Hardware wallets accessible
  - [ ] Signing procedure practiced
  - [ ] Communication channel active

- [ ] **Community Prepared** (if applicable)
  - [ ] Announcement drafted
  - [ ] Social media ready
  - [ ] Discord/Telegram mods briefed
  - [ ] FAQ prepared for common questions

---

## Deployment Day

### Final Verification (Do Immediately Before Deploy)

- [ ] **Double-Check Configuration**
  ```powershell
  # Verify environment variables
  echo $env:GNOSIS_SAFE_ADDRESS  # Should be 0x...
  echo $env:TREASURY_ADDRESS     # Should be 0x...
  echo $env:ETHERSCAN_API_KEY    # Should be set
  
  # Verify network
  npx hardhat console --network mainnet
  # Run: (await ethers.provider.getNetwork()).name  // Should be "mainnet"
  ```

- [ ] **Verify Deployer Balance**
  ```powershell
  npx hardhat run scripts/check-balance.ts --network mainnet
  # Expected: ≥0.5 ETH
  ```

- [ ] **Gas Price Check**
  - [ ] Check current gas prices: https://etherscan.io/gastracker
  - [ ] If > 50 gwei, consider waiting for lower gas
  - [ ] Deployment estimated cost: 0.05 - 0.15 ETH (depends on gas)

- [ ] **No Network Issues**
  - [ ] Ethereum mainnet healthy (check https://ethstats.net/)
  - [ ] RPC endpoint responding
  - [ ] No major incidents in progress

### Deploy Contracts

```powershell
# Deploy to mainnet
npx hardhat run scripts/deploy-production.ts --network mainnet
```

**Expected Output**:
- Token proxy address
- Staking proxy address
- Timelock address
- Implementation addresses
- Etherscan verification links
- Deployment JSON saved to `deployments/`

**During Deployment**:
- [ ] Monitor transactions on Etherscan
- [ ] Verify each contract deployment succeeds
- [ ] Note all deployed addresses
- [ ] Save deployment JSON file

**Deployment Checklist**:
- [ ] Token deployed successfully
- [ ] Staking deployed successfully
- [ ] Timelock deployed successfully
- [ ] Contracts configured correctly
- [ ] Ownership transferred to timelock
- [ ] Etherscan verification completed (or noted for manual verification)

### Post-Deployment Verification

- [ ] **Run Smoke Tests**
  ```powershell
  # Update deployment file path in smoke test if needed
  npx hardhat run scripts/testnet-smoke-test.ts --network mainnet
  ```
  Expected: 8/8 tests pass

- [ ] **Verify on Etherscan**
  - [ ] Token contract verified and readable
  - [ ] Staking contract verified and readable
  - [ ] Timelock contract verified and readable
  - [ ] Proxy → Implementation links correct

- [ ] **Manual Verification Checks**
  - [ ] Token name: "GreenWaveCoin"
  - [ ] Token symbol: "GWC"
  - [ ] Total supply: 1,000,000 tokens
  - [ ] Owner: Timelock address
  - [ ] Staking contract set correctly
  - [ ] Treasury address correct
  - [ ] Timelock delay: 86400 seconds (24 hours)

- [ ] **Start Monitoring**
  ```powershell
  pm2 start ecosystem.config.json --only greenwavecoin-monitor-mainnet
  pm2 save
  ```

---

## Post-Deployment (Within 24 Hours)

### Transfer Admin to Gnosis Safe

**Critical**: This makes governance decentralized and secure.

#### Via Gnosis Safe UI:

1. **Grant Proposer Role**
   - Go to: https://app.safe.global/
   - Select: GreenWaveCoin Governance Safe
   - New Transaction → Contract Interaction
   - Contract: `[TIMELOCK_ADDRESS]`
   - Function: `grantRole`
   - Parameters:
     - `role`: `0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1` (PROPOSER_ROLE)
     - `account`: `[GNOSIS_SAFE_ADDRESS]`
   - Submit → Get 3/5 signatures → Execute

2. **Grant Executor Role**
   - Repeat above with:
   - `role`: `0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63` (EXECUTOR_ROLE)

3. **Verify Roles Granted**
   - Read contract on Etherscan
   - Function: `hasRole`
   - Check Safe has both PROPOSER and EXECUTOR roles

4. **Renounce Deployer Admin** (⚠️ Irreversible!)
   ```powershell
   # Only after confirming Safe has roles!
   npx hardhat run scripts/renounce-admin.ts --network mainnet
   ```
   This removes deployer's DEFAULT_ADMIN_ROLE, making Safe the sole admin.

- [ ] Proposer role granted to Safe
- [ ] Executor role granted to Safe  
- [ ] Roles verified on Etherscan
- [ ] Deployer admin role renounced
- [ ] **POINT OF NO RETURN**: Only Safe can admin now

### Monitoring & Validation

- [ ] **24-Hour Monitoring Period**
  - [ ] Check monitor logs every 6 hours
  - [ ] Verify no alerts triggered
  - [ ] Confirm metrics are being recorded
  - [ ] Review first day's metric files

- [ ] **Run Invariant Checks**
  ```powershell
  npx hardhat test test/invariant.test.ts --network mainnet
  ```
  Expected: All invariants hold

- [ ] **Community Verification**
  - [ ] Share contract addresses publicly
  - [ ] Etherscan verification visible to all
  - [ ] Answer community questions
  - [ ] Monitor social channels for issues

### Documentation & Communication

- [ ] **Update Public Documentation**
  - [ ] Add mainnet addresses to README
  - [ ] Update deployment status badge
  - [ ] Publish contract addresses on website
  - [ ] Link to Etherscan for transparency

- [ ] **Announcement**
  - [ ] Blog post / Medium article
  - [ ] Twitter announcement
  - [ ] Discord/Telegram announcement
  - [ ] Include contract addresses and Etherscan links

- [ ] **Create How-To Guides**
  - [ ] How to buy/transfer tokens
  - [ ] How to stake tokens
  - [ ] How to participate in governance
  - [ ] How to verify contract on Etherscan

---

## Week 1 Post-Launch

- [ ] **Daily Health Checks**
  - [ ] Review monitoring metrics
  - [ ] Check for anomalies
  - [ ] Respond to community questions
  - [ ] Track trading volume (if listed)

- [ ] **Performance Metrics**
  - [ ] Total holders count
  - [ ] Total staked amount
  - [ ] Reward pool balance trend
  - [ ] Transaction volume
  - [ ] Gas costs per transaction type

- [ ] **Bug Bounty Program**
  - [ ] Launch bug bounty (Immunefi or direct)
  - [ ] Set reward levels
  - [ ] Announce to security community

- [ ] **Governance Test**
  - [ ] Propose and execute a test governance action via Safe
  - [ ] Example: Update reward rate or adjust fee
  - [ ] Document process and timing
  - [ ] Verify 24h timelock delay works as expected

---

## Month 1 Post-Launch

- [ ] **Comprehensive Review**
  - [ ] Analyze all monitoring data
  - [ ] Review any incidents or alerts
  - [ ] Community feedback summary
  - [ ] Performance vs. expectations

- [ ] **Security Audit Decision**
  - [ ] Check TVL trigger (>$1M?)
  - [ ] Review community requests for audit
  - [ ] Engage auditor if criteria met
  - [ ] Update security documentation

- [ ] **Roadmap Update**
  - [ ] Assess first month performance
  - [ ] Gather community feedback
  - [ ] Plan next phase features
  - [ ] Update public roadmap

---

## Emergency Rollback Plan

If critical issues are discovered post-deployment:

1. **Pause Contracts** (via Safe + Timelock or emergency key if configured)
2. **Assess Impact** (team + community)
3. **Communicate** (transparent, frequent updates)
4. **Prepare Fix** (new implementation if upgradeable, or migration plan)
5. **Test Fix** (on testnet)
6. **Deploy Fix** (via governance with expedited timeline if safe)
7. **Post-Mortem** (public transparency report)

See `SECURITY.md` for detailed incident response procedures.

---

## Sign-Off

**Deployment Lead**: ___________________ Date: ___________

**Security Review**: ___________________ Date: ___________

**Safe Signer #1**: ___________________ Date: ___________

**Safe Signer #2**: ___________________ Date: ___________

**Safe Signer #3**: ___________________ Date: ___________

---

*This checklist should be completed sequentially. Do not skip steps.*
