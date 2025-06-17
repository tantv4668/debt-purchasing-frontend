import { useMemo } from 'react';
import { encodeFunctionData, formatUnits } from 'viem';
import { useAccount, useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import { AAVE_ROUTER_ABI, ChainId, ERC20_ABI, getAaveRouterAddress } from '../contracts';
import { SUPPORTED_TOKENS } from '../contracts/tokens';
import type { CreatePositionParams, DebtPosition, UserPositionSummary } from '../types/debt-position';

// Hook to get user's debt positions
export function useUserDebtPositions() {
  const { address } = useAccount();

  const { data: userNonce } = useReadContract({
    address: getAaveRouterAddress(ChainId.SEPOLIA), // Default to Sepolia for now
    abi: AAVE_ROUTER_ABI,
    functionName: 'userNonces',
    args: address ? [address] : undefined,
  });

  // Get predicted addresses for all user's potential positions
  const predictedAddresses = useMemo(() => {
    if (!address || !userNonce) return [];
    const addresses: `0x${string}`[] = [];
    for (let i = 0; i < Number(userNonce); i++) {
      // Note: This would need to be implemented properly with the predictDebtAddress function
      // For now, we'll return empty array until we can calculate CREATE2 addresses
    }
    return addresses;
  }, [address, userNonce]);

  // TODO: Implement logic to fetch actual debt positions
  // This would involve:
  // 1. Getting all debt positions owned by user via events or subgraph
  // 2. Fetching Aave account data for each position
  // 3. Getting token balances and metadata

  return {
    positions: [] as DebtPosition[],
    isLoading: false,
    error: null,
    refetch: () => {},
  };
}

// Hook to predict debt address for new position
export function usePredictDebtAddress() {
  const { address } = useAccount();

  const { data: predictedAddress, isLoading } = useReadContract({
    address: getAaveRouterAddress(ChainId.SEPOLIA), // Default to Sepolia for now
    abi: AAVE_ROUTER_ABI,
    functionName: 'predictDebtAddress',
    args: address ? [address] : undefined,
  });

  return {
    predictedAddress,
    isLoading,
  };
}

// Hook to create position with multicall
export function useCreatePosition() {
  const { writeContract, isPending, error } = useWriteContract();
  const { address } = useAccount();
  const { predictedAddress } = usePredictDebtAddress();

  const createPosition = async (params: CreatePositionParams) => {
    if (!address || !predictedAddress) {
      throw new Error('Address or predicted address not available');
    }

    const { collateralAssets, borrowAssets } = params;

    // Validate that we have at least one collateral and one borrow asset
    if (!collateralAssets || collateralAssets.length === 0) {
      throw new Error('At least one collateral asset is required');
    }
    if (!borrowAssets || borrowAssets.length === 0) {
      throw new Error('At least one borrow asset is required');
    }

    // Prepare multicall data similar to the test
    const multicallData: `0x${string}`[] = [];

    // 1. Create debt position
    const createDebtData = encodeFunctionData({
      abi: AAVE_ROUTER_ABI,
      functionName: 'createDebt',
      args: [],
    });
    multicallData.push(createDebtData);

    // 2. Supply all collateral assets
    for (const collateral of collateralAssets) {
      if (!collateral.asset || collateral.asset === '0x0000000000000000000000000000000000000000') {
        throw new Error(`Invalid collateral asset address: ${collateral.asset}`);
      }
      const supplyData = encodeFunctionData({
        abi: AAVE_ROUTER_ABI,
        functionName: 'callSupply',
        args: [predictedAddress, collateral.asset, collateral.amount],
      });
      multicallData.push(supplyData);
    }

    // 3. Borrow all assets
    for (const borrowAsset of borrowAssets) {
      if (!borrowAsset.asset || borrowAsset.asset === '0x0000000000000000000000000000000000000000') {
        throw new Error(`Invalid borrow asset address: ${borrowAsset.asset}`);
      }
      const borrowData = encodeFunctionData({
        abi: AAVE_ROUTER_ABI,
        functionName: 'callBorrow',
        args: [predictedAddress, borrowAsset.asset, borrowAsset.amount, BigInt(borrowAsset.interestRateMode), address],
      });
      multicallData.push(borrowData);
    }

    // Execute multicall
    return writeContract({
      address: getAaveRouterAddress(ChainId.SEPOLIA), // Default to Sepolia for now
      abi: AAVE_ROUTER_ABI,
      functionName: 'multicall',
      args: [multicallData],
    });
  };

  return {
    createPosition,
    isPending,
    error,
  };
}

// Hook to get user's token balances
export function useTokenBalances() {
  const { address } = useAccount();
  const chainId = ChainId.SEPOLIA; // Default to Sepolia for now

  // Get token contracts for supported tokens on current chain
  const tokenContracts = Object.entries(SUPPORTED_TOKENS)
    .filter(([, token]) => token.addresses[chainId]) // Only include tokens available on current chain
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

  return {
    tokenBalances,
    isLoading,
  };
}

// Hook to get user position summary
export function useUserPositionSummary(): UserPositionSummary {
  const { positions } = useUserDebtPositions();

  return useMemo(() => {
    if (!positions || positions.length === 0) {
      return {
        totalPositions: 0,
        totalDebtValue: 0,
        totalCollateralValue: 0,
        averageHealthFactor: 0,
        positionsAtRisk: 0,
      };
    }

    const totalDebtValue = positions.reduce((sum, pos) => {
      return sum + pos.debts.reduce((debtSum, debt) => debtSum + debt.valueInUSD, 0);
    }, 0);

    const totalCollateralValue = positions.reduce((sum, pos) => {
      return sum + pos.collaterals.reduce((collSum, coll) => collSum + coll.valueInUSD, 0);
    }, 0);

    const averageHealthFactor =
      positions.reduce((sum, pos) => {
        return sum + Number(formatUnits(pos.healthFactor, 18));
      }, 0) / positions.length;

    const positionsAtRisk = positions.filter(pos => {
      const hf = Number(formatUnits(pos.healthFactor, 18));
      return hf < 1.5 && hf > 1.0; // At risk but not liquidated
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

// Utility function to format health factor
export function formatHealthFactor(healthFactor: bigint) {
  const hf = Number(formatUnits(healthFactor, 18));

  if (hf === 0) return { value: 0, status: 'liquidation' as const, color: 'red', label: 'Liquidated' };
  if (hf < 1.0) return { value: hf, status: 'liquidation' as const, color: 'red', label: 'Liquidation' };
  if (hf < 1.5) return { value: hf, status: 'danger' as const, color: 'red', label: 'High Risk' };
  if (hf < 2.0) return { value: hf, status: 'warning' as const, color: 'yellow', label: 'Warning' };

  return { value: hf, status: 'safe' as const, color: 'green', label: 'Safe' };
}
