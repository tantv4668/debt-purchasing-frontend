import { useEffect, useState } from "react";
import { useWaitForTransactionReceipt } from "wagmi";
import { Hash } from "viem";

interface UseTransactionHandlerProps {
  hash?: Hash;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  enableAutoRefresh?: boolean;
  refreshDelay?: number; // milliseconds
  showFullScreenOverlay?: boolean; // Enable full-screen overlay
}

interface TransactionState {
  isLoading: boolean;
  isWaitingForReceipt: boolean;
  isWaitingForSync: boolean;
  isSuccess: boolean;
  error: Error | null;
  remainingTime: number;
}

export function useTransactionHandler({
  hash,
  onSuccess,
  onError,
  enableAutoRefresh = true,
  refreshDelay = 20000, // 20 seconds default
  showFullScreenOverlay = false,
}: UseTransactionHandlerProps) {
  const [state, setState] = useState<TransactionState>({
    isLoading: false,
    isWaitingForReceipt: false,
    isWaitingForSync: false,
    isSuccess: false,
    error: null,
    remainingTime: 0,
  });

  const {
    isLoading: isConfirming,
    isSuccess: receiptSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Effect to handle transaction flow
  useEffect(() => {
    if (!hash) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isWaitingForReceipt: false,
        isWaitingForSync: false,
      }));
      return;
    }

    // Transaction submitted, waiting for receipt
    if (hash && isConfirming) {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        isWaitingForReceipt: true,
        isWaitingForSync: false,
        error: null,
      }));
    }

    // Receipt received successfully
    if (receiptSuccess && !state.isWaitingForSync && !state.isSuccess) {
      setState((prev) => ({
        ...prev,
        isWaitingForReceipt: false,
        isWaitingForSync: enableAutoRefresh,
        remainingTime: enableAutoRefresh ? refreshDelay : 0,
      }));

      if (enableAutoRefresh) {
        // Start countdown
        const interval = setInterval(() => {
          setState((prev) => {
            const newTime = prev.remainingTime - 1000;
            if (newTime <= 0) {
              clearInterval(interval);
              return {
                ...prev,
                isLoading: false,
                isWaitingForSync: false,
                isSuccess: true,
                remainingTime: 0,
              };
            }
            return {
              ...prev,
              remainingTime: newTime,
            };
          });
        }, 1000);

        // Auto-refresh after delay
        const refreshTimeout = setTimeout(() => {
          clearInterval(interval);
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isWaitingForSync: false,
            isSuccess: true,
          }));

          if (onSuccess) {
            onSuccess();
          }
        }, refreshDelay);

        return () => {
          clearInterval(interval);
          clearTimeout(refreshTimeout);
        };
      } else {
        // No auto-refresh, complete immediately
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isSuccess: true,
        }));

        if (onSuccess) {
          onSuccess();
        }
      }
    }

    // Handle error
    if (receiptError) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isWaitingForReceipt: false,
        isWaitingForSync: false,
        error: receiptError,
      }));

      if (onError) {
        onError(receiptError);
      }
    }
  }, [
    hash,
    isConfirming,
    receiptSuccess,
    receiptError,
    enableAutoRefresh,
    refreshDelay,
    onSuccess,
    onError,
    state.isWaitingForSync,
    state.isSuccess,
  ]);

  // Format remaining time as "Xs" or "Xm Ys"
  const formatRemainingTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Get status message
  const getStatusMessage = (): string => {
    if (state.isWaitingForReceipt) {
      return "Confirming transaction...";
    }
    if (state.isWaitingForSync) {
      return `Syncing database... ${formatRemainingTime(state.remainingTime)}`;
    }
    if (state.isSuccess) {
      return "Transaction completed successfully!";
    }
    if (state.error) {
      return `Transaction failed: ${state.error.message}`;
    }
    return "";
  };

  return {
    ...state,
    isLoading: state.isLoading,
    statusMessage: getStatusMessage(),
    formatRemainingTime,
    // Overlay-specific properties
    showOverlay:
      showFullScreenOverlay &&
      (state.isLoading || state.isWaitingForReceipt || state.isWaitingForSync),
    transactionHash: hash,
  };
}
