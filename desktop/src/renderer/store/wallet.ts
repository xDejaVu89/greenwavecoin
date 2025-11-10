import { create } from 'zustand';
import { ethers } from 'ethers';

interface WalletState {
  address: string | null;
  balance: string | null;
  chainId: number | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  isConnecting: boolean;
  error: string | null;
  
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  refreshBalance: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  balance: null,
  chainId: null,
  provider: null,
  signer: null,
  isConnecting: false,
  error: null,

  connect: async () => {
    set({ isConnecting: true, error: null });
    
    try {
      // Check if MetaMask is installed
      if (!window.ethereum) {
        throw new Error('MetaMask not found. Please install MetaMask extension.');
      }

      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Create provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = network.chainId;

      set({ 
        address, 
        chainId, 
        provider, 
        signer,
        isConnecting: false 
      });

      // Get balance
      await get().refreshBalance();

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          get().disconnect();
        } else {
          get().connect();
        }
      });

      // Listen for chain changes
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });

    } catch (error: any) {
      console.error('Wallet connection error:', error);
      set({ 
        error: error.message || 'Failed to connect wallet',
        isConnecting: false 
      });
    }
  },

  disconnect: () => {
    set({
      address: null,
      balance: null,
      chainId: null,
      provider: null,
      signer: null,
      error: null,
    });
  },

  switchNetwork: async (targetChainId: number) => {
    const { provider } = get();
    if (!provider || !window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (error: any) {
      // Chain doesn't exist, add it
      if (error.code === 4902) {
        const networkData = getNetworkData(targetChainId);
        if (networkData) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkData],
          });
        }
      } else {
        throw error;
      }
    }
  },

  refreshBalance: async () => {
    const { provider, address } = get();
    if (!provider || !address) return;

    try {
      const balance = await provider.getBalance(address);
      set({ balance: ethers.utils.formatEther(balance) });
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  },
}));

// Network configurations
function getNetworkData(chainId: number) {
  const networks: Record<number, any> = {
    137: {
      chainId: '0x89',
      chainName: 'Polygon Mainnet',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: ['https://polygon-rpc.com'],
      blockExplorerUrls: ['https://polygonscan.com'],
    },
    1: {
      chainId: '0x1',
      chainName: 'Ethereum Mainnet',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://eth.llamarpc.com'],
      blockExplorerUrls: ['https://etherscan.io'],
    },
  };
  return networks[chainId];
}

// Extend window for MetaMask
declare global {
  interface Window {
    ethereum?: any;
  }
}
