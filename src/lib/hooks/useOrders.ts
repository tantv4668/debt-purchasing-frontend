import { useEffect, useState } from "react";
import { Address } from "viem";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { MarketOrder, UserOrdersSummary, UserSellOrder } from "../types";
import { toPreciseWei } from "../utils";
import { orderApiService } from "../utils/order-api";
import { signCancelOrderMessage } from "../utils/order-signing";
import { formatTokenData, tokenPriceService } from "../utils/token-helpers";

// Convert backend order to frontend MarketOrder format (for market view)
const convertBackendOrderToMarketOrder = async (
  backendOrder: any,
  tokenPrices: Record<string, number>,
  chainId: number
): Promise<MarketOrder | null> => {
  try {
    const type = backendOrder.orderType === "FULL" ? "full" : "partial";

    // Parse health factor from string (in wei) to number
    const triggerHealthFactor = parseFloat(backendOrder.triggerHF) / 1e18;

    // Use debt position data directly from the order response
    const debtPositionData = backendOrder.debtPosition;
    let realCurrentHealthFactor = triggerHealthFactor;

    if (debtPositionData?.healthFactor) {
      realCurrentHealthFactor =
        parseFloat(debtPositionData.healthFactor) / 1e18;
    }

    // Format collaterals and debts using shared helper
    const { formattedTokens: collaterals, totalUSD: totalCollateralUSD } =
      formatTokenData(
        debtPositionData?.collaterals || [],
        chainId,
        tokenPrices,
        "collateral"
      );

    const { formattedTokens: debts, totalUSD: totalDebtUSD } = formatTokenData(
      debtPositionData?.debts || [],
      chainId,
      tokenPrices,
      "debt"
    );

    const baseOrder = {
      id: backendOrder.id,
      seller: backendOrder.seller as Address,
      type,
      triggerHealthFactor,
      currentHealthFactor: realCurrentHealthFactor,
      validUntil: new Date(backendOrder.endTime),
      isActive: realCurrentHealthFactor <= triggerHealthFactor,
      canExecuteReason:
        realCurrentHealthFactor <= triggerHealthFactor
          ? "YES"
          : `NO - HF too high (${realCurrentHealthFactor.toFixed(3)} > ${triggerHealthFactor.toFixed(3)})`,
      debtPosition: {
        address: backendOrder.debtAddress as Address,
        owner: debtPositionData?.owner || (backendOrder.seller as Address),
        nonce: BigInt(backendOrder.debtNonce || 0),
        totalCollateralBase: toPreciseWei(totalCollateralUSD), // Precise conversion to bigint with 18 decimals
        totalDebtBase: toPreciseWei(totalDebtUSD), // Precise conversion to bigint with 18 decimals
        availableBorrowsBase: BigInt(0),
        currentLiquidationThreshold: BigInt(8500),
        ltv: BigInt(8000),
        healthFactor: debtPositionData?.healthFactor
          ? BigInt(debtPositionData.healthFactor)
          : BigInt(Math.floor(realCurrentHealthFactor * 1e18)),
        collaterals,
        debts,
      },
    };

    if (type === "full") {
      const fullOrder = backendOrder.fullSellOrder;
      if (!fullOrder) {
        throw new Error(
          `Full sell order data missing for order ${backendOrder.id}`
        );
      }

      const netEquity = totalCollateralUSD - totalDebtUSD;
      const sellerPercentageBasisPoints = parseInt(fullOrder.percentOfEquity);
      const buyerPercentageBasisPoints = 10000 - sellerPercentageBasisPoints;
      const estimatedProfit = (netEquity * buyerPercentageBasisPoints) / 10000;

      return {
        ...baseOrder,
        type: "full",
        percentOfEquity: parseInt(fullOrder.percentOfEquity) / 100,
        paymentToken: fullOrder.token as Address,
        estimatedProfit: toPreciseWei(estimatedProfit), // Precise conversion to bigint with 18 decimals
      };
    } else {
      const partialOrder = backendOrder.partialSellOrder;
      if (!partialOrder) {
        throw new Error(
          `Partial sell order data missing for order ${backendOrder.id}`
        );
      }

      const repayAmount = BigInt(partialOrder.repayAmount);
      const bonusBasisPoints = parseInt(partialOrder.bonus);
      const bonusPercentage = parseInt(partialOrder.bonus) / 100;
      // Simple calculation: repay amount * bonus percentage
      const repayAmountNumber = parseFloat(partialOrder.repayAmount);
      const estimatedProfitUSD = (repayAmountNumber * bonusBasisPoints) / 10000;

      return {
        ...baseOrder,
        type: "partial",
        repayToken: partialOrder.repayToken as Address,
        repayAmount,
        bonus: bonusPercentage,
        collateralTokens: partialOrder.collateralOut as Address[],
        estimatedProfit: toPreciseWei(estimatedProfitUSD), // Precise conversion to bigint with 18 decimals
      };
    }
  } catch (error) {
    console.error("Error converting order to MarketOrder:", error);
    return null;
  }
};

// Convert backend order to frontend UserSellOrder format (for user orders view)
const convertBackendOrderToUserSellOrder = (
  backendOrder: any
): UserSellOrder => {
  const type = backendOrder.orderType === "FULL" ? "full" : "partial";
  const status = backendOrder.status.toLowerCase() as
    | "active"
    | "expired"
    | "executed"
    | "cancelled";

  // Use health factor from debt position data if available, otherwise fallback
  const debtPositionData = backendOrder.debtPosition;
  let currentHF = backendOrder.triggerHF; // Default fallback

  if (debtPositionData?.healthFactor) {
    currentHF = debtPositionData.healthFactor;
  } else if (backendOrder.currentHF) {
    currentHF = backendOrder.currentHF;
  }

  const baseOrder = {
    id: backendOrder.id,
    debtAddress: backendOrder.debtAddress as Address,
    type,
    status,
    createdAt: new Date(backendOrder.createdAt),
    validUntil: new Date(backendOrder.endTime),
    triggerHealthFactor: parseFloat(backendOrder.triggerHF) / 1e18, // Convert from wei
    currentHealthFactor: parseFloat(currentHF) / 1e18, // Convert from wei
    canExecute: backendOrder.canExecute || "NO", // Backend's execution status
  };

  if (type === "full") {
    const fullOrder = backendOrder.fullSellOrder;

    if (fullOrder) {
      return {
        ...baseOrder,
        type: "full",
        percentOfEquity: parseInt(fullOrder.percentOfEquity) / 100, // Convert from basis points
        paymentToken: fullOrder.token as Address,
      };
    } else {
      console.warn(
        "Full sell order missing nested data for order:",
        backendOrder.id
      );
      return {
        ...baseOrder,
        type: "full",
        percentOfEquity: 0,
        paymentToken: "0x0000000000000000000000000000000000000000" as Address,
      };
    }
  } else {
    const partialOrder = backendOrder.partialSellOrder;

    if (partialOrder) {
      return {
        ...baseOrder,
        type: "partial",
        repayToken: partialOrder.repayToken as Address,
        repayAmount: BigInt(partialOrder.repayAmount),
        bonus: parseInt(partialOrder.bonus) / 100, // Convert from basis points
        collateralToken: partialOrder.collateralOut as Address,
      };
    } else {
      console.warn(
        "Partial sell order missing nested data for order:",
        backendOrder.id
      );
      return {
        ...baseOrder,
        type: "partial",
        repayToken: "0x0000000000000000000000000000000000000000" as Address,
        repayAmount: BigInt(0),
        bonus: 0,
        collateralToken:
          "0x0000000000000000000000000000000000000000" as Address,
      };
    }
  }
};

// Hook for market orders (all active orders for browsing/purchasing)
export function useMarketOrders() {
  const chainId = useChainId();
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMarketOrders = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch token prices using shared service
      const tokenPrices = await tokenPriceService.getPrices();

      // Fetch all active orders
      const response = await orderApiService.getOrders({
        chainId,
        status: "ACTIVE",
        limit: 100,
      });

      if (!response.orders || response.orders.length === 0) {
        setError("No orders available at the moment.");
        setOrders([]);
        return;
      }

      const convertedOrdersPromises = response.orders.map((order) =>
        convertBackendOrderToMarketOrder(order, tokenPrices, chainId)
      );

      const convertedOrders = (
        await Promise.all(convertedOrdersPromises)
      ).filter((order): order is MarketOrder => order !== null);

      setOrders(convertedOrders);

      if (convertedOrders.length === 0 && response.orders.length > 0) {
        setError("Unable to process order data.");
      }
    } catch (err) {
      console.error("Failed to fetch market orders:", err);
      setError(
        "Unable to connect to the server. Please check your connection and try again."
      );
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketOrders();

    // Refresh orders every 30 seconds to check for health factor changes
    const interval = setInterval(fetchMarketOrders, 30000);
    return () => clearInterval(interval);
  }, [chainId]);

  return { orders, isLoading, error, refetch: fetchMarketOrders };
}

// Hook for user orders (orders created by the connected user)
export function useUserOrders() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [orders, setOrders] = useState<UserSellOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!isConnected || !address) {
      setOrders([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await orderApiService.getOrders({
        seller: address,
        chainId,
        limit: 50, // Fetch more orders for user
      });

      const convertedOrders = response.orders.map(
        convertBackendOrderToUserSellOrder
      );
      setOrders(convertedOrders);
    } catch (err) {
      console.error("Failed to fetch user orders:", err);
      setError(err instanceof Error ? err.message : "Failed to load orders");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [address, isConnected, chainId]);

  return { orders, isLoading, error, refetch: fetchOrders };
}

// Hook for user orders summary
export function useUserOrdersSummary(): UserOrdersSummary {
  const { orders } = useUserOrders();

  const summary = {
    totalOrders: orders.length,
    activeOrders: orders.filter((order) => order.status === "active").length,
    expiredOrders: orders.filter((order) => order.status === "expired").length,
    executedOrders: orders.filter((order) => order.status === "executed")
      .length,
    totalPotentialValue: 0, // Would calculate based on position values
  };

  return summary;
}

// Hook for order actions (cancel, create)
export function useOrderActions() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const cancelOrder = async (orderId: string) => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    if (!walletClient) {
      throw new Error("Wallet client not available");
    }

    console.log("🔄 useOrderActions.cancelOrder called:", { orderId, address });

    try {
      // Sign the cancel message
      const { message, signature } = await signCancelOrderMessage(
        orderId,
        walletClient
      );

      const cancelRequest = {
        seller: address,
        message,
        signature,
      };

      const result = await orderApiService.cancelOrder(orderId, cancelRequest);
      console.log("📥 cancelOrder API result:", result);

      if (!result.success) {
        console.error("❌ API returned error:", result.error);
        throw new Error(result.error || "Failed to cancel order");
      }

      console.log("✅ Order cancelled successfully:", result.message);
      return result;
    } catch (error) {
      console.error("❌ useOrderActions.cancelOrder error:", error);
      throw error;
    }
  };

  const createSellOrder = async (orderData: Partial<UserSellOrder>) => {
    console.log("Creating sell order:", orderData);
    throw new Error("Create sell order moved to modal implementation");
  };

  return {
    cancelOrder,
    createSellOrder,
  };
}
