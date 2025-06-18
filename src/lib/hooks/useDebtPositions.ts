import { useMemo } from 'react';
import { encodeAbiParameters, encodeFunctionData, formatUnits, keccak256 } from 'viem';
import { useAccount, useReadContract, useReadContracts, useWriteContract } from 'wagmi';
import { AAVE_ROUTER_ABI, ChainId, ERC20_ABI, getAaveRouterAddress } from '../contracts';
import { SUPPORTED_TOKENS } from '../contracts/tokens';
import type { CreatePositionParams, DebtPosition, UserPositionSummary } from '../types/debt-position';

// Hook to get user's debt positions
export function useUserDebtPositions() {
  const { address } = useAccount();
  const routerAddress = getAaveRouterAddress(ChainId.SEPOLIA);

  const { data: userNonce } = useReadContract({
    address: routerAddress,
    abi: AAVE_ROUTER_ABI,
    functionName: 'userNonces',
    args: address ? [address] : undefined,
  });

  // Calculate predicted addresses for all user's potential positions (following AaveRouter.sol logic)
  const predictedAddresses = useMemo(() => {
    if (!address || !userNonce || Number(userNonce) === 0) return [];

    const addresses: `0x${string}`[] = [];

    // For each nonce from 0 to current nonce-1, calculate the predicted address
    for (let i = 0; i < Number(userNonce); i++) {
      // Following AaveRouter.sol: bytes32 salt = keccak256(abi.encodePacked(user, userNonces[user]));
      const salt = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [address, BigInt(i)]));

      // This would require knowing the aaveDebtImplementation address
      // For now, we'll use the read contract to get each predicted address
      // In a real implementation, you'd want to batch these calls or use events
    }

    return addresses;
  }, [address, userNonce]);

  // TODO: Implement logic to fetch actual debt positions by checking ownership
  // This would involve:
  // 1. For each predicted address, check if debtOwners[address] == user
  // 2. If yes, fetch Aave account data for that position
  // 3. Get token balances and metadata

  return {
    positions: [] as DebtPosition[],
    isLoading: false,
    error: null,
    refetch: () => {},
  };
}

// Hook to predict debt address for new position (follows AaveRouter.sol logic)
export function usePredictDebtAddress() {
  const { address } = useAccount();

  const { data: predictedAddress, isLoading } = useReadContract({
    address: getAaveRouterAddress(ChainId.SEPOLIA),
    abi: AAVE_ROUTER_ABI,
    functionName: 'predictDebtAddress',
    args: address ? [address] : undefined,
  });

  return {
    predictedAddress,
    isLoading,
  };
}

// Hook to create position with multicall (following the test pattern)
export function useCreatePosition() {
  const { writeContractAsync, isPending, error } = useWriteContract();
  const { address } = useAccount();
  const { predictedAddress } = usePredictDebtAddress();

  const createPosition = async (params: CreatePositionParams) => {
    if (!address || !predictedAddress) {
      throw new Error('Address or predicted address not available');
    }

    const { collateralAssets, borrowAssets } = params;

    // Validate inputs
    if (!collateralAssets || collateralAssets.length === 0) {
      throw new Error('At least one collateral asset is required');
    }
    if (!borrowAssets || borrowAssets.length === 0) {
      throw new Error('At least one borrow asset is required');
    }

    // Prepare multicall data (following testCreateSupplyBorrowInSingleTx pattern)
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

    // 3. Borrow all assets (to user's address as in the test)
    for (const borrowAsset of borrowAssets) {
      if (!borrowAsset.asset || borrowAsset.asset === '0x0000000000000000000000000000000000000000') {
        throw new Error(`Invalid borrow asset address: ${borrowAsset.asset}`);
      }
      const borrowData = encodeFunctionData({
        abi: AAVE_ROUTER_ABI,
        functionName: 'callBorrow',
        args: [
          predictedAddress,
          borrowAsset.asset,
          borrowAsset.amount,
          BigInt(borrowAsset.interestRateMode),
          address, // receiver (following test pattern)
        ],
      });
      multicallData.push(borrowData);
    }

    // Execute multicall and wait for confirmation
    const txHash = await writeContractAsync({
      address: getAaveRouterAddress(ChainId.SEPOLIA),
      abi: AAVE_ROUTER_ABI,
      functionName: 'multicall',
      args: [multicallData],
    });

    return txHash;
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
  const chainId = ChainId.SEPOLIA;

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
      return hf < 1.5 && hf > 1.0;
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
