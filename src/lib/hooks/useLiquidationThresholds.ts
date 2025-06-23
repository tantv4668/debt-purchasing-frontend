import { useEffect, useState } from 'react';

export interface LiquidationThreshold {
  id: string;
  symbol: string;
  liquidationThreshold: string;
  liquidationBonus: string;
  reserveFactor: string;
  isActive: boolean;
  lastUpdatedAt: string;
}

export interface LiquidationThresholdsResponse {
  success: boolean;
  data?: {
    assetConfigurations: LiquidationThreshold[];
    pagination: {
      limit: number;
      offset: number;
      count: number;
      symbol?: string;
      isActive?: boolean;
    };
  };
  error?: string;
  timestamp: string;
}

export function useLiquidationThresholds() {
  const [thresholds, setThresholds] = useState<LiquidationThreshold[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLiquidationThresholds = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Fetching liquidation thresholds from backend...');

      // Fetch from backend API
      const response = await fetch('/api/liquidation-thresholds?limit=100&isActive=true');
      const data: LiquidationThresholdsResponse = await response.json();

      if (data.success && data.data?.assetConfigurations) {
        console.log(`Successfully fetched ${data.data.assetConfigurations.length} liquidation thresholds`);
        setThresholds(data.data.assetConfigurations);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.error || 'Failed to fetch liquidation thresholds from backend');
      }
    } catch (err) {
      console.error('Failed to fetch liquidation thresholds:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Backend connection failed: ${errorMessage}`);

      // Clear thresholds on error
      setThresholds([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiquidationThresholds();
  }, []);

  const getLiquidationThresholdBySymbol = (symbol: string): number => {
    const threshold = thresholds.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
    if (!threshold) return 0;

    // Backend already returns decimal values (e.g., 0.81 for 81%), not basis points
    return parseFloat(threshold.liquidationThreshold);
  };

  const getLiquidationThresholdByAddress = (address: string): number => {
    const threshold = thresholds.find(t => t.id.toLowerCase() === address.toLowerCase());
    if (!threshold) return 0;

    // Backend already returns decimal values (e.g., 0.81 for 81%), not basis points
    return parseFloat(threshold.liquidationThreshold);
  };

  const getLiquidationBonusBySymbol = (symbol: string): number => {
    const threshold = thresholds.find(t => t.symbol.toLowerCase() === symbol.toLowerCase());
    if (!threshold) return 0;

    // Backend already returns decimal values (e.g., 1.05 for 5% bonus), not basis points
    return parseFloat(threshold.liquidationBonus);
  };

  const getThresholdInfo = (symbol: string): LiquidationThreshold | null => {
    return thresholds.find(t => t.symbol.toLowerCase() === symbol.toLowerCase()) || null;
  };

  const isStale = (): boolean => {
    if (!lastUpdated) return true;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastUpdated < fiveMinutesAgo;
  };

  const refreshThresholds = () => {
    fetchLiquidationThresholds();
  };

  return {
    thresholds,
    isLoading,
    error,
    lastUpdated,
    getLiquidationThresholdBySymbol,
    getLiquidationThresholdByAddress,
    getLiquidationBonusBySymbol,
    getThresholdInfo,
    isStale,
    refreshThresholds,
  };
}
