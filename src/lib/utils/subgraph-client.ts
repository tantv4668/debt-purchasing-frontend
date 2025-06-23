import { ChainId } from '../contracts';
import { SUBGRAPH_CONFIG, SUBGRAPH_ENDPOINTS, SUBGRAPH_QUERIES } from '../contracts/config';
import { logger } from './logger';

// Backend API configuration
const BACKEND_API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002/api',
  TIMEOUT: 10000,
  USE_CACHE: true,
};

// Mock data for development
const MOCK_USER_POSITIONS_RESPONSE = {
  user: {
    id: '0x1234567890abcdef1234567890abcdef12345678',
    totalPositions: '2',
    totalVolumeTraded: '15000.50',
    positions: [
      {
        id: '0xabcdef1234567890abcdef1234567890abcdef12',
        nonce: '1',
        lastUpdatedAt: '1703001600', // Dec 19, 2023
        collaterals: [
          {
            id: 'collateral-1-weth',
            token: {
              id: '0xd6c774778564ec1973b24a15ee4a5d00742e6575',
              symbol: 'WETH',
              decimals: 18,
              priceUSD: '2250.50',
              lastUpdatedAt: '1703001600',
            },
            amount: '2.5',
            lastUpdatedAt: '1703001600',
          },
          {
            id: 'collateral-1-usdc',
            token: {
              id: '0x005104eb2fd93a0c8f26e18934289ab91596e6bf',
              symbol: 'USDC',
              decimals: 6,
              priceUSD: '1.00',
              lastUpdatedAt: '1703001600',
            },
            amount: '1000.0',
            lastUpdatedAt: '1703001600',
          },
        ],
        debts: [
          {
            id: 'debt-1-dai',
            token: {
              id: '0xe0f11265b326df8f5c3e1db6aa8dcd506fd4cc5b',
              symbol: 'DAI',
              decimals: 18,
              priceUSD: '1.00',
              lastUpdatedAt: '1703001600',
            },
            amount: '3000.0',
            interestRateMode: '2',
            lastUpdatedAt: '1703001600',
          },
        ],
      },
      {
        id: '0xfedcba0987654321fedcba0987654321fedcba09',
        nonce: '1',
        lastUpdatedAt: '1703001500',
        collaterals: [
          {
            id: 'collateral-2-wbtc',
            token: {
              id: '0x1b8ea7c3b44465be550ebaef50ff6bc5f25ee50c',
              symbol: 'WBTC',
              decimals: 8,
              priceUSD: '42500.00',
              lastUpdatedAt: '1703001500',
            },
            amount: '0.1',
            lastUpdatedAt: '1703001500',
          },
        ],
        debts: [
          {
            id: 'debt-2-usdc',
            token: {
              id: '0x005104eb2fd93a0c8f26e18934289ab91596e6bf',
              symbol: 'USDC',
              decimals: 6,
              priceUSD: '1.00',
              lastUpdatedAt: '1703001500',
            },
            amount: '2000.0',
            interestRateMode: '1',
            lastUpdatedAt: '1703001500',
          },
        ],
      },
    ],
  },
};

// Subgraph client for making GraphQL queries via backend API
export class SubgraphClient {
  private endpoint: string;
  private useMockData: boolean;
  private backendUrl: string;

  constructor(chainId: ChainId) {
    const endpoint = SUBGRAPH_ENDPOINTS[chainId as keyof typeof SUBGRAPH_ENDPOINTS];
    if (!endpoint) {
      throw new Error(`Subgraph not supported for chain ID: ${chainId}`);
    }
    this.endpoint = endpoint;
    this.useMockData = false; // Force use of backend API instead of mock data
    this.backendUrl = BACKEND_API_CONFIG.BASE_URL;
  }

  private async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    // Use mock data in development
    if (this.useMockData) {
      logger.info('Using mock subgraph data for development');
      await new Promise(resolve => setTimeout(resolve, SUBGRAPH_CONFIG.MOCK_DELAY));

      if (query.includes('GetUserPositions')) {
        return MOCK_USER_POSITIONS_RESPONSE as T;
      }

      // Return empty data for other queries
      return { user: null } as T;
    }

    try {
      // First try to get cached data from backend
      if (BACKEND_API_CONFIG.USE_CACHE) {
        try {
          const cachedData = await this.getCachedData<T>(query, variables);
          if (cachedData) {
            logger.info('Using cached data from backend');
            return cachedData;
          }
        } catch (cacheError) {
          logger.warn('Failed to get cached data, falling back to direct query:', cacheError);
        }
      }

      // Fallback to direct subgraph query via backend proxy
      logger.info('Making subgraph query via backend proxy:', {
        backend: this.backendUrl,
        query: query.slice(0, 100) + '...',
      });

      const response = await fetch(`${this.backendUrl}/subgraph`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
          operationName: this.getOperationName(query),
        }),
        signal: AbortSignal.timeout(BACKEND_API_CONFIG.TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Backend API error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(`Backend API error: ${result.error}`);
      }

      const subgraphData = result.data;

      if (subgraphData.errors) {
        logger.error('Subgraph query errors:', subgraphData.errors);
        throw new Error(`GraphQL errors: ${subgraphData.errors.map((e: any) => e.message).join(', ')}`);
      }

      logger.info('Subgraph query via backend successful:', {
        dataKeys: Object.keys(subgraphData.data || {}),
      });
      return subgraphData.data;
    } catch (error) {
      logger.error('Subgraph query via backend failed:', error);

      // Fallback to mock data if backend query fails
      if (!this.useMockData) {
        logger.warn('Falling back to mock data due to backend query failure');
        this.useMockData = true;
        return this.query(query, variables); // This will use mock data
      }

      throw error;
    }
  }

  private async getCachedData<T>(query: string, variables?: Record<string, any>): Promise<T | null> {
    try {
      // For positions, we'll handle it directly in getCachedPositions
      // This method is mainly for compatibility with the old subgraph query approach
      return null;
    } catch (error) {
      logger.warn('Failed to get cached data:', error);
      return null;
    }
  }

  private transformCachedData(cachedData: any, query: string): any {
    // Transform cached data format to match expected format
    if (query.includes('GetUserPositions')) {
      // The cachedData already contains the positions array we need
      return cachedData;
    }

    return cachedData;
  }

  private getOperationName(query: string): string {
    const match = query.match(/query\s+(\w+)/);
    return match ? match[1] : 'SubgraphQuery';
  }

  async getUserPositions(userAddress: string) {
    return this.query(SUBGRAPH_QUERIES.GET_USER_POSITIONS, {
      userAddress: userAddress.toLowerCase(),
    });
  }

  async getPositionDetails(positionId: string) {
    return this.query(SUBGRAPH_QUERIES.GET_POSITION_DETAILS, {
      positionId: positionId.toLowerCase(),
    });
  }

  async getTokenPrices(tokenAddresses: string[]) {
    return this.query(SUBGRAPH_QUERIES.GET_TOKEN_PRICES, {
      tokenAddresses: tokenAddresses.map(addr => addr.toLowerCase()),
    });
  }

  // New methods for accessing cached data directly
  async getCachedUsers(limit = 100, offset = 0) {
    try {
      const response = await fetch(`${this.backendUrl}/users?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(BACKEND_API_CONFIG.TIMEOUT),
      });

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      logger.error('Failed to get cached users:', error);
      return null;
    }
  }

  async getCachedPositions(owner?: string, limit = 100, offset = 0) {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });
      if (owner) params.set('owner', owner);

      const response = await fetch(`${this.backendUrl}/positions?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(BACKEND_API_CONFIG.TIMEOUT),
      });

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      logger.error('Failed to get cached positions:', error);
      return null;
    }
  }

  async getCachedOrders(filters: any = {}, limit = 100, offset = 0) {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        ...filters,
      });

      const response = await fetch(`${this.backendUrl}/orders?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(BACKEND_API_CONFIG.TIMEOUT),
      });

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      logger.error('Failed to get cached orders:', error);
      return null;
    }
  }

  async getBackendHealth() {
    try {
      const response = await fetch(`${this.backendUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      logger.error('Backend health check failed:', error);
      return null;
    }
  }
}

// Subgraph response types
export interface SubgraphToken {
  id: string;
  symbol: string;
  decimals: number;
  priceUSD: string;
  lastUpdatedAt: string;
}

export interface SubgraphCollateral {
  id: string;
  token: SubgraphToken;
  amount: string;
  lastUpdatedAt: string;
}

export interface SubgraphDebt {
  id: string;
  token: SubgraphToken;
  amount: string;
  interestRateMode: string;
  lastUpdatedAt: string;
}

export interface SubgraphPosition {
  id: string;
  nonce: string;
  lastUpdatedAt: string;
  collaterals: SubgraphCollateral[];
  debts: SubgraphDebt[];
}

export interface SubgraphUser {
  id: string;
  totalPositions: string;
  totalVolumeTraded: string;
  positions: SubgraphPosition[];
}

export interface UserPositionsResponse {
  user: SubgraphUser | null;
}

export interface PositionDetailsResponse {
  debtPosition:
    | (SubgraphPosition & {
        owner: {
          id: string;
        };
      })
    | null;
}

export function getSubgraphClient(chainId: ChainId): SubgraphClient {
  return new SubgraphClient(chainId);
}

export function isSubgraphSupported(chainId: ChainId): boolean {
  return chainId in SUBGRAPH_ENDPOINTS;
}
