import express from "express";
import dotenv from "dotenv";
import { ethers } from "ethers";
import rateLimit from 'express-rate-limit';
import { addEvent, getEvents, countEvents } from './db';
import path from "path";

dotenv.config();

// Configuration
const PORT = parseInt(process.env.MONITOR_PORT || "3001");
const RPC_URL = process.env.MONITOR_RPC || process.env.ARBITRUM_RPC || "http://127.0.0.1:8545";
const PROXY_ADDRESS = process.env.PROXY_ADDRESS || process.env.MONITOR_PROXY_ADDRESS;
const MAX_EVENTS = 100;

if (!PROXY_ADDRESS) {
  console.error("PROXY_ADDRESS is not set in the environment. Set PROXY_ADDRESS to the deployed contract proxy address.");
  process.exit(1);
}

// Load ABI from artifacts (project should be compiled first)
const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "GreenWaveCoin.sol", "GreenWaveCoin.json");
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

// Persist events to sqlite and keep small in-memory cache
const recentEvents: Array<Record<string, any>> = [];

// Basic Prometheus-style metrics (kept in-memory for simplicity)
let transferCounter = 0;

contract.on("Transfer", (from: string, to: string, value: any, event: any) => {
  const ev = {
    blockNumber: event.blockNumber,
    transactionHash: event.transactionHash,
    from,
    to,
    value: (value as any).toString ? (value as any).toString() : String(value),
    timestamp: Date.now()
  };

  // persist
  try {
    addEvent({ txhash: ev.transactionHash, blockNumber: ev.blockNumber, fromAddr: ev.from, toAddr: ev.to, value: ev.value, timestamp: ev.timestamp });
  } catch (err) {
    console.error('Failed to persist event', err);
  }

  // keep in-memory
  recentEvents.unshift(ev);
  if (recentEvents.length > MAX_EVENTS) recentEvents.pop();

  console.log(`Transfer ${ev.transactionHash} ${from} -> ${to} : ${ev.value}`);
  transferCounter++;
});

// Express app
const app = express();

app.get("/", (_req, res) => {
  res.json({ status: "ok", contract: PROXY_ADDRESS });
});

// Rate limit event endpoints to avoid heavy reads
const eventsLimiter = rateLimit({ windowMs: 10 * 1000, max: 10 });
app.get("/events", eventsLimiter, (_req, res) => {
  res.json(recentEvents);
});

app.get('/events/history', eventsLimiter, (_req, res) => {
  const limit = parseInt(String((_req as any).query.limit || '100'));
  const offset = parseInt(String((_req as any).query.offset || '0'));
  const rows = getEvents(limit, offset);
  res.json({ total: countEvents(), rows });
});

app.get("/metrics", async (_req, res) => {
  try {
    const [name, symbol, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.totalSupply()
    ]);
    res.json({ name, symbol, totalSupply: totalSupply.toString(), eventsStored: countEvents() });
  } catch (err: any) {
    res.status(500).json({ error: String(err) });
  }
});

// Prometheus-style metrics endpoint
app.get("/prometheus", async (_req, res) => {
  try {
    const totalSupply = (await contract.totalSupply()).toString();
    const eventsStored = countEvents();
    res.set('Content-Type', 'text/plain');
    res.send(`# HELP gwc_total_supply Total supply of GreenWaveCoin in wei\n# TYPE gwc_total_supply gauge\ngwc_total_supply ${totalSupply}\n# HELP gwc_events_stored Number of transfer events persisted\n# TYPE gwc_events_stored gauge\ngwc_events_stored ${eventsStored}\n# HELP gwc_transfer_counter Transfers observed since start\n# TYPE gwc_transfer_counter counter\ngwc_transfer_counter ${transferCounter}\n`);
  } catch (err: any) {
    res.status(500).send(String(err));
  }
});

app.listen(PORT, () => {
  console.log(`GreenWaveCoin monitor listening on http://localhost:${PORT}`);
  console.log(`Connected to RPC ${RPC_URL}`);
  console.log(`Monitoring proxy ${PROXY_ADDRESS}`);
});

// Serve a tiny UI
app.get('/ui', (_req, res) => {
  res.send(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>GreenWaveCoin Monitor</title></head>
<body>
<h1>GreenWaveCoin Monitor</h1>
<div id="stats"></div>
<ul id="events"></ul>
<script>
async function fetchMetrics(){
  const r=await fetch('/metrics');
  const j=await r.json();
  document.getElementById('stats').innerText=JSON.stringify(j,null,2);
}
async function fetchEvents(){
  const r=await fetch('/events');
  const j=await r.json();
  const el=document.getElementById('events'); el.innerHTML='';
  j.slice(0,50).forEach(e=>{
    const li=document.createElement('li');
    li.textContent = e.transactionHash + ' ' + e.from + ' -> ' + e.to + ' : ' + e.value;
    el.appendChild(li);
  });
}
fetchMetrics(); fetchEvents(); setInterval(fetchMetrics,5000); setInterval(fetchEvents,3000);
</script>
</body>
</html>`);
});
