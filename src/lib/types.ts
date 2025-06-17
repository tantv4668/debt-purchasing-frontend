import { Address } from 'viem';

// Order Title structure from smart contract
export interface OrderTitle {
  debt: string;
  debtNonce: bigint;
  startTime: bigint;
  endTime: bigint;
  triggerHF: bigint; // 18 decimal precision (e.g., 1.5 = 1.5e18)
}

// Full Sell Order structure from smart contract
export interface FullSellOrder {
  title: OrderTitle;
  token: string; // Payment token address
  percentOfEquity: number; // Basis points (e.g., 9000 = 90%)
  v: number;
  r: string;
  s: string;
}

// Partial Sell Order structure from smart contract
export interface PartialSellOrder {
  title: OrderTitle;
  interestRateMode: number; // 1 = stable, 2 = variable
  collateralOut: string[]; // Array of collateral token addresses
  percents: number[]; // Array of percentages for each collateral (basis points)
  repayToken: string; // Token to repay debt with
  repayAmount: bigint; // Amount to repay
  bonus: number; // Basis points bonus for buyer
  v: number;
  r: string;
  s: string;
}

// Frontend-specific order types
export type OrderType = 'full' | 'partial';

export interface CreateFullSellOrderParams {
  debtAddress: string;
  triggerHealthFactor: number; // Regular number (e.g., 1.5)
  equityPercentage: number; // Percentage 0-100
  paymentToken: string;
  validityPeriodHours: number;
}

export interface CreatePartialSellOrderParams {
  debtAddress: string;
  triggerHealthFactor: number;
  repayToken: string;
  repayAmount: string; // String to handle large numbers
  collateralTokens: string[];
  collateralPercentages: number[]; // Percentages that must sum to 100
  buyerBonus: number; // Percentage 0-100
  validityPeriodHours: number;
}

// Debt position information
export interface DebtPosition {
  address: string;
  owner: string;
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  healthFactor: bigint;
  collateralTokens: {
    address: string;
    symbol: string;
    amount: bigint;
    valueUSD: bigint;
  }[];
  debtTokens: {
    address: string;
    symbol: string;
    amount: bigint;
    valueUSD: bigint;
  }[];
}

export interface TokenBalance {
  token: Address;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  balanceUSD: bigint;
  aTokenAddress?: Address;
  debtTokenAddress?: Address;
}

// Market order for display
export interface MarketOrder {
  id: string;
  type: 'full' | 'partial';
  seller: Address;
  debtPosition: {
    address: Address;
    owner: Address;
    nonce: bigint;
    totalCollateralBase: bigint;
    totalDebtBase: bigint;
    availableBorrowsBase: bigint;
    currentLiquidationThreshold: bigint;
    ltv: bigint;
    healthFactor: bigint;
    collaterals: {
      token: Address;
      symbol: string;
      name: string;
      decimals: number;
      balance: bigint;
      balanceUSD: bigint;
    }[];
    debts: {
      token: Address;
      symbol: string;
      name: string;
      decimals: number;
      balance: bigint;
      balanceUSD: bigint;
    }[];
  };
  triggerHealthFactor: number;
  currentHealthFactor: number;
  estimatedProfit?: bigint;
  validUntil: Date;
  isActive: boolean;
  // Full order specific fields
  percentOfEquity?: number;
  paymentToken?: Address;
  // Partial order specific fields
  repayToken?: Address;
  repayAmount?: bigint;
  bonus?: number;
  collateralTokens?: Address[];
}

// Order execution result
export interface OrderExecutionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  profit?: bigint;
  gasCost?: bigint;
}

// Health factor status
export type HealthFactorStatus = 'safe' | 'warning' | 'danger' | 'critical';

export interface HealthFactorInfo {
  value: number;
  status: HealthFactorStatus;
  liquidationThreshold: number;
}

// Form validation types
export interface OrderFormErrors {
  triggerHealthFactor?: string;
  percentOfEquity?: string;
  repayAmount?: string;
  validUntil?: string;
  collateralTokens?: string;
  general?: string;
}

// Transaction states
export type TransactionState = 'idle' | 'preparing' | 'signing' | 'pending' | 'success' | 'error';

export interface TransactionStatus {
  state: TransactionState;
  hash?: string;
  error?: string;
}

// EIP-712 domain and types
export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

// Constants from smart contract
export const ORDER_CONSTANTS = {
  // Health factor precision (1e18 = 1.0)
  HEALTH_FACTOR_PRECISION: BigInt(1e18),

  // Basis points precision (10000 = 100%)
  BASIS_POINTS_PRECISION: 10000,

  // Minimum health factor for safety
  MIN_SAFE_HEALTH_FACTOR: 1.5,

  // Maximum order validity period (30 days)
  MAX_ORDER_VALIDITY_DAYS: 30,
} as const;

// Constants
export const HEALTH_FACTOR_DECIMALS = 18;
export const BASIS_POINTS_DIVISOR = 10000;
export const SECONDS_PER_HOUR = 3600;
export const MAX_VALIDITY_PERIOD_HOURS = 24 * 30; // 30 days
