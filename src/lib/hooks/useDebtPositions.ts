import { useEffect, useMemo, useState } from 'react';
import { encodeFunctionData, formatUnits } from 'viem';
import { useAccount, useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import { AAVE_ROUTER_ABI, ERC20_ABI, getAaveRouterAddress } from '../contracts';
import { CONTRACT_DEFAULTS } from '../contracts/config';
import { SUPPORTED_TOKENS } from '../contracts/tokens';
import type { CreatePositionParams, DebtPosition, UserPositionSummary } from '../types/debt-position';
import { validateWalletConnection } from '../utils/contract-helpers';
import { logger } from '../utils/logger';
import { DebtPositionData, useDebtPositionOperations } from './useContracts';

// Hook to get user's debt positions
export function useUserDebtPositions() {
  const { address } = useAccount();
  const debtOps = useDebtPositionOperations();
  const [positions, setPositions] = useState<DebtPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = async () => {
    if (!address) {
      setPositions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const debtPositions = await debtOps.getUserDebtPositions();
      const formattedPositions: DebtPosition[] = debtPositions.map((position: DebtPositionData) => ({
        address: position.debtAddress,
        owner: address,
        nonce: 0, // TODO: Get actual nonce from contract
        totalCollateralBase: position.totalCollateralBase,
        totalDebtBase: position.totalDebtBase,
        availableBorrowsBase: position.totalCollateralBase - position.totalDebtBase, // Simplified calculation
        currentLiquidationThreshold: position.liquidationThreshold,
        ltv: position.ltv,
        healthFactor: position.healthFactor,
        collaterals: [], // TODO: Implement detailed asset breakdown
        debts: [], // TODO: Implement detailed asset breakdown
        createdAt: Date.now(), // TODO: Get from events
        lastUpdated: Date.now(),
      }));

      setPositions(formattedPositions);
      logger.info(`Successfully loaded ${formattedPositions.length} debt positions`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch positions';
      logger.error('Error fetching debt positions:', err);
      setError(errorMessage);
      setPositions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [address]);

  return { positions, isLoading, error, refetch: fetchPositions };
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
  const { positions } = useUserDebtPositions();

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
