import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';

// Precise number parsing utilities
function parsePreciseFloat(value: string, precision: number = 4): number {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;

  // Truncate to specified precision instead of rounding
  const factor = Math.pow(10, precision);
  return Math.floor(num * factor) / factor;
}

function formatPreciseNumber(value: number, precision: number = 4): number {
  const factor = Math.pow(10, precision);
  return Math.floor(value * factor) / factor;
}

/* 
Precision improvements applied:
- parsePreciseFloat: Truncates to 4 decimals instead of rounding
- formatPreciseNumber: Ensures consistent 4-decimal precision
- All price calculations now maintain 4-decimal accuracy
- USD formatting shows up to 4 decimal places for precision
*/

export interface PriceToken {
  id: string;
  symbol: string;
  decimals: number;
  priceUSD: string;
  oracleSource: string;
  lastUpdatedAt: string;
}

export interface PriceTokensResponse {
  success: boolean;
  data?: {
    tokens: PriceToken[];
    pagination: {
      limit: number;
      offset: number;
      count: number;
    };
  };
  error?: string;
  timestamp: string;
}

interface TokenData {
  symbol: string;
  decimals: number;
  priceUSD: number;
  oracleSource?: string;
  lastUpdatedAt?: string;
}

interface UsePriceTokensReturn {
  data: PriceTokensResponse | null;
  tokens: Record<string, TokenData>;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  getTokenSymbol: (address: string) => string;
  getTokenPrice: (address: string) => number;
  getPriceBySymbol: (symbol: string) => number;
  calculateUSDValue: (amount: string, symbol: string) => number;
  getTotalUSDValue: (amounts: Array<{ amount: string; symbol: string }>) => number;
  refreshPrices: () => void;
  calculateUSDValueFromBigInt: (amount: bigint, tokenSymbol: string, decimals: number) => number;
  formatUSDValue: (value: number) => string;
}

export function usePriceTokens(params?: { symbol?: string; limit?: number; offset?: number }): UsePriceTokensReturn {
  const [data, setData] = useState<PriceTokensResponse | null>(null);
  const [tokens, setTokens] = useState<Record<string, TokenData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch complete token data from backend API
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002'}/api/prices`);
      if (!response.ok) {
        throw new Error('Failed to fetch token data');
      }

      const apiData = await response.json();
      if (apiData.success && apiData.data?.tokens) {
        // Create tokens map for easy lookup
        const tokenMap: Record<string, TokenData> = {};
        const priceTokens: PriceToken[] = [];

        apiData.data.tokens.forEach((token: any) => {
          if (token.id && token.symbol) {
            // Store in lookup map
            tokenMap[token.id.toLowerCase()] = {
              symbol: token.symbol,
              decimals: token.decimals || 18,
              priceUSD: parsePreciseFloat(token.priceUSD || '0'),
              oracleSource: token.oracleSource,
              lastUpdatedAt: token.lastUpdatedAt,
            };

            // Store in response format
            priceTokens.push({
              id: token.id,
              symbol: token.symbol,
              decimals: token.decimals || 18,
              priceUSD: token.priceUSD || '0',
              oracleSource: token.oracleSource || '',
              lastUpdatedAt: token.lastUpdatedAt || new Date().toISOString(),
            });
          }
        });

        setTokens(tokenMap);
        setData({
          success: true,
          data: {
            tokens: priceTokens,
            pagination: {
              limit: params?.limit || 100,
              offset: params?.offset || 0,
              count: priceTokens.length,
            },
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch price tokens';
      setError(errorMessage);
      setData({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();

    // Update token data every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [params?.symbol, params?.limit, params?.offset]);

  // Helper functions for easy reuse
  const getTokenSymbol = (address: string): string => {
    if (!address || address === '0x' || address === '0x0000000000000000000000000000000000000000') {
      return 'N/A';
    }

    const normalizedAddress = address.toLowerCase();
    const token = tokens[normalizedAddress];

    // Debug logging
    if (!token) {
      console.log(`🔍 Token not found for address: ${address}`);
      console.log(`🔍 Normalized address: ${normalizedAddress}`);
      console.log(`🔍 Available tokens:`, Object.keys(tokens));
    } else {
      console.log(`✅ Token found: ${address} -> ${token.symbol}`);
    }

    return token?.symbol || `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTokenPrice = (address: string): number => {
    const token = tokens[address.toLowerCase()];
    return token?.priceUSD || 0;
  };

  const getPriceBySymbol = (symbol: string): number => {
    const token = Object.values(tokens).find(token => token.symbol === symbol);
    return token?.priceUSD || 0;
  };

  const calculateUSDValueFromBigInt = (amount: bigint, tokenSymbol: string, decimals: number): number => {
    // Find token by symbol to get price
    const tokenEntry = Object.values(tokens).find(token => token.symbol === tokenSymbol);
    const priceUSD = tokenEntry?.priceUSD || 0;

    const amountInEther = parsePreciseFloat(formatUnits(amount, decimals));
    const result = amountInEther * priceUSD;
    return formatPreciseNumber(result);
  };

  const formatUSDValue = (value: number): string => {
    // Apply precise formatting before display formatting
    const preciseValue = formatPreciseNumber(value);

    if (preciseValue === 0) return '$0.00';
    if (preciseValue < 0.01) return '<$0.01';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4, // Show up to 4 decimal places for precision
    }).format(preciseValue);
  };

  const calculateUSDValue = (amount: string, symbol: string): number => {
    const token = Object.values(tokens).find(token => token.symbol === symbol);
    const priceUSD = token?.priceUSD || 0;
    const amountFloat = parsePreciseFloat(amount || '0');
    const result = amountFloat * priceUSD;
    return formatPreciseNumber(result);
  };

  const getTotalUSDValue = (amounts: Array<{ amount: string; symbol: string }>): number => {
    return amounts.reduce((total, item) => {
      return total + calculateUSDValue(item.amount, item.symbol);
    }, 0);
  };

  const refreshPrices = (): void => {
    fetchPrices();
  };

  return {
    data,
    tokens,
    isLoading,
    error,
    refetch: fetchPrices,
    getTokenSymbol,
    getTokenPrice,
    getPriceBySymbol,
    calculateUSDValue,
    getTotalUSDValue,
    refreshPrices,
    calculateUSDValueFromBigInt,
    formatUSDValue,
  };
}
