import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import { HardhatUserConfig } from "hardhat/config";
import "hardhat-deploy";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-deploy-ethers";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-verify";
import dotenv from "dotenv";

dotenv.config();

// Load and normalize private key
const rawKey = process.env.PRIVATE_KEY;
const normalizedKey = rawKey ? (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) : undefined;

// Load environment variables
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY;
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY;
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY;
const REPORT_GAS = process.env.REPORT_GAS === "true";
const SEPOLIA_RPC = process.env.SEPOLIA_RPC; // Optional override for Sepolia RPC
const MAINNET_RPC = process.env.MAINNET_RPC; // Optional override for Ethereum mainnet RPC

// RPC URLs
const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
const BSC_RPC = process.env.BSC_RPC || "https://bsc-dataseed.binance.org";
const BASE_RPC = process.env.BASE_RPC || "https://mainnet.base.org";

// Common network config generator
const createNetworkConfig = (url: string) => ({
  url,
  accounts: normalizedKey ? [normalizedKey] : [],
  timeout: 900000 // 15 minutes
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },

  networks: {
    hardhat: {
      mining: {
        auto: true,
        interval: 0
      }
    },
    localhost: { url: "http://127.0.0.1:8545" },

  // Ethereum testnets
  // Sepolia default RPC can be flaky (522 errors). Allow override with SEPOLIA_RPC env.
  // Recommended alternatives (set SEPOLIA_RPC):
  //   https://eth-sepolia.public.blastapi.io
  //   https://sepolia.gateway.tenderly.co
  //   https://rpc.notadegen.com/eth/sepolia
  // Or provider key based:
  //   https://sepolia.infura.io/v3/<INFURA_KEY>
  //   https://eth-sepolia.g.alchemy.com/v2/<ALCHEMY_KEY>
  // Default to Ankr public RPC which is commonly reliable; override via SEPOLIA_RPC in .env
  sepolia: createNetworkConfig(SEPOLIA_RPC || "https://rpc.ankr.com/eth_sepolia"),
  goerli: createNetworkConfig("https://rpc.ankr.com/eth_goerli"),

  // Ethereum mainnet (allow override via MAINNET_RPC)
  mainnet: createNetworkConfig(MAINNET_RPC || "https://eth.llamarpc.com"),

    // Polygon ecosystem
    amoy: createNetworkConfig("https://rpc-amoy.polygon.technology"),
    mumbai: createNetworkConfig("https://rpc-mumbai.maticvigil.com"),
    polygon: { ...createNetworkConfig(process.env.POLYGON_RPC || "https://1rpc.io/matic"), gasPrice: 350_000_000_000 },

    // BSC ecosystem
    bsc: createNetworkConfig(BSC_RPC),
    bscTestnet: createNetworkConfig("https://data-seed-prebsc-1-s1.binance.org:8545"),

    // Arbitrum ecosystem
    arbitrum: createNetworkConfig(ARBITRUM_RPC),
    arbitrumGoerli: createNetworkConfig("https://goerli-rollup.arbitrum.io/rpc"),

    // Base ecosystem
    base: createNetworkConfig(BASE_RPC),
    baseGoerli: createNetworkConfig("https://goerli.base.org")
  },

  // gasReporter typing in some versions can be strict; cast to any to avoid type mismatch
  gasReporter: ( {
    enabled: REPORT_GAS,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    token: "MATIC",
    gasPriceApi: "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice"
  } as unknown ) as any,

  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
    strict: true,
    only: ["GreenWaveCoin"]
  },

  // etherscan config is attached below as `any` to avoid HardhatUserConfig typing issues

  namedAccounts: { deployer: { default: 0 }, treasury: { default: 1 } },

  paths: { deploy: "deploy", deployments: "deployments" }
};

export default config;
// Attach etherscan API keys in a non-strict way to avoid typing conflicts across plugin versions
(config as any).etherscan = {
  apiKey: {
    sepolia: ETHERSCAN_API_KEY || "",
    goerli: ETHERSCAN_API_KEY || "",
    mainnet: ETHERSCAN_API_KEY || "",
    polygonMumbai: POLYGONSCAN_API_KEY || "",
    polygon: POLYGONSCAN_API_KEY || "",
    bsc: BSCSCAN_API_KEY || "",
    bscTestnet: BSCSCAN_API_KEY || "",
    arbitrumOne: ARBISCAN_API_KEY || "",
    arbitrumGoerli: ARBISCAN_API_KEY || "",
    base: BASESCAN_API_KEY || "",
    baseGoerli: BASESCAN_API_KEY || ""
  },
  customChains: [
    {
      network: "polygon",
      chainId: 137,
      urls: {
        apiURL: "https://api.polygonscan.com/api",
        browserURL: "https://polygonscan.com"
      }
    }
  ]
};