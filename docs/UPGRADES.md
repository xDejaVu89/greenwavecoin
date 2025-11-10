# UUPS Upgrade Guide

This project uses the UUPS upgrade pattern via OpenZeppelin's `@openzeppelin/hardhat-upgrades`.

Basic upgrade flow (after you have an implementation + proxy deployed):

1. Prepare the new implementation contract (incremental changes only; preserve storage layout).

2. Compile

```powershell
npx hardhat compile
```

3. Run the upgrade (example script or direct command in node):

```powershell
node ./scripts/upgrade.js --network mumbai
```

Or use a minimal script (example):

```js
// scripts/upgrade.js
const { ethers, upgrades } = require('hardhat');

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS; // set in env or arg
  const NewImpl = await ethers.getContractFactory('GreenWaveCoin');
  await upgrades.upgradeProxy(proxyAddress, NewImpl);
  console.log('Upgrade complete');
}

main().catch(console.error);
```

Security recommendations
- Always test upgrades on testnets first.
- Use a timelock and multisig for upgrade ownership.
- Keep a clear changelog of storage layout changes and avoid shifting storage slots.
