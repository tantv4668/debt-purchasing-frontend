import { Address } from 'viem';
import { HealthFactorInfo, HealthFactorStatus, ORDER_CONSTANTS } from './types';

export function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

// Health Factor utilities
export function formatHealthFactor(healthFactor: bigint): number {
  return Number(healthFactor) / Number(ORDER_CONSTANTS.HEALTH_FACTOR_PRECISION);
}

export function parseHealthFactor(healthFactor: number): bigint {
  return BigInt(Math.floor(healthFactor * Number(ORDER_CONSTANTS.HEALTH_FACTOR_PRECISION)));
}

export function getHealthFactorStatus(healthFactor: number): HealthFactorStatus {
  if (healthFactor >= 2.0) return 'safe';
  if (healthFactor >= 1.1) return 'warning';
  return 'danger';
}

export function getHealthFactorInfo(healthFactor: bigint, liquidationThreshold: bigint): HealthFactorInfo {
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
export function truncateAddress(address: Address, chars = 4): string {
  return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`;
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Token amount formatting
export function formatTokenAmount(amount: bigint, decimals: number, precision = 4): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === BigInt(0)) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.slice(0, precision).replace(/0+$/, '');

  if (trimmedFractional === '') {
    return wholePart.toString();
  }

  return `${wholePart}.${trimmedFractional}`;
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [wholePart, fractionalPart = ''] = amount.split('.');
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(wholePart + paddedFractional);
}

// USD amount formatting
export function formatUSD(amount: bigint, decimals = 8): string {
  const formatted = formatTokenAmount(amount, decimals, 2);
  return `$${parseFloat(formatted).toLocaleString()}`;
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
export function formatTimeRemaining(endTime: Date): string {
  const now = new Date();
  const diff = endTime.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Expired';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function isOrderExpired(endTime: Date): boolean {
  return new Date() > endTime;
}

// Order validation
export function validateHealthFactorTrigger(triggerHF: number, currentHF: number): string | null {
  if (triggerHF <= 1.0) {
    return 'Trigger health factor must be above 1.0 to avoid liquidation';
  }

  if (triggerHF >= currentHF) {
    return 'Trigger health factor must be below current health factor';
  }

  if (triggerHF < ORDER_CONSTANTS.MIN_SAFE_HEALTH_FACTOR) {
    return `Trigger health factor should be at least ${ORDER_CONSTANTS.MIN_SAFE_HEALTH_FACTOR} for safety`;
  }

  return null;
}

export function validatePercentOfEquity(percent: number): string | null {
  if (percent <= 0 || percent > 100) {
    return 'Percentage must be between 0 and 100';
  }

  if (percent < 10) {
    return 'Percentage should be at least 10% to be attractive to buyers';
  }

  return null;
}

export function validateOrderValidity(validUntil: Date): string | null {
  const now = new Date();
  const maxValidUntil = new Date(now.getTime() + ORDER_CONSTANTS.MAX_ORDER_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  if (validUntil <= now) {
    return 'Expiration must be in the future';
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
  percentOfEquity: number,
): bigint {
  const netEquity = totalCollateralBase - totalDebtBase;
  const buyerEquity =
    netEquity - (netEquity * BigInt(percentOfEquity * 100)) / BigInt(ORDER_CONSTANTS.BASIS_POINTS_PRECISION);
  return buyerEquity;
}

export function calculatePartialOrderCost(repayAmount: bigint, bonus: number): bigint {
  const bonusAmount = (repayAmount * BigInt(bonus * 100)) / BigInt(ORDER_CONSTANTS.BASIS_POINTS_PRECISION);
  return repayAmount + bonusAmount;
}

// Error handling
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
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
  const chars = '0123456789abcdef';
  let result = '0x';
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
  WETH: 'Wrapped Ethereum',
  WBTC: 'Wrapped Bitcoin',
  USDC: 'USD Coin',
  USDT: 'Tether USD',
  DAI: 'Dai Stablecoin',
  AAVE: 'Aave Token',
  LINK: 'Chainlink',
};

export function getTokenName(symbol: string): string {
  return TOKEN_NAMES[symbol] || symbol;
}
