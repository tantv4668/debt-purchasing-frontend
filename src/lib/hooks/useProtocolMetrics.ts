import { useState, useEffect } from "react";

interface ProtocolMetrics {
  totalUsers: string;
  totalPositions: string;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  totalVolumeUSD: number;
  fullOrdersUSD: string;
  partialOrdersUSD: string;
  collaterals: Array<{
    id: string;
    token: string;
    symbol: string;
    decimals: number;
    amount: string;
  }>;
  debts: Array<{
    id: string;
    token: string;
    symbol: string;
    decimals: number;
    amount: string;
  }>;
  lastUpdatedAt: string;
}

interface UseProtocolMetricsReturn {
  metrics: ProtocolMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProtocolMetrics(): UseProtocolMetricsReturn {
  const [metrics, setMetrics] = useState<ProtocolMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProtocolMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/protocol-metrics");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch protocol metrics");
      }

      const data = await response.json();

      if (data.success) {
        setMetrics(data.data);
      } else {
        throw new Error(data.error || "Failed to fetch protocol metrics");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error fetching protocol metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProtocolMetrics();
  }, []);

  return {
    metrics,
    loading,
    error,
    refetch: fetchProtocolMetrics,
  };
}
