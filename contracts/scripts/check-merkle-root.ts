import hre from 'hardhat';
import { ethers } from 'ethers';

async function main() {
  const escrowAddress = '0x2F3F050Ba9701c18E852011258fe6FF858BC0ED0';
  const gwcAddress = '0x6D938b4C48300A29905FBa272cCdC1207538865f';
  
  const RewardEscrow = await hre.ethers.getContractAt('RewardEscrow', escrowAddress);
  const GWC = await hre.ethers.getContractAt('GreenWaveCoin', gwcAddress);
  
  console.log('\n=== RewardEscrow Status ===');
  console.log('Address:', escrowAddress);
  
  const merkleRoot = await RewardEscrow.merkleRoots(0);
  console.log('Merkle Root (epoch 0):', merkleRoot);
  
  const balance = await GWC.balanceOf(escrowAddress);
  console.log('GWC Balance:', ethers.formatEther(balance), 'GWC');
  
  // Check if a specific claim has been made
  const testAddress = '0x6D51d80017C66afBeD44D50c775f46C60Bbb56af';
  const hasClaimed = await RewardEscrow.hasClaimed(0, testAddress);
  console.log(`Has ${testAddress} claimed from epoch 0:`, hasClaimed);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
