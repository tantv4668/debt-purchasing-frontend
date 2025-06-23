import { ChainId } from '../contracts';
import { logger } from './logger';

// Backend API configuration
const BACKEND_API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002/api',
  TIMEOUT: 10000,
};

// Backend API client for cached data
export class SubgraphClient {
  private backendUrl: string;

  constructor(chainId: ChainId) {
    // We don't need subgraph endpoint anymore since we use backend API
    this.backendUrl = BACKEND_API_CONFIG.BASE_URL;
  }

  // Direct API methods for accessing cached data from backend
  async getCachedUsers(limit = 100, offset = 0) {
    try {
      const response = await fetch(`${this.backendUrl}/users?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(BACKEND_API_CONFIG.TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Backend API error! status: ${response.status}`);
      }

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

      if (!response.ok) {
        throw new Error(`Backend API error! status: ${response.status}`);
      }

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

      if (!response.ok) {
        throw new Error(`Backend API error! status: ${response.status}`);
      }

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

      if (!response.ok) {
        throw new Error(`Backend API error! status: ${response.status}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      logger.error('Backend health check failed:', error);
      return null;
    }
  }

  // Legacy method names for backward compatibility - these now call backend API
  async getUserPositions(userAddress: string) {
    logger.info('Getting user positions from backend API for:', userAddress);
    return this.getCachedPositions(userAddress.toLowerCase());
  }

  async getPositionDetails(positionId: string) {
    logger.info('Getting position details from backend API for:', positionId);
    // For now, we get all positions and filter - can be optimized later
    const data = await this.getCachedPositions();
    if (!data || !data.positions) return null;

    const position = data.positions.find((p: any) => p.id.toLowerCase() === positionId.toLowerCase());
    return position ? { debtPosition: position } : { debtPosition: null };
  }

  async getTokenPrices(tokenAddresses: string[]) {
    logger.info('Token prices should be handled by backend oracle system');
    // This would need a separate backend endpoint for token prices
    return { tokens: [] };
  }
}

// Backend API response types (simplified from original subgraph types)
export interface BackendToken {
  id: string;
  symbol: string;
  decimals: number;
  priceUSD?: string;
  lastUpdatedAt?: string;
}

export interface BackendCollateral {
  id: string;
  token: BackendToken | string; // Can be object or just token address
  amount: string;
  lastUpdatedAt?: string;
}

export interface BackendDebt {
  id: string;
  token: BackendToken | string; // Can be object or just token address
  amount: string;
  interestRateMode: string;
  lastUpdatedAt?: string;
}

export interface BackendPosition {
  id: string;
  nonce: string;
  owner?: string;
  healthFactor?: string;
  lastUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  collaterals: BackendCollateral[];
  debts: BackendDebt[];
}

export interface BackendUser {
  id: string;
  totalPositions?: string;
  totalVolumeTraded?: string;
  positions: BackendPosition[];
}

// Legacy interfaces for backward compatibility
export interface SubgraphToken extends BackendToken {}
export interface SubgraphCollateral extends BackendCollateral {}
export interface SubgraphDebt extends BackendDebt {}
export interface SubgraphPosition extends BackendPosition {}
export interface SubgraphUser extends BackendUser {}

export interface UserPositionsResponse {
  user: SubgraphUser | null;
}

export interface PositionDetailsResponse {
  debtPosition: (SubgraphPosition & { owner: { id: string } }) | null;
}

export function getSubgraphClient(chainId: ChainId): SubgraphClient {
  return new SubgraphClient(chainId);
}

export function isSubgraphSupported(chainId: ChainId): boolean {
  // Since we use backend API, support depends on backend configuration
  return true; // Backend should handle chain support
}
