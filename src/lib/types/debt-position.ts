import type { TokenSymbol } from '../contracts';

// Re-export TokenSymbol for components
export type { TokenSymbol };

export interface DebtPosition {
  address: `0x${string}`;
  owner: `0x${string}`;
  nonce: number;
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
  collaterals: CollateralAsset[];
  debts: DebtAsset[];
  createdAt: number;
  lastUpdated: number;
}

export interface CollateralAsset {
  token: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  balanceFormatted: string;
  valueInBase: bigint;
  valueInUSD: number;
  aTokenAddress: `0x${string}`;
}

export interface DebtAsset {
  token: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  balanceFormatted: string;
  valueInBase: bigint;
  valueInUSD: number;
  interestRateMode: 1 | 2; // 1 = stable, 2 = variable
  variableDebtTokenAddress: `0x${string}`;
  stableDebtTokenAddress: `0x${string}`;
}

export interface CreatePositionParams {
  collateralAsset: `0x${string}`;
  collateralAmount: bigint;
  borrowAsset: `0x${string}`;
  borrowAmount: bigint;
  interestRateMode: 1 | 2;
}

export interface UserPositionSummary {
  totalPositions: number;
  totalDebtValue: number;
  totalCollateralValue: number;
  averageHealthFactor: number;
  positionsAtRisk: number; // HF < 1.5
}

// Health factor status
export type HealthFactorStatus = 'safe' | 'warning' | 'danger' | 'liquidation';

export interface HealthFactorInfo {
  value: number;
  status: HealthFactorStatus;
  color: string;
  label: string;
}

// Position creation flow state
export interface PositionCreationState {
  step: 'select-assets' | 'set-amounts' | 'review' | 'pending' | 'success' | 'error';
  collateralAsset?: `0x${string}`;
  borrowAsset?: `0x${string}`;
  collateralAmount?: string;
  borrowAmount?: string;
  interestRateMode?: 1 | 2;
  predictedAddress?: `0x${string}`;
  transactionHash?: `0x${string}`;
  error?: string;
}

// Multicall data structures
export interface MulticallOperation {
  target: `0x${string}`;
  data: `0x${string}`;
  description: string;
}

export interface CreatePositionMulticallData {
  operations: MulticallOperation[];
  totalEstimatedGas: bigint;
  approvalRequired: boolean;
  approvalToken?: `0x${string}`;
  approvalAmount?: bigint;
}
