import { Address } from 'viem';
import { CONTRACT_DEFAULTS, CONTRACT_ERRORS } from '../contracts/config';
import { logger } from './logger';

// Validation helpers
export const validateAddress = (address: string | undefined): Address => {
  if (!address) throw new Error(CONTRACT_ERRORS.INVALID_ADDRESS);
  return address as Address;
};

export const validateWalletConnection = (address: string | undefined): Address => {
  if (!address) throw new Error(CONTRACT_ERRORS.WALLET_NOT_CONNECTED);
  return address as Address;
};

// Contract call wrapper with error handling and logging
export const safeContractCall = async <T>(
  operation: () => Promise<T>,
  contractName: string,
  methodName: string,
  args?: any[],
): Promise<T> => {
  try {
    logger.contractCall(contractName, methodName, args);
    const result = await operation();
    logger.contractResult(contractName, methodName, result);
    return result;
  } catch (error) {
    logger.contractError(contractName, methodName, error);
    throw error;
  }
};

// Wagmi imports helper - reduces repetitive imports
export const getWagmiActions = async () => {
  const [{ readContract }, { config: wagmiConfig }] = await Promise.all([import('wagmi/actions'), import('../wagmi')]);
  return { readContract, wagmiConfig };
};

// Token operations helpers
export const getTokenAddress = (tokenSymbol: string, chainId: number, supportedTokens: any): Address => {
  const token = supportedTokens[tokenSymbol];
  if (!token || !token.addresses[chainId]) {
    throw new Error(CONTRACT_ERRORS.TOKEN_NOT_SUPPORTED(tokenSymbol, chainId));
  }
  return token.addresses[chainId] as Address;
};

// Approval helpers
export const needsApproval = (allowance: bigint, amount: bigint): boolean => {
  return allowance < amount;
};

export const getMaxApprovalAmount = (): bigint => {
  return CONTRACT_DEFAULTS.MAX_UINT256;
};

// Address calculation helpers
export const calculateSalt = async (userAddress: Address, nonce: number): Promise<`0x${string}`> => {
  const { keccak256, encodeAbiParameters } = await import('viem');
  return keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [userAddress, BigInt(nonce)]));
};

// Batch operation helpers
export const batchContractCalls = async <T>(
  operations: Array<() => Promise<T>>,
  batchSize: number = 5,
): Promise<T[]> => {
  const results: T[] = [];

  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(op => op()));

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.error(`Batch operation ${i + index} failed:`, result.reason);
      }
    });
  }

  return results;
};

// Health factor helpers
export const isPositionActive = (totalCollateralBase: bigint, totalDebtBase: bigint): boolean => {
  return totalCollateralBase > BigInt(0) || totalDebtBase > BigInt(0);
};
