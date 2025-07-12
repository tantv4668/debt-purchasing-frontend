import { useState, useEffect } from "react";

interface TokenInfo {
  id: string;
  token: string;
  symbol: string;
  decimals: number;
  amount: string;
  interestRateMode?: string;
  lastUpdatedAt: string;
}

interface DebtPosition {
  _id: string;
  id: string;
  owner: string;
  nonce: number;
  collaterals: TokenInfo[];
  debts: TokenInfo[];
  healthFactor: string;
  createdAt: string;
  updatedAt: string;
}

interface UseUserPositionsReturn {
  positions: DebtPosition[];
  loading: boolean;
  error: string | null;
  total: number;
  refetch: () => Promise<void>;
}

export function useUserPositions(
  userAddress?: string,
  limit: number = 10
): UseUserPositionsReturn {
  const [positions, setPositions] = useState<DebtPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchUserPositions = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!userAddress) {
        setPositions([]);
        setTotal(0);
        return;
      }

      const response = await fetch(
        `/api/positions?limit=${limit}&owner=${userAddress}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch user positions");
      }

      const data = await response.json();

      if (data.success) {
        setPositions(data.data.positions || []);
        setTotal(data.data.pagination?.total || 0);
      } else {
        throw new Error(data.error || "Failed to fetch user positions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error fetching user positions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPositions();
  }, [userAddress, limit]);

  return {
    positions,
    loading,
    error,
    total,
    refetch: fetchUserPositions,
  };
}
