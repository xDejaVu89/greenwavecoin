# Monitoring Setup Guide

## Overview

GreenWaveCoin includes automated monitoring to track contract health, detect anomalies, and alert the team to potential issues.

## Quick Start

### One-Time Manual Check

```powershell
# Check Sepolia testnet
npx hardhat run scripts/monitor-contracts.ts --network sepolia

# Check mainnet (after deployment)
npx hardhat run scripts/monitor-contracts.ts --network mainnet
```

### Continuous Monitoring with PM2

#### Install PM2 (if not already installed)

```powershell
npm install -g pm2
```

#### Start Monitoring

```powershell
# Start both mainnet and testnet monitors
pm2 start ecosystem.config.json

# Or start individually
pm2 start ecosystem.config.json --only greenwavecoin-monitor-mainnet
pm2 start ecosystem.config.json --only greenwavecoin-monitor-testnet
```

#### Monitor Status

```powershell
# View all running processes
pm2 list

# View logs
pm2 logs greenwavecoin-monitor-mainnet

# View specific log files
pm2 logs greenwavecoin-monitor-mainnet --lines 100

# Monitor in real-time
pm2 monit
```

#### Manage Monitors

```powershell
# Restart
pm2 restart greenwavecoin-monitor-mainnet

# Stop
pm2 stop greenwavecoin-monitor-mainnet

# Delete
pm2 delete greenwavecoin-monitor-mainnet

# Restart all
pm2 restart all
```

#### Auto-Start on System Boot

```powershell
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

## Monitoring Schedule

- **Mainnet**: Every 15 minutes (cron: `*/15 * * * *`)
- **Testnet**: Every 30 minutes (cron: `*/30 * * * *`)

You can adjust the schedule in `ecosystem.config.json` by changing the `cron_restart` field.

## Metrics Tracked

### Token Contract
- Total supply
- Pause status
- Owner address (should be timelock)
- Flash protection status
- Transaction fee settings

### Staking Contract
- Total staked amount
- Reward pool balance
- Reward rate (APR)
- Pause status
- Owner address (should be timelock)

### Timelock
- Minimum delay
- Pending operations (future enhancement)

## Alerts

### Automatic Alerts

When configured with a webhook URL, the monitor will automatically send alerts for:

- ⚠️ Token or staking contract paused
- ⚠️ Owner mismatch (not controlled by timelock)
- ⚠️ Low reward pool (< 10,000 tokens)
- ⚠️ Any other anomaly detected

### Webhook Setup

#### Discord Webhook

1. Go to your Discord server settings
2. Select "Integrations" → "Webhooks"
3. Create a new webhook
4. Copy the webhook URL
5. Add to `.env`:
   ```
   ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
   ```

#### Slack Webhook

1. Go to https://api.slack.com/apps
2. Create a new app or select existing
3. Enable "Incoming Webhooks"
4. Create a new webhook for your channel
5. Copy the webhook URL
6. Add to `.env`:
   ```
   ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

#### Custom Webhook

The monitor sends a JSON payload:
```json
{
  "text": "🚨 GreenWaveCoin Alert on <network>",
  "attachments": [{
    "color": "warning",
    "fields": [
      { "title": "Alert", "value": "Alert message here", "short": false }
    ]
  }]
}
```

Adapt `scripts/monitor-contracts.ts` if you need a different format.

## Metrics Storage

Metrics are saved to JSON files in the `monitoring/` directory:

```
monitoring/
  metrics-mainnet-1699876543210.json
  metrics-mainnet-1699876643210.json
  metrics-sepolia-1699876543210.json
  ...
```

Each file contains a snapshot of all metrics at that timestamp.

### Analyzing Historical Data

You can process these JSON files to:
- Track total supply over time
- Monitor reward pool depletion rate
- Generate dashboards
- Detect trends

Example script idea (future enhancement):
```typescript
// scripts/analyze-metrics.ts
// Read all metrics files, calculate trends, generate charts
```

## Troubleshooting

### Monitor Not Running

```powershell
# Check PM2 status
pm2 list

# View recent logs
pm2 logs greenwavecoin-monitor-mainnet --lines 50

# Restart
pm2 restart greenwavecoin-monitor-mainnet
```

### No Deployment Found Error

Ensure you have a deployment file in `deployments/`:
- Testnet: `testnet-sepolia-*.json`
- Mainnet: `production-mainnet-*.json`

### Webhook Not Sending

1. Verify `ALERT_WEBHOOK_URL` is set in `.env`
2. Test webhook manually:
   ```powershell
   curl -X POST $env:ALERT_WEBHOOK_URL -H "Content-Type: application/json" -d '{"text":"Test alert"}'
   ```
3. Check monitor logs for webhook errors

### RPC Connection Issues

If you see "connection timeout" or "rate limit" errors:

1. Add a dedicated RPC endpoint in `.env`:
   ```
   MAINNET_RPC=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
   ```
2. Consider using a paid RPC provider (Alchemy, Infura) for reliability
3. Increase monitoring interval if hitting rate limits

## Advanced: Custom Alerts

Edit `scripts/monitor-contracts.ts` to add custom alert conditions:

```typescript
// Example: Alert if staking pool drops below custom threshold
const customThreshold = ethers.parseEther(process.env.ALERT_THRESHOLD_TOKENS || "5000");
if (rewardPool < customThreshold) {
  alerts.push(`⚠️ Reward pool below ${ethers.formatEther(customThreshold)}`);
}

// Example: Alert on large supply changes
const expectedSupply = ethers.parseEther("1000000");
const deviation = ((totalSupply - expectedSupply) * 100n) / expectedSupply;
if (deviation > 5n || deviation < -5n) {
  alerts.push(`⚠️ Supply deviation: ${deviation}%`);
}
```

## Production Checklist

Before going live with monitoring:

- [ ] Set up dedicated RPC endpoint (Alchemy/Infura)
- [ ] Configure webhook URL in `.env`
- [ ] Test monitor script manually
- [ ] Start PM2 monitors
- [ ] Verify logs are being written
- [ ] Test webhook alerts (trigger manually)
- [ ] Set up PM2 auto-start on boot
- [ ] Save PM2 process list
- [ ] Document incident response procedure
- [ ] Assign on-call rotation for alerts

## Monitoring Dashboard (Future)

Consider building a web dashboard using:
- **Backend**: Read JSON metrics files, provide API
- **Frontend**: React/Next.js with Chart.js
- **Hosting**: Vercel/Netlify (static site)
- **Features**:
  - Real-time metrics display
  - Historical charts
  - Alert history
  - Health status indicators

## Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)

---

*For issues or questions, refer to the main project README or open an issue on GitHub.*
