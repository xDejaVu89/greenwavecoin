# GreenWaveCoin Monitoring & Operations Runbook

**Version**: 1.0  
**Last Updated**: November 7, 2025  
**Status**: Production

---

## Table of Contents

1. [Overview](#overview)
2. [Monitoring Setup](#monitoring-setup)
3. [Alert Thresholds](#alert-thresholds)
4. [Incident Response](#incident-response)
5. [Operational Procedures](#operational-procedures)
6. [Emergency Contacts](#emergency-contacts)

---

## Overview

This runbook provides operational procedures for monitoring and maintaining GreenWaveCoin in production.

### Key Metrics to Monitor

| Metric | Normal Range | Alert Threshold | Critical Threshold |
|--------|--------------|-----------------|-------------------|
| Transfer Volume | Variable | >10% of supply/hour | >25% of supply/hour |
| Treasury Balance | Growing | <5% of supply | <1% of supply |
| Staking Pool Balance | Growing | <10k GWC | <1k GWC |
| Flash Protection Triggers | <10/hour | >50/hour | >100/hour |
| Failed Transactions | <1% | >5% | >10% |
| Contract Upgrades | 0 | Any unscheduled | Any |

---

## Monitoring Setup

### 1. Event Monitoring Service

**Location**: `scripts/monitor.ts`

**Setup**:
```bash
# 1. Configure environment
cp .env.example .env

# 2. Set monitoring variables
PROXY_ADDRESS=0x... # Your deployed GreenWaveCoin proxy
MONITOR_RPC=https://... # Your RPC endpoint
MONITOR_PORT=3000

# 3. Start monitor
npm run monitor
```

**Endpoints**:
- `GET /events` - Recent Transfer events
- `GET /metrics` - Token statistics (supply, balances, etc.)
- `GET /health` - Service health check

**Expected Response Time**: <200ms  
**Restart on Failure**: Yes (use PM2 or systemd)

**PM2 Setup** (recommended):
```bash
npm install -g pm2
pm2 start npm --name "gwc-monitor" -- run monitor
pm2 save
pm2 startup
```

### 2. Alert Service

**Location**: `scripts/alerts.ts`

**Setup**:
```bash
# Configure webhooks in .env
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
SLACK_WEBHOOK=https://hooks.slack.com/services/...
ALERT_THRESHOLD_TOKENS=1000 # Alert on transfers ≥ 1000 GWC
```

**Start**:
```bash
npm run alerts

# Or with PM2:
pm2 start npm --name "gwc-alerts" -- run alerts
```

**Alert Types**:
- Large transfers (≥ threshold)
- Contract upgrades
- Emergency pause events
- Flash protection triggers
- Unusual gas usage

---

## Alert Thresholds

### Transfer Alerts

**Large Transfer (Yellow)**:
- Amount: ≥ 1,000 GWC
- Action: Log and review
- Response Time: Within 1 hour

**Massive Transfer (Orange)**:
- Amount: ≥ 10,000 GWC (1% of supply)
- Action: Immediate review
- Response Time: Within 15 minutes

**Critical Transfer (Red)**:
- Amount: ≥ 100,000 GWC (10% of supply)
- Action: Emergency team notification
- Response Time: Immediate

**Response Checklist**:
- [ ] Verify transaction is legitimate
- [ ] Check if from/to known addresses
- [ ] Review recent governance proposals
- [ ] Check for exploit indicators
- [ ] Document in incident log

### Contract Events

**Upgrade Detected**:
- Event: `Upgraded` emitted
- Action: Verify against governance schedule
- Response Time: Immediate

**Checklist**:
- [ ] Was upgrade scheduled in timelock?
- [ ] Does new implementation match approved code?
- [ ] Run smoke tests on new implementation
- [ ] Monitor for unusual behavior

**Pause Detected**:
- Event: `Paused` emitted
- Action: Emergency team notification
- Response Time: Immediate

**Checklist**:
- [ ] Was pause authorized by timelock?
- [ ] Identify reason for pause
- [ ] Communicate to community
- [ ] Prepare unpause plan

### Staking Pool

**Low Reward Pool (Warning)**:
- Balance: <10,000 GWC
- Action: Schedule reward pool top-up
- Response Time: Within 24 hours

**Critical Reward Pool**:
- Balance: <1,000 GWC
- Action: Emergency top-up via governance
- Response Time: Within 4 hours

**Checklist**:
- [ ] Calculate required top-up amount
- [ ] Create governance proposal
- [ ] Schedule timelock execution
- [ ] Notify stakers of timeline

---

## Incident Response

### Severity Levels

**P0 - Critical (15-minute response)**:
- Contract exploit detected
- Unauthorized ownership transfer
- Massive unexpected supply change
- Unscheduled contract upgrade

**P1 - High (1-hour response)**:
- Flash protection repeatedly triggered
- Staking reward pool depleted
- Treasury balance critically low
- Governance proposal exploit attempt

**P2 - Medium (4-hour response)**:
- Unusual transfer patterns
- Gas price spikes affecting operations
- RPC endpoint failures
- Monitoring service down

**P3 - Low (24-hour response)**:
- Minor UI issues
- Documentation updates needed
- Non-critical metrics out of range

### Emergency Response Procedures

#### 1. Suspected Exploit

**Immediate Actions** (within 5 minutes):
```bash
# 1. Pause contract (if timelock admin available)
# Via Gnosis Safe or authorized wallet:

# Schedule pause
npx hardhat run scripts/emergency-pause.ts --network mainnet

# 2. Alert team
# Post in #emergency channel
# Page on-call engineer
# Notify security partners

# 3. Document
# Create incident ticket
# Note time, symptoms, affected addresses
```

**Investigation** (within 30 minutes):
- [ ] Analyze suspicious transactions
- [ ] Check for reentrancy patterns
- [ ] Verify flash loan attacks
- [ ] Review recent contract interactions
- [ ] Consult with security auditors

**Mitigation** (within 2 hours):
- [ ] Deploy patch if needed
- [ ] Schedule upgrade via timelock
- [ ] Communicate with community
- [ ] Consider compensation plan

#### 2. Timelock Compromise

**If timelock admin wallet is compromised:**

```bash
# 1. IMMEDIATELY schedule cancellation of pending proposals
# Use Gnosis Safe or backup admin

# 2. Prepare emergency upgrade to new timelock
# Deploy new timelock
npx hardhat run scripts/deploy-new-timelock.ts

# 3. Schedule ownership transfer
# Via existing timelock before it executes malicious proposal
```

**Post-Incident**:
- [ ] Rotate all keys
- [ ] Audit all timelock proposals
- [ ] Implement additional multi-sig signers
- [ ] Review access control

#### 3. RPC Failures

**Primary RPC Down**:
```bash
# Update monitoring to use backup RPC
MONITOR_RPC=https://backup-rpc-url.com npm run monitor

# Update alerts service
ALERTS_RPC=https://backup-rpc-url.com npm run alerts
```

**Backup RPC Endpoints**:
- Primary: Alchemy
- Backup 1: Infura
- Backup 2: Public endpoint
- Backup 3: Self-hosted node

---

## Operational Procedures

### Daily Checklist

**Morning** (9:00 AM UTC):
- [ ] Check monitoring dashboard
- [ ] Review overnight alerts
- [ ] Verify service health
- [ ] Check treasury balance
- [ ] Review staking pool balance
- [ ] Scan for unusual activity

**Evening** (6:00 PM UTC):
- [ ] Review daily transaction volume
- [ ] Check governance proposals
- [ ] Update operational log
- [ ] Verify backup systems

### Weekly Checklist

**Monday**:
- [ ] Review weekly metrics
- [ ] Check reward pool status
- [ ] Plan reward pool top-up if needed
- [ ] Review pending governance proposals

**Wednesday**:
- [ ] Test monitoring alerts (send test)
- [ ] Verify webhook endpoints
- [ ] Review incident log
- [ ] Update documentation if needed

**Friday**:
- [ ] Weekly team sync
- [ ] Review security alerts
- [ ] Plan weekend coverage
- [ ] Backup configuration files

### Monthly Checklist

- [ ] Security review meeting
- [ ] Review and update runbook
- [ ] Test emergency procedures
- [ ] Rotate API keys/webhooks
- [ ] Audit access permissions
- [ ] Review storage layout (if upgrade planned)
- [ ] Update monitoring thresholds based on patterns

### Quarterly Checklist

- [ ] Comprehensive security audit
- [ ] Disaster recovery drill
- [ ] Review and update incident response plan
- [ ] Team training on emergency procedures
- [ ] Update emergency contact list
- [ ] Review monitoring coverage
- [ ] Plan improvements to operations

---

## Emergency Contacts

### On-Call Rotation

| Role | Primary | Backup |
|------|---------|--------|
| Security Lead | [Name] +1-XXX-XXX-XXXX | [Name] +1-XXX-XXX-XXXX |
| Operations Lead | [Name] +1-XXX-XXX-XXXX | [Name] +1-XXX-XXX-XXXX |
| Engineering Lead | [Name] +1-XXX-XXX-XXXX | [Name] +1-XXX-XXX-XXXX |
| Community Manager | [Name] +1-XXX-XXX-XXXX | [Name] +1-XXX-XXX-XXXX |

### External Contacts

**Security Audit Firm**:
- Company: [Audit Firm Name]
- Contact: security@example.com
- Emergency Hotline: +1-XXX-XXX-XXXX
- Slack: #security-alerts

**Infrastructure Providers**:
- RPC: Alchemy support@alchemy.com
- Block Explorer: Etherscan support@etherscan.io
- Hosting: AWS +1-XXX-XXX-XXXX

### Communication Channels

**Internal**:
- Emergency: Slack #emergency
- Operations: Slack #operations
- Security: Slack #security (private)
- On-Call: PagerDuty

**External**:
- Twitter: @GreenWaveCoin
- Discord: #announcements
- Telegram: @GreenWaveCoin_Official
- Email: security@greenwavecoin.io

---

## Monitoring Service Configuration

### Discord Webhook Setup

1. Go to Discord Server Settings → Integrations → Webhooks
2. Create new webhook for #alerts channel
3. Copy webhook URL
4. Add to `.env`: `DISCORD_WEBHOOK=https://discord.com/api/webhooks/...`

**Test**:
```bash
curl -X POST $DISCORD_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{"content": "Test alert from GreenWaveCoin monitoring"}'
```

### Slack Webhook Setup

1. Go to https://api.slack.com/messaging/webhooks
2. Create new Incoming Webhook
3. Select #alerts channel
4. Copy webhook URL
5. Add to `.env`: `SLACK_WEBHOOK=https://hooks.slack.com/services/...`

**Test**:
```bash
curl -X POST $SLACK_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{"text": "Test alert from GreenWaveCoin monitoring"}'
```

### Webhook Rotation

**Frequency**: Every 90 days

**Procedure**:
1. Create new webhook in platform
2. Update `.env` with new URL
3. Restart monitoring services
4. Test new webhook
5. Delete old webhook
6. Document rotation in log

---

## Appendix

### Common Issues and Solutions

**Issue**: Monitoring service crashed  
**Solution**: `pm2 restart gwc-monitor`  
**Prevention**: Set up PM2 auto-restart

**Issue**: Webhook not receiving alerts  
**Solution**: Test webhook URL, check rate limits, verify channel permissions  
**Prevention**: Monitor webhook health daily

**Issue**: False positive flash protection alerts  
**Solution**: Review transaction patterns, adjust thresholds if needed  
**Prevention**: Tune thresholds based on normal usage

**Issue**: Staking pool running low  
**Solution**: Create governance proposal to top up  
**Prevention**: Set up automated alerts at 20k GWC threshold

### Useful Commands

```bash
# Check contract owner
npx hardhat run scripts/check-owner.ts --network mainnet

# View pending timelock proposals
npx hardhat run scripts/list-proposals.ts --network mainnet

# Emergency pause (requires timelock admin)
npx hardhat run scripts/emergency-pause.ts --network mainnet

# Check storage layout before upgrade
npm run validate:storage

# Run security checks
npm run slither
```

### Log Files

- Monitor logs: `~/.pm2/logs/gwc-monitor-out.log`
- Alert logs: `~/.pm2/logs/gwc-alerts-out.log`
- Incident log: `docs/incidents/YYYY-MM-DD.md`
- Operations log: `docs/operations/YYYY-MM.md`

---

**Last Reviewed**: November 7, 2025  
**Next Review**: December 7, 2025  
**Owner**: Operations Team
