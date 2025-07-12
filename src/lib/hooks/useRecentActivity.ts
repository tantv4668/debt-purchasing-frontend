import { useState, useEffect } from "react";

interface RecentOrder {
  id: string;
  orderType: "FULL" | "PARTIAL";
  status: string;
  buyer?: string;
  seller: string;
  usdValue?: string;
  usdBonus?: string;
  createdAt: string;
  updatedAt: string;
  debtAddress: string;
}

interface UseRecentActivityReturn {
  activities: RecentOrder[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRecentActivity(limit: number = 10): UseRecentActivityReturn {
  const [activities, setActivities] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch executed orders (cached orders) with correct parameters
      const response = await fetch(
        `/api/cached-orders?status=EXECUTED&limit=${limit}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch recent activity");
      }

      const data = await response.json();

      if (data.success) {
        setActivities(data.data.orders || []);
      } else {
        throw new Error(data.error || "Failed to fetch recent activity");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error fetching recent activity:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivity();
  }, [limit]);

  return {
    activities,
    loading,
    error,
    refetch: fetchRecentActivity,
  };
}
