import { useMemo } from 'react';
import { Address } from 'viem';
import { useAccount, useChainId, useWriteContract } from 'wagmi';
import { ChainId, getAaveRouterAddress } from '../contracts';
import { AAVE_POOL_ABI, AAVE_ROUTER_ABI, ERC20_ABI } from '../contracts/abis';
import { AAVE_POOL_EXTENSIONS, CONTRACT_DEFAULTS } from '../contracts/config';
import { SUPPORTED_TOKENS } from '../contracts/tokens';
import {
  getMaxApprovalAmount,
  getTokenAddress,
  getWagmiActions,
  isPositionActive,
  needsApproval,
  safeContractCall,
  validateWalletConnection,
} from '../utils/contract-helpers';
import { logger } from '../utils/logger';
import {
  SubgraphCollateral,
  SubgraphDebt,
  SubgraphPosition,
  UserPositionsResponse,
  getSubgraphClient,
  isSubgraphSupported,
} from '../utils/subgraph-client';

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

// Debt Position Operations Hook (Subgraph-based)
export function useDebtPositionOperations() {
  const { address } = useAccount();
  const chainId = useChainId();

  return useMemo(() => {
    const getUserDebtPositions = async (): Promise<DebtPositionData[]> => {
      if (!address) {
        logger.info('No wallet address provided');
        return [];
      }

      if (!chainId || !isSubgraphSupported(chainId as ChainId)) {
        logger.warn(`Subgraph not supported for chain ID: ${chainId}`);
        return [];
      }

      try {
        logger.info('Fetching user debt positions from subgraph for:', address);

        const subgraphClient = getSubgraphClient(chainId as ChainId);
        const response: UserPositionsResponse = await subgraphClient.getUserPositions(address);

        if (!response.user || !response.user.positions) {
          logger.info('No positions found for user');
          return [];
        }

        const positions: DebtPositionData[] = response.user.positions.map((position: SubgraphPosition) => {
          // Calculate total collateral and debt values in USD
          let totalCollateralUSD = 0;
          let totalDebtUSD = 0;

          position.collaterals.forEach((collateral: SubgraphCollateral) => {
            const amount = parseFloat(collateral.amount);
            const price = parseFloat(collateral.token.priceUSD);
            totalCollateralUSD += amount * price;
          });

          position.debts.forEach((debt: SubgraphDebt) => {
            const amount = parseFloat(debt.amount);
            const price = parseFloat(debt.token.priceUSD);
            totalDebtUSD += amount * price;
          });

          // Calculate health factor (simplified - in practice you'd use Aave's formula)
          const healthFactor = totalDebtUSD > 0 ? (totalCollateralUSD * 0.8) / totalDebtUSD : 999; // Assuming 80% LTV

          return {
            debtAddress: position.id as Address,
            totalCollateralBase: BigInt(Math.floor(totalCollateralUSD * 1e18)), // Convert to base units
            totalDebtBase: BigInt(Math.floor(totalDebtUSD * 1e18)),
            healthFactor: BigInt(Math.floor(healthFactor * 1e18)),
            ltv: BigInt(Math.floor(0.8 * 1e18)), // 80% LTV
            liquidationThreshold: BigInt(Math.floor(0.85 * 1e18)), // 85% liquidation threshold
            isActive: isPositionActive(
              BigInt(Math.floor(totalCollateralUSD * 1e18)),
              BigInt(Math.floor(totalDebtUSD * 1e18)),
            ),
          };
        });

        logger.info(`Successfully loaded ${positions.length} positions from subgraph`);
        return positions;
      } catch (error) {
        logger.error('Error fetching positions from subgraph:', error);
        return [];
      }
    };

    const getPositionDetails = async (positionId: string) => {
      if (!chainId || !isSubgraphSupported(chainId as ChainId)) {
        logger.warn(`Subgraph not supported for chain ID: ${chainId}`);
        return null;
      }

      try {
        const subgraphClient = getSubgraphClient(chainId as ChainId);
        const response = await subgraphClient.getPositionDetails(positionId);
        return response.debtPosition;
      } catch (error) {
        logger.error('Error fetching position details:', error);
        return null;
      }
    };

    // Keep some legacy functions for backward compatibility
    const getUserNonce = async (): Promise<bigint> => {
      const userAddress = validateWalletConnection(address);
      const routerAddress = getAaveRouterAddress(chainId as ChainId);

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
      const routerAddress = getAaveRouterAddress(chainId as ChainId);

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

    return {
      getUserNonce,
      checkDebtOwnership,
      getUserDebtPositions,
      getPositionDetails,
    };
  }, [address, chainId]);
}

export default {
  useContract,
  useTokenOperations,
  useMultiTokenOperations,
  useDebtPositionOperations,
};
