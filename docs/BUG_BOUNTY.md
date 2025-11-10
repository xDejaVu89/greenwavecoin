# GreenWaveCoin Bug Bounty Program

**Status**: 🚀 ACTIVE  
**Launch Date**: [To be announced]  
**Program Type**: Managed In-House  
**Total Bounty Pool**: $50,000 USD (in ETH/USDC)

---

## Overview

GreenWaveCoin is committed to the security of our protocol and the safety of our users' funds. This bug bounty program rewards security researchers who discover and responsibly disclose vulnerabilities in our smart contracts and infrastructure.

**Our Commitment**:
- We will respond to all valid submissions within 48 hours
- We will not pursue legal action against good-faith researchers
- We will publicly acknowledge researchers (with permission)
- We will pay bounties promptly upon fix deployment

---

## Scope

### In-Scope Smart Contracts

**Primary Contracts** (Ethereum Mainnet):

| Contract | Address | Severity Multiplier |
|----------|---------|---------------------|
| GreenWaveCoin (Proxy) | `0x...` | 1.0x |
| GreenWaveCoin (Implementation) | `0x...` | 1.0x |
| GreenWaveStaking | `0x...` | 1.0x |
| GreenWaveTimelock | `0x...` | 1.0x |

**Source Code**:
- GitHub: https://github.com/yourorg/greenwavecoin
- Verified on Etherscan
- All contracts in `contracts/` directory

### In-Scope Infrastructure

**Monitoring & Operations**:
- Monitoring service (if exposed)
- Alert endpoints
- RPC endpoints (if self-hosted)

**Documentation**:
- Security flaws in documentation that could lead to user fund loss

### Out-of-Scope

The following are **NOT** eligible for bounties:

❌ **Known Issues**:
- Issues already listed in `docs/SECURITY_CHECKLIST.md`
- Issues documented in previous audits

❌ **Low-Impact Issues**:
- Gas optimization suggestions
- Code style/formatting issues
- Missing NatSpec comments
- Informational findings without security impact

❌ **Frontend/UI**:
- Website vulnerabilities (no official frontend yet)
- Phishing websites (report to abuse@greenwavecoin.io)

❌ **Third-Party Contracts**:
- OpenZeppelin contracts (report to OpenZeppelin directly)
- Uniswap, Aave, or other external protocols

❌ **Social Engineering**:
- Phishing attacks against team members
- Social media impersonation

❌ **Denial of Service**:
- Network-level DoS attacks
- Gas griefing (unless critical impact)

❌ **Previously Disclosed**:
- Public CVEs affecting dependencies
- Issues already submitted by another researcher

---

## Severity Classification

### Critical - $10,000 to $25,000

**Definition**: Direct theft or permanent freezing of user funds

**Examples**:
- Unauthorized minting/burning of tokens
- Theft of staked tokens
- Bypass of timelock delays
- Bypass of access controls allowing unauthorized upgrades
- Permanent DoS preventing all withdrawals
- Flash loan attacks draining the treasury

**Requirements**:
- Proof of concept demonstrating fund loss
- Clear steps to reproduce
- Fix recommendation

### High - $5,000 to $10,000

**Definition**: Potential for significant fund loss under specific conditions

**Examples**:
- Temporary freezing of user funds (>24 hours)
- Fee manipulation allowing theft of fees
- Governance manipulation (vote buying/delegation exploits)
- Reentrancy attacks with demonstrated loss
- Oracle manipulation (if oracles added later)
- Improper access control on critical functions

**Requirements**:
- Proof of concept showing realistic attack
- Description of conditions required
- Impact analysis

### Medium - $1,000 to $5,000

**Definition**: Issues that could lead to fund loss but require unlikely conditions

**Examples**:
- Griefing attacks affecting other users
- Temporary DoS (<24 hours)
- Precision loss in fee calculations (minor amounts)
- Front-running vulnerabilities with limited impact
- Missing event emissions for critical state changes
- Upgradeability issues (storage collisions, etc.)

**Requirements**:
- Description of attack scenario
- Assessment of likelihood
- Suggested mitigation

### Low - $200 to $1,000

**Definition**: Issues with minimal security impact

**Examples**:
- Gas inefficiencies leading to failed transactions
- Incorrect error messages
- Unexpected reverts in edge cases
- Missing input validation (non-critical)
- Inconsistent state without fund loss

**Requirements**:
- Clear description of issue
- Steps to reproduce
- Why it matters

---

## Bounty Determination

### Base Amount
Determined by severity classification above.

### Modifiers

**Quality Multipliers**:
- **Exceptional PoC** (+50%): Working exploit code, detailed analysis
- **Fix Included** (+25%): Pull request with complete fix and tests
- **Detailed Report** (+10%): Professional writeup with diagrams

**Reduction Factors**:
- **Partial Duplication** (-50%): Similar to existing submission (first gets full)
- **Missing PoC** (-50%): Theoretical only, no demonstration
- **Poor Quality Report** (-25%): Incomplete information, unclear steps

**Example Calculation**:
```
Base (High): $7,500
+ Exceptional PoC (+50%): $3,750
+ Fix Included (+25%): $1,875
= Total: $13,125
```

### Payment Structure

**Currency Options**:
- ETH (at current market price)
- USDC
- GreenWaveCoin tokens (at 20% premium)

**Payment Timeline**:
1. Submission received → Acknowledgment within 48h
2. Validation complete → Severity classification within 7 days
3. Fix deployed → Payment within 14 days of fix deployment

**Payment Method**:
- Direct to your Ethereum address
- Optionally through Immunefi or HackerOne (if available)

---

## Submission Process

### Step 1: Prepare Your Report

**Required Information**:
- **Vulnerability Type**: What kind of issue is it?
- **Affected Contract**: Which contract(s) are vulnerable?
- **Severity Assessment**: Your estimated severity (we may adjust)
- **Steps to Reproduce**: Exact steps to trigger the vulnerability
- **Proof of Concept**: Code demonstrating the exploit
- **Impact**: What can an attacker do? How much can they steal?
- **Recommended Fix**: How to fix the issue?

**Optional But Helpful**:
- Hardhat test case reproducing the issue
- Foundry fuzzing test
- Diagram showing attack flow
- Gas cost analysis
- Multiple fix approaches

### Step 2: Submit Securely

**Preferred Method - Encrypted Email**:

```bash
# 1. Encrypt your report with our PGP key
gpg --encrypt --armor --recipient security@greenwavecoin.io report.pdf

# 2. Send to: security@greenwavecoin.io
# Subject: [BUG BOUNTY] Brief Description
# Attach: report.pdf.asc
```

**Our PGP Key**:
```
-----BEGIN PGP PUBLIC KEY BLOCK-----
[To be added - generate a dedicated security@greenwavecoin.io key]
-----END PGP PUBLIC KEY BLOCK-----
```

**Alternative Methods**:
- GitHub Security Advisory: https://github.com/yourorg/greenwavecoin/security/advisories
- Keybase: [@greenwavecoin](https://keybase.io/greenwavecoin)
- Signal: [To be added]

**Please DO NOT**:
- ❌ Open public GitHub issues
- ❌ Post on social media
- ❌ Disclose on security forums
- ❌ Contact individual team members directly

### Step 3: Response Timeline

**Within 48 Hours**:
- Acknowledgment email with ticket number
- Initial triage (is this in-scope?)

**Within 7 Days**:
- Validation complete
- Severity classification
- Bounty amount determination

**Within 14 Days** (Critical/High):
- Fix developed and tested
- Internal security review
- Preparation for deployment

**Within 30 Days** (Medium/Low):
- Fix scheduled for next release
- Status updates every 7 days

**After Fix Deployment**:
- Bounty payment processed within 14 days
- Public disclosure coordinated with researcher

---

## Rules of Engagement

### DO ✅

**Responsible Disclosure**:
- Report vulnerabilities privately
- Allow reasonable time for fixes (90 days)
- Coordinate public disclosure with our team

**Professional Testing**:
- Use testnet/local fork for testing
- Minimize impact if testing on mainnet
- Follow ethical hacking principles

**Clear Communication**:
- Provide detailed, reproducible reports
- Respond to our questions promptly
- Update us if you find related issues

### DON'T ❌

**Prohibited Actions**:
- ❌ Test on mainnet with real funds
- ❌ Exploit vulnerabilities for profit
- ❌ Access/modify user data
- ❌ Degrade service availability
- ❌ Disclose publicly before fix
- ❌ Demand ransom or threaten disclosure
- ❌ Violate any laws or regulations

**Disqualifying Behavior**:
- Public disclosure before 90-day window
- Attempted extortion
- Attacks on production systems
- Theft of funds (will result in legal action)

---

## Bounty Eligibility

### Eligible Researchers

✅ **Anyone worldwide**, including:
- Independent security researchers
- Academic researchers
- Security firms (bounty split among team)
- Anonymous researchers (must provide ETH address)

### Ineligible Participants

❌ **Cannot participate**:
- GreenWaveCoin team members and contractors
- Immediate family of team members
- Previous auditors of these specific contracts
- Anyone involved in development or testing
- Anyone in countries sanctioned by OFAC

---

## Example Vulnerabilities

### Critical Example: Unauthorized Minting

**Issue**: Anyone can mint unlimited tokens

```solidity
// Vulnerable code
function mint(address to, uint256 amount) external {
    _mint(to, amount); // Missing access control!
}
```

**Impact**: Total supply dilution, token value collapse

**PoC**:
```typescript
await greenWaveCoin.connect(attacker).mint(attacker.address, ethers.parseEther("1000000000"));
// Attacker now has 1 billion tokens
```

**Fix**: Add access control
```solidity
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
    _mint(to, amount);
}
```

**Bounty**: $25,000 (Critical, max)

---

### High Example: Fee Bypass

**Issue**: Users can avoid burn fees by transferring to themselves

```solidity
// Vulnerable logic
if (from != to) {
    applyFees();
}
```

**Impact**: Fee mechanism broken, treasury underfunded

**PoC**:
```typescript
// Transfer to self in a loop to avoid fees
for (let i = 0; i < 100; i++) {
    await token.connect(user).transfer(user.address, amount);
}
```

**Fix**: Different condition or remove optimization

**Bounty**: $7,500 (High)

---

### Medium Example: Precision Loss

**Issue**: Fee calculation loses precision on small transfers

```solidity
uint256 fee = amount / 10000 * burnShare; // Wrong order
```

**Impact**: Small transfers pay no fees, but requires many txs

**PoC**:
```typescript
await token.transfer(recipient, 1000); // Amount < 10000, fee = 0
```

**Fix**: Reorder multiplication
```solidity
uint256 fee = (amount * burnShare) / 10000;
```

**Bounty**: $2,500 (Medium)

---

## FAQ

**Q: Can I submit issues found by automated tools?**  
A: Yes, but only if you validate them with a working PoC. Tool output alone is insufficient.

**Q: What if multiple researchers find the same bug?**  
A: First valid submission gets full bounty. Duplicates may get 10-25% if submitted within 48h.

**Q: Can I submit multiple bugs in one report?**  
A: Yes! Each bug is evaluated separately. Separate reports preferred for unrelated issues.

**Q: Do I need to sign an NDA?**  
A: No, but you must agree to responsible disclosure (90-day window).

**Q: Can I remain anonymous?**  
A: Yes, we only need an ETH address for payment. But we can't publicly credit you.

**Q: What if you disagree with my severity rating?**  
A: We'll explain our reasoning. You can provide additional justification. Final decision rests with our team, but we're always open to discussion.

**Q: Can I test on mainnet?**  
A: Strongly discouraged. Use testnets or local forks. Any damage to mainnet may result in disqualification and legal action.

**Q: How long do I have to wait before public disclosure?**  
A: 90 days from our acknowledgment, OR when we deploy a fix and publicly announce it (whichever is sooner). We'll coordinate with you.

**Q: What if you don't fix my bug?**  
A: If we don't fix within 90 days, you're free to disclose. We'll explain if we consider it unfixable or accept-risk.

**Q: Can I use this bug in a public writeup/portfolio?**  
A: Yes, after public disclosure is coordinated. We may ask you to co-author a postmortem.

---

## Contact

**Security Team**:
- Email: security@greenwavecoin.io (PGP required for vulnerabilities)
- GitHub: https://github.com/yourorg/greenwavecoin/security
- Response Time: <48 hours

**General Inquiries**:
- For questions about the program (non-vulnerabilities): bounty@greenwavecoin.io
- For payment status: payments@greenwavecoin.io

---

## Legal

### Safe Harbor

GreenWaveCoin commits to the following safe harbor for security researchers who:

1. Make a good faith effort to avoid privacy violations, data destruction, and service disruption
2. Only interact with accounts you own or have explicit permission to access
3. Do not exploit a security issue beyond minimal necessary testing
4. Report vulnerabilities privately and allow reasonable time for fixes

**We will not pursue legal action** against researchers who follow these guidelines.

### Disclosure Policy

- We reserve the right to adjust bounty amounts based on quality and impact
- We reserve the right to reject submissions we determine are out-of-scope
- Bounties are granted at our sole discretion
- Payment of a bounty does not constitute admission of liability
- All submissions become property of GreenWaveCoin
- We may publicly disclose reports after fixes are deployed

### Changes to Program

We may modify this program at any time. Changes will be posted to this document with a version number and date.

**Current Version**: 1.0  
**Last Updated**: [Date of mainnet launch]

---

## Recognition Wall 🏆

We appreciate the security research community! Researchers who help us will be listed here (with permission):

| Researcher | Severity | Issue | Bounty | Date |
|------------|----------|-------|--------|------|
| TBD | - | - | - | - |

*Hall of Fame coming soon after first valid submission!*

---

**Thank you for helping keep GreenWaveCoin secure!**

If you have questions about this program, please email: bounty@greenwavecoin.io
