'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import CreateDebtModal from '../../components/CreateDebtModal';
import CreateSellOrderModal from '../../components/CreateSellOrderModal';
import { formatHealthFactor, useUserDebtPositions, useUserPositionSummary } from '../../lib/hooks/useDebtPositions';
import { useOrderActions, useUserOrders, useUserOrdersSummary } from '../../lib/hooks/useUserOrders';
import { UserSellOrder } from '../../lib/types';
import { formatTimeRemaining, truncateAddress } from '../../lib/utils';

export default function PositionsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [selectedPositionForOrder, setSelectedPositionForOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');

  const { address, isConnected } = useAccount();
  const { positions, isLoading: positionsLoading, error: positionsError } = useUserDebtPositions();
  const { orders, isLoading: ordersLoading, error: ordersError } = useUserOrders();
  const { cancelOrder } = useOrderActions();
  const positionSummary = useUserPositionSummary();
  const ordersSummary = useUserOrdersSummary();

  const isLoading = positionsLoading || ordersLoading;
  const error = positionsError || ordersError;

  const handleCreateSellOrder = (position: any) => {
    setSelectedPositionForOrder(position);
    setIsCreateOrderModalOpen(true);
  };

  const handleCancelOrder = async (order: UserSellOrder) => {
    try {
      await cancelOrder(order.id);
      // Refresh orders list
    } catch (error) {
      console.error('Failed to cancel order:', error);
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

  if (isLoading) {
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

        {/* Combined Summary Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8'>
          {/* Positions Cards */}
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>Total Positions</p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>{positionSummary.totalPositions}</p>
              </div>
              <div className='w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center'>
                <svg
                  className='w-6 h-6 text-blue-600'
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
              <div className='w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center'>
                <svg
                  className='w-6 h-6 text-red-600'
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
                  {positionSummary.averageHealthFactor.toFixed(2)}
                </p>
              </div>
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  positionSummary.averageHealthFactor > 2
                    ? 'bg-green-100 dark:bg-green-900'
                    : positionSummary.averageHealthFactor > 1.5
                    ? 'bg-yellow-100 dark:bg-yellow-900'
                    : 'bg-red-100 dark:bg-red-900'
                }`}
              >
                <svg
                  className={`w-6 h-6 ${
                    positionSummary.averageHealthFactor > 2
                      ? 'text-green-600'
                      : positionSummary.averageHealthFactor > 1.5
                      ? 'text-yellow-600'
                      : 'text-red-600'
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
              <div className='w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center'>
                <svg
                  className='w-6 h-6 text-orange-600'
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
              <div className='w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center'>
                <svg
                  className='w-6 h-6 text-purple-600'
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
                onClick={() => setActiveTab('positions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'positions'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Debt Positions ({positionSummary.totalPositions})
              </button>
              <button
                onClick={() => setActiveTab('orders')}
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
                    {positions.map((position, index) => {
                      const healthFactor = formatHealthFactor(position.healthFactor);
                      const positionOrders = orders.filter(
                        order => order.debtAddress.toLowerCase() === position.address.toLowerCase(),
                      );

                      return (
                        <div key={index} className='bg-gray-50 rounded-xl p-6 border border-gray-100'>
                          <div className='flex justify-between items-start mb-4'>
                            <div>
                              <h3 className='text-lg font-semibold text-gray-900 mb-1'>Position #{index + 1}</h3>
                              <p className='text-sm text-gray-600 font-mono'>{truncateAddress(position.address)}</p>
                              {positionOrders.length > 0 && (
                                <div className='mt-2'>
                                  <span className='text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full'>
                                    {positionOrders.length} active order{positionOrders.length > 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                healthFactor.status === 'safe'
                                  ? 'bg-green-100 text-green-800'
                                  : healthFactor.status === 'warning'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : healthFactor.status === 'danger'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {healthFactor.label}
                            </div>
                          </div>

                          <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'>
                            {/* Collateral */}
                            <div>
                              <h4 className='text-sm font-medium text-gray-700 mb-3'>Collateral</h4>
                              <div className='space-y-2'>
                                {position.collaterals.map((collateral, idx) => (
                                  <div key={idx} className='flex justify-between items-center'>
                                    <span className='text-sm text-gray-600'>{collateral.symbol}</span>
                                    <div className='text-right'>
                                      <div className='text-sm font-medium'>{collateral.balanceFormatted}</div>
                                      <div className='text-xs text-gray-500'>
                                        ${collateral.valueInUSD.toLocaleString()}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Debt */}
                            <div>
                              <h4 className='text-sm font-medium text-gray-700 mb-3'>Debt</h4>
                              <div className='space-y-2'>
                                {position.debts.map((debt, idx) => (
                                  <div key={idx} className='flex justify-between items-center'>
                                    <span className='text-sm text-gray-600'>{debt.symbol}</span>
                                    <div className='text-right'>
                                      <div className='text-sm font-medium'>{debt.balanceFormatted}</div>
                                      <div className='text-xs text-gray-500'>${debt.valueInUSD.toLocaleString()}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Health Factor */}
                            <div>
                              <h4 className='text-sm font-medium text-gray-700 mb-3'>Health Factor</h4>
                              <div className='text-2xl font-bold mb-1' style={{ color: healthFactor.color }}>
                                {healthFactor.value.toFixed(2)}
                              </div>
                              <div className='text-xs text-gray-500'>{healthFactor.value > 1 ? 'Safe' : 'At Risk'}</div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className='pt-4 border-t border-gray-200'>
                            <div className='flex space-x-3'>
                              <button
                                onClick={() => handleCreateSellOrder(position)}
                                className='px-4 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors'
                              >
                                Create Sell Order
                              </button>
                              <button className='px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors'>
                                Manage Position
                              </button>
                              <button className='px-4 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors'>
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                              {order.triggerHealthFactor.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className='text-sm text-gray-600 dark:text-gray-400'>Current Health Factor:</span>
                            <span className='ml-2 font-medium text-gray-900 dark:text-white'>
                              {order.currentHealthFactor.toFixed(2)}
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
                              <button className='px-4 py-2 bg-gray-50 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors'>
                                View Details
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
      <CreateDebtModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      {selectedPositionForOrder && (
        <CreateSellOrderModal
          isOpen={isCreateOrderModalOpen}
          onClose={() => {
            setIsCreateOrderModalOpen(false);
            setSelectedPositionForOrder(null);
          }}
          debtPosition={selectedPositionForOrder}
          onCreateOrder={async orderData => {
            console.log('Creating order:', orderData);
            // Implementation would create the order
          }}
        />
      )}
    </div>
  );
}
