"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useWaitForTransactionReceipt } from "wagmi";
import { ChainId } from "../lib/contracts";
import { SUPPORTED_TOKENS } from "../lib/contracts/tokens";
import {
  useMultiTokenOperations,
  usePositionManagement,
} from "../lib/hooks/useContracts";
import { useTokenBalances } from "../lib/hooks/useDebtPositions";
import {
  formatHealthFactor,
  useHealthFactor,
} from "../lib/hooks/useHealthFactor";
import { usePriceTokens } from "../lib/hooks/usePriceTokens";
import { useTransactionHandler } from "../lib/hooks/useTransactionHandler";
import type { TokenSymbol } from "../lib/types/debt-position";
import { FullScreenTransactionOverlay } from "./FullScreenTransactionOverlay";
import Tooltip from "./Tooltip";

interface ManagePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: any; // The debt position to manage
  onPositionUpdated?: () => void;
}

type ActionTab = "supply" | "borrow" | "repay" | "withdraw";

interface AssetSelection {
  symbol: TokenSymbol;
  amount: string;
  selected: boolean;
  interestRateMode?: 1 | 2; // For borrow operations
}

// Health Factor Estimator Component
function HealthFactorEstimator({
  position,
  selectedAssets,
  actionTab,
  tokens,
}: {
  position: any;
  selectedAssets: AssetSelection[];
  actionTab: ActionTab;
  tokens: any;
}) {
  const { calculateUSDValue } = usePriceTokens();
  const currentHF = useHealthFactor(
    position?.collaterals || [],
    position?.debts || []
  );

  // Calculate new collaterals and debts for estimation
  const { newCollaterals, newDebts } = useMemo(() => {
    if (!position || selectedAssets.length === 0) {
      return {
        newCollaterals: position?.collaterals || [],
        newDebts: position?.debts || [],
      };
    }

    // Clone current position data
    const newCollaterals = [...(position.collaterals || [])];
    const newDebts = [...(position.debts || [])];

    selectedAssets.forEach((asset) => {
      if (!asset.amount || parseFloat(asset.amount) <= 0) return;

      const token = tokens[asset.symbol];
      const amountBigInt = parseUnits(asset.amount, token.decimals);

      switch (actionTab) {
        case "supply":
          // Add to collateral
          const existingCollateralIndex = newCollaterals.findIndex(
            (c) => c.symbol === asset.symbol
          );
          if (existingCollateralIndex >= 0) {
            newCollaterals[existingCollateralIndex] = {
              ...newCollaterals[existingCollateralIndex],
              balance:
                newCollaterals[existingCollateralIndex].balance + amountBigInt,
            };
          } else {
            newCollaterals.push({
              symbol: asset.symbol,
              balance: amountBigInt,
              decimals: token.decimals,
            });
          }
          break;

        case "borrow":
          // Add to debt
          const existingDebtIndex = newDebts.findIndex(
            (d) => d.symbol === asset.symbol
          );
          if (existingDebtIndex >= 0) {
            newDebts[existingDebtIndex] = {
              ...newDebts[existingDebtIndex],
              balance: newDebts[existingDebtIndex].balance + amountBigInt,
            };
          } else {
            newDebts.push({
              symbol: asset.symbol,
              balance: amountBigInt,
              decimals: token.decimals,
            });
          }
          break;

        case "repay":
          // Reduce debt
          const debtIndex = newDebts.findIndex(
            (d) => d.symbol === asset.symbol
          );
          if (debtIndex >= 0) {
            const newBalance = newDebts[debtIndex].balance - amountBigInt;
            if (newBalance <= BigInt(0)) {
              newDebts.splice(debtIndex, 1);
            } else {
              newDebts[debtIndex] = {
                ...newDebts[debtIndex],
                balance: newBalance,
              };
            }
          }
          break;

        case "withdraw":
          // Reduce collateral
          const collateralIndex = newCollaterals.findIndex(
            (c) => c.symbol === asset.symbol
          );
          if (collateralIndex >= 0) {
            const newBalance =
              newCollaterals[collateralIndex].balance - amountBigInt;
            if (newBalance <= BigInt(0)) {
              newCollaterals.splice(collateralIndex, 1);
            } else {
              newCollaterals[collateralIndex] = {
                ...newCollaterals[collateralIndex],
                balance: newBalance,
              };
            }
          }
          break;
      }
    });

    return { newCollaterals, newDebts };
  }, [position, selectedAssets, actionTab, tokens]);

  // Calculate estimated HF using the new collaterals and debts
  const estimatedHF = useHealthFactor(newCollaterals, newDebts);

  const hfChange = estimatedHF.healthFactor - currentHF.healthFactor;
  const isImproving = hfChange > 0;
  const isWorsening = hfChange < 0;

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mt-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        Health Factor Impact
        <Tooltip
          content="Estimated Health Factor after performing this action. HF below 1.0 risks liquidation."
          maxWidth="xl"
        >
          <svg
            className="w-4 h-4 text-gray-500 dark:text-gray-400 cursor-help"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        </Tooltip>
      </h4>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Current
          </div>
          <div className={`text-lg font-bold ${currentHF.color}`}>
            {formatHealthFactor(currentHF.healthFactor)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {currentHF.label}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            After Action
          </div>
          <div
            className={`text-lg font-bold ${estimatedHF.color} flex items-center gap-1`}
          >
            {formatHealthFactor(estimatedHF.healthFactor)}
            {selectedAssets.some(
              (a) => a.selected && a.amount && parseFloat(a.amount) > 0
            ) && (
              <span
                className={`text-sm ${isImproving ? "text-green-500" : isWorsening ? "text-red-500" : "text-gray-500"}`}
              >
                {isImproving ? "↗" : isWorsening ? "↘" : "→"}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {estimatedHF.label}
          </div>
        </div>
      </div>

      {estimatedHF.healthFactor < 1.1 &&
        estimatedHF.healthFactor !== currentHF.healthFactor && (
          <div className="mt-3 p-2 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded text-sm text-red-800 dark:text-red-200">
            ⚠️ Warning: This action will result in a low Health Factor. Consider
            the liquidation risk.
          </div>
        )}
    </div>
  );
}

// Position Information Component
function PositionInfo({
  position,
  actionTab,
}: {
  position: any;
  actionTab: ActionTab;
}) {
  const { calculateUSDValueFromBigInt, formatUSDValue } = usePriceTokens();

  if (!position) return null;

  const getRelevantAssets = () => {
    switch (actionTab) {
      case "supply":
      case "withdraw":
        return position.collaterals || [];
      case "borrow":
        // Show both collateral (what can be borrowed against) and current debt
        return {
          collaterals: position.collaterals || [],
          debts: (position.debts || []).filter((debt: any) => debt.balance > 0),
        };
      case "repay":
        return (position.debts || []).filter((debt: any) => debt.balance > 0);
      default:
        return [];
    }
  };

  const assets = getRelevantAssets();
  const hasNoDebt =
    !position.debts ||
    position.debts.length === 0 ||
    position.debts.every((debt: any) => !debt.balance || debt.balance === 0);

  const calculateTotalValue = (assetList: any[]) => {
    return assetList.reduce((total, asset) => {
      const value = calculateUSDValueFromBigInt(
        asset.balance,
        asset.symbol,
        asset.decimals
      );
      return total + value;
    }, 0);
  };

  return (
    <div
      className={`rounded-lg p-4 mb-4 ${
        hasNoDebt && actionTab === "repay"
          ? "bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700"
          : "bg-blue-50 dark:bg-blue-900"
      }`}
    >
      <h4
        className={`text-sm font-medium mb-3 ${
          hasNoDebt && actionTab === "repay"
            ? "text-green-800 dark:text-green-200"
            : "text-blue-800 dark:text-blue-200"
        }`}
      >
        Current Position{" "}
        {actionTab === "supply" || actionTab === "withdraw"
          ? "Collateral"
          : actionTab === "repay"
            ? "Debt"
            : "Overview"}
      </h4>

      {actionTab === "borrow" &&
      typeof assets === "object" &&
      "collaterals" in assets ? (
        <div className="space-y-3">
          <div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
              Available Collateral
            </div>
            {assets.collaterals.length > 0 ? (
              <div className="space-y-1">
                {assets.collaterals.map((asset: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-blue-800 dark:text-blue-200">
                      {parseFloat(
                        formatUnits(asset.balance, asset.decimals)
                      ).toLocaleString()}{" "}
                      {asset.symbol}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {formatUSDValue(
                        calculateUSDValueFromBigInt(
                          asset.balance,
                          asset.symbol,
                          asset.decimals
                        )
                      )}
                    </span>
                  </div>
                ))}
                <div className="border-t border-blue-200 dark:border-blue-700 pt-1 mt-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-blue-800 dark:text-blue-200">
                      Total Collateral
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {formatUSDValue(calculateTotalValue(assets.collaterals))}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-blue-600 dark:text-blue-400 text-sm">
                No collateral assets
              </div>
            )}
          </div>

          <div>
            <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
              Current Debt
            </div>
            {assets.debts.length > 0 ? (
              <div className="space-y-1">
                {assets.debts.map((asset: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-blue-800 dark:text-blue-200">
                      {parseFloat(
                        formatUnits(asset.balance, asset.decimals)
                      ).toLocaleString()}{" "}
                      {asset.symbol}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {formatUSDValue(
                        calculateUSDValueFromBigInt(
                          asset.balance,
                          asset.symbol,
                          asset.decimals
                        )
                      )}
                    </span>
                  </div>
                ))}
                <div className="border-t border-blue-200 dark:border-blue-700 pt-1 mt-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-blue-800 dark:text-blue-200">
                      Total Debt
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {formatUSDValue(calculateTotalValue(assets.debts))}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-blue-600 dark:text-blue-400 text-sm">
                No debt
              </div>
            )}
          </div>
        </div>
      ) : Array.isArray(assets) ? (
        assets.length > 0 ? (
          <div className="space-y-1">
            {assets.map((asset: any, index: number) => (
              <div key={index} className="flex justify-between text-sm">
                <span
                  className={
                    hasNoDebt && actionTab === "repay"
                      ? "text-green-800 dark:text-green-200"
                      : "text-blue-800 dark:text-blue-200"
                  }
                >
                  {parseFloat(
                    formatUnits(asset.balance, asset.decimals)
                  ).toLocaleString()}{" "}
                  {asset.symbol}
                </span>
                <span
                  className={
                    hasNoDebt && actionTab === "repay"
                      ? "text-green-600 dark:text-green-400"
                      : "text-blue-600 dark:text-blue-400"
                  }
                >
                  {formatUSDValue(
                    calculateUSDValueFromBigInt(
                      asset.balance,
                      asset.symbol,
                      asset.decimals
                    )
                  )}
                </span>
              </div>
            ))}
            <div
              className={`border-t pt-1 mt-2 ${
                hasNoDebt && actionTab === "repay"
                  ? "border-green-200 dark:border-green-700"
                  : "border-blue-200 dark:border-blue-700"
              }`}
            >
              <div className="flex justify-between text-sm font-medium">
                <span
                  className={
                    hasNoDebt && actionTab === "repay"
                      ? "text-green-800 dark:text-green-200"
                      : "text-blue-800 dark:text-blue-200"
                  }
                >
                  Total
                </span>
                <span
                  className={
                    hasNoDebt && actionTab === "repay"
                      ? "text-green-600 dark:text-green-400"
                      : "text-blue-600 dark:text-blue-400"
                  }
                >
                  {formatUSDValue(calculateTotalValue(assets))}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`text-sm ${
              hasNoDebt && actionTab === "repay"
                ? "text-green-600 dark:text-green-400"
                : "text-blue-600 dark:text-blue-400"
            }`}
          >
            {hasNoDebt && actionTab === "repay" ? (
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🎉</span>
                <div>
                  <div className="font-medium">
                    Congratulations! Your loan is fully repaid!
                  </div>
                  <div className="text-xs mt-1">
                    You have no outstanding debt on this position.
                  </div>
                </div>
              </div>
            ) : (
              `No ${actionTab === "supply" || actionTab === "withdraw" ? "collateral" : "debt"} assets`
            )}
          </div>
        )
      ) : null}
    </div>
  );
}

export default function ManagePositionModal({
  isOpen,
  onClose,
  position,
  onPositionUpdated,
}: ManagePositionModalProps) {
  const { address } = useAccount();
  const { tokenBalances } = useTokenBalances();
  const multiTokenOps = useMultiTokenOperations(ChainId.SEPOLIA);
  const positionOps = usePositionManagement(ChainId.SEPOLIA);
  const {
    calculateUSDValue,
    formatUSDValue,
    getTotalUSDValue,
    getPriceBySymbol,
    isLoading: pricesLoading,
    error: pricesError,
    refreshPrices,
  } = usePriceTokens();

  const [activeTab, setActiveTab] = useState<ActionTab>("supply");
  const [assets, setAssets] = useState<AssetSelection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvedTokens, setApprovedTokens] = useState<Set<string>>(new Set());
  const [pendingApprovals, setPendingApprovals] = useState<Set<string>>(
    new Set()
  );
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<
    `0x${string}` | undefined
  >(undefined);

  // Enhanced transaction handler with overlay support
  const transactionHandler = useTransactionHandler({
    hash: transactionHash,
    onSuccess: () => {
      console.log("✅ ManagePosition transaction successful! Refreshing...");
      setTransactionError(null);
      setTransactionHash(undefined);
      setIsProcessing(false);
      onPositionUpdated?.();
      resetForm();
    },
    onError: (error: Error) => {
      console.error("❌ ManagePosition transaction failed:", error);
      const errorMessage = error.message || "Transaction failed";
      setTransactionError(errorMessage);
      setTransactionHash(undefined);
      setIsProcessing(false);
    },
    enableAutoRefresh: true,
    refreshDelay: 20000, // 20 seconds
    showFullScreenOverlay: true, // Enable full-screen overlay
  });

  // Initialize default state
  const getDefaultAssets = () =>
    Object.keys(SUPPORTED_TOKENS).map((symbol) => ({
      symbol: symbol as TokenSymbol,
      amount: "",
      selected: false,
      interestRateMode: 2 as 1 | 2,
    }));

  // Reset form when tab changes
  useEffect(() => {
    setAssets(getDefaultAssets());
    setTransactionError(null);
    setApprovedTokens(new Set());
    setPendingApprovals(new Set());
  }, [activeTab]);

  // Auto-switch away from repay tab if no debt exists
  useEffect(() => {
    if (activeTab === "repay" && position) {
      const hasDebt =
        position.debts &&
        position.debts.length > 0 &&
        position.debts.some((debt: any) => debt.balance > 0);
      if (!hasDebt) {
        setActiveTab("supply"); // Switch to supply tab as default
      }
    }

    if (activeTab === "withdraw" && position) {
      const hasCollateral =
        position.collaterals &&
        position.collaterals.length > 0 &&
        position.collaterals.some((collateral: any) => collateral.balance > 0);
      if (!hasCollateral) {
        setActiveTab("supply"); // Switch to supply tab as default
      }
    }
  }, [position, activeTab]);

  // Get tokens configuration for current chain
  const getTokenConfig = (chainId: ChainId) => {
    const tokenConfig: Partial<
      Record<
        TokenSymbol,
        {
          address: `0x${string}`;
          symbol: string;
          name: string;
          decimals: number;
        }
      >
    > = {};

    Object.entries(SUPPORTED_TOKENS).forEach(([symbol, token]) => {
      if (token && token.addresses[chainId]) {
        tokenConfig[symbol as TokenSymbol] = {
          address: token.addresses[chainId] as `0x${string}`,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
        };
      }
    });

    return tokenConfig as Record<
      TokenSymbol,
      { address: `0x${string}`; symbol: string; name: string; decimals: number }
    >;
  };

  const tokens = getTokenConfig(ChainId.SEPOLIA);

  // Helper function to get token color
  const getTokenColor = (symbol: string) => {
    const colorMap: Record<string, string> = {
      WETH: "bg-blue-600",
      wstETH: "bg-blue-500",
      WBTC: "bg-orange-500",
      USDC: "bg-blue-500",
      DAI: "bg-yellow-500",
      LINK: "bg-blue-700",
      AAVE: "bg-purple-600",
      cbETH: "bg-blue-400",
      USDT: "bg-green-500",
      rETH: "bg-orange-400",
      LUSD: "bg-indigo-500",
      CRV: "bg-purple-500",
    };
    return colorMap[symbol] || "bg-gray-600";
  };

  const resetForm = () => {
    setAssets(getDefaultAssets());
    setTransactionError(null);
    setTransactionHash(undefined);
    setIsProcessing(false);
    setApprovedTokens(new Set());
    setPendingApprovals(new Set());
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getSelectedAssets = () => {
    return assets.filter(
      (asset) => asset.selected && asset.amount && parseFloat(asset.amount) > 0
    );
  };

  const getPositionAssetSymbols = (assetType: "collateral" | "debt") => {
    if (!position) return [];
    const positionAssets =
      assetType === "collateral" ? position.collaterals : position.debts;
    return positionAssets.map((asset: any) => asset.symbol);
  };

  const isAssetInPosition = (
    symbol: string,
    assetType: "collateral" | "debt"
  ) => {
    const assetList =
      assetType === "collateral" ? position?.collaterals : position?.debts;
    const asset = assetList?.find((asset: any) => asset.symbol === symbol);
    return asset && asset.balance > 0;
  };

  const handleApprove = async () => {
    if (!address || (activeTab !== "supply" && activeTab !== "repay")) return;

    const selectedAssets = getSelectedAssets();
    if (selectedAssets.length === 0) return;

    setIsApproving(true);
    try {
      const tokensToApprove = selectedAssets.map((asset) => {
        const token = tokens[asset.symbol];
        return {
          symbol: asset.symbol,
          amount: parseUnits(asset.amount, token.decimals),
        };
      });

      const { allApproved, approvalResults } =
        await multiTokenOps.approveMultipleTokens(tokensToApprove);

      // Track pending approvals
      approvalResults.forEach((result) => {
        if (result.success) {
          setPendingApprovals((prev) => new Set(prev).add(result.symbol));
        }
      });

      // Start polling to check for confirmation
      const pollForConfirmation = async (
        tokens: typeof tokensToApprove,
        attempts = 0
      ) => {
        if (attempts >= 20) {
          console.warn("Approval confirmation timeout reached");
          return;
        }

        try {
          const recheck = await multiTokenOps.checkMultipleAllowances(tokens);
          let allConfirmed = true;

          recheck.forEach((check) => {
            if (!check.needsApproval) {
              setApprovedTokens((prev) => new Set(prev).add(check.symbol));
              setPendingApprovals((prev) => {
                const newSet = new Set(prev);
                newSet.delete(check.symbol);
                return newSet;
              });
            } else {
              allConfirmed = false;
            }
          });

          if (!allConfirmed) {
            setTimeout(() => pollForConfirmation(tokens, attempts + 1), 3000);
          }
        } catch (error) {
          console.error("Error checking allowances:", error);
          setTimeout(() => pollForConfirmation(tokens, attempts + 1), 3000);
        }
      };

      setTimeout(() => pollForConfirmation(tokensToApprove), 2000);

      // Check for tokens that already had sufficient allowance
      const allowanceCheck =
        await multiTokenOps.checkMultipleAllowances(tokensToApprove);
      allowanceCheck.forEach((check) => {
        if (!check.needsApproval) {
          setApprovedTokens((prev) => new Set(prev).add(check.symbol));
        }
      });
    } catch (error) {
      console.error("Approval failed:", error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!address || !position) return;

    const selectedAssets = getSelectedAssets();
    if (selectedAssets.length === 0) return;

    setIsProcessing(true);
    setTransactionError(null);
    setTransactionHash(undefined);

    try {
      for (const asset of selectedAssets) {
        const token = tokens[asset.symbol];
        const amount = parseUnits(asset.amount, token.decimals);
        let txHash: `0x${string}` | undefined;

        if (activeTab === "supply") {
          txHash = await positionOps.supplyToPosition(
            position.address,
            token.address,
            amount
          );
        } else if (activeTab === "borrow") {
          txHash = await positionOps.borrowFromPosition(
            position.address,
            token.address,
            amount,
            asset.interestRateMode || 2,
            address
          );
        } else if (activeTab === "repay") {
          txHash = await positionOps.repayPosition(
            position.address,
            token.address,
            amount,
            asset.interestRateMode || 2
          );
        } else if (activeTab === "withdraw") {
          txHash = await positionOps.withdrawFromPosition(
            position.address,
            token.address,
            amount,
            address
          );
        }

        // Store the last transaction hash for receipt waiting
        if (txHash) {
          console.log(
            `🔄 ManagePosition ${activeTab} transaction submitted:`,
            txHash
          );
          setTransactionHash(txHash);
          // Don't set isProcessing to false here - let transaction handler handle it
        }
      }
    } catch (error) {
      console.error(`${activeTab} operation failed:`, error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : `${activeTab} operation failed`;
      const isUserRejection =
        errorMessage.toLowerCase().includes("reject") ||
        errorMessage.toLowerCase().includes("denied") ||
        errorMessage.toLowerCase().includes("cancelled");

      setTransactionError(
        isUserRejection ? "Transaction was rejected" : errorMessage
      );
      setTransactionHash(undefined);
      setIsProcessing(false);
    }
  };

  const getTabDescription = () => {
    switch (activeTab) {
      case "supply":
        return "Add more collateral to your position to improve your Health Factor and borrowing capacity.";
      case "borrow":
        return "Borrow additional assets against your collateral. Monitor your Health Factor to avoid liquidation.";
      case "repay":
        return "Repay part or all of your debt to improve your Health Factor and reduce liquidation risk.";
      case "withdraw":
        return "Withdraw collateral from your position. Ensure your Health Factor remains above 1.0.";
      default:
        return "";
    }
  };

  const getAssetFilterForTab = () => {
    switch (activeTab) {
      case "supply":
        return assets; // All assets can be supplied
      case "borrow":
        return assets; // All assets can be borrowed
      case "repay":
        // Only assets that are currently debt
        return assets.filter((asset) =>
          isAssetInPosition(asset.symbol, "debt")
        );
      case "withdraw":
        // Only assets that are currently collateral
        return assets.filter((asset) =>
          isAssetInPosition(asset.symbol, "collateral")
        );
      default:
        return assets;
    }
  };

  const getActionButtonText = () => {
    const selectedCount = getSelectedAssets().length;
    if (selectedCount === 0) return `Select assets to ${activeTab}`;

    const totalValue = getSelectedAssets().reduce((sum, asset) => {
      return sum + calculateUSDValue(asset.amount, asset.symbol);
    }, 0);

    return `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} ${selectedCount} asset${
      selectedCount > 1 ? "s" : ""
    }${totalValue > 0 ? ` • ${formatUSDValue(totalValue)}` : ""}`;
  };

  const needsApproval = () => {
    return activeTab === "supply" || activeTab === "repay";
  };

  const isReadyToExecute = () => {
    const selectedAssets = getSelectedAssets();
    if (selectedAssets.length === 0) return false;

    if (needsApproval()) {
      return selectedAssets.every((asset) => approvedTokens.has(asset.symbol));
    }

    return true;
  };

  // Get max amounts for validation
  const getMaxAmount = (symbol: string) => {
    if (activeTab === "repay") {
      // Max is current debt amount
      const debt = position?.debts?.find((d: any) => d.symbol === symbol);
      if (debt) {
        return parseFloat(formatUnits(debt.balance, debt.decimals));
      }
    } else if (activeTab === "withdraw") {
      // Max is current collateral amount (with some safety margin for HF)
      const collateral = position?.collaterals?.find(
        (c: any) => c.symbol === symbol
      );
      if (collateral) {
        return parseFloat(formatUnits(collateral.balance, collateral.decimals));
      }
    }
    return undefined;
  };

  const validateAmount = (symbol: string, amount: string) => {
    const maxAmount = getMaxAmount(symbol);
    if (maxAmount !== undefined && parseFloat(amount) > maxAmount) {
      return `Maximum ${activeTab === "repay" ? "repayable" : "withdrawable"} amount is ${maxAmount.toFixed(
        4
      )} ${symbol}`;
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={handleClose}
        />

        <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Manage Position
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Position:{" "}
                {position?.address
                  ? `${position.address.slice(0, 10)}...${position.address.slice(-4)}`
                  : "Loading..."}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                suppressHydrationWarning={true}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
            <div className="flex space-x-1">
              {(["supply", "borrow", "repay", "withdraw"] as ActionTab[])
                .filter((tab) => {
                  // Hide repay tab if there's no debt
                  if (tab === "repay") {
                    const hasDebt =
                      position?.debts &&
                      position.debts.length > 0 &&
                      position.debts.some((debt: any) => debt.balance > 0);
                    return hasDebt;
                  }
                  // Hide withdraw tab if there's no collateral
                  if (tab === "withdraw") {
                    const hasCollateral =
                      position?.collaterals &&
                      position.collaterals.length > 0 &&
                      position.collaterals.some(
                        (collateral: any) => collateral.balance > 0
                      );
                    return hasCollateral;
                  }
                  return true;
                })
                .map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === tab
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
              {getTabDescription()}
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Position Information */}
            <PositionInfo position={position} actionTab={activeTab} />

            {/* Price Status Indicator */}
            {pricesError && (
              <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="text-yellow-600 dark:text-yellow-400">
                      ⚠️
                    </div>
                    <span className="text-sm text-yellow-800 dark:text-yellow-200">
                      Price data unavailable - using fallback values
                    </span>
                  </div>
                  <button
                    onClick={refreshPrices}
                    className="text-xs text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Asset Selection */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Select Assets for{" "}
                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
                {getAssetFilterForTab().map((asset) => {
                  const token = tokens[asset.symbol];
                  const isInPosition = isAssetInPosition(
                    asset.symbol,
                    activeTab === "repay" ? "debt" : "collateral"
                  );
                  const maxAmount = getMaxAmount(asset.symbol);
                  const validationError = asset.amount
                    ? validateAmount(asset.symbol, asset.amount)
                    : null;

                  return (
                    <div
                      key={asset.symbol}
                      className={`p-4 border-2 rounded-xl transition-all duration-200 ${
                        asset.selected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900 shadow-md"
                          : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => {
                              setAssets((prev) =>
                                prev.map((a) =>
                                  a.symbol === asset.symbol
                                    ? { ...a, selected: !a.selected }
                                    : a
                                )
                              );
                            }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              asset.selected
                                ? "border-blue-500 bg-blue-500"
                                : "border-gray-300 dark:border-gray-500 hover:border-blue-400"
                            }`}
                          >
                            {asset.selected && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>

                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${getTokenColor(
                              asset.symbol
                            )}`}
                          >
                            {asset.symbol.charAt(0)}
                          </div>

                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 dark:text-white text-sm">
                              {asset.symbol}
                              {isInPosition && (
                                <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full">
                                  In Position
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                              Balance:{" "}
                              {parseFloat(
                                tokenBalances[
                                  asset.symbol as keyof typeof tokenBalances
                                ]?.formatted || "0"
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            {maxAmount !== undefined && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                Max{" "}
                                {activeTab === "repay"
                                  ? "repayable"
                                  : "withdrawable"}
                                : {maxAmount.toFixed(4)}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              {(() => {
                                const price = getPriceBySymbol(asset.symbol);
                                return price > 0
                                  ? `$${price.toFixed(4)}`
                                  : "Price loading...";
                              })()}
                            </div>
                          </div>
                        </div>

                        {asset.selected && (
                          <div className="flex items-center space-x-2">
                            <div className="text-right">
                              <input
                                type="number"
                                placeholder="0.0"
                                value={asset.amount}
                                onChange={(e) => {
                                  setAssets((prev) =>
                                    prev.map((a) =>
                                      a.symbol === asset.symbol
                                        ? { ...a, amount: e.target.value }
                                        : a
                                    )
                                  );
                                }}
                                max={maxAmount}
                                className={`w-24 px-3 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white dark:bg-gray-800 font-medium text-sm ${
                                  validationError
                                    ? "border-red-300 dark:border-red-600"
                                    : "border-gray-300 dark:border-gray-600"
                                }`}
                              />
                              {maxAmount !== undefined && (
                                <button
                                  onClick={() => {
                                    setAssets((prev) =>
                                      prev.map((a) =>
                                        a.symbol === asset.symbol
                                          ? {
                                              ...a,
                                              amount: maxAmount.toString(),
                                            }
                                          : a
                                      )
                                    );
                                  }}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mt-1 block"
                                >
                                  Max
                                </button>
                              )}
                              {asset.amount &&
                                parseFloat(asset.amount) > 0 &&
                                !validationError && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                                    {formatUSDValue(
                                      calculateUSDValue(
                                        asset.amount,
                                        asset.symbol
                                      )
                                    )}
                                  </div>
                                )}
                              {validationError && (
                                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                  {validationError}
                                </div>
                              )}
                            </div>

                            {activeTab === "borrow" && (
                              <select
                                value={asset.interestRateMode}
                                onChange={(e) => {
                                  setAssets((prev) =>
                                    prev.map((a) =>
                                      a.symbol === asset.symbol
                                        ? {
                                            ...a,
                                            interestRateMode: parseInt(
                                              e.target.value
                                            ) as 1 | 2,
                                          }
                                        : a
                                    )
                                  );
                                }}
                                className="px-2 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white dark:bg-gray-800 font-medium text-xs"
                              >
                                <option value={1}>Stable</option>
                                <option value={2}>Variable</option>
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Health Factor Estimation */}
            <HealthFactorEstimator
              position={position}
              selectedAssets={getSelectedAssets()}
              actionTab={activeTab}
              tokens={tokens}
            />

            {/* Error display */}
            {transactionError && (
              <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4 mt-6">
                <div className="flex items-start space-x-3">
                  <div className="text-red-600 dark:text-red-400 mt-1">❌</div>
                  <div className="text-sm text-red-800 dark:text-red-200">
                    <div className="font-medium mb-1">Transaction Failed</div>
                    <div>{transactionError}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              {needsApproval() && (
                <button
                  onClick={handleApprove}
                  disabled={
                    isApproving ||
                    getSelectedAssets().every((asset) =>
                      approvedTokens.has(asset.symbol)
                    ) ||
                    getSelectedAssets().some((asset) =>
                      pendingApprovals.has(asset.symbol)
                    ) ||
                    getSelectedAssets().some((asset) =>
                      validateAmount(asset.symbol, asset.amount)
                    )
                  }
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    getSelectedAssets().every((asset) =>
                      approvedTokens.has(asset.symbol)
                    )
                      ? "bg-green-600 text-white cursor-default"
                      : getSelectedAssets().some((asset) =>
                            pendingApprovals.has(asset.symbol)
                          )
                        ? "bg-yellow-600 text-white cursor-default"
                        : "bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50"
                  }`}
                >
                  {getSelectedAssets().every((asset) =>
                    approvedTokens.has(asset.symbol)
                  ) ? (
                    <div className="flex items-center justify-center space-x-2">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Approved</span>
                    </div>
                  ) : getSelectedAssets().some((asset) =>
                      pendingApprovals.has(asset.symbol)
                    ) ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Confirming Approval...</span>
                    </div>
                  ) : (
                    `Approve Token${getSelectedAssets().length > 1 ? "s" : ""}`
                  )}
                </button>
              )}

              <button
                onClick={handleExecuteAction}
                disabled={
                  !isReadyToExecute() ||
                  isProcessing ||
                  transactionHandler.isWaitingForReceipt ||
                  getSelectedAssets().some((asset) =>
                    validateAmount(asset.symbol, asset.amount)
                  )
                }
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing || transactionHandler.isWaitingForReceipt ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>
                      {transactionHandler.isWaitingForReceipt
                        ? "Confirming..."
                        : "Processing..."}
                    </span>
                  </div>
                ) : (
                  getActionButtonText()
                )}
              </button>
            </div>
          </div>

          {/* Full-screen transaction overlay */}
          <FullScreenTransactionOverlay
            isVisible={transactionHandler.showOverlay}
            isLoading={transactionHandler.isLoading}
            isWaitingForReceipt={transactionHandler.isWaitingForReceipt}
            isWaitingForSync={transactionHandler.isWaitingForSync}
            isSuccess={transactionHandler.isSuccess}
            error={transactionHandler.error}
            statusMessage={transactionHandler.statusMessage}
            transactionHash={transactionHandler.transactionHash}
            onClose={() => {
              console.log("Position management overlay closed");
            }}
          />

          {/* Debug overlay state */}
          {process.env.NODE_ENV === "development" && (
            <div className="fixed bottom-4 right-4 bg-black text-white p-2 rounded text-xs z-50">
              <div>
                showOverlay: {transactionHandler.showOverlay.toString()}
              </div>
              <div>isLoading: {transactionHandler.isLoading.toString()}</div>
              <div>
                isWaitingForReceipt:{" "}
                {transactionHandler.isWaitingForReceipt.toString()}
              </div>
              <div>
                isWaitingForSync:{" "}
                {transactionHandler.isWaitingForSync.toString()}
              </div>
              <div>txHash: {transactionHash?.slice(0, 10) || "none"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
