import { useEffect, useState } from "react";
import { Address } from "viem";
import { useAccount, useChainId } from "wagmi";
import { orderApiService } from "../utils/order-api";

export interface OrderHistoryItem {
  id: string;
  orderType: "FULL" | "PARTIAL";
  status: "EXECUTED" | "CANCELLED" | "EXPIRED";
  seller: Address;
  buyer?: Address;
  usdValue?: string;
  usdBonus?: string;
  userRole: "BUYER" | "SELLER";
  userEarning?: number; // For buyers: usdBonus, For sellers: saving calculation
  createdAt: Date;
  executedAt?: Date;
  cancelledAt?: Date;
  // Order details
  debtAddress: Address;
  triggerHF: string;
  // Full order specific
  bonus?: number; // basis points
  paymentToken?: Address;
  // Partial order specific
  repayToken?: Address;
  repayAmount?: string;
  collateralToken?: Address;
}

export interface UseOrderHistoryReturn {
  orders: OrderHistoryItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useOrderHistory(): UseOrderHistoryReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrderHistory = async () => {
    if (!isConnected || !address) {
      setOrders([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch orders where user is seller (non-active statuses)
      const [
        sellerExecutedResponse,
        sellerCancelledResponse,
        sellerExpiredResponse,
      ] = await Promise.all([
        orderApiService.getOrders({
          seller: address,
          chainId,
          status: "EXECUTED",
          limit: 100,
        }),
        orderApiService.getOrders({
          seller: address,
          chainId,
          status: "CANCELLED",
          limit: 100,
        }),
        orderApiService.getOrders({
          seller: address,
          chainId,
          status: "EXPIRED",
          limit: 100,
        }),
      ]);

      // For buyer orders, we need to fetch all executed orders and filter by buyer
      // Since the API doesn't support buyer filter, we'll get all executed orders
      const allExecutedResponse = await orderApiService.getOrders({
        chainId,
        status: "EXECUTED",
        limit: 100,
      });

      const convertedOrders: OrderHistoryItem[] = [];

      // Process seller orders from all responses
      const sellerResponses = [
        sellerExecutedResponse,
        sellerCancelledResponse,
        sellerExpiredResponse,
      ];
      for (const response of sellerResponses) {
        if (response.orders) {
          for (const order of response.orders) {
            const historyItem = convertToHistoryItem(order, "SELLER");
            if (historyItem) {
              convertedOrders.push(historyItem);
            }
          }
        }
      }

      // Process buyer orders (filter from all executed orders)
      if (allExecutedResponse.orders) {
        for (const order of allExecutedResponse.orders) {
          // Check if user is the buyer and not already added as seller
          if (order.buyer?.toLowerCase() === address.toLowerCase()) {
            const existingOrder = convertedOrders.find(
              (o) => o.id === order.id
            );
            if (!existingOrder) {
              const historyItem = convertToHistoryItem(order, "BUYER");
              if (historyItem) {
                convertedOrders.push(historyItem);
              }
            }
          }
        }
      }

      // Sort by most recent first
      convertedOrders.sort((a, b) => {
        const dateA = a.executedAt || a.cancelledAt || a.createdAt;
        const dateB = b.executedAt || b.cancelledAt || b.createdAt;
        return dateB.getTime() - dateA.getTime();
      });

      setOrders(convertedOrders);
    } catch (err) {
      console.error("❌ useOrderHistory: Failed to fetch order history:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load order history"
      );
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderHistory();
  }, [address, isConnected, chainId]);

  return { orders, isLoading, error, refetch: fetchOrderHistory };
}

// Helper function to convert backend order to history item
function convertToHistoryItem(
  backendOrder: any,
  userRole: "BUYER" | "SELLER"
): OrderHistoryItem | null {
  try {
    const status = backendOrder.status?.toUpperCase() as
      | "EXECUTED"
      | "CANCELLED"
      | "EXPIRED";

    // Orders are already filtered by non-active status in the API calls

    const baseItem: OrderHistoryItem = {
      id: backendOrder.id,
      orderType: backendOrder.orderType,
      status,
      seller: backendOrder.seller as Address,
      buyer: backendOrder.buyer as Address,
      usdValue: backendOrder.usdValue,
      usdBonus: backendOrder.usdBonus,
      userRole,
      createdAt: new Date(backendOrder.createdAt),
      debtAddress: backendOrder.debtAddress as Address,
      triggerHF: backendOrder.triggerHF,
    };

    // Add execution/cancellation dates
    if (status === "EXECUTED" && backendOrder.updatedAt) {
      baseItem.executedAt = new Date(backendOrder.updatedAt);
    }
    if (status === "CANCELLED" && backendOrder.cancelledAt) {
      baseItem.cancelledAt = new Date(backendOrder.cancelledAt);
    }

    // Calculate user earning based on role
    if (userRole === "BUYER" && backendOrder.usdBonus) {
      // For buyers: usdBonus is their earning
      baseItem.userEarning = parseFloat(backendOrder.usdBonus);
    } else if (userRole === "SELLER" && backendOrder.usdBonus) {
      // For sellers: saving = (max liquidation penalty % - configured bonus %) * usdValue
      // Max liquidation penalty is 5%, configured bonus is also 5%, so saving = 0
      const maxLiquidationPenalty = 0.05; // 5% max liquidation penalty

      // Get configured bonus percentage from order data
      let configuredBonusPercentage = 0.05; // Default 5%
      if (backendOrder.bonus) {
        configuredBonusPercentage = parseInt(backendOrder.bonus) / 10000;
      } else if (backendOrder.fullSellOrder?.bonus) {
        configuredBonusPercentage =
          parseInt(backendOrder.fullSellOrder.bonus) / 10000;
      } else if (backendOrder.partialSellOrder?.bonus) {
        configuredBonusPercentage =
          parseInt(backendOrder.partialSellOrder.bonus) / 10000;
      }

      const usdValue = parseFloat(backendOrder.usdValue || "0");
      const savingPercentage =
        maxLiquidationPenalty - configuredBonusPercentage;
      const saving = usdValue * savingPercentage;

      baseItem.userEarning = saving > 0 ? saving : 0;
    }

    // Add order type specific details
    if (backendOrder.orderType === "FULL" && backendOrder.fullSellOrder) {
      const fullOrder = backendOrder.fullSellOrder;
      baseItem.bonus = fullOrder.bonus ? parseInt(fullOrder.bonus) : 0;
      baseItem.paymentToken = fullOrder.token as Address;
    } else if (
      backendOrder.orderType === "PARTIAL" &&
      backendOrder.partialSellOrder
    ) {
      const partialOrder = backendOrder.partialSellOrder;
      baseItem.bonus = partialOrder.bonus ? parseInt(partialOrder.bonus) : 0;
      baseItem.repayToken = partialOrder.repayToken as Address;
      baseItem.repayAmount = partialOrder.repayAmount;
      baseItem.collateralToken = partialOrder.collateralOut as Address;
    }

    return baseItem;
  } catch (error) {
    console.error("Error converting order to history item:", error);
    return null;
  }
}
