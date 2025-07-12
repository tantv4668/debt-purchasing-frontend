import { useState } from "react";
import { Address } from "viem";
import { useOrderCancellation } from "../lib/hooks/useOrderCancellation";

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
  const { cancelOrder, isCancelling, cancellingOrderId } =
    useOrderCancellation();
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
        {isCurrentOrderCancelling ? "Cancelling..." : "Cancel Order"}
      </button>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

export default CancelOrderButton;
