// Contract configuration constants
import { ChainId } from './chains';

// Aave Pool ABI extension for getUserAccountData
export const AAVE_POOL_EXTENSIONS = [
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getUserAccountData',
    outputs: [
      { internalType: 'uint256', name: 'totalCollateralBase', type: 'uint256' },
      { internalType: 'uint256', name: 'totalDebtBase', type: 'uint256' },
      { internalType: 'uint256', name: 'availableBorrowsBase', type: 'uint256' },
      { internalType: 'uint256', name: 'currentLiquidationThreshold', type: 'uint256' },
      { internalType: 'uint256', name: 'ltv', type: 'uint256' },
      { internalType: 'uint256', name: 'healthFactor', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Contract operation defaults
export const CONTRACT_DEFAULTS = {
  CHAIN_ID: ChainId.SEPOLIA,
  MAX_UINT256: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000' as const,
  HEALTH_FACTOR_DECIMALS: 18,
  CACHE_EXPIRY_MS: 5 * 60 * 1000, // 5 minutes
} as const;

// Error messages
export const CONTRACT_ERRORS = {
  WALLET_NOT_CONNECTED: 'Wallet not connected',
  TOKEN_NOT_SUPPORTED: (token: string, chain: number) => `Token ${token} not supported on chain ${chain}`,
  INVALID_ADDRESS: 'Invalid address provided',
  INSUFFICIENT_ALLOWANCE: 'Insufficient token allowance',
  TRANSACTION_FAILED: 'Transaction failed',
  CONTRACT_CALL_FAILED: 'Contract call failed',
} as const;

// Debug configuration
export const DEBUG_CONFIG = {
  ENABLE_CONSOLE_LOGS: process.env.NODE_ENV === 'development',
  LOG_LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
  } as const,
} as const;

// Position fetching configuration
export const POSITION_CONFIG = {
  MAX_NONCE_ITERATIONS: 100, // Safety limit for nonce iterations
  FALLBACK_RETRY_COUNT: 3,
  POSITION_CACHE_KEY: 'user_debt_positions',
} as const;

// Backend API configuration
export const BACKEND_API_CONFIG = {
  BASE_URL: (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002').replace(/\/api$/, '') + '/api',
  TIMEOUT: 10000,
  USE_CACHE: true,
} as const;
