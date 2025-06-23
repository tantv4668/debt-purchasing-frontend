import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { useLiquidationThresholds } from './useLiquidationThresholds';
import { usePriceTokens } from './usePriceTokens';

export interface AssetBalance {
  symbol: string;
  balance: bigint;
  decimals: number;
  address?: string;
}

export interface HealthFactorData {
  healthFactor: number;
  totalCollateralValue: number;
  totalBorrowedValue: number;
  weightedAvgLiquidationThreshold: number;
  status: 'safe' | 'warning' | 'danger' | 'critical';
  color: string;
  label: string;
  isLoading: boolean;
  error?: string;
}

export function useHealthFactor(collaterals: AssetBalance[], debts: AssetBalance[]): HealthFactorData {
  const { getPriceBySymbol, isLoading: pricesLoading, error: pricesError } = usePriceTokens();
  const {
    getLiquidationThresholdBySymbol,
    isLoading: thresholdsLoading,
    error: thresholdsError,
  } = useLiquidationThresholds();

  const healthFactorData = useMemo(() => {
    const isLoading = pricesLoading || thresholdsLoading;
    const error = pricesError || thresholdsError;

    if (isLoading) {
      return {
        healthFactor: 0,
        totalCollateralValue: 0,
        totalBorrowedValue: 0,
        weightedAvgLiquidationThreshold: 0,
        status: 'safe' as const,
        color: 'text-gray-400',
        label: 'Loading...',
        isLoading: true,
      };
    }

    if (error) {
      return {
        healthFactor: 0,
        totalCollateralValue: 0,
        totalBorrowedValue: 0,
        weightedAvgLiquidationThreshold: 0,
        status: 'safe' as const,
        color: 'text-red-500',
        label: 'Error',
        isLoading: false,
        error,
      };
    }

    // Calculate total collateral value with liquidation thresholds
    let totalCollateralValueWeighted = 0;
    let totalCollateralValue = 0;

    console.log('=== HEALTH FACTOR CALCULATION START ===');

    for (const collateral of collaterals) {
      const price = getPriceBySymbol(collateral.symbol);
      const liquidationThreshold = getLiquidationThresholdBySymbol(collateral.symbol);
      const amount = parseFloat(formatUnits(collateral.balance, collateral.decimals));
      const value = amount * price;

      totalCollateralValue += value;
      totalCollateralValueWeighted += value * liquidationThreshold;

      console.log(`Collateral ${collateral.symbol}:`);
      console.log(`  - Amount: ${amount.toFixed(4)}`);
      console.log(`  - Price: $${price.toFixed(2)}`);
      console.log(
        `  - Liquidation Threshold: ${liquidationThreshold.toFixed(3)} (${(liquidationThreshold * 100).toFixed(1)}%)`,
      );
      console.log(`  - Value: $${value.toFixed(2)}`);
      console.log(`  - Weighted Value: $${(value * liquidationThreshold).toFixed(2)}`);
    }

    // Calculate total borrowed value
    let totalBorrowedValue = 0;
    for (const debt of debts) {
      const price = getPriceBySymbol(debt.symbol);
      const amount = parseFloat(formatUnits(debt.balance, debt.decimals));
      const value = amount * price;

      totalBorrowedValue += value;

      console.log(`Debt ${debt.symbol}:`);
      console.log(`  - Amount: ${amount.toFixed(4)}`);
      console.log(`  - Price: $${price.toFixed(2)}`);
      console.log(`  - Value: $${value.toFixed(2)}`);
    }

    // Calculate Health Factor using Aave formula
    // HF = (Sum of: Collateral Value × Liquidation Threshold) / Total Borrowed Value
    const healthFactor =
      totalBorrowedValue > 0 ? totalCollateralValueWeighted / totalBorrowedValue : Number.MAX_SAFE_INTEGER;

    // Calculate weighted average liquidation threshold
    const weightedAvgLiquidationThreshold =
      totalCollateralValue > 0 ? totalCollateralValueWeighted / totalCollateralValue : 0;

    console.log('=== HEALTH FACTOR SUMMARY ===');
    console.log(`Total Collateral Value: $${totalCollateralValue.toFixed(2)}`);
    console.log(`Weighted Collateral Value: $${totalCollateralValueWeighted.toFixed(2)}`);
    console.log(`Total Borrowed Value: $${totalBorrowedValue.toFixed(2)}`);
    console.log(`Health Factor: ${healthFactor.toFixed(4)}`);
    console.log(`Weighted Avg LT: ${(weightedAvgLiquidationThreshold * 100).toFixed(2)}%`);
    console.log('=== HEALTH FACTOR CALCULATION END ===');

    // Determine status and styling
    let status: 'safe' | 'warning' | 'danger' | 'critical';
    let color: string;
    let label: string;

    if (healthFactor >= 2.0) {
      status = 'safe';
      color = 'text-green-600 dark:text-green-400';
      label = 'Safe';
    } else if (healthFactor >= 1.5) {
      status = 'warning';
      color = 'text-yellow-600 dark:text-yellow-400';
      label = 'Warning';
    } else if (healthFactor >= 1.1) {
      status = 'danger';
      color = 'text-orange-600 dark:text-orange-400';
      label = 'Risk';
    } else {
      status = 'critical';
      color = 'text-red-600 dark:text-red-400';
      label = healthFactor < 1 ? 'Liquidatable' : 'Critical';
    }

    return {
      healthFactor,
      totalCollateralValue,
      totalBorrowedValue,
      weightedAvgLiquidationThreshold,
      status,
      color,
      label,
      isLoading: false,
    };
  }, [
    collaterals,
    debts,
    getPriceBySymbol,
    getLiquidationThresholdBySymbol,
    pricesLoading,
    thresholdsLoading,
    pricesError,
    thresholdsError,
  ]);

  return healthFactorData;
}

// Helper function to format health factor for display
export function formatHealthFactor(hf: number): string {
  if (hf === Number.MAX_SAFE_INTEGER) return '∞';
  return hf.toFixed(2);
}
