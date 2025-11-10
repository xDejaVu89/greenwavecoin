import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Daily digest aggregator for the last 24h of monitoring data.
 * Produces a markdown summary and a JSON aggregate in monitoring/.
 */
async function main() {
  const network = await ethers.provider.getNetwork();
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  const dir = 'monitoring';
  fs.mkdirSync(dir, { recursive: true });

  const files = fs.readdirSync(dir).filter(f => (f.includes(`metrics-${network.name}-`) || f.includes(`invariant-${network.name}-`)));

  const withinWindow = files.filter(f => {
    const m = f.match(/-(\d+)\.json$/);
    if (!m) return false;
    const ts = Number(m[1]);
    return now - ts <= windowMs;
  }).sort();

  let metricsCount = 0;
  let invariantCount = 0;
  let alertCount = 0;
  const alerts: string[] = [];
  let lastMetrics: any = null;

  for (const file of withinWindow) {
    const full = path.join(dir, file);
    try {
      const data = JSON.parse(fs.readFileSync(full, 'utf-8'));
      if (file.startsWith(`metrics-${network.name}-`)) {
        metricsCount++;
        lastMetrics = data; // last one in sorted order
        if (Array.isArray(data.alerts)) {
          alertCount += data.alerts.length;
          alerts.push(...data.alerts);
        }
      } else if (file.startsWith(`invariant-${network.name}-`)) {
        invariantCount++;
        if (data?.invariants?.failures?.length) {
          alertCount += data.invariants.failures.length;
          alerts.push(...data.invariants.failures);
        }
      }
    } catch {}
  }

  const summaryMdLines: string[] = [];
  summaryMdLines.push(`# GreenWaveCoin Daily Digest (${network.name})`);
  summaryMdLines.push(`Date: ${new Date(now).toISOString()}`);
  summaryMdLines.push('');
  summaryMdLines.push(`- Metrics snapshots: ${metricsCount}`);
  summaryMdLines.push(`- Invariant snapshots: ${invariantCount}`);
  summaryMdLines.push(`- Alerts observed: ${alertCount}`);

  if (lastMetrics) {
    summaryMdLines.push('');
    summaryMdLines.push('## Latest Metrics');
    summaryMdLines.push(`- Total Supply: ${lastMetrics.token?.totalSupply}`);
    summaryMdLines.push(`- Token Paused: ${lastMetrics.token?.isPaused}`);
    summaryMdLines.push(`- Owner: ${lastMetrics.token?.owner}`);
    summaryMdLines.push(`- Flash Protection: ${lastMetrics.token?.flashProtectionEnabled}`);
    summaryMdLines.push(`- Tx Fee (bps): ${lastMetrics.token?.transactionFee}`);
    summaryMdLines.push(`- Total Staked: ${lastMetrics.staking?.totalStaked}`);
    summaryMdLines.push(`- Reward Pool: ${lastMetrics.staking?.rewardPool}`);
  }

  if (alerts.length) {
    summaryMdLines.push('');
    summaryMdLines.push('## Alerts');
    for (const a of alerts.slice(-20)) { // last 20 alerts
      summaryMdLines.push(`- ${a}`);
    }
  }

  const md = summaryMdLines.join('\n');
  const mdFile = path.join(dir, `digest-${network.name}-${now}.md`);
  fs.writeFileSync(mdFile, md);

  const aggregate = {
    timestamp: new Date(now).toISOString(),
    network: network.name,
    metricsCount,
    invariantCount,
    alertCount,
    lastMetrics,
    lastAlerts: alerts.slice(-20)
  };
  const jsonFile = path.join(dir, `digest-${network.name}-${now}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(aggregate, null, 2));

  console.log('📝 Daily digest written:', mdFile);

  // Optional: POST digest to Slack/Discord if configured
  try {
    const fetch = (await import('node-fetch')).default;
    const title = `GreenWaveCoin Daily Digest (${network.name})`;
    const summary = `Metrics: ${metricsCount} | Invariants: ${invariantCount} | Alerts: ${alertCount}`;

    if (process.env.SLACK_WEBHOOK) {
      await fetch(process.env.SLACK_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `📊 ${title}\n${summary}` })
      });
      console.log('📤 Digest summary sent to Slack');
    }

    if (process.env.DISCORD_WEBHOOK) {
      await fetch(process.env.DISCORD_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'GWV Monitor', embeds: [{ title, description: summary, color: 0x3498db }] })
      });
      console.log('📤 Digest summary sent to Discord');
    }

    if (process.env.ALERT_WEBHOOK_URL) {
      await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `📊 ${title}\n${summary}` })
      });
      console.log('📤 Digest summary sent to ALERT_WEBHOOK_URL');
    }
  } catch (e: any) {
    console.log('⚠️  Failed to send digest webhook:', e.message);
  }
}

main().catch(e => { console.error('❌ Daily digest failed:', e); process.exit(1); });
