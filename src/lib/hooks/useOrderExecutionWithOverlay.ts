import { useState } from "react";
import { useTransactionHandler } from "./useTransactionHandler";
import { useOrderExecution, ExecuteOrderOptions } from "./useOrderExecution";
import { MarketOrder } from "../types";

export function useOrderExecutionWithOverlay() {
  const {
    executeOrder: originalExecuteOrder,
    isExecuting,
    executingOrderId,
  } = useOrderExecution();
  const [transactionHash, setTransactionHash] = useState<
    `0x${string}` | undefined
  >(undefined);

  // Enhanced transaction handler with overlay support
  const transactionHandler = useTransactionHandler({
    hash: transactionHash,
    onSuccess: () => {
      console.log(
        "✅ Order execution completed! Page will refresh in 20 seconds..."
      );
      setTransactionHash(undefined);
      // Auto-refresh page after successful execution
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (error) => {
      console.error("❌ Order execution failed:", error);
      setTransactionHash(undefined);
    },
    enableAutoRefresh: true,
    refreshDelay: 20000, // 20 seconds
    showFullScreenOverlay: true, // Enable full-screen overlay
  });

  const executeOrder = async (
    order: MarketOrder,
    options: ExecuteOrderOptions = {}
  ) => {
    try {
      setTransactionHash(undefined);

      // Execute the order and get transaction hash
      const txHash = await originalExecuteOrder(order, options);

      // Set the hash for the transaction handler to monitor
      setTransactionHash(txHash as `0x${string}`);

      return txHash;
    } catch (error) {
      setTransactionHash(undefined);
      throw error;
    }
  };

  return {
    executeOrder,
    isExecuting: isExecuting || transactionHandler.isLoading,
    executingOrderId,
    // Overlay properties
    showOverlay: transactionHandler.showOverlay,
    transactionHash: transactionHandler.transactionHash,
    isWaitingForReceipt: transactionHandler.isWaitingForReceipt,
    isWaitingForSync: transactionHandler.isWaitingForSync,
    isSuccess: transactionHandler.isSuccess,
    error: transactionHandler.error,
    statusMessage: transactionHandler.statusMessage,
  };
}
