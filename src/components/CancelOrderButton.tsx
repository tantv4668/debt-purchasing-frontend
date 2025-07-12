import { useState } from "react";
import { Address } from "viem";
import { useOrderCancellation } from "../lib/hooks/useOrderCancellation";
import { FullScreenTransactionOverlay } from "./FullScreenTransactionOverlay";
import TransactionConfirmationPopup from "./TransactionConfirmationPopup";

interface CancelOrderButtonProps {
  order: {
    id: string;
    debt: Address;
    debtNonce: number;
    startTime: number;
    endTime: number;
    triggerHF: string;
    seller: Address;
    status: string;
  };
  onOrderCancelled?: () => void;
}

export function CancelOrderButton({
  order,
  onOrderCancelled,
}: CancelOrderButtonProps) {
  const [usePopup, setUsePopup] = useState(true); // Default to popup for cancel orders
  const {
    cancelOrder,
    isCancelling,
    cancellingOrderId,
    transactionStatus,
    isWaitingForSync,
    remainingTime,
    // Overlay properties
    showOverlay,
    transactionHash,
    isWaitingForReceipt,
    isSuccess,
    error: transactionError,
  } = useOrderCancellation(!usePopup); // Use full-screen overlay only when popup is disabled
  const [error, setError] = useState<string | null>(null);

  const handleCancelOrder = async () => {
    try {
      setError(null);

      await cancelOrder({
        debt: order.debt,
        debtNonce: order.debtNonce,
        startTime: order.startTime,
        endTime: order.endTime,
        triggerHF: Number(order.triggerHF),
      });

      // Order successfully cancelled
      if (onOrderCancelled) {
        onOrderCancelled();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to cancel order";
      setError(errorMessage);
    }
  };

  // Only show for active orders
  if (order.status !== "ACTIVE") {
    return null;
  }

  const isCurrentOrderCancelling =
    cancellingOrderId === `${order.debt}-${order.debtNonce}`;

  return (
    <div className="flex flex-col space-y-2">
      <button
        onClick={handleCancelOrder}
        disabled={isCancelling}
        className={`
          px-4 py-2 rounded-md font-medium transition-colors
          ${
            isCancelling
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-red-500 text-white hover:bg-red-600"
          }
        `}
      >
        {isCurrentOrderCancelling ? (
          <div className="flex items-center space-x-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Cancelling...</span>
          </div>
        ) : (
          "Cancel Order"
        )}
      </button>

      {/* Enhanced Transaction Status */}
      {isCurrentOrderCancelling && transactionStatus && (
        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center space-x-2">
          {isCancelling && (
            <svg
              className="animate-spin h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          <span>{transactionStatus}</span>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {/* Full-screen transaction overlay */}
      <FullScreenTransactionOverlay
        isVisible={!usePopup && showOverlay}
        isLoading={isCancelling}
        isWaitingForReceipt={isWaitingForReceipt}
        isWaitingForSync={isWaitingForSync}
        isSuccess={isSuccess}
        error={transactionError}
        statusMessage={transactionStatus}
        transactionHash={transactionHash}
        onClose={() => {
          // Optional: handle close if needed
        }}
      />

      {/* Transaction Confirmation Popup */}
      {usePopup && (
        <TransactionConfirmationPopup
          isOpen={
            isCancelling ||
            isWaitingForReceipt ||
            isSuccess ||
            !!transactionError
          }
          onClose={() => {
            // Reset states when manually closed
            if (transactionError) {
              setError(null);
            }
          }}
          transactionHash={transactionHash}
          isWaitingForReceipt={isWaitingForReceipt}
          isWaitingForSync={false} // Don't show sync state for cancel orders
          isSuccess={isSuccess}
          error={transactionError}
          statusMessage={transactionStatus}
          title="Cancelling Order"
          description={`Cancelling order for debt position ${order.debt.slice(0, 6)}...${order.debt.slice(-4)}`}
          allowClose={true}
        />
      )}
    </div>
  );
}

export default CancelOrderButton;
