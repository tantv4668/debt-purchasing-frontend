// Re-export all contract-related modules for easy importing
export * from './abis';
export * from './addresses';
export * from './chains';
export * from './config';
export * from './tokens';

// Legacy exports for backward compatibility
import { CONTRACT_ABIS } from './abis';
import { getContractAddress } from './addresses';
import { ChainId } from './chains';

// Export all contract configurations
export { AAVE_ORACLE_ABI, AAVE_POOL_ABI, AAVE_ROUTER_ABI, CONTRACT_ABIS } from './abis';
export { CONTRACT_ADDRESSES, getContractAddress, getContractAddresses } from './addresses';
export { ChainId, DEFAULT_CHAIN, SUPPORTED_CHAINS } from './chains';
export { SUPPORTED_TOKENS } from './tokens';

// Utility function to get contract config for wagmi
export function getContractConfig(chainId: ChainId, contractName: keyof typeof CONTRACT_ABIS) {
  return {
    address: getContractAddress(chainId, contractName as any),
    abi: CONTRACT_ABIS[contractName],
  };
}

// Common contract configurations for current chain
export function getAaveRouterConfig(chainId: ChainId) {
  return {
    address: getContractAddress(chainId, 'aaveRouter') as `0x${string}`,
    abi: CONTRACT_ABIS.aaveRouter,
  };
}

export function getAaveOracleConfig(chainId: ChainId) {
  return {
    address: getContractAddress(chainId, 'aaveOracle') as `0x${string}`,
    abi: CONTRACT_ABIS.aaveOracle,
  };
}

export function getAavePoolConfig(chainId: ChainId) {
  return {
    address: getContractAddress(chainId, 'poolProxy') as `0x${string}`,
    abi: CONTRACT_ABIS.aavePool,
  };
}

// Helper function to get AaveRouter address directly
export function getAaveRouterAddress(chainId: ChainId): `0x${string}` {
  return getContractAddress(chainId, 'aaveRouter') as `0x${string}`;
}
