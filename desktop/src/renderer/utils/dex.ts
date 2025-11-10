import { ethers } from 'ethers';

const ZERO_X_API_BASE = 'https://polygon.api.0x.org';

export interface SwapQuote {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  price: string;
  estimatedGas: string;
  allowanceTarget: string;
  to: string;
  data: string;
  value: string;
}

export interface Token {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  logoURI?: string;
}

// Popular tokens on Polygon
export const POLYGON_TOKENS: Record<string, Token> = {
  MATIC: {
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    symbol: 'MATIC',
    decimals: 18,
    name: 'Polygon',
  },
  USDC: {
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin',
  },
  USDT: {
    address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    symbol: 'USDT',
    decimals: 6,
    name: 'Tether USD',
  },
  WETH: {
    address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    symbol: 'WETH',
    decimals: 18,
    name: 'Wrapped Ether',
  },
  WBTC: {
    address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    symbol: 'WBTC',
    decimals: 8,
    name: 'Wrapped Bitcoin',
  },
  DAI: {
    address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    symbol: 'DAI',
    decimals: 18,
    name: 'Dai Stablecoin',
  },
};

export async function getSwapQuote(
  sellToken: string,
  buyToken: string,
  sellAmount: string,
  chainId: number = 137
): Promise<SwapQuote> {
  const baseUrl = chainId === 137 ? ZERO_X_API_BASE : 'https://api.0x.org';
  
  const params = new URLSearchParams({
    sellToken,
    buyToken,
    sellAmount,
    slippagePercentage: '0.01', // 1% slippage
  });

  const response = await fetch(`${baseUrl}/swap/v1/quote?${params}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.reason || 'Failed to get quote');
  }

  return response.json();
}

export async function getTokenBalance(
  provider: ethers.providers.Web3Provider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  // Native token (MATIC/ETH)
  if (tokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
    const balance = await provider.getBalance(userAddress);
    return ethers.utils.formatEther(balance);
  }

  // ERC20 token
  const contract = new ethers.Contract(
    tokenAddress,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );

  const balance = await contract.balanceOf(userAddress);
  const token = Object.values(POLYGON_TOKENS).find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
  const decimals = token?.decimals || 18;
  
  return ethers.utils.formatUnits(balance, decimals);
}

export async function checkAllowance(
  provider: ethers.providers.Web3Provider,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<string> {
  const contract = new ethers.Contract(
    tokenAddress,
    ['function allowance(address owner, address spender) view returns (uint256)'],
    provider
  );

  const allowance = await contract.allowance(ownerAddress, spenderAddress);
  return allowance.toString();
}

export async function approveToken(
  signer: ethers.Signer,
  tokenAddress: string,
  spenderAddress: string,
  amount: string
): Promise<ethers.ContractTransaction> {
  const contract = new ethers.Contract(
    tokenAddress,
    ['function approve(address spender, uint256 amount) returns (bool)'],
    signer
  );

  return contract.approve(spenderAddress, amount);
}

export async function executeSwap(
  signer: ethers.Signer,
  quote: SwapQuote
): Promise<ethers.ContractTransaction> {
  const tx = {
    to: quote.to,
    data: quote.data,
    value: quote.value || '0',
    gasLimit: ethers.BigNumber.from(quote.estimatedGas).mul(120).div(100), // 20% buffer
  };

  return signer.sendTransaction(tx);
}

// Helper to parse user input amount to wei/smallest unit
export function parseTokenAmount(amount: string, decimals: number): string {
  return ethers.utils.parseUnits(amount, decimals).toString();
}

// Helper to format amounts for display
export function formatTokenAmount(amount: string, decimals: number, maxDecimals: number = 6): string {
  const formatted = ethers.utils.formatUnits(amount, decimals);
  const num = parseFloat(formatted);
  return num.toFixed(Math.min(maxDecimals, decimals));
}
