import type { PriceToken, PriceTokensResponse } from '../hooks/usePriceTokens';

// Frontend API route that proxies to backend
const FRONTEND_API_BASE = ''; // Use relative path for frontend API routes
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';

interface PriceApiResponse {
  success: boolean;
  data?: {
    tokens: Array<{
      id: string;
      symbol: string;
      decimals: number;
      priceUSD: string;
      oracleSource: string;
      lastUpdatedAt: string;
    }>;
    pagination: {
      limit: number;
      offset: number;
      count: number;
    };
  };
  error?: string;
  timestamp: string;
}

export class PriceApiClient {
  // Ensure BACKEND_URL doesn't include /api path
  private baseUrl: string = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002').replace(/\/api$/, '');
  private timeout: number = 10000; // 10 seconds

  constructor(baseUrl?: string, timeout?: number) {
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/api$/, '');
    }
    if (timeout) {
      this.timeout = timeout;
    }
  }

  async fetchPriceTokens(params?: { symbol?: string; limit?: number; offset?: number }): Promise<PriceApiResponse> {
    try {
      const searchParams = new URLSearchParams();

      if (params?.symbol) searchParams.append('symbol', params.symbol);
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.offset) searchParams.append('offset', params.offset.toString());

      const queryString = searchParams.toString();
      const url = `/api/prices${queryString ? `?${queryString}` : ''}`;

      console.log(`[PriceApiClient] Fetching from: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}`;
        throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log(`[PriceApiClient] Received ${data.data?.tokens?.length || 0} tokens`);

      return data;
    } catch (error) {
      console.error('[PriceApiClient] Error fetching price tokens:', error);
      throw error;
    }
  }

  async fetchDirectFromBackend(params?: {
    symbol?: string;
    limit?: number;
    offset?: number;
  }): Promise<PriceApiResponse> {
    try {
      const searchParams = new URLSearchParams();

      if (params?.symbol) searchParams.append('symbol', params.symbol);
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.offset) searchParams.append('offset', params.offset.toString());

      const queryString = searchParams.toString();
      const url = `${this.baseUrl}/api/prices${queryString ? `?${queryString}` : ''}`;

      console.log(`[PriceApiClient] Direct backend fetch from: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log(`[PriceApiClient] Direct fetch received ${data.data?.tokens?.length || 0} tokens`);

      return data;
    } catch (error) {
      console.error('[PriceApiClient] Error in direct backend fetch:', error);
      throw error;
    }
  }

  async fetchSpecificToken(symbol: string): Promise<PriceToken | null> {
    try {
      const response = await this.fetchPriceTokens({ symbol, limit: 1 });
      return response.data && response.data.tokens.length > 0 ? response.data.tokens[0] : null;
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error);
      return null;
    }
  }

  async fetchMultipleTokens(symbols: string[]): Promise<PriceToken[]> {
    try {
      // For now, fetch all tokens and filter client-side
      // In production, the backend could support multiple symbol filtering
      const response = await this.fetchPriceTokens({ limit: 50 });
      const symbolsLower = symbols.map(s => s.toLowerCase());

      return response.data?.tokens.filter(token => symbolsLower.includes(token.symbol.toLowerCase())) || [];
    } catch (error) {
      console.error('Failed to fetch multiple tokens:', error);
      return [];
    }
  }

  // Health check for backend connectivity
  async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      return response.ok;
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  }
}

// Default instance using frontend API proxy
export const priceApiClient = new PriceApiClient();

// Direct backend instance for debugging
export const directBackendApiClient = new PriceApiClient(
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002',
);

// Mock data fallback for development (removed per user request)
export const MOCK_PRICE_TOKENS: PriceToken[] = [];

export function getMockPriceResponse(): PriceTokensResponse {
  return {
    success: false,
    error: 'Mock data disabled - please check backend connection',
    timestamp: new Date().toISOString(),
  };
}
