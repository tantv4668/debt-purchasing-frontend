// Export all contract configurations
export * from './abis';
export * from './addresses';
export * from './chains';
export * from './tokens';

// Re-export commonly used types and functions
export { AAVE_ORACLE_ABI, AAVE_POOL_ABI, AAVE_ROUTER_ABI, CONTRACT_ABIS } from './abis';
export { CONTRACT_ADDRESSES, getContractAddress, getContractAddresses } from './addresses';
export { ChainId, DEFAULT_CHAIN, SUPPORTED_CHAINS } from './chains';
export { SUPPORTED_TOKENS } from './tokens';

import { CONTRACT_ABIS } from './abis';
import { getContractAddress } from './addresses';
import { ChainId } from './chains';

// Utility function to get contract config for wagmi
export function getContractConfig(chainId: ChainId, contractName: keyof typeof CONTRACT_ABIS) {
  return {
    address: getContractAddress(chainId, contractName as any) as `0x${string}`,
    abi: CONTRACT_ABIS[contractName],
    chainId,
  };
}

// Common contract configurations for current chain
export function getAaveRouterConfig(chainId: ChainId) {
  return getContractConfig(chainId, 'aaveRouter');
}

export function getAaveOracleConfig(chainId: ChainId) {
  return getContractConfig(chainId, 'aaveOracle');
}

export function getAavePoolConfig(chainId: ChainId) {
  return getContractConfig(chainId, 'aavePool');
}

// Helper function to get AaveRouter address directly
export function getAaveRouterAddress(chainId: ChainId): `0x${string}` {
  return getContractAddress(chainId, 'aaveRouter') as `0x${string}`;
}
