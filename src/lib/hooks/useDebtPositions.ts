import { useEffect, useMemo, useState } from "react";
import { encodeFunctionData, formatUnits } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { AAVE_ROUTER_ABI, ERC20_ABI, getAaveRouterAddress } from "../contracts";
import { CONTRACT_DEFAULTS } from "../contracts/config";
import { SUPPORTED_TOKENS } from "../contracts/tokens";
import type {
  CreatePositionParams,
  DebtPosition,
  UserPositionSummary,
} from "../types/debt-position";
import { toPreciseWei } from "../utils";
import { validateWalletConnection } from "../utils/contract-helpers";
import { logger } from "../utils/logger";
import {
  getSubgraphClient,
  isSubgraphSupported,
} from "../utils/subgraph-client";
import { formatTokenData, tokenPriceService } from "../utils/token-helpers";

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
      logger.info(
        "Fetching user debt positions from backend API for:",
        address,
        `limit: ${limit}, offset: ${offset}`
      );

      // Fetch token prices using shared service
      const tokenPrices = await tokenPriceService.getPrices();

      const subgraphClient = getSubgraphClient(chainId);
      const cachedData = await subgraphClient.getCachedPositions(
        address.toLowerCase(),
        limit,
        offset
      );

      if (
        !cachedData ||
        !cachedData.positions ||
        cachedData.positions.length === 0
      ) {
        logger.info("No positions found for user");
        setPositions([]);
        setTotal(cachedData?.total || 0);
        return;
      }

      setTotal(cachedData.total || cachedData.positions.length);

      const formattedPositions: DebtPosition[] = cachedData.positions.map(
        (position: any) => {
          // Format collaterals and debts using shared helper
          const { formattedTokens: collaterals, totalUSD: totalCollateralUSD } =
            formatTokenData(
              position.collaterals,
              chainId,
              tokenPrices,
              "collateral"
            );

          const { formattedTokens: debts, totalUSD: totalDebtUSD } =
            formatTokenData(position.debts, chainId, tokenPrices, "debt");

          // Use health factor directly from backend (it's already in wei format)
          const healthFactor = position.healthFactor || "1000000000000000000"; // Default to 1.0 if not provided

          return {
            address: position.id as `0x${string}`,
            owner: address,
            nonce: parseInt(position.nonce || "0"), // Map nonce from backend data
            totalPositions: parseInt(position.totalPositions || "0"),
            totalCollateralBase: toPreciseWei(totalCollateralUSD), // Precise conversion to bigint with 18 decimals
            totalDebtBase: toPreciseWei(totalDebtUSD), // Precise conversion to bigint with 18 decimals
            availableBorrowsBase: toPreciseWei(
              Math.max(0, totalCollateralUSD * 0.8 - totalDebtUSD) // 80% LTV minus current debt
            ),
            currentLiquidationThreshold: BigInt(Math.floor(0.85 * 1e18)), // 85%
            ltv: BigInt(Math.floor(0.8 * 1e18)), // 80%
            healthFactor: BigInt(healthFactor), // Use backend's health factor directly
            collaterals,
            debts,
            createdAt: position.blockchainCreatedAt
              ? new Date(position.blockchainCreatedAt).getTime()
              : new Date(position.createdAt).getTime(), // Use blockchain time if available, fallback to MongoDB time
            lastUpdated: position.blockchainUpdatedAt
              ? new Date(position.blockchainUpdatedAt).getTime()
              : new Date(position.updatedAt).getTime(),
          };
        }
      );

      setPositions(formattedPositions);
      logger.info(
        `Successfully loaded ${formattedPositions.length} debt positions from subgraph`
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to fetch positions from subgraph";
      logger.error("Error fetching debt positions from subgraph:", err);
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/cache/refresh`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!response.ok) throw new Error("Cache refresh failed");
    } catch (error) {
      console.warn("Cache refresh failed:", error);
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

  return {
    positions,
    total,
    isLoading,
    error,
    refetch: fetchPositions,
    refetchWithCacheRefresh,
  };
}

// Hook to predict debt address for new position
export function usePredictDebtAddress() {
  const { address } = useAccount();

  const { data: predictedAddress, isLoading } = useReadContract({
    address: getAaveRouterAddress(CONTRACT_DEFAULTS.CHAIN_ID),
    abi: AAVE_ROUTER_ABI,
    functionName: "predictDebtAddress",
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
      throw new Error("Predicted address not available");
    }

    const { collateralAssets, borrowAssets } = params;

    // Validate inputs
    if (!collateralAssets?.length) {
      throw new Error("At least one collateral asset is required");
    }
    if (!borrowAssets?.length) {
      throw new Error("At least one borrow asset is required");
    }

    // Prepare multicall data
    const multicallData: `0x${string}`[] = [];

    // 1. Create debt position
    multicallData.push(
      encodeFunctionData({
        abi: AAVE_ROUTER_ABI,
        functionName: "createDebt",
        args: [],
      })
    );

    // 2. Supply all collateral assets
    for (const collateral of collateralAssets) {
      if (
        !collateral.asset ||
        collateral.asset === CONTRACT_DEFAULTS.ZERO_ADDRESS
      ) {
        throw new Error(
          `Invalid collateral asset address: ${collateral.asset}`
        );
      }
      multicallData.push(
        encodeFunctionData({
          abi: AAVE_ROUTER_ABI,
          functionName: "callSupply",
          args: [predictedAddress, collateral.asset, collateral.amount],
        })
      );
    }

    // 3. Borrow all assets
    for (const borrowAsset of borrowAssets) {
      if (
        !borrowAsset.asset ||
        borrowAsset.asset === CONTRACT_DEFAULTS.ZERO_ADDRESS
      ) {
        throw new Error(`Invalid borrow asset address: ${borrowAsset.asset}`);
      }
      multicallData.push(
        encodeFunctionData({
          abi: AAVE_ROUTER_ABI,
          functionName: "callBorrow",
          args: [
            predictedAddress,
            borrowAsset.asset,
            borrowAsset.amount,
            BigInt(borrowAsset.interestRateMode),
            userAddress,
          ],
        })
      );
    }

    // Execute multicall
    const txHash = await writeContractAsync({
      address: getAaveRouterAddress(CONTRACT_DEFAULTS.CHAIN_ID),
      abi: AAVE_ROUTER_ABI,
      functionName: "multicall",
      args: [multicallData],
    });

    logger.info("Position creation transaction submitted:", txHash);
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
      functionName: "balanceOf" as const,
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
      return (
        sum +
        Number(
          formatUnits(
            pos.totalDebtBase,
            CONTRACT_DEFAULTS.HEALTH_FACTOR_DECIMALS
          )
        )
      );
    }, 0);

    const totalCollateralValue = positions.reduce((sum, pos) => {
      return (
        sum +
        Number(
          formatUnits(
            pos.totalCollateralBase,
            CONTRACT_DEFAULTS.HEALTH_FACTOR_DECIMALS
          )
        )
      );
    }, 0);

    const totalHealthFactor = positions.reduce((sum, pos) => {
      return (
        sum +
        Number(
          formatUnits(
            pos.healthFactor,
            CONTRACT_DEFAULTS.HEALTH_FACTOR_DECIMALS
          )
        )
      );
    }, 0);

    const averageHealthFactor = totalHealthFactor / positions.length;
    const positionsAtRisk = positions.filter((pos) => {
      const hf = Number(
        formatUnits(pos.healthFactor, CONTRACT_DEFAULTS.HEALTH_FACTOR_DECIMALS)
      );
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
  const value = Number(
    formatUnits(healthFactor, CONTRACT_DEFAULTS.HEALTH_FACTOR_DECIMALS)
  );

  let status: "safe" | "warning" | "danger" | "liquidation";
  let color: string;
  let label: string;

  if (value >= 2) {
    status = "safe";
    color = "#10B981"; // green
    label = "Safe";
  } else if (value >= 1.5) {
    status = "warning";
    color = "#F59E0B"; // yellow
    label = "Warning";
  } else if (value >= 1) {
    status = "danger";
    color = "#EF4444"; // red
    label = "Danger";
  } else {
    status = "liquidation";
    color = "#DC2626"; // dark red
    label = "Liquidation";
  }

  return { value, status, color, label };
}
