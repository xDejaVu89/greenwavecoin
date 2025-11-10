import dotenv from 'dotenv';
import { ethers } from 'ethers';
import axios from 'axios';
import path from 'path';

dotenv.config();

const RPC_URL = process.env.MONITOR_RPC || process.env.ARBITRUM_RPC || 'http://127.0.0.1:8545';
const PROXY_ADDRESS = process.env.PROXY_ADDRESS || process.env.MONITOR_PROXY_ADDRESS;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK;
const ALERT_THRESHOLD_TOKENS = parseFloat(process.env.ALERT_THRESHOLD_TOKENS || '1000'); // in tokens
const TOKEN_DECIMALS = parseInt(process.env.TOKEN_DECIMALS || '18');

if (!PROXY_ADDRESS) {
  console.error('PROXY_ADDRESS not set in env; set PROXY_ADDRESS to your deployed proxy address');
  process.exit(1);
}

// Load ABI
const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'GreenWaveCoin.sol', 'GreenWaveCoin.json');
let abi: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const artifact = require(artifactPath);
  abi = artifact.abi;
} catch (err) {
  console.error(`Could not load artifact at ${artifactPath}. Run 'npx hardhat compile' first.`);
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(PROXY_ADDRESS, abi, provider);

async function sendDiscord(content: string) {
  if (!DISCORD_WEBHOOK) return;
  try {
    await axios.post(DISCORD_WEBHOOK, { content });
  } catch (err: any) {
    console.error('Discord webhook failed', err?.message || err);
  }
}

async function sendSlack(text: string) {
  if (!SLACK_WEBHOOK) return;
  try {
    await axios.post(SLACK_WEBHOOK, { text });
  } catch (err: any) {
    console.error('Slack webhook failed', err?.message || err);
  }
}

function humanAmount(big: any) {
  try {
    const v = ethers.formatUnits(big, TOKEN_DECIMALS);
    return v;
  } catch {
    return String(big);
  }
}

// Listen for large transfers
contract.on('Transfer', async (from: string, to: string, value: any, event: any) => {
  const amount = parseFloat(humanAmount(value));
  if (amount >= ALERT_THRESHOLD_TOKENS) {
    const msg = `ALERT: Large transfer detected: ${amount} tokens from ${from} to ${to}. Tx: https://etherscan.io/tx/${event.transactionHash}`;
    console.log(msg);
    await Promise.all([sendDiscord(msg), sendSlack(msg)]);
  }
});

// Listen for upgrades (OpenZeppelin emits Upgraded(address))
contract.on('Upgraded', async (implementation: string, event: any) => {
  const msg = `NOTICE: Contract upgraded to implementation ${implementation}. Tx: https://etherscan.io/tx/${event.transactionHash}`;
  console.log(msg);
  await Promise.all([sendDiscord(msg), sendSlack(msg)]);
});

console.log('Alerts service running');
console.log('Monitoring', PROXY_ADDRESS, 'via', RPC_URL);
