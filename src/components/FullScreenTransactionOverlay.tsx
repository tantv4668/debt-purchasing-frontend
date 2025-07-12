import React from "react";

interface FullScreenTransactionOverlayProps {
  isVisible: boolean;
  isLoading: boolean;
  isWaitingForReceipt: boolean;
  isWaitingForSync: boolean;
  isSuccess: boolean;
  error: Error | null;
  statusMessage: string;
  transactionHash?: string;
  onClose?: () => void;
}

export function FullScreenTransactionOverlay({
  isVisible,
  isLoading,
  isWaitingForReceipt,
  isWaitingForSync,
  isSuccess,
  error,
  statusMessage,
  transactionHash,
  onClose,
}: FullScreenTransactionOverlayProps) {
  if (!isVisible) return null;

  const getLoadingAnimation = () => {
    if (isWaitingForReceipt || isLoading) {
      return (
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-6"></div>
      );
    }
    if (isWaitingForSync) {
      return (
        <div className="flex items-center justify-center mb-6">
          <div className="animate-pulse rounded-full h-16 w-16 bg-green-500 mx-auto"></div>
        </div>
      );
    }
    if (isSuccess) {
      return (
        <div className="flex items-center justify-center mb-6">
          <div className="rounded-full h-16 w-16 bg-green-500 flex items-center justify-center">
            <svg
              className="h-8 w-8 text-white"
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
          </div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex items-center justify-center mb-6">
          <div className="rounded-full h-16 w-16 bg-red-500 flex items-center justify-center">
            <svg
              className="h-8 w-8 text-white"
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
        </div>
      );
    }
    return null;
  };

  const getMainTitle = () => {
    if (isWaitingForReceipt) return "Confirming Transaction";
    if (isWaitingForSync) return "Syncing Database";
    if (isSuccess) return "Transaction Completed";
    if (error) return "Transaction Failed";
    return "Processing Transaction";
  };

  const getSubTitle = () => {
    if (isWaitingForReceipt)
      return "Please wait while your transaction is being confirmed on the blockchain...";
    if (isWaitingForSync)
      return "Transaction confirmed! Syncing with database and subgraph...";
    if (isSuccess) return "Your transaction has been completed successfully!";
    if (error)
      return "There was an error processing your transaction. Please try again.";
    return "Please wait while your transaction is being processed...";
  };

  const canClose = isSuccess || error;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 max-w-md w-full mx-4 text-center">
        {/* Loading Animation */}
        {getLoadingAnimation()}

        {/* Main Title */}
        <h2 className="text-2xl font-bold text-white mb-4">{getMainTitle()}</h2>

        {/* Subtitle */}
        <p className="text-gray-400 mb-6">{getSubTitle()}</p>

        {/* Status Message */}
        <div className="mb-6">
          <p
            className={`text-lg font-medium ${
              isWaitingForReceipt
                ? "text-blue-400"
                : isWaitingForSync
                  ? "text-green-400"
                  : isSuccess
                    ? "text-green-400"
                    : error
                      ? "text-red-400"
                      : "text-white"
            }`}
          >
            {statusMessage}
          </p>
        </div>

        {/* Transaction Hash */}
        {transactionHash && (
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-2">Transaction Hash:</p>
            <a
              href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 break-all text-sm underline"
            >
              {transactionHash}
            </a>
          </div>
        )}

        {/* Error Details */}
        {error && (
          <div className="mb-6">
            <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded border border-red-800">
              {error.message}
            </p>
          </div>
        )}

        {/* Close Button */}
        {canClose && onClose && (
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Close
          </button>
        )}

        {/* Non-closeable indicator */}
        {!canClose && (
          <div className="text-sm text-gray-500">
            <p>
              Please do not close this window while the transaction is
              processing...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
