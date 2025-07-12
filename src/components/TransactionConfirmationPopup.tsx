import React, { useEffect, useState } from "react";

interface TransactionConfirmationPopupProps {
  isOpen: boolean;
  onClose?: () => void;
  transactionHash?: `0x${string}`;
  isWaitingForReceipt?: boolean;
  isWaitingForSync?: boolean;
  isSuccess?: boolean;
  error?: Error | null;
  statusMessage?: string;
  title?: string;
  description?: string;
  allowClose?: boolean;
  onSuccess?: () => void; // Callback to call before page reload
}

export default function TransactionConfirmationPopup({
  isOpen,
  onClose,
  transactionHash,
  isWaitingForReceipt = false,
  isWaitingForSync = false,
  isSuccess = false,
  error,
  statusMessage,
  title,
  description,
  allowClose = false,
  onSuccess,
}: TransactionConfirmationPopupProps) {
  const [countdown, setCountdown] = useState(50);
  const [showCountdown, setShowCountdown] = useState(false);

  // Auto-close logic when transaction succeeds
  useEffect(() => {
    if (isSuccess && isOpen) {
      setShowCountdown(true);
      setCountdown(50);

      const interval = setInterval(() => {
        setCountdown((prev) => {
          const nextCount = prev - 1;
          if (nextCount <= 0) {
            clearInterval(interval);
            // Call success callback before reload
            onSuccess?.();
            // Close popup and reload page
            onClose?.();
            setTimeout(() => {
              window.location.reload();
            }, 500);
            return 0;
          }
          return nextCount;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setShowCountdown(false);
    }
  }, [isSuccess, isOpen, onClose, onSuccess]);

  if (!isOpen) return null;

  // Auto-determine title and description based on state
  const getTitle = () => {
    if (title) return title;
    if (error) return "Transaction Failed";
    // Always show waiting state, even when successful
    if (isWaitingForReceipt && transactionHash)
      return "Confirming Transaction...";
    return "Processing Transaction...";
  };

  const getDescription = () => {
    if (description) return description;
    if (error) return `Transaction failed: ${error.message}`;
    // Always show waiting state, even when successful
    if (isWaitingForReceipt && transactionHash)
      return "Transaction submitted. Waiting for blockchain confirmation...";
    return "Please confirm the transaction in your wallet.";
  };

  const getIconComponent = () => {
    if (error) {
      return (
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
      );
    }

    // Always show loading spinner, even when successful
    return (
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 shadow-xl">
        <div className="p-6">
          <div className="text-center space-y-6">
            {getIconComponent()}

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {getTitle()}
              </h3>
              <p className="text-gray-600 mb-4">{getDescription()}</p>

              {statusMessage && (
                <div className="text-sm text-blue-600 mb-4">
                  {statusMessage}
                </div>
              )}

              {transactionHash && (
                <div className="text-sm text-gray-500 mb-4">
                  Transaction Hash:{" "}
                  <span className="font-mono">
                    {transactionHash.slice(0, 12)}...
                    {transactionHash.slice(-8)}
                  </span>
                  <div className="mt-2">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      View on Etherscan
                    </a>
                  </div>
                </div>
              )}

              {!error && (
                <div className="text-sm text-gray-500">
                  This may take a few moments to complete.
                </div>
              )}
            </div>

            {/* Warning box for active transactions */}
            {isWaitingForReceipt && !error && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="text-yellow-600 mt-1">⚠️</div>
                  <div className="text-sm text-yellow-800">
                    <div className="font-medium mb-1">
                      Transaction in Progress
                    </div>
                    <div>
                      Do not close this window until the transaction is
                      confirmed.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3">
              {/* Close button for error states */}
              {error && allowClose && (
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
