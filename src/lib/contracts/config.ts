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

// Subgraph endpoints configuration
export const SUBGRAPH_ENDPOINTS = {
  1: 'https://api.thegraph.com/subgraphs/name/debt-purchasing/mainnet', // Mainnet (placeholder)
  11155111: 'https://api.thegraph.com/subgraphs/name/debt-purchasing/sepolia', // Sepolia (placeholder)
} as const;

// Development configuration
export const SUBGRAPH_CONFIG = {
  USE_MOCK_DATA: false, // Set to false when real subgraph is deployed
  MOCK_DELAY: 1000, // Simulate network delay in development
  ENABLE_LOGGING: true,
} as const;

// GraphQL queries
export const SUBGRAPH_QUERIES = {
  GET_USER_POSITIONS: `
    query GetUserPositions($userAddress: String!) {
      user(id: $userAddress) {
        id
        totalPositions
        totalVolumeTraded
        positions {
          id
          nonce
          lastUpdatedAt
          collaterals {
            id
            token {
              id
              symbol
              decimals
              priceUSD
            }
            amount
            lastUpdatedAt
          }
          debts {
            id
            token {
              id
              symbol
              decimals
              priceUSD
            }
            amount
            interestRateMode
            lastUpdatedAt
          }
        }
      }
    }
  `,

  GET_POSITION_DETAILS: `
    query GetPositionDetails($positionId: String!) {
      debtPosition(id: $positionId) {
        id
        owner {
          id
        }
        nonce
        lastUpdatedAt
        collaterals {
          id
          token {
            id
            symbol
            decimals
            priceUSD
          }
          amount
          lastUpdatedAt
        }
        debts {
          id
          token {
            id
            symbol
            decimals
            priceUSD
          }
          amount
          interestRateMode
          lastUpdatedAt
        }
      }
    }
  `,

  GET_TOKEN_PRICES: `
    query GetTokenPrices($tokenAddresses: [String!]!) {
      tokens(where: { id_in: $tokenAddresses }) {
        id
        symbol
        decimals
        priceUSD
        lastUpdatedAt
      }
    }
  `,
} as const;
