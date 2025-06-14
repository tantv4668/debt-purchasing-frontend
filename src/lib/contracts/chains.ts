export enum ChainId {
  MAINNET = 1,
  SEPOLIA = 11155111,
}

export interface ChainConfig {
  id: ChainId;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  currency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const SUPPORTED_CHAINS: Record<ChainId, ChainConfig> = {
  [ChainId.MAINNET]: {
    id: ChainId.MAINNET,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    currency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  [ChainId.SEPOLIA]: {
    id: ChainId.SEPOLIA,
    name: 'Sepolia Testnet',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    blockExplorer: 'https://sepolia.etherscan.io',
    currency: {
      name: 'Sepolia Ethereum',
      symbol: 'SepoliaETH',
      decimals: 18,
    },
  },
} as const;

export const DEFAULT_CHAIN = ChainId.SEPOLIA;

export function getChainConfig(chainId: ChainId): ChainConfig {
  const config = SUPPORTED_CHAINS[chainId];
  if (!config) {
    throw new Error(`Chain ${chainId} is not supported`);
  }
  return config;
}
