const { ethers, upgrades } = require('hardhat');

async function main() {
  const [deployer, user1, user2, treasury] = await ethers.getSigners();
  const TokenFactory = await ethers.getContractFactory('GreenWaveCoin');
  const token = await upgrades.deployProxy(TokenFactory, [
    'GreenWaveCoin',
    'GWV',
    deployer.address,
    treasury.address
  ], { initializer: 'initialize', kind: 'uups' });

  console.log('Deployed token at', token.target || token.address || token.address);

  const tx = await token.connect(deployer).configureFlashLoanProtection(true, 300, ethers.parseEther('1000'));
  await tx.wait();

  console.log('Configured flashLoan: delay=', (await token.transferDelay()).toString(), 'max=', (await token.maxTransferAmount()).toString());
  console.log('lastTransferTimestamp before transfer:', (await token.lastTransferTimestamp(deployer.address)).toString());

  try {
    const t = await token.connect(deployer).transfer(user1.address, ethers.parseEther('100'));
    await t.wait();
    console.log('First transfer succeeded');
  } catch (e) {
    console.error('First transfer failed:', e.error || e.message || e);
  }

  console.log('lastTransferTimestamp after attempt (deployer):', (await token.lastTransferTimestamp(deployer.address)).toString());
  console.log('lastTransferTimestamp after attempt (user1):', (await token.lastTransferTimestamp(user1.address)).toString());
}

main().catch((e) => { console.error(e); process.exit(1); });
