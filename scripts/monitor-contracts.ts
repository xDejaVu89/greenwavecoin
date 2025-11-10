import { ethers } from "hardhat";
import { GreenWaveCoin, GreenWaveStaking } from "../typechain-types";
import fs from "fs";

/**
 * Contract monitoring script
 * Tracks key metrics and health indicators for deployed contracts
 * Run via: npx hardhat run scripts/monitor-contracts.ts --network <network>
 * Or set up with PM2 for continuous monitoring
 */

interface MonitoringMetrics {
  timestamp: string;
  network: string;
  token: {
    address: string;
    totalSupply: string;
    isPaused: boolean;
    owner: string;
    flashProtectionEnabled: boolean;
    transactionFee: string;
  };
  staking: {
    address: string;
    totalStaked: string;
    rewardPool: string;
    rewardRate: string;
    isPaused: boolean;
    owner: string;
  };
  timelock?: {
    address: string;
    minDelay: string;
  };
  alerts: string[];
}

async function main() {
  console.log("🔍 Contract Health Monitor\n");
  
  const network = await ethers.provider.getNetwork();
  const alerts: string[] = [];

  // Load latest deployment
  let deployment: any;
  try {
    const prefix = network.name === "mainnet" ? "production" : "testnet";
    const files = fs.readdirSync("deployments")
      .filter(f => f.startsWith(prefix))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      throw new Error(`No ${prefix} deployment found`);
    }
    
    deployment = JSON.parse(fs.readFileSync(`deployments/${files[0]}`, "utf-8"));
  } catch (e: any) {
    console.error("❌ Failed to load deployment:", e.message);
    process.exit(1);
  }

  console.log("📋 Monitoring deployment:", deployment.timestamp);
  console.log("   Network:", network.name);
  console.log("   Token:", deployment.contracts.token.proxy);
  console.log("   Staking:", deployment.contracts.staking.proxy);
  console.log("   Timelock:", deployment.contracts.timelock, "\n");

  // Get contract instances
  const token = await ethers.getContractAt("GreenWaveCoin", deployment.contracts.token.proxy) as unknown as GreenWaveCoin;
  const staking = await ethers.getContractAt("GreenWaveStaking", deployment.contracts.staking.proxy) as unknown as GreenWaveStaking;

  // === Token Metrics ===
  console.log("🪙 Token Metrics");
  const totalSupply = await token.totalSupply();
  const tokenPaused = await token.paused();
  const tokenOwner = await token.owner();
  const flashEnabled = await token.flashProtectionEnabled();
  const txFee = await token.transactionFee();

  console.log("   Total Supply:", ethers.formatEther(totalSupply));
  console.log("   Paused:", tokenPaused);
  console.log("   Owner:", tokenOwner);
  console.log("   Flash Protection:", flashEnabled);
  console.log("   Transaction Fee:", txFee.toString(), "bps\n");

  if (tokenPaused) {
    alerts.push("⚠️  TOKEN PAUSED - transfers are disabled");
  }

  // Check if ownership matches timelock
  if (deployment.contracts.timelock && tokenOwner.toLowerCase() !== deployment.contracts.timelock.toLowerCase()) {
    alerts.push("⚠️  Token owner mismatch - expected timelock control");
  }

  // === Staking Metrics ===
  console.log("🥩 Staking Metrics");
  const totalStaked = await staking.totalStaked();
  const rewardPool = await staking.rewardPool();
  const rewardRate = await staking.rewardRate();
  const stakingPaused = await staking.paused();
  const stakingOwner = await staking.owner();

  console.log("   Total Staked:", ethers.formatEther(totalStaked));
  console.log("   Reward Pool:", ethers.formatEther(rewardPool));
  console.log("   Reward Rate:", rewardRate.toString(), "bps APR");
  console.log("   Paused:", stakingPaused);
  console.log("   Owner:", stakingOwner, "\n");

  if (stakingPaused) {
    alerts.push("⚠️  STAKING PAUSED - stake/unstake disabled");
  }

  if (deployment.contracts.timelock && stakingOwner.toLowerCase() !== deployment.contracts.timelock.toLowerCase()) {
    alerts.push("⚠️  Staking owner mismatch - expected timelock control");
  }

  // Low reward pool warning
  const rewardPoolThreshold = ethers.parseEther("10000"); // 10k tokens
  if (rewardPool < rewardPoolThreshold) {
    alerts.push(`⚠️  Low reward pool: ${ethers.formatEther(rewardPool)} tokens remaining`);
  }

  // === Timelock ===
  if (deployment.contracts.timelock) {
    console.log("⏰ Timelock");
    const timelock = await ethers.getContractAt("GreenWaveTimelock", deployment.contracts.timelock);
    const minDelay = await timelock.getMinDelay();
    console.log("   Min Delay:", minDelay.toString(), "seconds (", Number(minDelay) / 3600, "hours )\n");
  }

  // === Summary ===
  const metrics: MonitoringMetrics = {
    timestamp: new Date().toISOString(),
    network: network.name,
    token: {
      address: deployment.contracts.token.proxy,
      totalSupply: ethers.formatEther(totalSupply),
      isPaused: tokenPaused,
      owner: tokenOwner,
      flashProtectionEnabled: flashEnabled,
      transactionFee: txFee.toString()
    },
    staking: {
      address: deployment.contracts.staking.proxy,
      totalStaked: ethers.formatEther(totalStaked),
      rewardPool: ethers.formatEther(rewardPool),
      rewardRate: rewardRate.toString(),
      isPaused: stakingPaused,
      owner: stakingOwner
    },
    alerts
  };

  if (deployment.contracts.timelock) {
    const timelock = await ethers.getContractAt("GreenWaveTimelock", deployment.contracts.timelock);
    const minDelay = await timelock.getMinDelay();
    metrics.timelock = {
      address: deployment.contracts.timelock,
      minDelay: minDelay.toString()
    };
  }

  // Save metrics
  const metricsDir = "monitoring";
  fs.mkdirSync(metricsDir, { recursive: true });
  const metricsFile = `${metricsDir}/metrics-${network.name}-${Date.now()}.json`;
  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));

  console.log("=".repeat(60));
  if (alerts.length === 0) {
    console.log("✅ All checks passed - system healthy");
  } else {
    console.log("⚠️  ALERTS DETECTED:");
    alerts.forEach(alert => console.log("   ", alert));
  }
  console.log("=".repeat(60));
  console.log("\n💾 Metrics saved:", metricsFile);

  // Optional: Send webhooks if configured
  const hasAlerts = alerts.length > 0;
  if (hasAlerts) {
    const title = `GreenWaveCoin Alert on ${network.name}`;
    const summary = alerts.join("\n");
    try {
      const fetch = (await import("node-fetch")).default;

      // Generic webhook
      if (process.env.ALERT_WEBHOOK_URL) {
        const genericPayload = {
          text: `🚨 ${title}`,
          attachments: [{
            color: "warning",
            fields: alerts.map(a => ({ title: "Alert", value: a, short: false }))
          }]
        };
        await fetch(process.env.ALERT_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(genericPayload)
        });
        console.log("📢 Alert sent to ALERT_WEBHOOK_URL");
      }

      // Slack webhook
      if (process.env.SLACK_WEBHOOK) {
        const slackPayload = {
          text: `🚨 ${title}`,
          attachments: [
            {
              color: "#ffcc00",
              fields: alerts.map(a => ({ title: "Alert", value: a, short: false }))
            }
          ]
        };
        await fetch(process.env.SLACK_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackPayload)
        });
        console.log("📢 Alert sent to Slack");
      }

      // Discord webhook
      if (process.env.DISCORD_WEBHOOK) {
        const discordPayload = {
          username: "GWV Monitor",
          embeds: [
            {
              title: title,
              description: summary,
              color: 0xFFCC00,
              timestamp: new Date().toISOString()
            }
          ]
        };
        await fetch(process.env.DISCORD_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordPayload)
        });
        console.log("📢 Alert sent to Discord");
      }
    } catch (e: any) {
      console.log("⚠️  Failed to send webhook:", e.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Monitor failed:", error);
    process.exit(1);
  });
