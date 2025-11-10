# Gnosis Safe Setup Guide

## Overview

For mainnet deployment, GreenWaveCoin uses a Gnosis Safe multisig wallet as the ultimate admin of the timelock controller. This provides:
- **Decentralized control**: No single person can execute admin functions
- **Security**: Requires 3 of 5 signatures to act
- **Transparency**: All transactions are on-chain and auditable
- **Recovery**: If one signer loses access, others can still operate

## Recommended Setup: 3-of-5 Multisig

**Threshold**: 3 signatures required  
**Total Signers**: 5  
**Rationale**: Balances security (need 3 to compromise) with operational flexibility (2 can be unavailable)

## Step-by-Step Setup

### 1. Access Gnosis Safe

Go to: https://app.safe.global/

### 2. Connect Wallet

Connect with the wallet that will become **Signer #1** (typically deployer wallet).

### 3. Create New Safe

1. Click "Create new Safe"
2. Select **Ethereum Mainnet** as the network
3. Name your Safe: `GreenWaveCoin Governance`

### 4. Add Signers

Add 5 signer addresses:

**Recommended Signer Distribution**:
- **Signer #1**: Lead Developer (deployer wallet)
- **Signer #2**: Technical Co-Founder
- **Signer #3**: Community Representative (elected)
- **Signer #4**: Security Advisor
- **Signer #5**: Legal/Compliance Officer

**Important**: 
- Use hardware wallets (Ledger/Trezor) for all signers
- Verify each address carefully (checksum validation)
- Ensure each signer has access to their private keys
- Document who controls each address (secure internal record)

### 5. Set Threshold

- Set threshold to **3 of 5**
- This means 3 signatures are required to execute any transaction

### 6. Review and Deploy

1. Review all settings:
   - Network: Ethereum Mainnet
   - Signers: 5 addresses
   - Threshold: 3
   - Name: GreenWaveCoin Governance

2. Click "Create"

3. **Pay deployment fee**: ~$50-150 in ETH (gas cost)
   - Use the connected wallet to pay
   - Wait for transaction confirmation

4. **Save the Safe address**: 
   ```
   0xYourSafeAddressHere123456789...
   ```

### 7. Verify Safe

After deployment:
1. Click on your Safe in the dashboard
2. Verify all 5 signers are listed
3. Verify threshold shows "3 of 5"
4. Bookmark the Safe URL for easy access

### 8. Configure Environment

Add the Safe address to your `.env`:

```bash
GNOSIS_SAFE_ADDRESS=0xYourSafeAddressHere123456789...
```

### 9. Test Transaction (Recommended)

Before mainnet deployment, test the Safe with a small transaction:

1. Go to "New Transaction" → "Send tokens"
2. Send 0.001 ETH to a test address
3. Confirm with Signer #1
4. Share transaction link with other signers
5. Have 2 more signers confirm
6. Execute the transaction

This validates:
- All signers have access
- Threshold works correctly
- Team understands the signing process

### 10. Document Signers

Create an internal document (NOT public) with:

```
Signer #1: 0xAddress1... - John Doe (john@example.com) - Ledger Nano X
Signer #2: 0xAddress2... - Jane Smith (jane@example.com) - Trezor Model T
Signer #3: 0xAddress3... - Bob Wilson (bob@example.com) - Ledger Nano S
Signer #4: 0xAddress4... - Alice Brown (alice@example.com) - Trezor One
Signer #5: 0xAddress5... - Charlie Davis (charlie@example.com) - Ledger Nano X

Backup Recovery Plan:
- If 3+ signers unavailable: [Emergency procedure]
- Safe backup: [Location of encrypted backup]
- Contact list: [Secure location]
```

Store this document securely (encrypted vault, password manager).

## Using the Safe with Timelock

### Initial Setup (During Deployment)

The deployment script will:
1. Deploy token, staking, and timelock contracts
2. Transfer ownership of token and staking to the timelock
3. **Manual step**: Transfer timelock admin role to Safe

To transfer timelock admin to Safe:

```typescript
// After deployment, run this manually or via script
const timelock = await ethers.getContractAt("GreenWaveTimelock", TIMELOCK_ADDRESS);

// Grant proposer role to Safe
await timelock.grantRole(PROPOSER_ROLE, GNOSIS_SAFE_ADDRESS);

// Grant executor role to Safe (or keep as deployer for faster execution)
await timelock.grantRole(EXECUTOR_ROLE, GNOSIS_SAFE_ADDRESS);

// Revoke deployer's admin role (irreversible!)
await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployerAddress);
```

### Making Changes via Safe + Timelock

All governance actions go through this flow:

1. **Propose** (via Safe, needs 3/5 signatures)
2. **Wait** (24 hours timelock delay)
3. **Execute** (via Safe, needs 3/5 signatures)

Example: Update transaction fee

#### Step 1: Propose Transaction

```typescript
// In Safe "New Transaction" → "Contract Interaction"
// Target: Timelock contract address
// Function: schedule(
//   target: Token address
//   value: 0
//   data: token.updateFees(newFee, burnShare, stakingShare)
//   predecessor: 0x0000...
//   salt: (random)
//   delay: 86400 (24 hours)
// )
```

Three signers must approve this transaction.

#### Step 2: Wait for Timelock

After the schedule transaction is executed:
- Wait 24 hours (timelock delay)
- Monitor the operation via `timelock.isOperationReady(operationId)`

#### Step 3: Execute Transaction

```typescript
// In Safe "New Transaction" → "Contract Interaction"
// Target: Timelock contract address
// Function: execute(
//   target: Token address
//   value: 0
//   data: token.updateFees(newFee, burnShare, stakingShare)
//   predecessor: 0x0000...
//   salt: (same as schedule)
// )
```

Three signers must approve and one executes.

## Emergency Procedures

### Pause Contracts (Fast-Track)

If a critical vulnerability is discovered:

1. **Option A**: Schedule → wait 24h → execute pause
   - Safest, but slow
   - Use if vulnerability is not actively exploited

2. **Option B**: Pause immediately via Safe (if deployer has pause role)
   - Requires pre-granting pause role to Safe separate from timelock
   - Only for emergencies

### Recovering from Signer Loss

**Scenario**: One signer loses access

- **Impact**: None (need 3 of 5, still have 4 available)
- **Action**: Continue operating, plan to rotate signer address

**Scenario**: Two signers lose access

- **Impact**: High risk (only 3 available, no margin for error)
- **Action**: 
  1. Emergency meeting of remaining 3 signers
  2. Coordinate signing schedule
  3. Execute transaction to replace lost signer addresses

**Scenario**: Three or more signers lose access

- **Impact**: Critical - Cannot operate Safe
- **Recovery**: 
  - If funds are at risk, may need to deploy new contracts
  - This is why secure backup of signer info is critical
  - Consider insurance for this scenario

### Changing Safe Configuration

To add/remove signers or change threshold:

1. Go to Safe Settings → "Owners"
2. Propose change (add/remove owner or change threshold)
3. Get 3/5 approvals
4. Execute transaction

**Important**: Never reduce threshold below 2, and never let active signers drop below threshold+1.

## Best Practices

### Operational Security

- [ ] All signers use hardware wallets
- [ ] Signer addresses never used for other transactions (dedicated governance addresses)
- [ ] Regular check-ins to verify all signers still have access
- [ ] Test transactions quarterly to maintain familiarity
- [ ] Encrypted backup of signer information
- [ ] Clear communication channel for coordinating signatures

### Transaction Hygiene

- [ ] Always verify transaction details before signing
- [ ] Use Tenderly or similar tool to simulate transactions
- [ ] Double-check recipient addresses
- [ ] Review transaction data carefully (especially encoded calls)
- [ ] Have at least one signer verify on-chain after execution

### Communication Protocol

**For routine governance**:
1. Proposal discussed in governance forum
2. Consensus reached
3. Transaction prepared and shared in private signer channel
4. 48-hour review period before signing
5. Coordinate signing (not all at once - stagger for review)

**For emergency actions**:
1. Emergency notification via secure channel
2. Brief verification call (optional but recommended)
3. Coordinate rapid signing
4. Post-mortem and public communication after resolution

## Integration with Deployment

Update `scripts/deploy-production.ts` to include Safe address:

```typescript
const GNOSIS_SAFE = process.env.GNOSIS_SAFE_ADDRESS;

// After deploying timelock and transferring ownership:
console.log("\n⚠️  MANUAL STEP REQUIRED:");
console.log("Transfer timelock admin to Safe:");
console.log(`1. Go to ${safeUrl}`);
console.log(`2. New Transaction → Contract Interaction`);
console.log(`3. Target: ${timelockAddress}`);
console.log(`4. Function: grantRole(role=PROPOSER_ROLE, account=${GNOSIS_SAFE})`);
console.log(`5. Get 3/5 signatures and execute`);
console.log(`6. Repeat for EXECUTOR_ROLE`);
console.log(`7. Deployer then renounces DEFAULT_ADMIN_ROLE`);
```

## Resources

- [Gnosis Safe Official Docs](https://help.safe.global/)
- [Safe Transaction Service API](https://safe-transaction-mainnet.safe.global/)
- [Safe Contract Addresses](https://github.com/safe-global/safe-deployments)
- [Zodiac Governor Module](https://github.com/gnosis/zodiac-module-governor) (future integration)

## Checklist: Safe Ready for Production

- [ ] Safe deployed on Ethereum mainnet
- [ ] 5 signer addresses configured
- [ ] Threshold set to 3 of 5
- [ ] All signers verified access to their wallets
- [ ] Test transaction completed successfully
- [ ] Safe address added to `.env`
- [ ] Signer information documented securely
- [ ] Emergency procedures documented and shared
- [ ] Communication channel established for coordination
- [ ] Backup recovery plan in place

---

*Complete this setup before proceeding to mainnet deployment.*
