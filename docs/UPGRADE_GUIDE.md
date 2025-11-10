# GreenWaveCoin Upgrade Guide

## Overview

GreenWaveCoin and GreenWaveStaking use the **UUPS (Universal Upgradeable Proxy Standard)** pattern for upgradeability. This allows the implementation contract to be upgraded while preserving the contract address and state.

## ⚠️ Critical Safety Rules

### 1. **NEVER Modify Storage Layout**

When creating a new implementation, you MUST:
- ✅ **Add new variables ONLY at the end** of the contract
- ✅ **Keep existing variables in the same order**
- ✅ **Keep the storage gap** (`uint256[50] private __gap`)
- ❌ **DO NOT reorder existing variables**
- ❌ **DO NOT delete existing variables**
- ❌ **DO NOT change variable types**
- ❌ **DO NOT add variables in the middle**

### 2. **Initialization vs Constructor**

- ✅ Use `initialize()` function for setup (already done)
- ✅ Use `initializer` modifier to prevent re-initialization
- ✅ Add `_disableInitializers()` in constructor
- ❌ **DO NOT use regular constructors** for state setup

### 3. **Storage Gap Management**

Current storage layout for GreenWaveCoin:
```solidity
// State variables (in order)
bool public timelockEnabled;
address public timelock;
bool public flashProtectionEnabled;
uint256 public maxTransfersPerBlock;
uint256 public maxTransferAmount;
mapping(address => uint256) public lastTransferBlock;
mapping(address => uint256) public transfersInCurrentBlock;
mapping(address => uint256) public delegationCounts;
uint256 public maxDelegations;
address public stakingContract;
address public treasury;
uint256 public transactionFee;
uint256 public burnShare;
uint256 public stakingShare;
bool private _inFeeDistribution;

// Events (do not consume storage)

// Storage gap for future variables
uint256[50] private __gap; // 50 slots reserved for future use
```

**When adding new variables:**
1. Add them AFTER all existing variables, BEFORE the gap
2. Reduce the gap size by the number of slots used
3. Example: Adding 3 uint256 variables → reduce gap from 50 to 47

```solidity
// ✅ CORRECT: New variables added before gap
uint256 public newVariable1;
uint256 public newVariable2;
uint256 public newVariable3;
uint256[47] private __gap; // Reduced from 50 to 47

// ❌ WRONG: Don't add variables after the gap
uint256[50] private __gap;
uint256 public newVariable; // This breaks storage layout!
```

## Upgrade Process

### Step 1: Develop New Implementation

Create a new implementation contract:

```typescript
// contracts/GreenWaveCoinV2.sol
contract GreenWaveCoinV2 is GreenWaveCoin {
    // Add new storage variables BEFORE the gap
    uint256 public newFeature;
    
    // Reduce gap size accordingly
    // (If parent had __gap[50] and you add 1 variable, use __gap[49])
    
    // Add new functions
    function newFunction() external onlyOwner {
        newFeature = 123;
    }
    
    // Override existing functions if needed
    function version() external pure returns (string memory) {
        return "2.0.0";
    }
}
```

### Step 2: Test Storage Compatibility

Use OpenZeppelin's upgrade validation:

```typescript
// scripts/validate-upgrade.ts
import { ethers, upgrades } from "hardhat";

async function validateUpgrade() {
  const proxyAddress = "0x..."; // Your deployed proxy address
  
  const GreenWaveCoinV2 = await ethers.getContractFactory("GreenWaveCoinV2");
  
  // This will throw an error if storage layout is incompatible
  await upgrades.validateUpgrade(proxyAddress, GreenWaveCoinV2, {
    kind: "uups"
  });
  
  console.log("✅ Upgrade validation passed!");
}
```

### Step 3: Create Upgrade Proposal

Since the contract is timelock-controlled, you must create a governance proposal:

```typescript
// scripts/propose-upgrade.ts
import { ethers, upgrades } from "hardhat";

async function proposeUpgrade() {
  const PROXY_ADDRESS = "0x..."; // Your token proxy
  const TIMELOCK_ADDRESS = "0x..."; // Your timelock
  
  // Deploy new implementation
  const GreenWaveCoinV2 = await ethers.getContractFactory("GreenWaveCoinV2");
  const newImplementation = await upgrades.prepareUpgrade(
    PROXY_ADDRESS, 
    GreenWaveCoinV2,
    { kind: "uups" }
  );
  
  console.log("New implementation deployed:", newImplementation);
  
  // Encode the upgrade call
  const token = await ethers.getContractAt("GreenWaveCoin", PROXY_ADDRESS);
  const upgradeData = token.interface.encodeFunctionData("upgradeTo", [
    newImplementation
  ]);
  
  // Create timelock proposal
  const timelock = await ethers.getContractAt("GreenWaveTimelock", TIMELOCK_ADDRESS);
  
  const eta = Math.floor(Date.now() / 1000) + (await timelock.delay()).toNumber() + 100;
  const salt = ethers.solidityPackedKeccak256(["string"], ["upgrade-v2"]);
  
  const tx = await timelock.schedule(
    PROXY_ADDRESS,      // target
    0,                  // value
    upgradeData,        // data
    ethers.ZeroHash,    // predecessor
    salt,               // salt
    eta                 // execution time
  );
  
  await tx.wait();
  console.log("✅ Upgrade proposal created!");
  console.log("   ETA:", new Date(eta * 1000).toISOString());
  console.log("   Operation ID:", await timelock.hashOperation(
    PROXY_ADDRESS, 0, upgradeData, ethers.ZeroHash, salt
  ));
}
```

### Step 4: Execute Upgrade (After Timelock Delay)

```typescript
// scripts/execute-upgrade.ts
import { ethers } from "hardhat";

async function executeUpgrade() {
  const PROXY_ADDRESS = "0x...";
  const NEW_IMPLEMENTATION = "0x..."; // From prepareUpgrade
  const TIMELOCK_ADDRESS = "0x...";
  
  const token = await ethers.getContractAt("GreenWaveCoin", PROXY_ADDRESS);
  const upgradeData = token.interface.encodeFunctionData("upgradeTo", [
    NEW_IMPLEMENTATION
  ]);
  
  const timelock = await ethers.getContractAt("GreenWaveTimelock", TIMELOCK_ADDRESS);
  const salt = ethers.solidityPackedKeccak256(["string"], ["upgrade-v2"]);
  
  // Execute the upgrade
  const tx = await timelock.execute(
    PROXY_ADDRESS,
    0,
    upgradeData,
    ethers.ZeroHash,
    salt
  );
  
  await tx.wait();
  console.log("✅ Upgrade executed successfully!");
  
  // Verify new implementation
  const currentImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current implementation:", currentImpl);
  console.log("Expected implementation:", NEW_IMPLEMENTATION);
  
  if (currentImpl === NEW_IMPLEMENTATION) {
    console.log("✅ Implementation updated correctly!");
  }
}
```

## Storage Layout Verification

### Before ANY Upgrade

Always run this verification:

```bash
# Check storage layout
npx hardhat clean
npx hardhat compile
npx hardhat run scripts/validate-upgrade.ts
```

### Generate Storage Layout Report

```typescript
// scripts/check-storage.ts
import { ethers } from "hardhat";
import * as fs from "fs";

async function checkStorage() {
  const contract = await ethers.getContractFactory("GreenWaveCoin");
  
  // Get storage layout from compilation artifacts
  const artifact = await ethers.artifacts.readArtifact("GreenWaveCoin");
  const buildInfo = await ethers.artifacts.getBuildInfo(
    `contracts/GreenWaveCoin.sol:GreenWaveCoin`
  );
  
  if (buildInfo) {
    const layout = buildInfo.output.contracts["contracts/GreenWaveCoin.sol"]
      ["GreenWaveCoin"].storageLayout;
    
    fs.writeFileSync(
      "storage-layout.json",
      JSON.stringify(layout, null, 2)
    );
    
    console.log("Storage layout saved to storage-layout.json");
    console.log("\nStorage variables:");
    layout.storage.forEach((item: any) => {
      console.log(`  ${item.label} (slot ${item.slot}): ${item.type}`);
    });
  }
}
```

## Common Upgrade Scenarios

### Adding a New Feature

```solidity
// contracts/GreenWaveCoinV2.sol
contract GreenWaveCoinV2 is GreenWaveCoin {
    // New state variable (MUST be at end, before gap)
    mapping(address => bool) public whitelist;
    uint256[49] private __gap; // Reduced from 50
    
    // New function
    function setWhitelist(address account, bool status) external onlyOwner {
        whitelist[account] = status;
    }
    
    // Override to add whitelist check
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        
        // Add new logic
        if (whitelist[from] || whitelist[to]) {
            // Whitelisted addresses bypass fees
            _inFeeDistribution = true;
        }
    }
}
```

### Fixing a Bug

```solidity
// contracts/GreenWaveCoinV2.sol
contract GreenWaveCoinV2 is GreenWaveCoin {
    // No new storage needed for bug fix
    // Keep gap at 50
    uint256[50] private __gap;
    
    // Override buggy function with fix
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        // Fixed implementation here
        // ...
    }
}
```

### Changing Fee Logic

```solidity
// contracts/GreenWaveCoinV2.sol
contract GreenWaveCoinV2 is GreenWaveCoin {
    // New fee structure
    uint256 public dynamicFeeRate;
    mapping(address => uint256) public userTiers;
    uint256[48] private __gap; // Reduced from 50 (added 2 variables)
    
    function setDynamicFees(bool enabled) external onlyOwner {
        dynamicFeeRate = enabled ? 100 : 0;
    }
    
    // Override fee calculation
    function _calculateFee(uint256 amount) internal view returns (uint256) {
        if (dynamicFeeRate > 0) {
            // New dynamic fee logic
            return (amount * dynamicFeeRate) / 10000;
        }
        // Fall back to original logic
        return (amount * transactionFee) / 10000;
    }
}
```

## Emergency Upgrade Procedure

If a critical bug is found:

1. **Pause the contract immediately** (via timelock)
2. **Develop and test the fix** thoroughly
3. **Create emergency proposal** with minimal timelock delay (if configured)
4. **Execute upgrade** as soon as delay expires
5. **Verify fix** on mainnet
6. **Unpause contract**

## Testing Upgrades

Always test on testnet first:

```typescript
// test/upgrade.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("GreenWaveCoin Upgrade", function() {
  it("Should upgrade to V2 while preserving state", async function() {
    // Deploy V1
    const GreenWaveCoinV1 = await ethers.getContractFactory("GreenWaveCoin");
    const token = await upgrades.deployProxy(
      GreenWaveCoinV1,
      ["GreenWaveCoin", "GWC", deployer.address, treasury.address],
      { kind: "uups" }
    );
    
    // Save some state
    const totalSupply = await token.totalSupply();
    const balance = await token.balanceOf(deployer.address);
    
    // Upgrade to V2
    const GreenWaveCoinV2 = await ethers.getContractFactory("GreenWaveCoinV2");
    const upgraded = await upgrades.upgradeProxy(token, GreenWaveCoinV2);
    
    // Verify state preserved
    expect(await upgraded.totalSupply()).to.equal(totalSupply);
    expect(await upgraded.balanceOf(deployer.address)).to.equal(balance);
    
    // Verify new functionality
    expect(await upgraded.version()).to.equal("2.0.0");
  });
});
```

## Rollback Procedure

If an upgrade fails, you can rollback:

```typescript
// Rollback to previous implementation
const previousImplementation = "0x..."; // Save this before each upgrade
await timelock.schedule(
  PROXY_ADDRESS,
  0,
  token.interface.encodeFunctionData("upgradeTo", [previousImplementation]),
  ethers.ZeroHash,
  salt,
  eta
);
```

## Security Checklist for Upgrades

- [ ] Storage layout validated with OpenZeppelin plugin
- [ ] All existing tests pass with new implementation
- [ ] New functionality tested thoroughly
- [ ] Gas costs analyzed (upgrade shouldn't drastically increase costs)
- [ ] Security audit completed (for major changes)
- [ ] Deployment tested on testnet
- [ ] Timelock proposal created and verified
- [ ] Community notified of upcoming upgrade
- [ ] Emergency pause plan prepared
- [ ] Rollback procedure documented

## Resources

- [OpenZeppelin Upgrades Plugin](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [UUPS Pattern](https://eips.ethereum.org/EIPS/eip-1822)
- [Storage Layout](https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html)
- [Writing Upgradeable Contracts](https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable)
