import { ethers } from 'ethers';

// GWC Token ABI (minimal for balanceOf and approve)
export const GWC_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

// RewardEscrowV2 ABI (minimal for claim)
export const REWARD_ESCROW_ABI = [
  'function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof)',
  'function isClaimed(uint256 index) view returns (bool)',
];

// Contract addresses (update with deployed addresses)
export const CONTRACTS = {
  // Polygon mainnet addresses (placeholder - update after deployment)
  137: {
    GWC_TOKEN: '0x0000000000000000000000000000000000000000', // TODO: Update
    REWARD_ESCROW: '0x0000000000000000000000000000000000000000', // TODO: Update
  },
  // Ethereum mainnet addresses (if deployed there)
  1: {
    GWC_TOKEN: '0x0000000000000000000000000000000000000000', // TODO: Update
    REWARD_ESCROW: '0x0000000000000000000000000000000000000000', // TODO: Update
  },
  // Mumbai testnet (for testing)
  80001: {
    GWC_TOKEN: '0x0000000000000000000000000000000000000000', // TODO: Update
    REWARD_ESCROW: '0x0000000000000000000000000000000000000000', // TODO: Update
  },
};

export function getContracts(chainId: number) {
  return CONTRACTS[chainId as keyof typeof CONTRACTS] || null;
}

export async function getGWCBalance(
  provider: ethers.providers.Web3Provider,
  address: string,
  chainId: number
): Promise<string> {
  const contracts = getContracts(chainId);
  if (!contracts || contracts.GWC_TOKEN === '0x0000000000000000000000000000000000000000') {
    return '0';
  }

  const tokenContract = new ethers.Contract(
    contracts.GWC_TOKEN,
    GWC_TOKEN_ABI,
    provider
  );

  const balance = await tokenContract.balanceOf(address);
  return ethers.utils.formatEther(balance);
}

export async function claimRewards(
  signer: ethers.Signer,
  chainId: number,
  index: number,
  account: string,
  amount: string,
  proof: string[]
): Promise<ethers.ContractTransaction> {
  const contracts = getContracts(chainId);
  if (!contracts) {
    throw new Error('Contracts not deployed on this network');
  }

  const escrowContract = new ethers.Contract(
    contracts.REWARD_ESCROW,
    REWARD_ESCROW_ABI,
    signer
  );

  // Convert amount to wei
  const amountWei = ethers.utils.parseEther(amount);

  const tx = await escrowContract.claim(index, account, amountWei, proof);
  return tx;
}
