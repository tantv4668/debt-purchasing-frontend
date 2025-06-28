'use client';

import {
  formatHealthFactor,
  formatPreciseHealthFactor,
  formatPreciseNumber,
  formatTimeRemaining,
  truncateAddress,
} from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useAccount, useChainId, useWalletClient } from 'wagmi';
import CreateDebtModal from '../../components/CreateDebtModal';
import CreateSellOrderModal from '../../components/CreateSellOrderModal';
import ManagePositionModal from '../../components/ManagePositionModal';
import Tooltip from '../../components/Tooltip';
import { useUserDebtPositions, useUserPositionSummary } from '../../lib/hooks/useDebtPositions';
import { useLiquidationThresholds } from '../../lib/hooks/useLiquidationThresholds';
import { useOrderActions, useUserOrders, useUserOrdersSummary } from '../../lib/hooks/useOrders';
import { usePriceTokens } from '../../lib/hooks/usePriceTokens';
import { CreateFullSellOrderParams, CreatePartialSellOrderParams, UserSellOrder } from '../../lib/types';
import { createOrderService } from '../../lib/utils/create-order';

// Component to calculate and display health factor for a single position
function PositionHealthFactor({ position }: { position: any }) {
  // Use health factor directly from backend data (already in wei format)
  const healthFactorValue = formatHealthFactor(position.healthFactor);

  // Determine color and status based on health factor value
  const getHealthFactorDisplay = (value: number) => {
    if (value >= 2) {
      return {
        color: 'text-green-600 dark:text-green-400',
        label: 'Safe',
        status: 'safe' as const,
      };
    } else if (value >= 1.5) {
      return {
        color: 'text-yellow-600 dark:text-yellow-400',
        label: 'Warning',
        status: 'warning' as const,
      };
    } else if (value >= 1) {
      return {
        color: 'text-red-600 dark:text-red-400',
        label: 'Danger',
        status: 'danger' as const,
      };
    } else {
      return {
        color: 'text-red-800 dark:text-red-300',
        label: 'Liquidation Risk',
        status: 'liquidation' as const,
      };
    }
  };

  const { color, label } = getHealthFactorDisplay(healthFactorValue);

  // Calculate collateral and debt values for tooltip
  const totalCollateralValue = position.collaterals.reduce((sum: number, collateral: any) => {
    return sum + (collateral.valueInUSD || 0);
  }, 0);

  const totalDebtValue = position.debts.reduce((sum: number, debt: any) => {
    return sum + (debt.valueInUSD || 0);
  }, 0);

  return (
    <div>
      <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2'>
        Health Factor
        <Tooltip
          content='Health Factor measures position safety. HF = (Collateral Value × Liquidation Thresholds) ÷ Debt Value. Values below 1.0 risk liquidation.'
          maxWidth='xl'
        >
          <svg
            className='w-4 h-4 text-gray-500 dark:text-gray-400 cursor-help'
            fill='currentColor'
            viewBox='0 0 20 20'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              fillRule='evenodd'
              d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
              clipRule='evenodd'
            />
          </svg>
        </Tooltip>
      </h4>
      <div className={`text-2xl font-bold mb-1 ${color} flex items-center gap-2`}>
        {healthFactorValue}
        <Tooltip
          content={`Current Health Factor: ${healthFactorValue}. Collateral: $${formatPreciseNumber(
            totalCollateralValue,
            2,
          )}, Debt: $${formatPreciseNumber(totalDebtValue, 2)}`}
          maxWidth='lg'
        >
          <svg
            className='w-4 h-4 text-gray-500 dark:text-gray-400 cursor-help'
            fill='currentColor'
            viewBox='0 0 20 20'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              fillRule='evenodd'
              d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
              clipRule='evenodd'
            />
          </svg>
        </Tooltip>
      </div>
      <div className='text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2'>
        {label}
        <Tooltip
          content={`${label}: ${
            healthFactorValue >= 2
              ? 'Very safe position'
              : healthFactorValue >= 1.5
              ? 'Moderately safe position'
              : healthFactorValue >= 1.1
              ? 'Risky position, monitor closely'
              : 'Critical - risk of liquidation'
          }`}
          maxWidth='lg'
        >
          <svg
            className='w-3 h-3 text-gray-500 dark:text-gray-400 cursor-help'
            fill='currentColor'
            viewBox='0 0 20 20'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              fillRule='evenodd'
              d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
              clipRule='evenodd'
            />
          </svg>
        </Tooltip>
      </div>
      <div className='text-xs text-gray-400 mt-1 flex items-center gap-2'>
        LT: 85.0%
        <Tooltip
          content={`Liquidation Threshold: 85.0%. This is the weighted average percentage of collateral value that counts toward your health factor. Higher LT = safer assets.`}
          maxWidth='2xl'
        >
          <svg
            className='w-3 h-3 text-gray-500 dark:text-gray-400 cursor-help'
            fill='currentColor'
            viewBox='0 0 20 20'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              fillRule='evenodd'
              d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
              clipRule='evenodd'
            />
          </svg>
        </Tooltip>
      </div>
    </div>
  );
}

export default function PositionsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [isManagePositionModalOpen, setIsManagePositionModalOpen] = useState(false);
  const [selectedPositionForOrder, setSelectedPositionForOrder] = useState<any>(null);
  const [selectedPositionForManage, setSelectedPositionForManage] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(5);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const {
    positions,
    total,
    isLoading: positionsLoading,
    error: positionsError,
    refetchWithCacheRefresh,
  } = useUserDebtPositions(pageSize, (currentPage - 1) * pageSize);
  const { orders, isLoading: ordersLoading, error: ordersError, refetch: refetchOrders } = useUserOrders();
  const { cancelOrder } = useOrderActions();
  const positionSummary = useUserPositionSummary();
  const ordersSummary = useUserOrdersSummary();
  const { calculateUSDValueFromBigInt, formatUSDValue, isLoading: pricesLoading } = usePriceTokens();
  const { isLoading: thresholdsLoading, error: thresholdsError } = useLiquidationThresholds();

  // Track initial loading completion
  useEffect(() => {
    if (!positionsLoading && !ordersLoading && !pricesLoading && !thresholdsLoading && !hasInitiallyLoaded) {
      setHasInitiallyLoaded(true);
    }
  }, [positionsLoading, ordersLoading, pricesLoading, thresholdsLoading, hasInitiallyLoaded]);

  // Only show full-page loading on initial load
  const isInitialLoading =
    !hasInitiallyLoaded && (positionsLoading || ordersLoading || pricesLoading || thresholdsLoading);
  const error = positionsError || ordersError || thresholdsError;

  const handleCreateSellOrder = (position: any) => {
    setSelectedPositionForOrder(position);
    setIsCreateOrderModalOpen(true);
  };

  const handleManagePosition = (position: any) => {
    setSelectedPositionForManage(position);
    setIsManagePositionModalOpen(true);
  };

  const handleCancelOrder = async (order: UserSellOrder) => {
    try {
      await cancelOrder(order.id);
      // Refresh orders list
      await refetchOrders();
      console.log('✅ Order cancelled and list refreshed');
    } catch (error) {
      console.error('Failed to cancel order:', error);
      // You might want to show a toast notification here
    }
  };

  // Real order creation implementation
  const handleOrderCreation = async (
    params: CreateFullSellOrderParams | CreatePartialSellOrderParams,
  ): Promise<void> => {
    if (!walletClient || !address) {
      throw new Error('Wallet not connected');
    }

    const orderServiceInstance = createOrderService({
      chainId,
      walletClient,
      seller: address,
    });

    try {
      if ('equityPercentage' in params) {
        // This is a full sell order
        const result = await orderServiceInstance.createFullSellOrder(params as CreateFullSellOrderParams);
        console.log('Full sell order created:', result);
      } else {
        // This is a partial sell order
        const result = await orderServiceInstance.createPartialSellOrder(params as CreatePartialSellOrderParams);
        console.log('Partial sell order created:', result);
      }
      // Refresh orders list after successful creation
      // The useUserOrders hook will automatically refetch
    } catch (error) {
      console.error('Failed to create order:', error);
      throw error;
    }
  };

  const getOrderStatusBadge = (status: UserSellOrder['status']) => {
    const colors = {
      active: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      expired: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
      executed: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const calculateTotalValue = (assets: any[]) => {
    return assets.reduce((total, asset) => {
      const usdValue = calculateUSDValueFromBigInt(asset.balance, asset.symbol, asset.decimals);
      return total + usdValue;
    }, 0);
  };

  if (!isConnected) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className='flex items-center justify-center' style={{ minHeight: 'calc(100vh - 4rem)' }}>
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white mb-4'>Connect Your Wallet</h1>
            <p className='text-gray-600 dark:text-gray-300'>
              Please connect your wallet to view your positions and orders.
            </p>
            <div className='flex justify-center mt-4'>
              <appkit-button />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className='flex items-center justify-center' style={{ minHeight: 'calc(100vh - 4rem)' }}>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
            <p className='text-gray-600 dark:text-gray-300'>Loading your positions and orders...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className='flex items-center justify-center' style={{ minHeight: 'calc(100vh - 4rem)' }}>
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-red-600 mb-4'>Error Loading Data</h1>
            <p className='text-gray-600 dark:text-gray-300'>Failed to load positions and orders. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Header */}
        <div className='flex justify-between items-center mb-8'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>Positions & Orders</h1>
            <p className='text-gray-600 dark:text-gray-300 mt-2'>Manage your debt positions and sell orders</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className='bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors'
          >
            Create Position
          </button>
        </div>

        {/* Subtle Loading Indicators */}
        {hasInitiallyLoaded && (pricesLoading || positionsLoading || ordersLoading || thresholdsLoading) && (
          <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-6'>
            <div className='flex items-center space-x-2'>
              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600'></div>
              <span className='text-sm text-blue-800 dark:text-blue-300'>
                Refreshing data...
                {pricesLoading && ' (prices)'}
                {positionsLoading && ' (positions)'}
                {ordersLoading && ' (orders)'}
                {thresholdsLoading && ' (thresholds)'}
              </span>
            </div>
          </div>
        )}

        {/* Combined Summary Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8'>
          {/* Positions Cards */}
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>Total Positions</p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>{positionSummary.totalPositions}</p>
              </div>
              <div className='w-12 h-12 bg-blue-50 dark:bg-blue-800 rounded-lg flex items-center justify-center'>
                <svg
                  className='w-6 h-6 text-blue-600 dark:text-blue-300'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  suppressHydrationWarning={true}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>Total Debt</p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                  ${positionSummary.totalDebtValue.toLocaleString()}
                </p>
              </div>
              <div className='w-12 h-12 bg-red-50 dark:bg-red-800 rounded-lg flex items-center justify-center'>
                <svg
                  className='w-6 h-6 text-red-500 dark:text-red-300'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  suppressHydrationWarning={true}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1'
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>Avg Health Factor</p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {formatPreciseHealthFactor(positionSummary.averageHealthFactor, 2)}
                </p>
              </div>
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  positionSummary.averageHealthFactor > 2
                    ? 'bg-green-50 dark:bg-green-800'
                    : positionSummary.averageHealthFactor > 1.5
                    ? 'bg-yellow-50 dark:bg-yellow-800'
                    : 'bg-red-50 dark:bg-red-800'
                }`}
              >
                <svg
                  className={`w-6 h-6 ${
                    positionSummary.averageHealthFactor > 2
                      ? 'text-green-600 dark:text-green-300'
                      : positionSummary.averageHealthFactor > 1.5
                      ? 'text-yellow-600 dark:text-yellow-300'
                      : 'text-red-600 dark:text-red-300'
                  }`}
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  suppressHydrationWarning={true}
                >
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 10V3L4 14h7v7l9-11h-7z' />
                </svg>
              </div>
            </div>
          </div>

          {/* Orders Cards */}
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>Active Orders</p>
                <p className='text-2xl font-bold text-orange-600'>{ordersSummary.activeOrders}</p>
              </div>
              <div className='w-12 h-12 bg-orange-50 dark:bg-orange-800 rounded-lg flex items-center justify-center'>
                <svg
                  className='w-6 h-6 text-orange-600 dark:text-orange-300'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  suppressHydrationWarning={true}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>Total Orders</p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>{ordersSummary.totalOrders}</p>
              </div>
              <div className='w-12 h-12 bg-purple-50 dark:bg-purple-800 rounded-lg flex items-center justify-center'>
                <svg
                  className='w-6 h-6 text-purple-600 dark:text-purple-300'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  suppressHydrationWarning={true}
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z'
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8'>
          <div className='border-b border-gray-200 dark:border-gray-700'>
            <nav className='-mb-px flex space-x-8 px-6'>
              <button
                onClick={() => {
                  setActiveTab('positions');
                  setCurrentPage(1);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'positions'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Debt Positions ({positionSummary.totalPositions})
              </button>
              <button
                onClick={() => {
                  setActiveTab('orders');
                  setCurrentPage(1);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'orders'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Sell Orders ({ordersSummary.totalOrders})
              </button>
            </nav>
          </div>

          <div className='p-6'>
            {/* Positions Tab */}
            {activeTab === 'positions' && (
              <div>
                {positions.length === 0 ? (
                  <div className='text-center py-12'>
                    <div className='w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4'>
                      <svg
                        className='w-12 h-12 text-gray-400 dark:text-gray-500'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                        suppressHydrationWarning={true}
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                        />
                      </svg>
                    </div>
                    <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-2'>No Debt Positions</h3>
                    <p className='text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto'>
                      You haven't created any debt positions yet. Create your first position to start leveraging your
                      assets.
                    </p>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className='bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors'
                    >
                      Create Your First Position
                    </button>
                  </div>
                ) : (
                  <div className='space-y-6'>
                    {/* Positions are already sorted by blockchainCreatedAt from backend */}
                    {positions.map((position, index) => {
                      const positionOrders = orders.filter(
                        order => order.debtAddress.toLowerCase() === position.address.toLowerCase(),
                      );
                      const collateralValue = calculateTotalValue(position.collaterals);
                      const debtValue = calculateTotalValue(position.debts);

                      return (
                        <div
                          key={index}
                          className='bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700'
                        >
                          <div className='flex justify-between items-start mb-4'>
                            <div>
                              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                                Position #{(currentPage - 1) * pageSize + index + 1}
                              </h3>
                              <p className='text-sm text-gray-600 dark:text-gray-400 font-mono'>
                                {truncateAddress(position.address)}
                              </p>
                              {positionOrders.length > 0 && (
                                <div className='mt-2'>
                                  <span className='text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full'>
                                    {positionOrders.length} active order{positionOrders.length > 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className='px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'>
                              Position
                            </div>
                          </div>

                          <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'>
                            {/* Collateral */}
                            <div className='flex flex-col'>
                              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>Collateral</h4>
                              <div className='space-y-2 flex-1 flex flex-col justify-end'>
                                {position.collaterals.map((collateral, idx) => (
                                  <div key={idx} className='flex justify-between items-center'>
                                    <span className='text-sm text-gray-600 dark:text-gray-400'>
                                      {collateral.symbol}
                                    </span>
                                    <div className='text-right'>
                                      <div className='text-sm font-medium text-gray-900 dark:text-white'>
                                        {collateral.balanceFormatted}
                                      </div>
                                      <div className='text-xs text-gray-500 dark:text-gray-400'>
                                        {formatUSDValue(
                                          calculateUSDValueFromBigInt(
                                            collateral.balance,
                                            collateral.symbol,
                                            collateral.decimals,
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                <div className='pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center'>
                                  <span className='text-sm font-semibold text-gray-700 dark:text-gray-300'>Total</span>
                                  <span className='text-sm font-bold text-green-600 dark:text-green-400'>
                                    {formatUSDValue(collateralValue)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Debt */}
                            <div className='flex flex-col'>
                              <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>Debt</h4>
                              <div className='space-y-2 flex-1 flex flex-col justify-end'>
                                {position.debts.map((debt, idx) => (
                                  <div key={idx} className='flex justify-between items-center'>
                                    <span className='text-sm text-gray-600 dark:text-gray-400'>{debt.symbol}</span>
                                    <div className='text-right'>
                                      <div className='text-sm font-medium text-gray-900 dark:text-white'>
                                        {debt.balanceFormatted}
                                      </div>
                                      <div className='text-xs text-gray-500 dark:text-gray-400'>
                                        {formatUSDValue(
                                          calculateUSDValueFromBigInt(debt.balance, debt.symbol, debt.decimals),
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                <div className='pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center'>
                                  <span className='text-sm font-semibold text-gray-700 dark:text-gray-300'>Total</span>
                                  <span className='text-sm font-bold text-red-600 dark:text-red-400'>
                                    {formatUSDValue(debtValue)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Health Factor */}
                            <div>
                              <PositionHealthFactor position={position} />
                            </div>
                          </div>

                          {/* Actions */}
                          <div className='pt-4 border-t border-gray-200 dark:border-gray-600'>
                            <div className='flex space-x-3'>
                              <button
                                onClick={() => handleCreateSellOrder(position)}
                                className='px-4 py-2 bg-orange-50 dark:bg-orange-900 text-orange-600 dark:text-orange-200 rounded-lg text-sm font-medium hover:bg-orange-100 dark:hover:bg-orange-800 transition-colors'
                              >
                                Create Sell Order
                              </button>
                              <button
                                onClick={() => handleManagePosition(position)}
                                className='px-4 py-2 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors'
                              >
                                Manage Position
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Pagination Controls */}
                    {positionSummary.totalPositions > pageSize && (
                      <div className='flex items-center justify-between border-t border-gray-200 dark:border-gray-600 pt-6'>
                        <div className='flex-1 flex justify-between sm:hidden'>
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className='relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                          >
                            Previous
                          </button>
                          <button
                            onClick={() =>
                              setCurrentPage(prev =>
                                Math.min(prev + 1, Math.ceil(positionSummary.totalPositions / pageSize)),
                              )
                            }
                            disabled={currentPage === Math.ceil(positionSummary.totalPositions / pageSize)}
                            className='ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                          >
                            Next
                          </button>
                        </div>
                        <div className='hidden sm:flex-1 sm:flex sm:items-center sm:justify-between'>
                          <div>
                            <p className='text-sm text-gray-700 dark:text-gray-300'>
                              Showing <span className='font-medium'>{(currentPage - 1) * pageSize + 1}</span> to{' '}
                              <span className='font-medium'>
                                {Math.min(currentPage * pageSize, positionSummary.totalPositions)}
                              </span>{' '}
                              of <span className='font-medium'>{positionSummary.totalPositions}</span> positions
                            </p>
                          </div>
                          <div>
                            <nav
                              className='relative z-0 inline-flex rounded-md shadow-sm -space-x-px'
                              aria-label='Pagination'
                            >
                              <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className='relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                              >
                                <span className='sr-only'>Previous</span>
                                <svg className='h-5 w-5' fill='currentColor' viewBox='0 0 20 20'>
                                  <path
                                    fillRule='evenodd'
                                    d='M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z'
                                    clipRule='evenodd'
                                  />
                                </svg>
                              </button>

                              {/* Page numbers */}
                              {Array.from(
                                { length: Math.min(5, Math.ceil(positionSummary.totalPositions / pageSize)) },
                                (_, i) => {
                                  const totalPages = Math.ceil(positionSummary.totalPositions / pageSize);
                                  let pageNumber: number;

                                  if (totalPages <= 5) {
                                    pageNumber = i + 1;
                                  } else if (currentPage <= 3) {
                                    pageNumber = i + 1;
                                  } else if (currentPage >= totalPages - 2) {
                                    pageNumber = totalPages - 4 + i;
                                  } else {
                                    pageNumber = currentPage - 2 + i;
                                  }

                                  return (
                                    <button
                                      key={pageNumber}
                                      onClick={() => setCurrentPage(pageNumber)}
                                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                        currentPage === pageNumber
                                          ? 'z-10 bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-200'
                                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                      }`}
                                    >
                                      {pageNumber}
                                    </button>
                                  );
                                },
                              )}

                              <button
                                onClick={() =>
                                  setCurrentPage(prev =>
                                    Math.min(prev + 1, Math.ceil(positionSummary.totalPositions / pageSize)),
                                  )
                                }
                                disabled={currentPage === Math.ceil(positionSummary.totalPositions / pageSize)}
                                className='relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                              >
                                <span className='sr-only'>Next</span>
                                <svg className='h-5 w-5' fill='currentColor' viewBox='0 0 20 20'>
                                  <path
                                    fillRule='evenodd'
                                    d='M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z'
                                    clipRule='evenodd'
                                  />
                                </svg>
                              </button>
                            </nav>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div>
                {orders.length === 0 ? (
                  <div className='text-center py-12'>
                    <div className='w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4'>
                      <svg
                        className='w-12 h-12 text-gray-400 dark:text-gray-500'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                        suppressHydrationWarning={true}
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
                        />
                      </svg>
                    </div>
                    <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-2'>No Sell Orders</h3>
                    <p className='text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto'>
                      You haven't created any sell orders yet. Create sell orders for your positions to protect against
                      liquidation.
                    </p>
                    {positions.length > 0 && (
                      <button
                        onClick={() => setActiveTab('positions')}
                        className='bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 transition-colors'
                      >
                        Go to Positions to Create Orders
                      </button>
                    )}
                  </div>
                ) : (
                  <div className='space-y-4'>
                    {orders.map(order => (
                      <div
                        key={order.id}
                        className='bg-gray-50 dark:bg-gray-700 rounded-xl p-6 border border-gray-100 dark:border-gray-600'
                      >
                        <div className='flex justify-between items-start mb-4'>
                          <div>
                            <div className='flex items-center gap-3 mb-2'>
                              <div
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  order.type === 'full'
                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                    : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                                }`}
                              >
                                {order.type === 'full' ? 'Full Sale' : 'Partial Sale'}
                              </div>
                              {getOrderStatusBadge(order.status)}
                            </div>
                            <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                              Order for Position {truncateAddress(order.debtAddress)}
                            </h3>
                            <p className='text-sm text-gray-600 dark:text-gray-300'>
                              Created {formatTimeRemaining(order.createdAt)} ago
                            </p>
                          </div>
                          <div className='text-right'>
                            <div className='text-sm text-gray-600 dark:text-gray-400'>Expires in</div>
                            <div className='font-medium text-orange-600'>{formatTimeRemaining(order.validUntil)}</div>
                          </div>
                        </div>

                        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-4'>
                          <div>
                            <span className='text-sm text-gray-600 dark:text-gray-400'>Trigger Health Factor:</span>
                            <span className='ml-2 font-medium text-gray-900 dark:text-white'>
                              {formatPreciseHealthFactor(order.triggerHealthFactor, 2)}
                            </span>
                          </div>
                          <div>
                            <span className='text-sm text-gray-600 dark:text-gray-400'>Current Health Factor:</span>
                            <span
                              className={`ml-2 font-medium ${
                                order.canExecute === 'YES'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                            >
                              {formatPreciseHealthFactor(order.currentHealthFactor, 2)}
                              {order.canExecute === 'YES' && ' (Executable)'}
                            </span>
                          </div>
                          <div>
                            {order.type === 'full' && (
                              <>
                                <span className='text-sm text-gray-600 dark:text-gray-400'>Seller Gets:</span>
                                <span className='ml-2 font-medium text-gray-900 dark:text-white'>
                                  {order.percentOfEquity}%
                                </span>
                              </>
                            )}
                            {order.type === 'partial' && (
                              <>
                                <span className='text-sm text-gray-600 dark:text-gray-400'>Bonus:</span>
                                <span className='ml-2 font-medium text-gray-900 dark:text-white'>{order.bonus}%</span>
                              </>
                            )}
                          </div>
                        </div>

                        {order.status === 'active' && (
                          <div className='pt-4 border-t border-gray-200 dark:border-gray-600'>
                            <div className='flex space-x-3'>
                              <button
                                onClick={() => handleCancelOrder(order)}
                                className='px-4 py-2 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-200 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-800 transition-colors'
                              >
                                Cancel Order
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateDebtModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPositionCreated={refetchWithCacheRefresh}
      />
      {selectedPositionForOrder && (
        <CreateSellOrderModal
          isOpen={isCreateOrderModalOpen}
          onClose={() => {
            setIsCreateOrderModalOpen(false);
            setSelectedPositionForOrder(null);
          }}
          debtPosition={selectedPositionForOrder}
          onCreateOrder={handleOrderCreation}
        />
      )}
      {selectedPositionForManage && (
        <ManagePositionModal
          isOpen={isManagePositionModalOpen}
          onClose={() => {
            setIsManagePositionModalOpen(false);
            setSelectedPositionForManage(null);
          }}
          position={selectedPositionForManage}
          onPositionUpdated={refetchWithCacheRefresh}
        />
      )}
    </div>
  );
}
