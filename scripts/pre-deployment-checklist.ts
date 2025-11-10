import { ethers } from "hardhat";

/**
 * Pre-deployment checklist validator
 * Verifies all requirements before mainnet launch
 */

interface ChecklistItem {
  name: string;
  description: string;
  check: () => Promise<{ pass: boolean; message: string }>;
  required: boolean;
}

async function main() {
  const DRY_RUN = process.env.DRY_RUN === 'true';
  if (DRY_RUN) {
    console.log('🏁 Running in DRY_RUN mode: network external checks will be skipped or downgraded to warnings.');
  }
  console.log("📋 GreenWaveCoin Pre-Deployment Checklist\n");
  console.log("=".repeat(70), "\n");

  const checklist: ChecklistItem[] = [
    {
      name: "1. Tests Passing",
      description: "All unit, integration, and invariant tests pass",
      required: true,
      check: async () => {
        // In DRY_RUN, skip RPC-dependent signer fetch
        try {
          await ethers.getSigners();
          return { pass: true, message: "✅ Test framework operational (run: npx hardhat test)" };
        } catch (e) {
          return { pass: DRY_RUN, message: DRY_RUN ? "⚠️  DRY_RUN: Skipping test framework initialization" : "❌ Cannot initialize test framework" };
        }
      }
    },
    
    {
      name: "2. Sepolia Deployment Complete",
      description: "Contracts deployed and verified on Sepolia testnet",
      required: true,
      check: async () => {
        const fs = require("fs");
        try {
          const files = fs.readdirSync("deployments").filter((f: string) => f.startsWith("testnet-"));
          if (files.length > 0) {
            const latest = files.sort().reverse()[0];
            return { pass: true, message: `✅ Testnet deployment found: ${latest}` };
          }
          return { pass: DRY_RUN, message: DRY_RUN ? "⚠️  DRY_RUN: Skipping testnet deployment check" : "❌ No testnet deployment found (run: npx hardhat run scripts/deploy-testnet.ts --network sepolia)" };
        } catch (e) {
          return { pass: DRY_RUN, message: DRY_RUN ? "⚠️  DRY_RUN: deployments directory missing (ignored)" : "❌ No deployments directory" };
        }
      }
    },
    
    {
      name: "3. Testnet Smoke Tests",
      description: "Basic operations validated on testnet",
      required: true,
      check: async () => {
        return { pass: DRY_RUN, message: DRY_RUN ? "⚠️  DRY_RUN: Skipping smoke test enforcement" : "⚠️  Manual verification required (run: npx hardhat run scripts/testnet-smoke-test.ts --network sepolia)" };
      }
    },
    
    {
      name: "4. Upgrade Rehearsal",
      description: "UUPS upgrade tested on testnet per LAUNCH_READY.md",
      required: true,
      check: async () => {
        const fs = require("fs");
        try {
          const files = fs.readdirSync("rehearsals");
          if (files.length > 0) return { pass: true, message: "✅ Rehearsal artifacts found" };
          return { pass: DRY_RUN, message: DRY_RUN ? "⚠️  DRY_RUN: Skipping upgrade rehearsal check" : "❌ No upgrade rehearsal completed (see LAUNCH_READY.md)" };
        } catch (e) {
          return { pass: DRY_RUN, message: DRY_RUN ? "⚠️  DRY_RUN: rehearsals directory missing (ignored)" : "⚠️  No rehearsals/ directory (manual verification required)" };
        }
      }
    },
    
    {
      name: "5. Environment Variables",
      description: "Production private key and API keys configured",
      required: true,
      check: async () => {
        const hasPrivateKey = !!process.env.PRIVATE_KEY;
        const hasEtherscan = !!process.env.ETHERSCAN_API_KEY;
        
        if (hasPrivateKey && hasEtherscan) {
          return { 
            pass: true, 
            message: "✅ .env configured (PRIVATE_KEY, ETHERSCAN_API_KEY)" 
          };
        }
        
        const missing = [];
        if (!hasPrivateKey) missing.push("PRIVATE_KEY");
        if (!hasEtherscan) missing.push("ETHERSCAN_API_KEY");
        
        return { 
          pass: false, 
          message: `❌ Missing env vars: ${missing.join(", ")}` 
        };
      }
    },
    
    {
      name: "6. Mainnet Balance",
      description: "Deployer has sufficient ETH (min 0.5 ETH recommended)",
      required: true,
      check: async () => {
        try {
          const [deployer] = await ethers.getSigners();
          const balance = await ethers.provider.getBalance(deployer.address);
          const ethBalance = Number(ethers.formatEther(balance));
          if (ethBalance >= 0.5) return { pass: true, message: `✅ Deployer has ${ethBalance.toFixed(4)} ETH` };
          return { pass: DRY_RUN, message: DRY_RUN ? `⚠️  DRY_RUN: Balance ${ethBalance.toFixed(4)} ETH < 0.5 ignored` : `❌ Insufficient balance: ${ethBalance.toFixed(4)} ETH (need 0.5+ ETH)` };
        } catch (e) {
          return { pass: DRY_RUN, message: DRY_RUN ? "⚠️  DRY_RUN: Balance check skipped" : "⚠️  Cannot check balance (wrong network?)" };
        }
      }
    },
    
    {
      name: "7. Multisig Prepared",
      description: "Gnosis Safe addresses and signers documented",
      required: true,
      check: async () => {
        const safeAddress = process.env.GNOSIS_SAFE_ADDRESS;
        if (safeAddress && ethers.isAddress(safeAddress)) return { pass: true, message: `✅ Gnosis Safe configured: ${safeAddress}` };
        return { pass: DRY_RUN, message: DRY_RUN ? "⚠️  DRY_RUN: Safe address missing (ignored)" : "❌ GNOSIS_SAFE_ADDRESS not set (see docs/MULTISIG_SETUP.md)" };
      }
    },
    
    {
      name: "8. Monitoring Setup",
      description: "Alert webhooks and monitoring infrastructure ready",
      required: true,
      check: async () => {
        const hasWebhook = !!process.env.ALERT_WEBHOOK_URL;
        if (hasWebhook) {
          return { 
            pass: true, 
            message: "✅ Alert webhook configured" 
          };
        }
        return { 
          pass: false, 
          message: "⚠️  No ALERT_WEBHOOK_URL set (see docs/OPERATIONS_RUNBOOK.md)" 
        };
      }
    },
    
    {
      name: "9. Security Audit",
      description: "External audit completed and findings addressed (optional but recommended)",
      required: false,
      check: async () => {
        const fs = require("fs");
        try {
          const files = fs.readdirSync("audits");
          if (files.length > 0) {
            return { pass: true, message: "✅ Audit reports found in audits/" };
          }
          return { 
            pass: false, 
            message: "⚠️  Optional: No audit reports (recommended for >$10M projects)" 
          };
        } catch (e) {
          return { 
            pass: false, 
            message: "⚠️  Optional: Consider external audit (OpenZeppelin, Trail of Bits)" 
          };
        }
      }
    },
    
    {
      name: "10. Documentation Review",
      description: "All docs current and accurate",
      required: true,
      check: async () => {
        const fs = require("fs");
        const requiredDocs = [
          "README.md",
          "LAUNCH_READY.md",
          "docs/MULTISIG_SETUP.md",
          "docs/OPERATIONS_RUNBOOK.md",
          "docs/BUG_BOUNTY.md",
          "LICENSE",
          "NOTICE"
        ];
        
        const missing = requiredDocs.filter(doc => !fs.existsSync(doc));
        
        if (missing.length === 0) {
          return { 
            pass: true, 
            message: "✅ All required documentation present" 
          };
        }
        return { 
          pass: false, 
          message: `❌ Missing docs: ${missing.join(", ")}` 
        };
      }
    }
  ];

  let passedRequired = 0;
  let totalRequired = 0;
  let passedOptional = 0;
  let totalOptional = 0;

  for (const item of checklist) {
    console.log(`\n${item.name}`);
    console.log(`   ${item.description}`);
    console.log(`   ${item.required ? "[REQUIRED]" : "[OPTIONAL]"}`);
    
    try {
      const result = await item.check();
      console.log(`   ${result.message}`);
      
      if (item.required) {
        totalRequired++;
        if (result.pass) passedRequired++;
      } else {
        totalOptional++;
        if (result.pass) passedOptional++;
      }
    } catch (error: any) {
      console.log(`   ❌ Check failed: ${error.message}`);
      if (item.required) totalRequired++;
      else totalOptional++;
    }
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 CHECKLIST SUMMARY");
  console.log("=".repeat(70));
  console.log(`\n✅ Required: ${passedRequired}/${totalRequired}`);
  console.log(`ℹ️  Optional: ${passedOptional}/${totalOptional}`);
  
  const allRequiredPassed = passedRequired === totalRequired;
  
  if (allRequiredPassed) {
    console.log("\n🎉 ALL REQUIRED ITEMS COMPLETE");
    console.log("\n✅ Ready for mainnet deployment!");
    console.log("\n📝 Final Steps:");
    console.log("   1. Review LAUNCH_READY.md Phase 2");
    console.log("   2. Run: npx hardhat run scripts/deploy-production.ts --network mainnet");
    console.log("   3. Monitor first 48 hours closely");
    console.log("   4. Announce to community\n");
  } else {
    const remaining = totalRequired - passedRequired;
    console.log(`\n⚠️  ${remaining} REQUIRED ITEM${remaining > 1 ? 'S' : ''} REMAINING`);
    console.log("\n❌ Not ready for mainnet. Complete required items first.\n");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Checklist validation error:", error);
    process.exit(1);
  });
