import 'dotenv/config';

async function main() {
  const title = 'GreenWaveCoin Alert Test';
  const alerts = [
    'This is a test alert message from alerts-test.ts',
    'If you receive this, webhook configuration works.'
  ];

  const hasAny = !!process.env.ALERT_WEBHOOK_URL || !!process.env.SLACK_WEBHOOK || !!process.env.DISCORD_WEBHOOK;
  if (!hasAny) {
    console.log('No webhooks configured. Set ALERT_WEBHOOK_URL, SLACK_WEBHOOK, or DISCORD_WEBHOOK in .env');
    return;
  }

  const fetch = (await import('node-fetch')).default;
  const summary = alerts.join('\n');

  try {
    if (process.env.ALERT_WEBHOOK_URL) {
      await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🔔 ${title}`,
          attachments: [{ color: 'good', fields: alerts.map(a => ({ title: 'Test', value: a, short: false })) }]
        })
      });
      console.log('Sent test to ALERT_WEBHOOK_URL');
    }

    if (process.env.SLACK_WEBHOOK) {
      await fetch(process.env.SLACK_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🔔 ${title}`,
          attachments: [{ color: '#2eb886', fields: alerts.map(a => ({ title: 'Test', value: a, short: false })) }]
        })
      });
      console.log('Sent test to SLACK_WEBHOOK');
    }

    if (process.env.DISCORD_WEBHOOK) {
      await fetch(process.env.DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'GWV Monitor',
          embeds: [{ title, description: summary, color: 0x2eb886, timestamp: new Date().toISOString() }]
        })
      });
      console.log('Sent test to DISCORD_WEBHOOK');
    }
  } catch (e: any) {
    console.log('Webhook send failed:', e.message);
    process.exitCode = 1;
  }
}

main().catch(e => { console.error(e); process.exit(1); });
