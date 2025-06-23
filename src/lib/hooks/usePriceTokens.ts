import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { priceApiClient } from '../utils/price-api';

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
      symbol?: string;
    };
  };
  error?: string;
  timestamp: string;
}

export function usePriceTokens() {
  const [priceTokens, setPriceTokens] = useState<PriceToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPriceTokens = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Fetching price tokens from backend...');

      // Fetch from backend through the frontend API proxy
      const data = await priceApiClient.fetchPriceTokens({ limit: 50 });

      if (data.success && data.data?.tokens) {
        console.log(`Successfully fetched ${data.data.tokens.length} price tokens`);
        setPriceTokens(data.data.tokens);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.error || 'Failed to fetch price tokens from backend');
      }
    } catch (err) {
      console.error('Failed to fetch price tokens:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Backend connection failed: ${errorMessage}`);

      // Clear tokens on error since we're not using mock data
      setPriceTokens([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPriceTokens();
  }, []);

  const getPriceBySymbol = (symbol: string): number => {
    const token = priceTokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
    return token ? parseFloat(token.priceUSD) : 0;
  };

  const getPriceByAddress = (address: string): number => {
    const token = priceTokens.find(t => t.id.toLowerCase() === address.toLowerCase());
    return token ? parseFloat(token.priceUSD) : 0;
  };

  const calculateUSDValue = (amount: string, symbol: string, decimals?: number): number => {
    if (!amount || parseFloat(amount) <= 0) return 0;

    const price = getPriceBySymbol(symbol);
    if (price <= 0) return 0;

    const numericAmount = parseFloat(amount);
    return numericAmount * price;
  };

  const calculateUSDValueFromBigInt = (amount: bigint, symbol: string, decimals: number): number => {
    if (amount <= BigInt(0)) return 0;

    const price = getPriceBySymbol(symbol);
    if (price <= 0) return 0;

    const formattedAmount = parseFloat(formatUnits(amount, decimals));
    return formattedAmount * price;
  };

  const formatUSDValue = (value: number): string => {
    if (value === 0) return '$0.00';
    if (value < 0.01) return '<$0.01';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getTotalUSDValue = (assets: Array<{ symbol: string; amount: string; decimals?: number }>): number => {
    return assets.reduce((total, asset) => {
      return total + calculateUSDValue(asset.amount, asset.symbol, asset.decimals);
    }, 0);
  };

  const getTokenInfo = (symbol: string): PriceToken | null => {
    return priceTokens.find(t => t.symbol.toLowerCase() === symbol.toLowerCase()) || null;
  };

  const isStale = (): boolean => {
    if (!lastUpdated) return true;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastUpdated < fiveMinutesAgo;
  };

  const refreshPrices = () => {
    fetchPriceTokens();
  };

  return {
    priceTokens,
    isLoading,
    error,
    lastUpdated,
    getPriceBySymbol,
    getPriceByAddress,
    calculateUSDValue,
    calculateUSDValueFromBigInt,
    formatUSDValue,
    getTotalUSDValue,
    getTokenInfo,
    isStale,
    refreshPrices,
  };
}
