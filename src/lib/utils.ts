import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Address, formatUnits } from "viem";
import { HealthFactorInfo, HealthFactorStatus, ORDER_CONSTANTS } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Health Factor utilities
export function formatHealthFactor(healthFactor: bigint): number {
  return Number(parseFloat(formatUnits(healthFactor, 18)).toFixed(4));
}

export function parseHealthFactor(healthFactor: number): bigint {
  return BigInt(
    Math.floor(healthFactor * Number(ORDER_CONSTANTS.HEALTH_FACTOR_PRECISION))
  );
}

export function getHealthFactorStatus(
  healthFactor: number
): HealthFactorStatus {
  if (healthFactor >= 2.0) return "safe";
  if (healthFactor >= 1.1) return "warning";
  return "danger";
}

export function getHealthFactorInfo(
  healthFactor: bigint,
  liquidationThreshold: bigint
): HealthFactorInfo {
  const value = formatHealthFactor(healthFactor);
  const status = getHealthFactorStatus(value);
  const threshold = Number(liquidationThreshold) / 10000; // Convert from basis points

  return {
    value,
    status,
    liquidationThreshold: threshold,
  };
}

// Address utilities
export function truncateAddress(
  address: string,
  prefixLength = 6,
  suffixLength = 4
): string {
  if (address.length <= prefixLength + suffixLength) {
    return address;
  }
  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Token amount formatting
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  precision = 4
): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr
    .slice(0, precision)
    .replace(/0+$/, "");

  if (trimmedFractional === "") {
    return wholePart.toString();
  }

  return `${wholePart}.${trimmedFractional}`;
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [wholePart, fractionalPart = ""] = amount.split(".");
  const paddedFractional = fractionalPart
    .padEnd(decimals, "0")
    .slice(0, decimals);
  return BigInt(wholePart + paddedFractional);
}

// Format wei values (BigInt) to USD display
export function formatWeiToUSD(weiValue: bigint): string {
  const usdValue = formatUnits(weiValue, 18);
  return formatNumberToUSD(parseFloat(usdValue));
}

// Format ether values (BigInt that represent USD amounts directly) to USD display
export function formatEtherToUSD(etherValue: bigint): string {
  const usdValue = Number(etherValue);
  return formatNumberToUSD(usdValue);
}

// Format regular number to USD display
export function formatNumberToUSD(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return "<$0.01";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Legacy function - keep for backward compatibility but mark as deprecated
export function formatUSD(value: bigint): string {
  console.warn(
    "formatUSD is deprecated. Use formatWeiToUSD or formatEtherToUSD instead."
  );
  return formatWeiToUSD(value);
}

// Percentage utilities
export function formatPercentage(percentage: number): string {
  return `${percentage.toFixed(2)}%`;
}

export function parseBasisPoints(percentage: number): bigint {
  return BigInt(Math.floor(percentage * 100)); // Convert percentage to basis points
}

export function formatBasisPoints(basisPoints: bigint): number {
  return Number(basisPoints) / 100; // Convert basis points to percentage
}

// Time utilities
export function formatTimeRemaining(date: Date | string): string {
  const targetDate = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "Expired";
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours}h`;
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  } else {
    return `${diffMinutes}m`;
  }
}

export function isOrderExpired(endTime: Date): boolean {
  return new Date() > endTime;
}

// Order validation
export function validateHealthFactorTrigger(
  triggerHF: number,
  currentHF: number
): string | null {
  // if (triggerHF <= 1.0) {
  //   return 'Trigger health factor must be above 1.0 to avoid liquidation';
  // }

  // if (triggerHF >= currentHF) {
  //   return 'Trigger health factor must be below current health factor';
  // }

  // if (triggerHF < ORDER_CONSTANTS.MIN_SAFE_HEALTH_FACTOR) {
  //   return `Trigger health factor should be at least ${ORDER_CONSTANTS.MIN_SAFE_HEALTH_FACTOR} for safety`;
  // }

  return null;
}

export function validateBonus(bonus: number): string | null {
  // bonus is in percentage format (e.g., 2 = 2%, not basis points)
  if (bonus <= 0 || bonus > 20) {
    return "Bonus must be between 0.1% and 20%";
  }

  if (bonus < 0.1) {
    return "Bonus should be at least 0.1%";
  }

  if (bonus > 10) {
    return "Warning: High bonus may reduce market appeal";
  }

  return null;
}

export function validateOrderValidity(validUntil: Date): string | null {
  const now = new Date();
  const maxValidUntil = new Date(
    now.getTime() +
      ORDER_CONSTANTS.MAX_ORDER_VALIDITY_DAYS * 24 * 60 * 60 * 1000
  );

  if (validUntil <= now) {
    return "Expiration must be in the future";
  }

  if (validUntil > maxValidUntil) {
    return `Maximum validity period is ${ORDER_CONSTANTS.MAX_ORDER_VALIDITY_DAYS} days`;
  }

  return null;
}

// Profit calculations
export function calculateFullOrderProfit(
  totalCollateralBase: bigint,
  totalDebtBase: bigint,
  bonus: number
): bigint {
  // New logic: Buyer gets bonusAmount as profit
  // bonusAmount = totalDebtBase * bonus / 10000 (bonus is already in basis points)
  const bonusAmount = (totalDebtBase * BigInt(bonus)) / BigInt(10000);
  return bonusAmount;
}

export function calculatePartialOrderCost(
  repayAmount: bigint,
  bonus: number
): bigint {
  const bonusAmount =
    (repayAmount * BigInt(bonus)) /
    BigInt(ORDER_CONSTANTS.BASIS_POINTS_PRECISION);
  return repayAmount + bonusAmount;
}

// Error handling
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
}

// Contract interaction helpers
export function encodeOrderTitle(title: {
  debt: Address;
  debtNonce: bigint;
  startTime: bigint;
  endTime: bigint;
  triggerHF: bigint;
}) {
  return {
    debt: title.debt,
    debtNonce: title.debtNonce,
    startTime: title.startTime,
    endTime: title.endTime,
    triggerHF: title.triggerHF,
  };
}

// Mock data helpers for development
export function generateMockAddress(): Address {
  const chars = "0123456789abcdef";
  let result = "0x";
  for (let i = 0; i < 40; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result as Address;
}

export function generateMockOrderId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Token symbol to name mapping
export const TOKEN_NAMES: Record<string, string> = {
  WETH: "Wrapped Ethereum",
  WBTC: "Wrapped Bitcoin",
  USDC: "USD Coin",
  USDT: "Tether USD",
  DAI: "Dai Stablecoin",
  AAVE: "Aave Token",
  LINK: "Chainlink",
};

export function getTokenName(symbol: string): string {
  return TOKEN_NAMES[symbol] || symbol;
}

// Precise number conversion utilities
export function toPreciseBigInt(
  value: number,
  decimals: number = 18,
  precision: number = 4
): bigint {
  // Ensure we preserve the specified precision without rounding
  const factor = Math.pow(10, decimals);
  const precisionFactor = Math.pow(10, precision);

  // Truncate to the specified precision instead of rounding
  const truncatedValue = Math.floor(value * precisionFactor) / precisionFactor;

  // Convert to bigint with full precision
  const result = truncatedValue * factor;

  // Use Math.floor to avoid any rounding up
  return BigInt(Math.floor(result));
}

export function toPreciseWei(value: number, precision: number = 4): bigint {
  return toPreciseBigInt(value, 18, precision);
}

export function toPreciseTokenAmount(
  value: number,
  tokenDecimals: number,
  precision: number = 4
): bigint {
  return toPreciseBigInt(value, tokenDecimals, precision);
}

// Alternative method using string manipulation for even more precision
export function toPreciseBigIntString(
  value: number,
  decimals: number = 18,
  precision: number = 4
): bigint {
  // Convert to string with fixed precision
  const valueStr = value.toFixed(precision);
  const [wholePart, fractionalPart = ""] = valueStr.split(".");

  // Pad fractional part to match decimals
  const paddedFractional = fractionalPart
    .padEnd(decimals, "0")
    .slice(0, decimals);

  // Combine and convert to bigint
  return BigInt(wholePart + paddedFractional);
}

// Precise number formatting utilities for UI display
export function formatPreciseNumber(
  value: number,
  precision: number = 4
): string {
  const factor = Math.pow(10, precision);
  const truncatedValue = Math.floor(value * factor) / factor;
  return truncatedValue.toString();
}

export function formatPreciseHealthFactor(
  value: number,
  decimals: number = 3
): string {
  const factor = Math.pow(10, decimals);
  const truncatedValue = Math.floor(value * factor) / factor;
  return truncatedValue.toFixed(decimals);
}

export function formatPrecisePercentage(
  percentage: number,
  decimals: number = 2
): string {
  const factor = Math.pow(10, decimals);
  const truncatedValue = Math.floor(percentage * factor) / factor;
  return `${truncatedValue.toFixed(decimals)}%`;
}

export function formatBasisPointsToPercentage(
  basisPoints: number,
  decimals: number = 2
): string {
  const percentage = basisPoints / 100; // Convert basis points to percentage
  const factor = Math.pow(10, decimals);
  const truncatedValue = Math.floor(percentage * factor) / factor;
  return `${truncatedValue.toFixed(decimals)}%`;
}

/* 
Example of precision improvement:
- Old method: Math.round(1234.56789 * 1e18) = 1234567890000000000000n (rounded)
- New method: toPreciseWei(1234.56789) = 1234567800000000000000n (preserves 4 decimals exactly)
*/

// Precise USD formatting functions
export function formatPreciseUSD(value: number, decimals: number = 4): string {
  if (value === 0) return "$0.00";
  if (value < 0.0001) return "<$0.0001";

  // Use precise truncation instead of rounding
  const factor = Math.pow(10, decimals);
  const truncatedValue = Math.floor(value * factor) / factor;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  }).format(truncatedValue);
}

// Format wei values (BigInt) to precise USD display
export function formatPreciseWeiToUSD(
  weiValue: bigint,
  decimals: number = 4
): string {
  const usdValue = formatUnits(weiValue, 18);
  return formatPreciseUSD(parseFloat(usdValue), decimals);
}

// Format ether values (BigInt that represent USD amounts directly) to precise USD display
export function formatPreciseEtherToUSD(
  etherValue: bigint,
  decimals: number = 4
): string {
  const usdValue = Number(etherValue);
  return formatPreciseUSD(usdValue, decimals);
}
