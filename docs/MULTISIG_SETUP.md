# Multi-Signature Wallet Setup for GreenWaveCoin

**Recommended for**: Timelock Admin Control  
**Platform**: Gnosis Safe  
**Network**: Ethereum Mainnet

---

## Why Use Multi-Sig?

After deploying GreenWaveCoin, ownership is transferred to a timelock contract. The timelock's admin should be a multi-signature wallet to prevent single points of failure:

✅ **No single person** can execute governance proposals  
✅ **Requires consensus** from multiple signers  
✅ **Protects against** compromised keys  
✅ **Provides transparency** via on-chain history

---

## Recommended Configuration

### For Small Teams (3-5 people)
- **Signers**: 3-5 trusted team members
- **Threshold**: 2-of-3 or 3-of-5
- **Backup**: Maintain offline recovery keys

### For DAOs (Decentralized)
- **Signers**: 7-11 community members
- **Threshold**: 4-of-7 or 6-of-11
- **Composition**: Mix of core team + community

### Example Setup (Recommended for Launch)
```
Signers: 5
├── CEO/Founder
├── CTO/Technical Lead
├── Security Lead
├── Community Representative
└── External Security Advisor

Threshold: 3-of-5
```

---

## Setup Instructions

### Step 1: Deploy Gnosis Safe

1. **Go to Gnosis Safe**:
   - Visit: https://app.safe.global/
   - Connect wallet
   - Click "Create new Safe"

2. **Configure Safe**:
   ```
   Network: Ethereum Mainnet
   Safe name: GreenWaveCoin Governance
   
   Owners:
   - 0x... (Founder)
   - 0x... (CTO)
   - 0x... (Security Lead)
   - 0x... (Community Rep)
   - 0x... (External Advisor)
   
   Threshold: 3 out of 5
   ```

3. **Deploy**:
   - Review configuration
   - Pay deployment gas fee (~$50-100)
   - Wait for confirmation
   - Save Safe address: `0x...`

### Step 2: Configure Timelock Admin

After deploying your contracts, transfer timelock admin to the Safe:

```typescript
// In scripts/deploy-production.ts
const GNOSIS_SAFE_ADDRESS = "0x..."; // Your Safe address

// After timelock deployment
const timelock = await GreenWaveTimelockFactory.deploy(
  TIMELOCK_DELAY,
  GNOSIS_SAFE_ADDRESS // Safe is the admin
);
```

**Or transfer admin after deployment**:

```typescript
// scripts/transfer-timelock-admin.ts
const TIMELOCK_ADDRESS = "0x...";
const GNOSIS_SAFE_ADDRESS = "0x...";

const timelock = await ethers.getContractAt("GreenWaveTimelock", TIMELOCK_ADDRESS);

// Current admin transfers to Safe
await timelock.transferAdminTo(GNOSIS_SAFE_ADDRESS);
```

### Step 3: Test Multi-Sig Flow

**Test with a simple operation** (e.g., update fees):

1. **Create Transaction in Safe**:
   - Go to Safe interface
   - Click "New Transaction"
   - Select "Contract Interaction"
   - Enter Timelock address
   - Select `schedule()` function

2. **Schedule Proposal**:
   ```
   Function: schedule(address,uint256,bytes,bytes32,bytes32,uint256)
   
   target: 0x... (GreenWaveCoin proxy address)
   value: 0
   data: [encoded updateFees call]
   predecessor: 0x0000...
   salt: 0x[random]
   delay: [current timestamp + 24 hours]
   ```

3. **Signers Approve**:
   - Signer 1: Reviews and signs
   - Signer 2: Reviews and signs
   - Signer 3: Reviews and executes (once threshold met)

4. **Wait for Timelock Delay**: 24 hours

5. **Execute Proposal**:
   - Create new Safe transaction
   - Call `timelock.execute(...)` with same parameters
   - Requires threshold signatures again

---

## Operational Procedures

### Creating a Governance Proposal

**1. Proposal Creation** (Any signer can initiate):

```bash
# Generate proposal parameters
npx hardhat run scripts/create-proposal.ts

# Output:
# Target: 0x...
# Data: 0x...
# ETA: 1699564800
# Salt: 0x...
```

**2. Submit to Safe**:
- Go to Safe interface
- New Transaction → Contract Interaction
- Timelock address → `schedule()`
- Input parameters from script
- Add description in Safe transaction notes

**3. Review Period** (Signers review):
- Check proposal details
- Verify target contract
- Decode function call
- Verify parameters are correct
- Discuss in governance channel

**4. Approval** (Threshold signers approve):
- Signer 1: Review code → Approve
- Signer 2: Review code → Approve
- Signer 3: Review code → Execute

**5. Waiting Period**: 24-hour timelock delay

**6. Execution** (After delay expires):
- Any signer creates execution transaction
- Call `timelock.execute()` with same params
- Collect threshold signatures
- Execute transaction

### Emergency Pause Procedure

**When to Use**:
- Critical exploit detected
- Suspicious activity
- Contract behavior anomaly

**Fast-Track Process**:

```bash
# 1. Create pause transaction
npx hardhat run scripts/emergency-pause.ts

# 2. Submit to Safe (highest priority)
# - Tag as "EMERGENCY"
# - Notify all signers immediately

# 3. Collect signatures ASAP (target: <1 hour)
# - Signer 1: Review exploit evidence → Approve
# - Signer 2: Review exploit evidence → Approve  
# - Signer 3: Execute immediately

# 4. Schedule via timelock (may have emergency 1-hour delay)

# 5. Communicate to community
# - Post on Twitter/Discord
# - Explain reason
# - Provide timeline for fix
```

---

## Best Practices

### Signer Security

**Hardware Wallets Required**:
- All signers MUST use hardware wallets (Ledger, Trezor)
- No software/hot wallets for production Safe

**Key Management**:
- Keep hardware wallet in secure location
- Use strong PIN
- Write down recovery phrase (offline)
- Store recovery phrase in safe deposit box
- Never share private keys

**Operational Security**:
- Verify transaction details on hardware wallet screen
- Double-check contract addresses
- Review encoded function calls
- Don't sign blindly

### Communication

**Before Signing**:
- Review proposal in governance forum
- Discuss in private signer channel
- Verify technical details
- Check for red flags

**Emergency Contact**:
- Maintain 24/7 contact list
- Use encrypted messaging (Signal)
- Have backup signers available
- Test emergency procedures quarterly

### Transaction Verification

**Always Verify**:
1. Contract address matches deployed proxy
2. Function selector matches intended function
3. Parameters are correct (decode calldata)
4. Value is correct (usually 0)
5. Gas limit is reasonable

**Tools**:
- Etherscan: Verify contract addresses
- Safe UI: Shows decoded function calls
- Tenderly: Simulate transaction before signing

---

## Gnosis Safe Features

### Transaction History
- View all past transactions
- See who signed what
- Audit trail for governance

### Address Book
- Save important addresses
- Add labels (e.g., "GWC Token Proxy")
- Prevent typos

### Apps Integration
- Use WalletConnect
- Connect to dApps safely
- Sign with Safe instead of EOA

### Notifications
- Email alerts for new transactions
- Slack/Discord webhooks
- Mobile app push notifications

---

## Signer Rotation

### Adding a New Signer

**When to Add**:
- Team member joins
- Decentralization increase
- Backup signer needed

**Procedure**:
1. Discuss in governance
2. Create "Add Owner" transaction in Safe
3. Set new threshold if needed
4. Collect threshold signatures
5. Execute transaction
6. Welcome new signer

### Removing a Signer

**When to Remove**:
- Team member leaves
- Key compromised
- Inactivity

**Procedure**:
1. Emergency: Remove immediately if compromised
2. Non-emergency: Announce to team
3. Create "Remove Owner" transaction
4. Adjust threshold if needed
5. Collect signatures (excluding removed signer)
6. Execute
7. Revoke access to communication channels

---

## Advanced Configuration

### Multiple Safes

Consider using multiple Safes for separation of concerns:

```
Main Safe (Timelock Admin)
├── Required for: Governance proposals
├── Signers: 5
├── Threshold: 3-of-5
└── Purpose: High-security, slow operations

Operations Safe (Day-to-Day)
├── Required for: Monitoring, alerts
├── Signers: 3
├── Threshold: 2-of-3
└── Purpose: Fast response, lower value

Treasury Safe (Funds Management)
├── Required for: Token distributions
├── Signers: 5
├── Threshold: 3-of-5
└── Purpose: Financial operations
```

### Safe Modules

Gnosis Safe supports modules for advanced functionality:

**Zodiac Reality Module**: Off-chain voting integration  
**Scheduler Module**: Automated recurring transactions  
**Roles Modifier**: Fine-grained permissions

---

## Disaster Recovery

### Lost Signer Key

**If 1 signer loses access**:
- Safe still functional (threshold: 3-of-5)
- Replace lost signer when possible
- No immediate action needed

**If 2 signers lose access**:
- Safe still functional
- Replace signers ASAP
- Consider lowering threshold temporarily

**If ≥3 signers lose access**:
- **CRITICAL**: Cannot execute transactions
- Recovery depends on Safe configuration
- May require social recovery or contract upgrade

**Prevention**:
- All signers maintain secure backups
- Test recovery procedures quarterly
- Consider recovery module

### Safe Recovery Plan

**Option 1: Social Recovery** (if configured):
- Use pre-configured guardians
- Requires guardian signatures
- Can recover even if all keys lost

**Option 2: Recovery Phrase**:
- If Safe is an HD wallet-based account
- Use recovery phrase to restore access
- Requires secure storage of phrase

**Option 3: Contract Upgrade** (last resort):
- If contract supports recovery mechanism
- Requires community governance
- Time-consuming process

---

## Testing Checklist

Before going live with multi-sig:

- [ ] Deploy Safe on testnet
- [ ] Add all signers
- [ ] Test proposal creation
- [ ] Test threshold approval flow
- [ ] Test timelock schedule/execute
- [ ] Test emergency pause
- [ ] Verify all signers can access
- [ ] Practice disaster recovery
- [ ] Document all procedures
- [ ] Train all signers

---

## Resources

**Gnosis Safe**:
- Website: https://safe.global
- Docs: https://docs.safe.global
- Help: https://help.safe.global

**Safe SDK**:
- GitHub: https://github.com/safe-global/safe-core-sdk
- Examples: Programmatic Safe interaction

**Community**:
- Discord: https://discord.gg/safe
- Forum: https://forum.safe.global

---

**Recommendation**: Deploy a 3-of-5 Gnosis Safe for mainnet launch, then gradually decentralize by adding community signers over time.

**Next Steps**:
1. Deploy Safe on testnet
2. Practice governance flow
3. Document signer contacts
4. Set up monitoring
5. Deploy Safe on mainnet
6. Transfer timelock admin to Safe
