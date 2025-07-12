import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { Address } from "viem";
import { getAaveRouterAddress } from "../contracts";
import { AAVE_ROUTER_ABI } from "../contracts/abis";
import { logger } from "../utils/logger";
import { useTransactionHandler } from "./useTransactionHandler";

export interface CancelOrderParams {
  debt: Address;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: number;
}

export interface OrderTitle {
  debt: Address;
  debtNonce: number;
  startTime: number;
  endTime: number;
  triggerHF: number;
}

export function useOrderCancellation(useFullScreenOverlay: boolean = false) {
  const { address, chainId } = useAccount();
  const { writeContractAsync, data: hash } = useWriteContract();

  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(
    null
  );

  // Enhanced transaction handler with auto-refresh but no database sync
  const transactionHandler = useTransactionHandler({
    hash,
    onSuccess: () => {
      logger.info("✅ Order cancellation completed! Refreshing page...");
      setCancellingOrderId(null);
      // Optional: refresh data or notify parent component
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (error) => {
      logger.error("❌ Order cancellation failed:", error);
      setCancellingOrderId(null);
    },
    enableAutoRefresh: false, // No auto-refresh for cancel orders
    refreshDelay: 0, // No delay needed
    showFullScreenOverlay: useFullScreenOverlay, // Use parameter
  });

  // Cancel a specific order
  const cancelOrder = async (params: CancelOrderParams) => {
    if (!address || !chainId) {
      throw new Error("Wallet not connected");
    }

    const routerAddress = getAaveRouterAddress(chainId);
    setCancellingOrderId(`${params.debt}-${params.debtNonce}`);

    try {
      logger.info("🚫 Cancelling order:", params);

      // Construct the OrderTitle struct
      const orderTitle: OrderTitle = {
        debt: params.debt,
        debtNonce: params.debtNonce,
        startTime: params.startTime,
        endTime: params.endTime,
        triggerHF: params.triggerHF,
      };

      // Call the contract's cancelOrder function
      const txHash = await writeContractAsync({
        address: routerAddress,
        abi: AAVE_ROUTER_ABI,
        functionName: "cancelOrder",
        args: [orderTitle],
      });

      logger.info("✅ Order cancellation transaction submitted:", txHash);
      // Transaction handler will handle confirmation and refresh
      return txHash;
    } catch (error) {
      logger.error("❌ Order cancellation failed:", error);
      setCancellingOrderId(null);
      throw error;
    }
  };

  // Cancel all orders for a debt position
  const cancelAllOrders = async (debtAddress: Address) => {
    if (!address || !chainId) {
      throw new Error("Wallet not connected");
    }

    const routerAddress = getAaveRouterAddress(chainId);
    setCancellingOrderId(`all-${debtAddress}`);

    try {
      logger.info("🚫 Cancelling all orders for debt position:", debtAddress);

      // Call the contract's cancelDebtCurrentOrders function
      const txHash = await writeContractAsync({
        address: routerAddress,
        abi: AAVE_ROUTER_ABI,
        functionName: "cancelDebtCurrentOrders",
        args: [debtAddress],
      });

      logger.info("✅ Cancel all orders transaction submitted:", txHash);
      // Transaction handler will handle confirmation and refresh
      return txHash;
    } catch (error) {
      logger.error("❌ Cancel all orders failed:", error);
      setCancellingOrderId(null);
      throw error;
    }
  };

  return {
    cancelOrder,
    cancelAllOrders,
    isCancelling: transactionHandler.isLoading,
    cancellingOrderId,
    transactionStatus: transactionHandler.statusMessage,
    isWaitingForSync: transactionHandler.isWaitingForSync,
    remainingTime: transactionHandler.remainingTime,
    // Overlay properties
    showOverlay: transactionHandler.showOverlay,
    transactionHash: transactionHandler.transactionHash,
    isWaitingForReceipt: transactionHandler.isWaitingForReceipt,
    isSuccess: transactionHandler.isSuccess,
    error: transactionHandler.error,
  };
}
