// Contract addresses and configurations
import {
  AAVE_DEBT_ABI,
  AAVE_ORACLE_ABI,
  AAVE_POOL_ABI,
  AAVE_ROUTER_ABI,
  CHAINLINK_AGGREGATOR_ABI,
} from './contracts/abis';
import { CONTRACT_ADDRESSES, getContractAddress } from './contracts/addresses';
import { ChainId } from './contracts/chains';

// Helper to get contract address by chain
export function getAaveRouterAddress(chainId: ChainId): `0x${string}` {
  return getContractAddress(chainId, 'aaveRouter') as `0x${string}`;
}

export function getPoolAddressesProvider(chainId: ChainId): `0x${string}` {
  return getContractAddress(chainId, 'poolAddressesProvider') as `0x${string}`;
}

export function getPoolProxy(chainId: ChainId): `0x${string}` {
  return getContractAddress(chainId, 'poolProxy') as `0x${string}`;
}

export function getAaveOracle(chainId: ChainId): `0x${string}` {
  return getContractAddress(chainId, 'aaveOracle') as `0x${string}`;
}

// Common token addresses (these are generic and need to be updated per chain)
export const TOKEN_ADDRESSES = {
  [ChainId.MAINNET]: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as `0x${string}`,
    USDC: '0xA0b86a33E6441986F0F27eab3D7Cc3C9fB7c7C1c' as `0x${string}`,
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as `0x${string}`,
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as `0x${string}`,
  },
  [ChainId.SEPOLIA]: {
    WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as `0x${string}`,
    USDC: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8' as `0x${string}`,
    DAI: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357' as `0x${string}`,
    WBTC: '0x29f2D40B0605204364af54EC677bD022dA425d03' as `0x${string}`,
  },
} as const;

// Export ABIs from the organized structure
export { AAVE_DEBT_ABI, AAVE_ORACLE_ABI, AAVE_POOL_ABI, AAVE_ROUTER_ABI, CHAINLINK_AGGREGATOR_ABI };

// ERC20 ABI for token interactions
export const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Token information
export function getTokenConfig(chainId: ChainId) {
  const addresses = TOKEN_ADDRESSES[chainId];

  return {
    WETH: {
      address: addresses.WETH,
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      decimals: 18,
      logoUrl: '/tokens/weth.png',
    },
    USDC: {
      address: addresses.USDC,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoUrl: '/tokens/usdc.png',
    },
    DAI: {
      address: addresses.DAI,
      symbol: 'DAI',
      name: 'Dai Stablecoin',
      decimals: 18,
      logoUrl: '/tokens/dai.png',
    },
    WBTC: {
      address: addresses.WBTC,
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      decimals: 8,
      logoUrl: '/tokens/wbtc.png',
    },
  } as const;
}

export type TokenSymbol = 'WETH' | 'USDC' | 'DAI' | 'WBTC';

// Export contract addresses for backward compatibility
export { ChainId, CONTRACT_ADDRESSES };
