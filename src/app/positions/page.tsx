"use client";

import {
  formatHealthFactor,
  formatPreciseHealthFactor,
  formatPreciseNumber,
  formatTimeRemaining,
  truncateAddress,
} from "@/lib/utils";
import { useEffect, useState } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import CreateDebtModal from "../../components/CreateDebtModal";
import CreateSellOrderModal from "../../components/CreateSellOrderModal";
import ManagePositionModal from "../../components/ManagePositionModal";
import Tooltip from "../../components/Tooltip";
import ImportantNotesWarning from "../../components/ImportantNotesWarning";
import {
  useUserDebtPositions,
  useUserPositionSummary,
} from "../../lib/hooks/useDebtPositions";
import { useLiquidationThresholds } from "../../lib/hooks/useLiquidationThresholds";
import {
  useOrderActions,
  useUserOrders,
  useUserOrdersSummary,
} from "../../lib/hooks/useOrders";
import { useOrderHistory } from "../../lib/hooks/useOrderHistory";
import { useOrderCancellation } from "@/lib/hooks/useOrderCancellation";
import { Address } from "viem";
import { usePriceTokens } from "../../lib/hooks/usePriceTokens";
import {
  CreateFullSellOrderParams,
  CreatePartialSellOrderParams,
  UserSellOrder,
} from "../../lib/types";
import { createOrderService } from "../../lib/utils/create-order";
import ConfirmationModal from "../../components/ConfirmationModal";
import TransactionConfirmationPopup from "../../components/TransactionConfirmationPopup";

// Component to calculate and display health factor for a single position
function PositionHealthFactor({ position }: { position: any }) {
  // Use health factor directly from backend data (already in wei format)
  const healthFactorValue = formatHealthFactor(position.healthFactor);

  // Determine color and status based on health factor value
  const getHealthFactorDisplay = (value: number) => {
    if (value >= 2) {
      return {
        color: "text-green-600 dark:text-green-400",
        label: "Safe",
        status: "safe" as const,
      };
    } else if (value >= 1.5) {
      return {
        color: "text-yellow-600 dark:text-yellow-400",
        label: "Warning",
        status: "warning" as const,
      };
    } else if (value >= 1) {
      return {
        color: "text-red-600 dark:text-red-400",
        label: "Danger",
        status: "danger" as const,
      };
    } else {
      return {
        color: "text-red-800 dark:text-red-300",
        label: "Liquidation Risk",
        status: "liquidation" as const,
      };
    }
  };

  const { color, label } = getHealthFactorDisplay(healthFactorValue);

  // Calculate collateral and debt values for tooltip
  const totalCollateralValue = position.collaterals.reduce(
    (sum: number, collateral: any) => {
      return sum + (collateral.valueInUSD || 0);
    },
    0
  );

  const totalDebtValue = position.debts.reduce((sum: number, debt: any) => {
    return sum + (debt.valueInUSD || 0);
  }, 0);

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        Health Factor
        <Tooltip
          content="Health Factor measures position safety. HF = (Collateral Value × Liquidation Thresholds) ÷ Debt Value. Values below 1.0 risk liquidation."
          maxWidth="xl"
        >
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400 cursor-help"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        </Tooltip>
      </h4>
      <div
        className={`text-2xl font-bold mb-1 ${color} flex items-center gap-2`}
      >
        {healthFactorValue}
        <Tooltip
          content={`Current Health Factor: ${healthFactorValue}. Collateral: $${formatPreciseNumber(
            totalCollateralValue,
            2
          )}, Debt: $${formatPreciseNumber(totalDebtValue, 2)}`}
          maxWidth="lg"
        >
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400 cursor-help"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        </Tooltip>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
        {label}
        <Tooltip
          content={`${label}: ${
            healthFactorValue >= 2
              ? "Very safe position"
              : healthFactorValue >= 1.5
                ? "Moderately safe position"
                : healthFactorValue >= 1.1
                  ? "Risky position, monitor closely"
                  : "Critical - risk of liquidation"
          }`}
          maxWidth="lg"
        >
          <svg
            className="w-3 h-3 text-gray-500 dark:text-gray-400 cursor-help"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        </Tooltip>
      </div>
      <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
        LT: 85.0%
        <Tooltip
          content={`Liquidation Threshold: 85.0%. This is the weighted average percentage of collateral value that counts toward your health factor. Higher LT = safer assets.`}
          maxWidth="2xl"
        >
          <svg
            className="w-3 h-3 text-gray-500 dark:text-gray-400 cursor-help"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        </Tooltip>
      </div>
    </div>
  );
}

export default function PositionsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [isManagePositionModalOpen, setIsManagePositionModalOpen] =
    useState(false);
  const [selectedPositionForOrder, setSelectedPositionForOrder] =
    useState<any>(null);
  const [selectedPositionForManage, setSelectedPositionForManage] =
    useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    "positions" | "orders" | "history"
  >("positions");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(5);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Filter states for Active Orders tab
  const [positionFilter, setPositionFilter] = useState<string>(""); // Address filter
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>("all"); // "all", "full", "partial"

  // Cancel all orders confirmation modal state
  const [showCancelAllModal, setShowCancelAllModal] = useState(false);
  const [selectedPositionForCancel, setSelectedPositionForCancel] =
    useState<any>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();

  // Initialize contract-based order cancellation hook with popup support
  const [usePopupForCancellation, setUsePopupForCancellation] = useState(true);
  const {
    cancelOrder: cancelOrderContract,
    cancelAllOrders,
    isCancelling,
    transactionHash,
    isWaitingForReceipt,
    isSuccess,
    error: transactionError,
    transactionStatus,
  } = useOrderCancellation(!usePopupForCancellation); // Use full-screen overlay when popup disabled
  const {
    positions,
    total,
    isLoading: positionsLoading,
    error: positionsError,
    refetchWithCacheRefresh,
  } = useUserDebtPositions(pageSize, (currentPage - 1) * pageSize);
  const {
    orders,
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useUserOrders();
  const {
    orders: historyOrders,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useOrderHistory();
  const { cancelOrder } = useOrderActions();
  const positionSummary = useUserPositionSummary();
  const ordersSummary = useUserOrdersSummary();
  const {
    calculateUSDValueFromBigInt,
    formatUSDValue,
    isLoading: pricesLoading,
  } = usePriceTokens();

  const { isLoading: thresholdsLoading, error: thresholdsError } =
    useLiquidationThresholds();

  // Track initial loading completion
  useEffect(() => {
    if (
      !positionsLoading &&
      !ordersLoading &&
      !pricesLoading &&
      !thresholdsLoading &&
      !hasInitiallyLoaded
    ) {
      setHasInitiallyLoaded(true);
    }
  }, [
    positionsLoading,
    ordersLoading,
    pricesLoading,
    thresholdsLoading,
    hasInitiallyLoaded,
  ]);

  // Only show full-page loading on initial load
  const isInitialLoading =
    !hasInitiallyLoaded &&
    (positionsLoading || ordersLoading || pricesLoading || thresholdsLoading);
  const error = positionsError || ordersError || thresholdsError;

  const handleCreateSellOrder = (position: any) => {
    setSelectedPositionForOrder(position);
    setIsCreateOrderModalOpen(true);
  };

  const handleManagePosition = (position: any) => {
    setSelectedPositionForManage(position);
    setIsManagePositionModalOpen(true);
  };

  const handleCancelOrder = async (order: UserSellOrder) => {
    try {
      // Get full order details from backend to extract contract parameters
      const { orderApiService } = await import("../../lib/utils/order-api");
      const orderInfo = await orderApiService.getOrderById(order.id);

      if (!orderInfo) {
        throw new Error("Failed to get order details");
      }
      const orderData = {
        debt: order.debtAddress,
        debtNonce: orderInfo.debtNonce || 0,
        startTime: Math.floor(new Date(orderInfo.startTime).getTime() / 1000),
        endTime: Math.floor(new Date(orderInfo.endTime).getTime() / 1000),
        triggerHF: orderInfo.triggerHF,
      };

      await cancelOrderContract(orderData);
      // Refresh orders list
      await refetchOrders();
      console.log("✅ Order cancelled on-chain and list refreshed");
    } catch (error) {
      console.error("Failed to cancel order:", error);
      // You might want to show a toast notification here
    }
  };

  const handleCancelAllOrders = (position: any) => {
    setSelectedPositionForCancel(position);
    setShowCancelAllModal(true);
  };

  const handleConfirmCancelAllOrders = async () => {
    if (!selectedPositionForCancel) return;

    try {
      console.log(
        "🚫 Cancelling all orders for position:",
        selectedPositionForCancel.address
      );

      await cancelAllOrders(selectedPositionForCancel.address as Address);

      // Refresh both orders and positions
      await refetchOrders();
      await refetchWithCacheRefresh();

      console.log("✅ All orders cancelled successfully and data refreshed");

      // Close modal
      setShowCancelAllModal(false);
      setSelectedPositionForCancel(null);
    } catch (error) {
      console.error("❌ Failed to cancel all orders:", error);
      // Keep modal open to show error state
    }
  };

  const handleCloseCancelAllModal = () => {
    if (!isCancelling) {
      setShowCancelAllModal(false);
      setSelectedPositionForCancel(null);
    }
  };

  // Real order creation implementation
  const handleOrderCreation = async (
    params: CreateFullSellOrderParams | CreatePartialSellOrderParams
  ): Promise<void> => {
    if (!walletClient || !address) {
      throw new Error("Wallet not connected");
    }

    const orderServiceInstance = createOrderService({
      chainId,
      walletClient,
      seller: address,
    });

    try {
      if ("bonus" in params) {
        // This is a full sell order
        const result = await orderServiceInstance.createFullSellOrder(
          params as CreateFullSellOrderParams
        );
        console.log("✅ Full sell order created:", result);
      } else {
        // This is a partial sell order
        const result = await orderServiceInstance.createPartialSellOrder(
          params as CreatePartialSellOrderParams
        );
        console.log("✅ Partial sell order created:", result);
      }

      // Refresh orders list after successful creation
      await refetchOrders();

      // Also refresh positions in case summary stats changed
      await refetchWithCacheRefresh();
    } catch (error) {
      console.error("❌ Failed to create order:", error);
      throw error;
    }
  };

  const getOrderStatusBadge = (status: UserSellOrder["status"]) => {
    const colors = {
      active:
        "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
      expired: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
      executed: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
      cancelled:
        "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const calculateTotalValue = (assets: any[]) => {
    return assets.reduce((total, asset) => {
      const usdValue = calculateUSDValueFromBigInt(
        asset.balance,
        asset.symbol,
        asset.decimals
      );
      return total + usdValue;
    }, 0);
  };

  // Copy to clipboard function
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(text);
      // Clear copied state after 2 seconds
      setTimeout(() => {
        setCopiedAddress(null);
      }, 2000);
      console.log("✅ Address copied to clipboard:", text);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  };

  // Filter orders based on position and type
  const filteredOrders = orders.filter((order) => {
    const matchesPosition =
      positionFilter === "" ||
      order.debtAddress.toLowerCase().includes(positionFilter.toLowerCase());
    const matchesType =
      orderTypeFilter === "all" || order.type === orderTypeFilter;
    return matchesPosition && matchesType;
  });

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "calc(100vh - 4rem)" }}
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Connect Your Wallet
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Please connect your wallet to view your positions and orders.
            </p>
            <div className="flex justify-center mt-4">
              <appkit-button />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "calc(100vh - 4rem)" }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">
              Loading your positions and orders...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "calc(100vh - 4rem)" }}
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Error Loading Data
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Failed to load positions and orders. Please try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Positions & Orders
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Manage your debt positions and sell orders
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Create Position
          </button>
        </div>

        {/* Important Notes Warning */}
        <ImportantNotesWarning />

        {/* Subtle Loading Indicators - REMOVED to prevent screen jitter */}

        {/* Combined Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {/* Positions Cards */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Positions
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {positionSummary.totalPositions}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-800 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600 dark:text-blue-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  suppressHydrationWarning={true}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Debt
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${positionSummary.totalDebtValue.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-50 dark:bg-red-800 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-500 dark:text-red-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  suppressHydrationWarning={true}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Avg Health Factor
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatPreciseHealthFactor(
                    positionSummary.averageHealthFactor,
                    2
                  )}
                </p>
              </div>
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  positionSummary.averageHealthFactor > 2
                    ? "bg-green-50 dark:bg-green-800"
                    : positionSummary.averageHealthFactor > 1.5
                      ? "bg-yellow-50 dark:bg-yellow-800"
                      : "bg-red-50 dark:bg-red-800"
                }`}
              >
                <svg
                  className={`w-6 h-6 ${
                    positionSummary.averageHealthFactor > 2
                      ? "text-green-600 dark:text-green-300"
                      : positionSummary.averageHealthFactor > 1.5
                        ? "text-yellow-600 dark:text-yellow-300"
                        : "text-red-600 dark:text-red-300"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  suppressHydrationWarning={true}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Orders Cards */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Active Orders
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {ordersSummary.activeOrders}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-800 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-orange-600 dark:text-orange-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  suppressHydrationWarning={true}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Orders
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {ordersSummary.totalOrders}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-800 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600 dark:text-purple-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  suppressHydrationWarning={true}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => {
                  setActiveTab("positions");
                  setCurrentPage(1);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "positions"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                Debt Positions ({positionSummary.totalPositions})
              </button>
              <button
                onClick={() => {
                  setActiveTab("orders");
                  setCurrentPage(1);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "orders"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                Active Orders
              </button>
              <button
                onClick={() => {
                  setActiveTab("history");
                  setCurrentPage(1);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "history"
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                History ({historyOrders.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Positions Tab */}
            {activeTab === "positions" && (
              <div>
                {positions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-12 h-12 text-gray-400 dark:text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        suppressHydrationWarning={true}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Debt Positions
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
                      You haven&apos;t created any debt positions yet. Create
                      your first position to start leveraging your assets.
                    </p>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Create Your First Position
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Positions are already sorted by blockchainCreatedAt from backend */}
                    {positions.map((position, index) => {
                      const positionOrders = orders.filter(
                        (order) =>
                          order.debtAddress.toLowerCase() ===
                          position.address.toLowerCase()
                      );
                      const collateralValue = calculateTotalValue(
                        position.collaterals
                      );
                      const debtValue = calculateTotalValue(position.debts);

                      return (
                        <div
                          key={index}
                          className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                Position #
                                {(currentPage - 1) * pageSize + index + 1}
                              </h3>
                              <div className="flex items-center space-x-2">
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                                  {truncateAddress(position.address)}
                                </p>
                                <button
                                  onClick={() =>
                                    copyToClipboard(position.address)
                                  }
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    copiedAddress === position.address
                                      ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                      : "text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                  }`}
                                  title={
                                    copiedAddress === position.address
                                      ? "Copied!"
                                      : "Copy full address"
                                  }
                                >
                                  {copiedAddress === position.address ? (
                                    <>
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                      <span>Copied</span>
                                    </>
                                  ) : (
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                      />
                                    </svg>
                                  )}
                                </button>
                              </div>
                              {positionOrders.length > 0 && (
                                <div className="mt-2">
                                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                                    {positionOrders.length} active order
                                    {positionOrders.length > 1 ? "s" : ""}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                              Position
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            {/* Collateral */}
                            <div className="flex flex-col">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Collateral
                              </h4>
                              <div className="space-y-2 flex-1 flex flex-col justify-end">
                                {position.collaterals.map((collateral, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center"
                                  >
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                      {collateral.symbol}
                                    </span>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {collateral.balanceFormatted}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatUSDValue(
                                          calculateUSDValueFromBigInt(
                                            collateral.balance,
                                            collateral.symbol,
                                            collateral.decimals
                                          )
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Total
                                  </span>
                                  <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                    {formatUSDValue(collateralValue)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Debt */}
                            <div className="flex flex-col">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Debt
                              </h4>
                              <div className="space-y-2 flex-1 flex flex-col justify-end">
                                {position.debts.map((debt, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center"
                                  >
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                      {debt.symbol}
                                    </span>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {debt.balanceFormatted}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatUSDValue(
                                          calculateUSDValueFromBigInt(
                                            debt.balance,
                                            debt.symbol,
                                            debt.decimals
                                          )
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    Total
                                  </span>
                                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                                    {formatUSDValue(debtValue)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Health Factor */}
                            <div>
                              <PositionHealthFactor position={position} />
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="flex flex-wrap gap-3">
                              <button
                                onClick={() => handleCreateSellOrder(position)}
                                className="px-4 py-2 bg-orange-50 dark:bg-orange-900 text-orange-600 dark:text-orange-200 rounded-lg text-sm font-medium hover:bg-orange-100 dark:hover:bg-orange-800 transition-colors"
                              >
                                Create Sell Order
                              </button>
                              <button
                                onClick={() => handleManagePosition(position)}
                                className="px-4 py-2 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                              >
                                Manage Position
                              </button>
                              {positionOrders.length > 0 && (
                                <button
                                  onClick={() =>
                                    handleCancelAllOrders(position)
                                  }
                                  disabled={isCancelling}
                                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    isCancelling
                                      ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                      : "bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-800"
                                  }`}
                                >
                                  {isCancelling
                                    ? "Cancelling..."
                                    : "Cancel All Orders"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Pagination Controls */}
                    {positionSummary.totalPositions > pageSize && (
                      <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-600 pt-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                          <button
                            onClick={() =>
                              setCurrentPage((prev) => Math.max(prev - 1, 1))
                            }
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() =>
                              setCurrentPage((prev) =>
                                Math.min(
                                  prev + 1,
                                  Math.ceil(
                                    positionSummary.totalPositions / pageSize
                                  )
                                )
                              )
                            }
                            disabled={
                              currentPage ===
                              Math.ceil(
                                positionSummary.totalPositions / pageSize
                              )
                            }
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              Showing{" "}
                              <span className="font-medium">
                                {(currentPage - 1) * pageSize + 1}
                              </span>{" "}
                              to{" "}
                              <span className="font-medium">
                                {Math.min(
                                  currentPage * pageSize,
                                  positionSummary.totalPositions
                                )}
                              </span>{" "}
                              of{" "}
                              <span className="font-medium">
                                {positionSummary.totalPositions}
                              </span>{" "}
                              positions
                            </p>
                          </div>
                          <div>
                            <nav
                              className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                              aria-label="Pagination"
                            >
                              <button
                                onClick={() =>
                                  setCurrentPage((prev) =>
                                    Math.max(prev - 1, 1)
                                  )
                                }
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="sr-only">Previous</span>
                                <svg
                                  className="h-5 w-5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>

                              {/* Page numbers */}
                              {Array.from(
                                {
                                  length: Math.min(
                                    5,
                                    Math.ceil(
                                      positionSummary.totalPositions / pageSize
                                    )
                                  ),
                                },
                                (_, i) => {
                                  const totalPages = Math.ceil(
                                    positionSummary.totalPositions / pageSize
                                  );
                                  let pageNumber: number;

                                  if (totalPages <= 5) {
                                    pageNumber = i + 1;
                                  } else if (currentPage <= 3) {
                                    pageNumber = i + 1;
                                  } else if (currentPage >= totalPages - 2) {
                                    pageNumber = totalPages - 4 + i;
                                  } else {
                                    pageNumber = currentPage - 2 + i;
                                  }

                                  return (
                                    <button
                                      key={pageNumber}
                                      onClick={() => setCurrentPage(pageNumber)}
                                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                        currentPage === pageNumber
                                          ? "z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-200"
                                          : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                                      }`}
                                    >
                                      {pageNumber}
                                    </button>
                                  );
                                }
                              )}

                              <button
                                onClick={() =>
                                  setCurrentPage((prev) =>
                                    Math.min(
                                      prev + 1,
                                      Math.ceil(
                                        positionSummary.totalPositions /
                                          pageSize
                                      )
                                    )
                                  )
                                }
                                disabled={
                                  currentPage ===
                                  Math.ceil(
                                    positionSummary.totalPositions / pageSize
                                  )
                                }
                                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="sr-only">Next</span>
                                <svg
                                  className="h-5 w-5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </nav>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === "orders" && (
              <div>
                {/* Filter Controls */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Filter Orders
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Position Address Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Position Address
                      </label>
                      <input
                        type="text"
                        placeholder="Enter position address..."
                        value={positionFilter}
                        onChange={(e) => setPositionFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Order Type Filter */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                        Order Type
                      </label>
                      <select
                        value={orderTypeFilter}
                        onChange={(e) => setOrderTypeFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="all">All Types</option>
                        <option value="full">Full Sale</option>
                        <option value="partial">Partial Sale</option>
                      </select>
                    </div>
                  </div>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-12 h-12 text-gray-400 dark:text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        suppressHydrationWarning={true}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Sell Orders
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
                      You haven&apos;t created any sell orders yet. Create sell
                      orders for your positions to protect against liquidation.
                    </p>
                    {positions.length > 0 && (
                      <button
                        onClick={() => setActiveTab("positions")}
                        className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors"
                      >
                        Go to Positions to Create Orders
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onCancelOrder={handleCancelOrder}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div>
                {historyLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300">
                      Loading order history...
                    </p>
                  </div>
                ) : historyError ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 bg-red-100 dark:bg-red-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-12 h-12 text-red-400 dark:text-red-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-red-600 mb-2">
                      Error Loading History
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      {historyError}
                    </p>
                    <button
                      onClick={refetchHistory}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : historyOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-12 h-12 text-gray-400 dark:text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Order History
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
                      You don&apos;t have any executed, cancelled, or expired
                      orders yet. Order history will appear here once you start
                      trading.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historyOrders.map((historyOrder) => (
                      <HistoryOrderCard
                        key={historyOrder.id}
                        order={historyOrder}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateDebtModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPositionCreated={refetchWithCacheRefresh}
      />
      {selectedPositionForOrder && (
        <CreateSellOrderModal
          isOpen={isCreateOrderModalOpen}
          onClose={() => {
            setIsCreateOrderModalOpen(false);
            setSelectedPositionForOrder(null);
          }}
          debtPosition={selectedPositionForOrder}
          onCreateOrder={handleOrderCreation}
        />
      )}
      {selectedPositionForManage && (
        <ManagePositionModal
          isOpen={isManagePositionModalOpen}
          onClose={() => {
            setIsManagePositionModalOpen(false);
            setSelectedPositionForManage(null);
          }}
          position={selectedPositionForManage}
          onPositionUpdated={refetchWithCacheRefresh}
        />
      )}

      {/* Cancel All Orders Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCancelAllModal}
        onClose={handleCloseCancelAllModal}
        onConfirm={handleConfirmCancelAllOrders}
        title="Cancel All Orders"
        description="Are you sure you want to cancel ALL orders for this position? This is a destructive action that will invalidate all existing orders."
        confirmText="Yes, Cancel All Orders"
        cancelText="Keep Orders"
        isLoading={isCancelling}
        type="danger"
        highlightedAddress={selectedPositionForCancel?.address}
        details={[
          "Cancel all active orders for this position",
          "Increase the debt nonce by 1",
          "Make all existing orders invalid",
          "This action cannot be undone",
        ]}
      />

      {/* Transaction Confirmation Popup for Order Cancellation */}
      {usePopupForCancellation && (
        <TransactionConfirmationPopup
          isOpen={
            isCancelling ||
            isWaitingForReceipt ||
            isSuccess ||
            !!transactionError
          }
          onClose={() => {
            // Popup closed
          }}
          transactionHash={transactionHash}
          isWaitingForReceipt={isWaitingForReceipt}
          isWaitingForSync={false} // Don't show sync state for cancel orders
          isSuccess={isSuccess}
          error={transactionError}
          statusMessage={transactionStatus}
          title="Cancelling Order"
          description="Processing order cancellation transaction..."
          allowClose={true}
        />
      )}
    </div>
  );
}

// Enhanced Order Card Component with detailed information
function OrderCard({
  order,
  onCancelOrder,
}: {
  order: UserSellOrder;
  onCancelOrder: (order: UserSellOrder) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { calculateUSDValueFromBigInt, formatUSDValue, getTokenSymbol } =
    usePriceTokens();

  const getOrderStatusBadge = (status: UserSellOrder["status"]) => {
    const colors = {
      active:
        "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
      expired: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
      executed: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
      cancelled:
        "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatTokenAmount = (amount: string, decimals: number = 18) => {
    try {
      const value = parseFloat(amount);
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      });
    } catch {
      return amount;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 border border-gray-100 dark:border-gray-600">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                order.type === "full"
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                  : "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
              }`}
            >
              {order.type === "full" ? "Full Sale" : "Partial Sale"}
            </div>
            {getOrderStatusBadge(order.status)}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Order for Position{" "}
            <span className="font-mono bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-2 py-1 rounded-md font-bold">
              {truncateAddress(order.debtAddress)}
            </span>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Created {formatTimeRemaining(order.createdAt)} ago
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Expires in
          </div>
          <div className="font-medium text-orange-600">
            {formatTimeRemaining(order.validUntil)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
        <div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Trigger Health Factor:
          </span>
          <span className="ml-2 font-medium text-gray-900 dark:text-white">
            {formatPreciseHealthFactor(order.triggerHealthFactor, 2)}
          </span>
        </div>
        <div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Current Health Factor:
          </span>
          <span
            className={`ml-2 font-medium ${
              order.canExecute === "YES"
                ? "text-red-600 dark:text-red-400"
                : "text-gray-900 dark:text-white"
            }`}
          >
            {formatPreciseHealthFactor(order.currentHealthFactor, 2)}
            {order.canExecute === "YES" && " (Executable)"}
          </span>
        </div>
        <div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Debt Nonce:
          </span>
          <span className="ml-2 font-medium text-gray-900 dark:text-white">
            {order.debtNonce}
          </span>
        </div>
      </div>

      {/* Order Details Expandable Section */}
      <div className="mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full px-4 py-3 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Order Parameters & Details
          </span>
          <svg
            className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isExpanded && (
          <div className="mt-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Order Type Specific Information */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {order.type === "full"
                    ? "Full Sale Parameters"
                    : "Partial Sale Parameters"}
                </h4>
                <div className="space-y-2">
                  {order.type === "full" ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Bonus:
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {order.bonus
                            ? `${(order.bonus / 100).toFixed(2)}%`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Payment Token:
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                          {order.paymentToken
                            ? getTokenSymbol(order.paymentToken)
                            : "N/A"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Repay Amount:
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {order.repayAmount
                            ? formatTokenAmount(order.repayAmount)
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Repay Token:
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                          {order.repayToken
                            ? getTokenSymbol(order.repayToken)
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Collateral Token:
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                          {order.collateralToken
                            ? getTokenSymbol(order.collateralToken)
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          Buyer Bonus:
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {order.bonus
                            ? `${(order.bonus / 100).toFixed(2)}%`
                            : "N/A"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Order Timing & Status */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Order Timing & Status
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Order ID:
                    </span>
                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                      {truncateAddress(order.id)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Created:
                    </span>
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Expires:
                    </span>
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      {formatDate(order.validUntil)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Status:
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {order.status.charAt(0).toUpperCase() +
                        order.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Executable:
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        order.canExecute === "YES"
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {order.canExecute === "YES"
                        ? "Yes - Can Execute"
                        : "No - Safe"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Auto-cancellation warning */}
      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start space-x-2">
          <svg
            className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Auto-cancellation Notice
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              If any order with debt nonce{" "}
              <strong className="text-amber-900 dark:text-amber-100">
                {order.debtNonce}
              </strong>{" "}
              for position{" "}
              <span className="font-mono bg-amber-100 dark:bg-amber-800 px-1 py-0.5 rounded text-amber-900 dark:text-amber-100 font-semibold">
                {truncateAddress(order.debtAddress)}
              </span>{" "}
              is executed, all other orders with the same debt nonce for the
              same position will be automatically cancelled.
              <br />
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Note: Orders with same debt nonce but different positions are
                not affected.
              </span>
            </p>
          </div>
        </div>
      </div>

      {order.status === "active" && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex space-x-3">
            <button
              onClick={() => onCancelOrder(order)}
              className="px-4 py-2 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-800 transition-colors"
            >
              Cancel Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// History Order Card Component
function HistoryOrderCard({ order }: { order: any }) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      EXECUTED:
        "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
      CANCELLED:
        "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
      EXPIRED: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}
      >
        {status}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      BUYER: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
      SELLER:
        "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[role as keyof typeof colors]}`}
      >
        {role}
      </span>
    );
  };

  const formatUSDAmount = (amount?: number) => {
    if (!amount) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getActionDate = () => {
    if (order.status === "EXECUTED" && order.executedAt) {
      return { label: "Executed", date: order.executedAt };
    }
    if (order.status === "CANCELLED" && order.cancelledAt) {
      return { label: "Cancelled", date: order.cancelledAt };
    }
    return { label: "Created", date: order.createdAt };
  };

  const actionInfo = getActionDate();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {order.orderType}
            </span>
            {getStatusBadge(order.status)}
            {getRoleBadge(order.userRole)}
          </div>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {actionInfo.label}: {formatDate(actionInfo.date)}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Position Info */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Position
          </h4>
          <div className="space-y-1">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {truncateAddress(order.debtAddress)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              Trigger HF: {parseFloat(order.triggerHF) / 1e18}
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Order Details
          </h4>
          <div className="space-y-1">
            {order.orderType === "FULL" ? (
              <>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Full Sale Order
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  Bonus: {(order.bonus || 0) / 100}%
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Partial Sale
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  Amount: {order.repayAmount || "N/A"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  Bonus: {(order.bonus || 0) / 100}%
                </div>
              </>
            )}
          </div>
        </div>

        {/* Financial Info */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {order.userRole === "BUYER" ? "Your Earning" : "Your Saving"}
          </h4>
          <div className="space-y-1">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatUSDAmount(order.userEarning)}
            </div>
            {order.usdValue && (
              <div className="text-xs text-gray-500 dark:text-gray-500">
                Order Value: {formatUSDAmount(parseFloat(order.usdValue))}
              </div>
            )}
            {order.usdBonus && (
              <div className="text-xs text-gray-500 dark:text-gray-500">
                Bonus: {formatUSDAmount(parseFloat(order.usdBonus))}
              </div>
            )}
            {order.userRole === "SELLER" &&
              order.usdValue &&
              order.usdBonus && (
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  vs 5% max penalty:{" "}
                  {formatUSDAmount(parseFloat(order.usdValue) * 0.05)}
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Additional Info Row */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
          <div>Order ID: {truncateAddress(order.id)}</div>
          <div>
            {order.userRole === "BUYER"
              ? `Purchased from ${truncateAddress(order.seller)}`
              : `Sold to ${order.buyer ? truncateAddress(order.buyer) : "N/A"}`}
          </div>
        </div>
      </div>
    </div>
  );
}
