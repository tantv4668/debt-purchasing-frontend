"use client";

import { ChainId } from "@/lib/contracts/chains";
import { SUPPORTED_TOKENS } from "@/lib/contracts/tokens";
import {
  CreateFullSellOrderParams,
  CreatePartialSellOrderParams,
  OrderFormErrors,
  OrderType,
  TransactionStatus,
} from "@/lib/types";
import { DebtPosition } from "@/lib/types/debt-position";
import { useEffect, useMemo, useState } from "react";
import { Address } from "viem";
import { useChainId } from "wagmi";
import {
  formatHealthFactor,
  formatWeiToUSD,
  validateHealthFactorTrigger,
  validateOrderValidity,
  validatePercentOfEquity,
} from "../lib/utils";

interface CreateSellOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtPosition: DebtPosition;
  onCreateOrder: (
    params: CreateFullSellOrderParams | CreatePartialSellOrderParams
  ) => Promise<void>;
}

export default function CreateSellOrderModal({
  isOpen,
  onClose,
  debtPosition,
  onCreateOrder,
}: CreateSellOrderModalProps) {
  const chainId = useChainId();

  // Get payment tokens available on current chain
  const paymentTokens = useMemo(() => {
    const currentChainId = (chainId as ChainId) || ChainId.SEPOLIA;

    // Select commonly used payment tokens (stablecoins and major assets)
    const preferredTokens = ["WBTC", "USDC", "DAI", "USDT"];

    return preferredTokens
      .map((symbol) => {
        const token = SUPPORTED_TOKENS[symbol];
        if (!token || !token.addresses[currentChainId]) return null;

        return {
          address: token.addresses[currentChainId] as Address,
          symbol: token.symbol,
          name: token.name,
        };
      })
      .filter(Boolean) as Array<{
      address: Address;
      symbol: string;
      name: string;
    }>;
  }, [chainId]);

  const [orderType, setOrderType] = useState<OrderType>("full");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [txStatus, setTxStatus] = useState<TransactionStatus>({
    state: "idle",
  });

  // Full order form state
  const [triggerHealthFactor, setTriggerHealthFactor] = useState("1.4");
  const [percentOfEquity, setPercentOfEquity] = useState("90");
  const [paymentToken, setPaymentToken] = useState<Address>("0x" as Address);
  const [validDays, setValidDays] = useState("7");

  // Partial order form state
  const [repayToken, setRepayToken] = useState<Address>("0x" as Address);
  const [repayAmount, setRepayAmount] = useState("");
  const [selectedCollateral, setSelectedCollateral] = useState<Address>(
    "0x" as Address
  );
  const [bonus, setBonus] = useState("1");

  // Update token states when paymentTokens change
  useEffect(() => {
    if (paymentTokens.length > 0) {
      if (paymentToken === "0x") {
        setPaymentToken(paymentTokens[0].address);
      }
    }
  }, [paymentTokens, paymentToken]);

  // Set initial repay token from debt tokens
  useEffect(() => {
    if (debtPosition?.debts?.length > 0 && repayToken === "0x") {
      setRepayToken(debtPosition.debts[0].token);
    }
  }, [debtPosition, repayToken]);

  // Set initial collateral when debt position is available
  useEffect(() => {
    if (debtPosition?.collaterals?.length > 0 && selectedCollateral === "0x") {
      setSelectedCollateral(debtPosition.collaterals[0].token);
    }
  }, [debtPosition, selectedCollateral]);

  const currentHealthFactor = formatHealthFactor(debtPosition.healthFactor);

  const validateForm = (): boolean => {
    const newErrors: OrderFormErrors = {};

    // Validate trigger health factor
    const triggerHF = parseFloat(triggerHealthFactor);
    const triggerError = validateHealthFactorTrigger(
      triggerHF,
      currentHealthFactor
    );
    if (triggerError) {
      newErrors.triggerHealthFactor = triggerError;
    }

    // Validate order validity
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + parseInt(validDays));
    const validityError = validateOrderValidity(validUntil);
    if (validityError) {
      newErrors.validUntil = validityError;
    }

    if (orderType === "full") {
      // Validate percent of equity
      const percent = parseFloat(percentOfEquity);
      const percentError = validatePercentOfEquity(percent);
      if (percentError) {
        newErrors.percentOfEquity = percentError;
      }
    } else {
      // Validate repay token selection
      if (!repayToken || repayToken === "0x") {
        newErrors.repayAmount = "Please select a debt token to repay";
      } else if (!repayAmount || parseFloat(repayAmount) <= 0) {
        // Validate repay amount only if token is selected
        newErrors.repayAmount = "Repay amount must be greater than 0";
      } else {
        // Validate repay amount doesn't exceed debt balance
        const selectedDebt = debtPosition.debts.find(
          (debt) => debt.token === repayToken
        );
        if (selectedDebt && selectedDebt.balanceFormatted) {
          const balanceStr = String(selectedDebt.balanceFormatted);
          const maxRepayAmount = parseFloat(balanceStr.replace(/,/g, ""));
          const requestedAmount = parseFloat(repayAmount);
          if (requestedAmount > maxRepayAmount) {
            newErrors.repayAmount = `Repay amount cannot exceed ${balanceStr} ${selectedDebt.symbol}`;
          }
        }
      }

      // Validate collateral selection
      if (!selectedCollateral || selectedCollateral === "0x") {
        newErrors.collateralToken = "Please select a collateral token";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setTxStatus({ state: "preparing" });

    try {
      const validityPeriodHours = parseInt(validDays) * 24;

      if (orderType === "full") {
        const params: CreateFullSellOrderParams = {
          debtAddress: debtPosition.address,
          debtNonce: debtPosition.nonce || 0, // Use current nonce from debt position
          triggerHealthFactor: parseFloat(triggerHealthFactor),
          equityPercentage: parseFloat(percentOfEquity),
          paymentToken,
          validityPeriodHours,
        };
        await onCreateOrder(params);
      } else {
        // Get decimals of selected repay token
        const selectedDebt = debtPosition.debts.find(
          (debt) => debt.token === repayToken
        );
        const repayTokenDecimals = selectedDebt?.decimals || 18; // Default to 18 if not found

        const params: CreatePartialSellOrderParams = {
          debtAddress: debtPosition.address,
          debtNonce: debtPosition.nonce || 0, // Use current nonce from debt position
          triggerHealthFactor: parseFloat(triggerHealthFactor),
          repayToken,
          repayAmount,
          repayTokenDecimals,
          collateralToken: selectedCollateral,
          buyerBonus: parseFloat(bonus),
          validityPeriodHours,
        };
        await onCreateOrder(params);
      }

      setTxStatus({ state: "success" });
      setTimeout(() => {
        onClose();
        setTxStatus({ state: "idle" });
      }, 2000);
    } catch (error) {
      setTxStatus({
        state: "error",
        error: error instanceof Error ? error.message : "Transaction failed",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Create Sell Order
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
              disabled={isLoading}
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Position Info */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Position Overview
            </h3>

            {/* Available Collateral */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Available Collateral
              </h4>
              <div className="space-y-1">
                {debtPosition.collaterals.map((collateral) => (
                  <div
                    key={collateral.token}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-gray-600 dark:text-gray-400">
                      {collateral.balanceFormatted} {collateral.symbol}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ${collateral.valueInUSD.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between items-center text-sm font-medium pt-1 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-gray-900 dark:text-white">
                    Total Collateral
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {formatWeiToUSD(debtPosition.totalCollateralBase)}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Debt */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Debt
              </h4>
              <div className="space-y-1">
                {debtPosition.debts.map((debt) => (
                  <div
                    key={debt.token}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-gray-600 dark:text-gray-400">
                      {debt.balanceFormatted} {debt.symbol}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ${debt.valueInUSD.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between items-center text-sm font-medium pt-1 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-gray-900 dark:text-white">
                    Total Debt
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {formatWeiToUSD(debtPosition.totalDebtBase)}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-gray-200 dark:border-gray-600">
              <div>
                <span className="text-gray-600 dark:text-gray-300">
                  Health Factor:
                </span>
                <span
                  className={`ml-2 font-medium ${
                    currentHealthFactor >= 2
                      ? "text-green-600"
                      : currentHealthFactor >= 1.4
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {formatHealthFactor(debtPosition.healthFactor)}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-300">
                  Net Equity:
                </span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {formatWeiToUSD(
                    debtPosition.totalCollateralBase -
                      debtPosition.totalDebtBase
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Order Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Order Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrderType("full")}
                className={`p-4 rounded-lg border text-left ${
                  orderType === "full"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-900 dark:text-white"
                }`}
              >
                <div className="font-medium">Full Sale</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Sell entire position for percentage of equity
                </div>
              </button>
              <button
                type="button"
                onClick={() => setOrderType("partial")}
                className={`p-4 rounded-lg border text-left ${
                  orderType === "partial"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-900 dark:text-white"
                }`}
              >
                <div className="font-medium">Partial Sale</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Partial debt repayment for collateral
                </div>
              </button>
            </div>
          </div>

          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Trigger Health Factor
              </label>
              <input
                type="number"
                step="0.1"
                min="1.1"
                // max={currentHealthFactor.toString()}
                value={triggerHealthFactor}
                onChange={(e) => setTriggerHealthFactor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={isLoading}
              />
              {errors.triggerHealthFactor && (
                <p className="text-red-600 text-xs mt-1">
                  {errors.triggerHealthFactor}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Valid for (days)
              </label>
              <select
                value={validDays}
                onChange={(e) => setValidDays(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={isLoading}
              >
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
              {errors.validUntil && (
                <p className="text-red-600 text-xs mt-1">{errors.validUntil}</p>
              )}
            </div>
          </div>

          {/* Full Order Specific Fields */}
          {orderType === "full" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Equity Share (%)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={percentOfEquity}
                    onChange={(e) => setPercentOfEquity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={isLoading}
                  />
                  {errors.percentOfEquity && (
                    <p className="text-red-600 text-xs mt-1">
                      {errors.percentOfEquity}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Token
                  </label>
                  <select
                    value={paymentToken}
                    onChange={(e) => setPaymentToken(e.target.value as Address)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={isLoading}
                  >
                    {paymentTokens.map((token) => (
                      <option key={token.address} value={token.address}>
                        {token.symbol} - {token.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Partial Order Specific Fields */}
          {orderType === "partial" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Repay Token
                  </label>
                  <select
                    value={repayToken}
                    onChange={(e) => setRepayToken(e.target.value as Address)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={isLoading}
                  >
                    <option value="0x">Select debt token to repay</option>
                    {debtPosition.debts.map((debt) => (
                      <option key={debt.token} value={debt.token}>
                        {debt.symbol} - {debt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Repay Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={isLoading}
                    placeholder="Amount to repay"
                  />
                  {errors.repayAmount && (
                    <p className="text-red-600 text-xs mt-1">
                      {errors.repayAmount}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Buyer Bonus (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={bonus}
                  onChange={(e) => setBonus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={isLoading}
                />
              </div>

              {/* Collateral Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Collateral to Withdraw
                </label>
                <div className="space-y-2">
                  {debtPosition.collaterals.map((collateral) => (
                    <div
                      key={collateral.token}
                      className="flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    >
                      <div className="flex items-center">
                        <input
                          type="radio"
                          checked={selectedCollateral === collateral.token}
                          onChange={() =>
                            setSelectedCollateral(collateral.token)
                          }
                          className="mr-3"
                          disabled={isLoading}
                        />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {collateral.symbol}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {collateral.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {errors.collateralToken && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.collateralToken}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Transaction Status */}
          {txStatus.state !== "idle" && (
            <div
              className={`p-4 rounded-lg ${
                txStatus.state === "success"
                  ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                  : txStatus.state === "error"
                    ? "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                    : "bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
              }`}
            >
              <div className="flex items-center">
                {txStatus.state === "preparing" && (
                  <div className="spinner mr-2" />
                )}
                {txStatus.state === "success" && (
                  <span className="mr-2">✓</span>
                )}
                {txStatus.state === "error" && <span className="mr-2">✗</span>}
                <span>
                  {txStatus.state === "preparing" && "Preparing transaction..."}
                  {txStatus.state === "signing" &&
                    "Please sign the transaction"}
                  {txStatus.state === "pending" && "Transaction pending..."}
                  {txStatus.state === "success" &&
                    "Order created successfully!"}
                  {txStatus.state === "error" &&
                    (txStatus.error || "Transaction failed")}
                </span>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || txStatus.state === "success"}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating Order..." : "Create Sell Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
