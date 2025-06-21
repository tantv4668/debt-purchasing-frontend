import { useMemo } from 'react';
import { Address } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';
import { ChainId, getAaveRouterAddress } from '../contracts';
import { AAVE_POOL_ABI, AAVE_ROUTER_ABI, ERC20_ABI } from '../contracts/abis';
import { getContractAddress } from '../contracts/addresses';
import { AAVE_POOL_EXTENSIONS, CONTRACT_DEFAULTS, POSITION_CONFIG } from '../contracts/config';
import { SUPPORTED_TOKENS } from '../contracts/tokens';
import {
  calculateSalt,
  getMaxApprovalAmount,
  getTokenAddress,
  getWagmiActions,
  isPositionActive,
  needsApproval,
  safeContractCall,
  validateWalletConnection,
} from '../utils/contract-helpers';
import { logger } from '../utils/logger';

// Complete Aave Pool ABI
const AAVE_POOL_COMPLETE_ABI = [...AAVE_POOL_ABI, ...AAVE_POOL_EXTENSIONS] as const;

// Contract interaction types
export interface ContractConfig {
  address: Address;
  abi: any;
}

export interface DebtPositionData {
  debtAddress: Address;
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  healthFactor: bigint;
  ltv: bigint;
  liquidationThreshold: bigint;
  isActive: boolean;
}

// Base contract hook
export function useContract<T = any>(config: ContractConfig) {
  const { writeContract } = useWriteContract();

  return useMemo(() => {
    const read = async (functionName: string, args: any[] = []) => {
      const { readContract, wagmiConfig } = await getWagmiActions();
      return readContract(wagmiConfig, {
        address: config.address,
        abi: config.abi,
        functionName,
        args,
      });
    };

    const write = async (functionName: string, args: any[] = []) => {
      return writeContract({
        address: config.address,
        abi: config.abi,
        functionName,
        args,
      });
    };

    return { read, write, address: config.address, abi: config.abi };
  }, [config.address, config.abi, writeContract]);
}

// Token Operations Hook
export function useTokenOperations(chainId: ChainId = CONTRACT_DEFAULTS.CHAIN_ID) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const routerAddress = getAaveRouterAddress(chainId);

  return useMemo(() => {
    const checkAllowance = async (tokenSymbol: string, spenderAddress?: Address): Promise<bigint> => {
      const userAddress = validateWalletConnection(address);
      const spender = spenderAddress || routerAddress;
      const tokenAddress = getTokenAddress(tokenSymbol, chainId, SUPPORTED_TOKENS);

      return safeContractCall(
        async () => {
          const { readContract, wagmiConfig } = await getWagmiActions();
          return readContract(wagmiConfig, {
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [userAddress, spender],
          }) as Promise<bigint>;
        },
        'ERC20',
        'allowance',
        [userAddress, spender],
      );
    };

    const approveToken = async (tokenSymbol: string, amount: bigint, spenderAddress?: Address) => {
      validateWalletConnection(address);
      const spender = spenderAddress || routerAddress;
      const tokenAddress = getTokenAddress(tokenSymbol, chainId, SUPPORTED_TOKENS);

      return writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, amount],
      });
    };

    const approveMaxToken = async (tokenSymbol: string, spenderAddress?: Address) => {
      return approveToken(tokenSymbol, getMaxApprovalAmount(), spenderAddress);
    };

    return { checkAllowance, approveToken, approveMaxToken };
  }, [address, chainId, routerAddress, writeContractAsync]);
}

// Multi-token operations hook
export function useMultiTokenOperations(chainId: ChainId = CONTRACT_DEFAULTS.CHAIN_ID) {
  const tokenOps = useTokenOperations(chainId);

  return useMemo(() => {
    const checkMultipleAllowances = async (
      tokens: Array<{ symbol: string; amount: bigint }>,
      spenderAddress?: Address,
    ) => {
      const results = await Promise.all(
        tokens.map(async ({ symbol, amount }) => {
          const allowance = await tokenOps.checkAllowance(symbol, spenderAddress);
          return {
            symbol,
            amount,
            allowance,
            needsApproval: needsApproval(allowance, amount),
          };
        }),
      );
      return results;
    };

    const approveMultipleTokens = async (
      tokens: Array<{ symbol: string; amount: bigint }>,
      spenderAddress?: Address,
    ) => {
      const allowanceCheck = await checkMultipleAllowances(tokens, spenderAddress);
      const tokensNeedingApproval = allowanceCheck.filter(t => t.needsApproval);

      if (tokensNeedingApproval.length === 0) {
        return { allApproved: true, approvalResults: [] };
      }

      const approvalResults = [];
      for (const token of tokensNeedingApproval) {
        try {
          await tokenOps.approveMaxToken(token.symbol, spenderAddress);
          approvalResults.push({ symbol: token.symbol, success: true });
        } catch (error) {
          approvalResults.push({ symbol: token.symbol, success: false, error });
        }
      }

      return {
        allApproved: approvalResults.every(r => r.success),
        approvalResults,
      };
    };

    return { checkMultipleAllowances, approveMultipleTokens };
  }, [tokenOps]);
}

// Debt Position Operations Hook
export function useDebtPositionOperations(chainId: ChainId = CONTRACT_DEFAULTS.CHAIN_ID) {
  const { address } = useAccount();
  const routerAddress = getAaveRouterAddress(chainId);

  return useMemo(() => {
    const getUserNonce = async (): Promise<bigint> => {
      const userAddress = validateWalletConnection(address);

      return safeContractCall(
        async () => {
          const { readContract, wagmiConfig } = await getWagmiActions();
          return readContract(wagmiConfig, {
            address: routerAddress,
            abi: AAVE_ROUTER_ABI,
            functionName: 'userNonces',
            args: [userAddress],
          }) as Promise<bigint>;
        },
        'AaveRouter',
        'userNonces',
        [userAddress],
      );
    };

    const checkDebtOwnership = async (debtAddress: Address): Promise<boolean> => {
      const userAddress = validateWalletConnection(address);

      return safeContractCall(
        async () => {
          const { readContract, wagmiConfig } = await getWagmiActions();
          const owner = (await readContract(wagmiConfig, {
            address: routerAddress,
            abi: AAVE_ROUTER_ABI,
            functionName: 'debtOwners',
            args: [debtAddress],
          })) as Address;

          return owner.toLowerCase() === userAddress.toLowerCase();
        },
        'AaveRouter',
        'debtOwners',
        [debtAddress],
      );
    };

    const getDebtPositionData = async (debtAddress: Address): Promise<DebtPositionData | null> => {
      return safeContractCall(
        async () => {
          const { readContract, wagmiConfig } = await getWagmiActions();
          const poolAddress = getContractAddress(chainId, 'poolProxy') as Address;

          const accountData = (await readContract(wagmiConfig, {
            address: poolAddress,
            abi: AAVE_POOL_COMPLETE_ABI,
            functionName: 'getUserAccountData',
            args: [debtAddress],
          })) as [bigint, bigint, bigint, bigint, bigint, bigint];

          const [
            totalCollateralBase,
            totalDebtBase,
            availableBorrowsBase,
            currentLiquidationThreshold,
            ltv,
            healthFactor,
          ] = accountData;

          return {
            debtAddress,
            totalCollateralBase,
            totalDebtBase,
            healthFactor,
            ltv,
            liquidationThreshold: currentLiquidationThreshold,
            isActive: isPositionActive(totalCollateralBase, totalDebtBase),
          };
        },
        'AavePool',
        'getUserAccountData',
        [debtAddress],
      );
    };

    // Main function to get all user debt positions
    const getUserDebtPositions = async (): Promise<DebtPositionData[]> => {
      if (!address) return [];

      try {
        logger.info('Fetching user debt positions for:', address);

        const userNonce = await getUserNonce();
        logger.info(`User nonce: ${userNonce.toString()}`);

        if (Number(userNonce) === 0) {
          logger.info('User has no debt positions (nonce is 0)');
          return [];
        }

        // Try to get implementation address for CREATE2 calculation
        let positions: DebtPositionData[] = [];

        try {
          positions = await getPositionsByNonceIteration(Number(userNonce));
        } catch (error) {
          logger.warn('Nonce iteration failed, trying fallback approach:', error);
          positions = await getFallbackPositions();
        }

        logger.info(`Found ${positions.length} total positions`);
        return positions;
      } catch (error) {
        logger.error('Error getting user debt positions:', error);
        return [];
      }
    };

    // Helper: Get positions by iterating through nonces
    const getPositionsByNonceIteration = async (userNonce: number): Promise<DebtPositionData[]> => {
      const positions: DebtPositionData[] = [];
      const maxIterations = Math.min(userNonce, POSITION_CONFIG.MAX_NONCE_ITERATIONS);

      logger.info(`Checking positions for nonces 0 to ${maxIterations - 1}`);

      for (let nonce = 0; nonce < maxIterations; nonce++) {
        try {
          const salt = await calculateSalt(address as Address, nonce);
          logger.debug(`Checking nonce ${nonce} with salt: ${salt}`);

          // For now, we'll use the fallback approach since CREATE2 calculation is complex
          // This is where you'd implement proper CREATE2 address calculation
          // const calculatedAddress = calculateCREATE2Address(routerAddress, salt, implementationHash);
        } catch (error) {
          logger.error(`Error checking nonce ${nonce}:`, error);
          continue;
        }
      }

      return positions;
    };

    // Helper: Fallback approach for finding positions
    const getFallbackPositions = async (): Promise<DebtPositionData[]> => {
      logger.info('Using fallback approach to find positions');

      return safeContractCall(
        async () => {
          const { readContract, wagmiConfig } = await getWagmiActions();
          const positions: DebtPositionData[] = [];

          // Get the current predicted address (for next position)
          const nextPredictedAddress = (await readContract(wagmiConfig, {
            address: routerAddress,
            abi: AAVE_ROUTER_ABI,
            functionName: 'predictDebtAddress',
            args: [address],
          })) as Address;

          logger.info('Next predicted address:', nextPredictedAddress);

          // Test the predicted address
          const positionData = await getDebtPositionData(nextPredictedAddress);

          if (positionData) {
            const isOwned = await checkDebtOwnership(nextPredictedAddress);
            logger.info('Is owned by user:', isOwned);

            if (isOwned && positionData.isActive) {
              positions.push(positionData);
              logger.info('✅ Added position:', nextPredictedAddress);
            } else {
              logger.info('❌ Position not active or not owned');
            }
          } else {
            logger.info('❌ No position data found');
          }

          return positions;
        },
        'AaveRouter',
        'fallbackPositionSearch',
      );
    };

    return {
      getUserNonce,
      checkDebtOwnership,
      getDebtPositionData,
      getUserDebtPositions,
    };
  }, [address, chainId, routerAddress]);
}

export default {
  useContract,
  useTokenOperations,
  useMultiTokenOperations,
  useDebtPositionOperations,
};
