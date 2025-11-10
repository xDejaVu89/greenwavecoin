import { ethers, upgrades, artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Storage Layout Validation Script
 * 
 * This script validates the storage layout of upgradeable contracts to ensure
 * that upgrades won't corrupt state. It generates storage layout reports and
 * compares them to detect unsafe changes.
 */

interface StorageReport {
  contract: string;
  timestamp: string;
  slots: Array<{
    label: string;
    slot: number;
    offset: number;
    type: string;
  }>;
}

async function main() {
  console.log("📊 Storage Layout Validation\n");

  const contracts = ["GreenWaveCoin", "GreenWaveStaking"];
  const reportsDir = path.join(__dirname, "../storage-layouts");

  // Create reports directory if it doesn't exist
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  for (const contractName of contracts) {
    console.log(`\n🔍 Analyzing ${contractName}...`);

    try {
      // Get contract factory
      const ContractFactory = await ethers.getContractFactory(contractName);

      // Get storage layout from compilation artifacts
      const buildInfo = await artifacts.getBuildInfo(
        `contracts/${contractName}.sol:${contractName}`
      );

      if (!buildInfo) {
        console.log(`  ⚠️  No build info found for ${contractName}`);
        continue;
      }

      const output = buildInfo.output;
      const contractOutput = output.contracts[`contracts/${contractName}.sol`][contractName];

      if (!(contractOutput as any).storageLayout) {
        console.log(`  ⚠️  No storage layout found for ${contractName}`);
        continue;
      }

      const layout = (contractOutput as any).storageLayout;

      // Create storage report
      const report: StorageReport = {
        contract: contractName,
        timestamp: new Date().toISOString(),
        slots: layout.storage.map((item: any) => ({
          label: item.label,
          slot: parseInt(item.slot),
          offset: item.offset,
          type: layout.types[item.type].label
        }))
      };

      // Save current layout
      const currentLayoutPath = path.join(reportsDir, `${contractName}.current.json`);
      fs.writeFileSync(currentLayoutPath, JSON.stringify(report, null, 2));

      console.log(`  ✅ Current layout saved to ${path.basename(currentLayoutPath)}`);
      console.log(`  📝 Storage variables: ${report.slots.length}`);

      // Display storage layout
      console.log(`\n  Storage Layout:`);
      report.slots.forEach(slot => {
        console.log(`    Slot ${slot.slot.toString().padStart(3)}: ${slot.label.padEnd(30)} (${slot.type})`);
      });

      // Check for previous layout and compare
      const previousLayoutPath = path.join(reportsDir, `${contractName}.baseline.json`);
      
      if (fs.existsSync(previousLayoutPath)) {
        const previousReport: StorageReport = JSON.parse(
          fs.readFileSync(previousLayoutPath, "utf-8")
        );

        console.log(`\n  🔄 Comparing with baseline from ${new Date(previousReport.timestamp).toLocaleString()}...`);

        let hasChanges = false;
        let hasDangerousChanges = false;

        // Check for removed or reordered variables
        previousReport.slots.forEach((prevSlot, index) => {
          const currentSlot = report.slots[index];

          if (!currentSlot) {
            console.log(`  ❌ DANGEROUS: Variable "${prevSlot.label}" removed from slot ${prevSlot.slot}`);
            hasDangerousChanges = true;
            return;
          }

          if (currentSlot.label !== prevSlot.label) {
            console.log(`  ❌ DANGEROUS: Variable order changed at slot ${prevSlot.slot}`);
            console.log(`     Previous: ${prevSlot.label}`);
            console.log(`     Current:  ${currentSlot.label}`);
            hasDangerousChanges = true;
          }

          if (currentSlot.slot !== prevSlot.slot) {
            console.log(`  ❌ DANGEROUS: Variable "${prevSlot.label}" moved from slot ${prevSlot.slot} to ${currentSlot.slot}`);
            hasDangerousChanges = true;
          }

          if (currentSlot.type !== prevSlot.type) {
            console.log(`  ❌ DANGEROUS: Variable "${prevSlot.label}" type changed`);
            console.log(`     Previous: ${prevSlot.type}`);
            console.log(`     Current:  ${currentSlot.type}`);
            hasDangerousChanges = true;
          }
        });

        // Check for new variables
        if (report.slots.length > previousReport.slots.length) {
          const newVariables = report.slots.slice(previousReport.slots.length);
          console.log(`  ℹ️  New variables added:`);
          newVariables.forEach(slot => {
            console.log(`     Slot ${slot.slot}: ${slot.label} (${slot.type})`);
          });
          hasChanges = true;
        }

        if (hasDangerousChanges) {
          console.log(`\n  ❌ STORAGE LAYOUT VALIDATION FAILED`);
          console.log(`  ⚠️  Detected dangerous storage layout changes that will corrupt state!`);
          console.log(`  ⚠️  DO NOT upgrade with these changes.`);
          process.exit(1);
        } else if (hasChanges) {
          console.log(`\n  ✅ Storage layout changes are safe (new variables appended)`);
        } else {
          console.log(`\n  ✅ No storage layout changes detected`);
        }
      } else {
        console.log(`\n  📝 No baseline found. Creating baseline...`);
        fs.writeFileSync(previousLayoutPath, JSON.stringify(report, null, 2));
        console.log(`  ✅ Baseline saved to ${path.basename(previousLayoutPath)}`);
      }

      // Validate storage gap
      const gapVariable = report.slots.find(s => s.label === "__gap");
      if (gapVariable) {
        // Extract gap size from type (e.g., "uint256[50]" -> 50)
        const gapMatch = gapVariable.type.match(/\[(\d+)\]/);
        if (gapMatch) {
          const gapSize = parseInt(gapMatch[1]);
          console.log(`\n  📏 Storage gap: ${gapSize} slots reserved for future use`);
          
          if (gapSize < 10) {
            console.log(`  ⚠️  Warning: Storage gap is small (${gapSize} slots). Consider reserving more space.`);
          }
        }
      } else {
        console.log(`\n  ⚠️  Warning: No __gap variable found. Upgrades may be risky.`);
      }

    } catch (error: any) {
      console.log(`  ❌ Error analyzing ${contractName}:`, error.message);
      process.exit(1);
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("✅ Storage layout validation complete!");
  console.log(`${"=".repeat(70)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Validation failed:", error);
    process.exit(1);
  });
