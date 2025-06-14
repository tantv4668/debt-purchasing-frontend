import { useChainId } from 'wagmi';
import {
  ChainId,
  getAaveOracleConfig,
  getAavePoolConfig,
  getAaveRouterConfig,
  getContractAddress,
  SUPPORTED_TOKENS,
} from '../contracts';

/**
 * Hook to get contract configurations for the current chain
 */
export function useContracts() {
  const chainId = useChainId() as ChainId;

  const aaveRouter = getAaveRouterConfig(chainId);
  const aaveOracle = getAaveOracleConfig(chainId);
  const aavePool = getAavePoolConfig(chainId);

  return {
    aaveRouter,
    aaveOracle,
    aavePool,
    chainId,
  };
}

/**
 * Hook to get token address for the current chain
 */
export function useTokenAddress(tokenSymbol: keyof typeof SUPPORTED_TOKENS) {
  const chainId = useChainId() as ChainId;

  const token = SUPPORTED_TOKENS[tokenSymbol];
  if (!token) {
    throw new Error(`Token ${tokenSymbol} not supported`);
  }

  const address = token.addresses[chainId];
  if (!address) {
    throw new Error(`Token ${tokenSymbol} not available on chain ${chainId}`);
  }

  return {
    address: address as `0x${string}`,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
  };
}

/**
 * Hook to get contract address for the current chain
 */
export function useContractAddress(contractName: 'aaveRouter' | 'aaveOracle' | 'poolProxy' | 'poolAddressesProvider') {
  const chainId = useChainId() as ChainId;
  return getContractAddress(chainId, contractName);
}

/**
 * Hook to check if current chain is supported
 */
export function useIsSupportedChain() {
  const chainId = useChainId() as ChainId;
  return chainId === ChainId.SEPOLIA || chainId === ChainId.MAINNET;
}
