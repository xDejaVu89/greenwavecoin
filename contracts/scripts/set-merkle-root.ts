import dotenv from 'dotenv';
import path from 'path';
// Load env from contracts/.env or project root .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { ethers } from 'ethers';

async function main() {
  const escrowAddress = '0x2F3F050Ba9701c18E852011258fe6FF858BC0ED0';
  const epoch = 0;
  const newRoot = '0xb1d047a3733a474f3e3cf6faa7d37f832ba0acff1306295e246953015141da7a';

  const rpc = process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';
  const pk = process.env.PRIVATE_KEY as string;
  if (!pk) throw new Error('PRIVATE_KEY not set in env');

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  console.log('Using deployer:', await wallet.getAddress());

  const escrowAbi = [
    'function setMerkleRoot(uint256 epoch, bytes32 root) external',
    'function merkleRoots(uint256 epoch) view returns (bytes32)'
  ];

  const escrow = new ethers.Contract(escrowAddress, escrowAbi, wallet);

  console.log(`Setting merkle root for epoch ${epoch}...`);
  const tx = await escrow.setMerkleRoot(epoch, newRoot);
  console.log('Tx sent:', tx.hash);
  const receipt = await tx.wait();
  console.log('Confirmed in block', receipt.blockNumber);

  const readBack = await escrow.merkleRoots(epoch);
  console.log('New merkle root:', readBack);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
