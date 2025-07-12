"use client";

// AppKit button will be used instead
import Link from "next/link";
import { useAccount } from "wagmi";
import { useProtocolMetrics } from "@/lib/hooks/useProtocolMetrics";
import { useRecentActivity } from "@/lib/hooks/useRecentActivity";
import { formatUSD, formatCompactNumber } from "@/lib/utils/formatters";
import ImportantNotesWarning from "@/components/ImportantNotesWarning";

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { metrics, loading, error } = useProtocolMetrics();
  const { activities, loading: activitiesLoading } = useRecentActivity(10);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl text-center max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Connect Your Wallet
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Please connect your wallet to access the dashboard.
          </p>
          <div className="flex justify-center mt-4">
            <appkit-button />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Welcome back, {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>

        {/* Important Notes Warning */}
        <ImportantNotesWarning />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Collateral */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Collateral
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {loading ? (
                    <span className="animate-pulse">...</span>
                  ) : error ? (
                    <span className="text-red-500">Error</span>
                  ) : (
                    formatUSD(metrics?.totalCollateralUSD || 0, true)
                  )}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">🏦</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Protocol-wide collateral
            </p>
          </div>

          {/* Total Debt */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Debt
                </p>
                <p className="text-2xl font-bold text-blue-600">
                  {loading ? (
                    <span className="animate-pulse">...</span>
                  ) : error ? (
                    <span className="text-red-500">Error</span>
                  ) : (
                    formatUSD(metrics?.totalDebtUSD || 0, true)
                  )}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">💳</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Across {metrics?.totalPositions || 0} positions
            </p>
          </div>

          {/* Total Volume */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Volume
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {loading ? (
                    <span className="animate-pulse">...</span>
                  ) : error ? (
                    <span className="text-red-500">Error</span>
                  ) : (
                    formatUSD(metrics?.totalVolumeUSD || 0, true)
                  )}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">📈</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Full + Partial orders
            </p>
          </div>

          {/* Total Users */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Users
                </p>
                <p className="text-2xl font-bold text-purple-600">
                  {loading ? (
                    <span className="animate-pulse">...</span>
                  ) : error ? (
                    <span className="text-red-500">Error</span>
                  ) : (
                    formatCompactNumber(parseInt(metrics?.totalUsers || "0"))
                  )}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Active protocol users
            </p>
          </div>
        </div>

        {/* System-wide Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 mb-8">
          <div className="p-6 border-b dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              System Activity
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Recent order executions across the protocol
            </p>
          </div>
          <div className="p-6">
            {activitiesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                    <div className="flex-1 space-y-1">
                      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 animate-pulse"></div>
                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No recent activity
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Order executions will appear here when they happen
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const timeAgo = new Date(
                    activity.updatedAt || activity.createdAt
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isRecent =
                    new Date().getTime() -
                      new Date(
                        activity.updatedAt || activity.createdAt
                      ).getTime() <
                    24 * 60 * 60 * 1000;

                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div
                        className={`w-3 h-3 rounded-full ${
                          activity.status === "EXECUTED"
                            ? "bg-green-500"
                            : activity.orderType === "FULL"
                              ? "bg-blue-500"
                              : "bg-purple-500"
                        }`}
                      ></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {activity.orderType} order executed
                          {activity.usdValue && (
                            <span className="text-green-600 ml-2 font-semibold">
                              {formatUSD(parseFloat(activity.usdValue), true)}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Buyer: {activity.buyer?.slice(0, 6)}...
                          {activity.buyer?.slice(-4)} • {timeAgo}
                          {isRecent && (
                            <span className="text-green-500 ml-2 font-medium">
                              • Recent
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            activity.orderType === "FULL"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          }`}
                        >
                          {activity.orderType}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
