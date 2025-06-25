import { useEffect, useMemo, useState } from 'react';
import { encodeFunctionData, formatUnits } from 'viem';
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import { AAVE_ROUTER_ABI, ERC20_ABI, getAaveRouterAddress } from '../contracts';
import { CONTRACT_DEFAULTS } from '../contracts/config';
import { SUPPORTED_TOKENS } from '../contracts/tokens';
import type { CreatePositionParams, DebtPosition, UserPositionSummary } from '../types/debt-position';
import { validateWalletConnection } from '../utils/contract-helpers';
import { logger } from '../utils/logger';
import { getSubgraphClient, isSubgraphSupported } from '../utils/subgraph-client';

// Hook to get user's debt positions from backend API
export function useUserDebtPositions(limit = 10, offset = 0) {
  const { address } = useAccount();
  const chainId = useChainId();
  const [positions, setPositions] = useState<DebtPosition[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = async () => {
    if (!address) {
      setPositions([]);
      return;
    }

    if (!chainId || !isSubgraphSupported(chainId)) {
      logger.warn(`Subgraph not supported for chain ID: ${chainId}`);
      setError(`Subgraph not supported for this network`);
      setPositions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info('Fetching user debt positions from backend API for:', address, `limit: ${limit}, offset: ${offset}`);

      const subgraphClient = getSubgraphClient(chainId);
      const cachedData = await subgraphClient.getCachedPositions(address.toLowerCase(), limit, offset);

      if (!cachedData || !cachedData.positions || cachedData.positions.length === 0) {
        logger.info('No positions found for user');
        setPositions([]);
        setTotal(cachedData?.total || 0);
        return;
      }

      setTotal(cachedData.total || cachedData.positions.length);

      const formattedPositions: DebtPosition[] = cachedData.positions.map((position: any) => {
        // Get token info for collaterals and debts (fallback values since backend doesn't include full token data)
        const getTokenInfo = (tokenAddress: string) => {
          // Look up token in SUPPORTED_TOKENS by address
          const tokenEntry = Object.entries(SUPPORTED_TOKENS).find(
            ([, token]) =>
              token.addresses[chainId as keyof typeof token.addresses]?.toLowerCase() === tokenAddress.toLowerCase(),
          );

          if (tokenEntry) {
            const [symbol, tokenConfig] = tokenEntry;
            return {
              symbol,
              decimals: tokenConfig.decimals,
              priceUSD: 1.0, // Default price, would need to fetch from oracle
            };
          }

          // Fallback for unknown tokens
          return {
            symbol: 'UNKNOWN',
            decimals: 18,
            priceUSD: 1.0,
          };
        };

        // Calculate totals in USD
        let totalCollateralUSD = 0;
        let totalDebtUSD = 0;

        // Format collaterals
        const collaterals = position.collaterals.map((collateral: any) => {
          const amount = parseFloat(collateral.amount);
          const tokenInfo = getTokenInfo(collateral.token);
          const price = tokenInfo.priceUSD;
          const valueInUSD = amount * price;
          const balance = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals)));
          totalCollateralUSD += valueInUSD;

          return {
            token: collateral.token as `0x${string}`,
            symbol: tokenInfo.symbol,
            name: tokenInfo.symbol,
            decimals: tokenInfo.decimals,
            balance,
            balanceFormatted: amount.toFixed(4),
            valueInBase: BigInt(Math.floor(valueInUSD * 1e18)),
            valueInUSD: valueInUSD,
            aTokenAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          };
        });

        // Format debts
        const debts = position.debts.map((debt: any) => {
          const amount = parseFloat(debt.amount);
          const tokenInfo = getTokenInfo(debt.token);
          const price = tokenInfo.priceUSD;
          const valueInUSD = amount * price;
          const balance = BigInt(Math.floor(amount * Math.pow(10, tokenInfo.decimals)));
          totalDebtUSD += valueInUSD;

          return {
            token: debt.token as `0x${string}`,
            symbol: tokenInfo.symbol,
            name: tokenInfo.symbol,
            decimals: tokenInfo.decimals,
            balance,
            balanceFormatted: amount.toFixed(4),
            valueInBase: BigInt(Math.floor(valueInUSD * 1e18)),
            valueInUSD: valueInUSD,
            interestRateMode: parseInt(debt.interestRateMode) as 1 | 2,
            variableDebtTokenAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            stableDebtTokenAddress: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          };
        });

        // Parse health factor from backend (it's already a string like "1.0")
        const healthFactorValue = parseFloat(position.healthFactor || '1.0');

        return {
          address: position.id as `0x${string}`,
          owner: address,
          nonce: parseInt(position.nonce || '0'),
          totalCollateralBase: BigInt(Math.floor(totalCollateralUSD * 1e18)),
          totalDebtBase: BigInt(Math.floor(totalDebtUSD * 1e18)),
          availableBorrowsBase: BigInt(Math.floor((totalCollateralUSD * 0.8 - totalDebtUSD) * 1e18)),
          currentLiquidationThreshold: BigInt(Math.floor(0.85 * 1e18)), // 85%
          ltv: BigInt(Math.floor(0.8 * 1e18)), // 80%
          healthFactor: BigInt(Math.floor(healthFactorValue * 1e18)),
          collaterals,
          debts,
          createdAt: new Date(position.createdAt).getTime(),
          lastUpdated: new Date(position.updatedAt).getTime(),
        };
      });

      setPositions(formattedPositions);
      logger.info(`Successfully loaded ${formattedPositions.length} debt positions from subgraph`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch positions from subgraph';
      logger.error('Error fetching debt positions from subgraph:', err);
      setError(errorMessage);
      setPositions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [address, chainId, limit, offset]);

  const triggerCacheRefresh = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/cache/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Cache refresh failed');
    } catch (error) {
      console.warn('Cache refresh failed:', error);
    }
  };

  const refetchWithCacheRefresh = async () => {
    // Wait for subgraph to index the transaction (10 seconds)
    setTimeout(async () => {
      await triggerCacheRefresh();
      // Wait a bit more for cache to update, then fetch
      setTimeout(fetchPositions, 2000);
    }, 10000);
  };

  return { positions, total, isLoading, error, refetch: fetchPositions, refetchWithCacheRefresh };
}

// Hook to predict debt address for new position
export function usePredictDebtAddress() {
  const { address } = useAccount();

  const { data: predictedAddress, isLoading } = useReadContract({
    address: getAaveRouterAddress(CONTRACT_DEFAULTS.CHAIN_ID),
    abi: AAVE_ROUTER_ABI,
    functionName: 'predictDebtAddress',
    args: address ? [address] : undefined,
  });

  return { predictedAddress, isLoading };
}

// Hook to create position with multicall
export function useCreatePosition() {
  const { writeContractAsync, isPending, error } = useWriteContract();
  const { address } = useAccount();
  const { predictedAddress } = usePredictDebtAddress();

  const createPosition = async (params: CreatePositionParams) => {
    const userAddress = validateWalletConnection(address);
    if (!predictedAddress) {
      throw new Error('Predicted address not available');
    }

    const { collateralAssets, borrowAssets } = params;

    // Validate inputs
    if (!collateralAssets?.length) {
      throw new Error('At least one collateral asset is required');
    }
    if (!borrowAssets?.length) {
      throw new Error('At least one borrow asset is required');
    }

    // Prepare multicall data
    const multicallData: `0x${string}`[] = [];

    // 1. Create debt position
    multicallData.push(
      encodeFunctionData({
        abi: AAVE_ROUTER_ABI,
        functionName: 'createDebt',
        args: [],
      }),
    );

    // 2. Supply all collateral assets
    for (const collateral of collateralAssets) {
      if (!collateral.asset || collateral.asset === CONTRACT_DEFAULTS.ZERO_ADDRESS) {
        throw new Error(`Invalid collateral asset address: ${collateral.asset}`);
      }
      multicallData.push(
        encodeFunctionData({
          abi: AAVE_ROUTER_ABI,
          functionName: 'callSupply',
          args: [predictedAddress, collateral.asset, collateral.amount],
        }),
      );
    }

    // 3. Borrow all assets
    for (const borrowAsset of borrowAssets) {
      if (!borrowAsset.asset || borrowAsset.asset === CONTRACT_DEFAULTS.ZERO_ADDRESS) {
        throw new Error(`Invalid borrow asset address: ${borrowAsset.asset}`);
      }
      multicallData.push(
        encodeFunctionData({
          abi: AAVE_ROUTER_ABI,
          functionName: 'callBorrow',
          args: [
            predictedAddress,
            borrowAsset.asset,
            borrowAsset.amount,
            BigInt(borrowAsset.interestRateMode),
            userAddress,
          ],
        }),
      );
    }

    // Execute multicall
    const txHash = await writeContractAsync({
      address: getAaveRouterAddress(CONTRACT_DEFAULTS.CHAIN_ID),
      abi: AAVE_ROUTER_ABI,
      functionName: 'multicall',
      args: [multicallData],
    });

    logger.info('Position creation transaction submitted:', txHash);
    return txHash;
  };

  return { createPosition, isPending, error };
}

// Hook to get user's token balances
export function useTokenBalances() {
  const { address } = useAccount();
  const chainId = CONTRACT_DEFAULTS.CHAIN_ID;

  const tokenContracts = Object.entries(SUPPORTED_TOKENS)
    .filter(([, token]) => token.addresses[chainId])
    .map(([symbol, token]) => ({
      address: token.addresses[chainId] as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf' as const,
      args: address ? [address] : undefined,
      symbol,
      decimals: token.decimals,
    }));

  const { data: balances, isLoading } = useReadContracts({
    contracts: tokenContracts,
  });

  const tokenBalances = useMemo(() => {
    if (!balances) return {};

    const result: Record<string, { balance: bigint; formatted: string }> = {};
    tokenContracts.forEach((contract, index) => {
      const balance = (balances[index]?.result as bigint) || BigInt(0);
      result[contract.symbol] = {
        balance,
        formatted: formatUnits(balance, contract.decimals),
      };
    });

    return result;
  }, [balances, tokenContracts]);

  return { tokenBalances, isLoading };
}

// Hook to get user position summary
export function useUserPositionSummary(): UserPositionSummary {
  const { positions } = useUserDebtPositions(100, 0); // Get all positions for summary

  return useMemo(() => {
    if (!positions.length) {
      return {
        totalPositions: 0,
        totalDebtValue: 0,
        totalCollateralValue: 0,
        averageHealthFactor: 0,
        positionsAtRisk: 0,
      };
    }

    const totalDebtValue = positions.reduce((sum, pos) => {
      return sum + Number(formatUnits(pos.totalDebtBase, CONTRACT_DEFAULTS.HEALTH_FACTOR_DECIMALS));
    }, 0);

    const totalCollateralValue = positions.reduce((sum, pos) => {
      return sum + Number(formatUnits(pos.totalCollateralBase, CONTRACT_DEFAULTS.HEALTH_FACTOR_DECIMALS));
    }, 0);

    const totalHealthFactor = positions.reduce((sum, pos) => {
      return sum + Number(formatUnits(pos.healthFactor, CONTRACT_DEFAULTS.HEALTH_FACTOR_DECIMALS));
    }, 0);

    const averageHealthFactor = totalHealthFactor / positions.length;
    const positionsAtRisk = positions.filter(pos => {
      const hf = Number(formatUnits(pos.healthFactor, CONTRACT_DEFAULTS.HEALTH_FACTOR_DECIMALS));
      return hf < 1.5;
    }).length;

    return {
      totalPositions: positions.length,
      totalDebtValue,
      totalCollateralValue,
      averageHealthFactor,
      positionsAtRisk,
    };
  }, [positions]);
}

// Health factor formatting helper
export function formatHealthFactor(healthFactor: bigint) {
  const value = Number(formatUnits(healthFactor, CONTRACT_DEFAULTS.HEALTH_FACTOR_DECIMALS));

  let status: 'safe' | 'warning' | 'danger' | 'liquidation';
  let color: string;
  let label: string;

  if (value >= 2) {
    status = 'safe';
    color = '#10B981'; // green
    label = 'Safe';
  } else if (value >= 1.5) {
    status = 'warning';
    color = '#F59E0B'; // yellow
    label = 'Warning';
  } else if (value >= 1) {
    status = 'danger';
    color = '#EF4444'; // red
    label = 'Danger';
  } else {
    status = 'liquidation';
    color = '#DC2626'; // dark red
    label = 'Liquidation';
  }

  return { value, status, color, label };
}
