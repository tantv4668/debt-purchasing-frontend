'use client';

import { useMarketOrders } from '@/lib/hooks/useMarketOrders';
import { useOrderExecution } from '@/lib/hooks/useOrderExecution';
import { HealthFactorStatus, MarketOrder, OrderType } from '@/lib/types';
import { formatPercentage, formatTimeRemaining, formatUSD, getHealthFactorStatus, truncateAddress } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

export default function MarketPage() {
  const { isConnected } = useAccount();
  const { orders, isLoading, error, refetch } = useMarketOrders();
  const { executeOrder, isExecuting, executingOrderId } = useOrderExecution();

  const [filteredOrders, setFilteredOrders] = useState<MarketOrder[]>([]);
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderType | 'all'>('all');
  const [healthFactorFilter, setHealthFactorFilter] = useState<HealthFactorStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'healthFactor' | 'profit' | 'timeRemaining'>('healthFactor');

  useEffect(() => {
    let filtered = orders;

    // Filter by order type
    if (orderTypeFilter !== 'all') {
      filtered = filtered.filter(order => order.type === orderTypeFilter);
    }

    // Filter by health factor status
    if (healthFactorFilter !== 'all') {
      filtered = filtered.filter(order => getHealthFactorStatus(order.currentHealthFactor) === healthFactorFilter);
    }

    // Sort orders
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'healthFactor':
          return a.currentHealthFactor - b.currentHealthFactor;
        case 'profit':
          return Number(b.estimatedProfit || 0) - Number(a.estimatedProfit || 0);
        case 'timeRemaining':
          return a.validUntil.getTime() - b.validUntil.getTime();
        default:
          return 0;
      }
    });

    setFilteredOrders(filtered);
  }, [orders, orderTypeFilter, healthFactorFilter, sortBy]);

  const handleExecuteOrder = async (order: MarketOrder) => {
    if (!isConnected) {
      alert('Please connect your wallet');
      return;
    }

    try {
      console.log('🎯 Starting order execution for:', order.id);

      const txHash = await executeOrder(order);
      console.log('✅ Order execution transaction:', txHash);

      alert(`Successfully executed ${order.type} order!\nTransaction: ${txHash}`);

      // Wait a bit before refreshing to allow blockchain to update
      setTimeout(() => {
        refetch();
      }, 2000);
    } catch (error) {
      console.error('❌ Failed to execute order:', error);

      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;

        // Provide more specific error messages for common cases
        if (error.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds to execute this order. Please check your token balance.';
        } else if (error.message.includes('allowance')) {
          errorMessage = 'Token approval failed. Please try again or check your wallet settings.';
        } else if (error.message.includes('HF too high')) {
          errorMessage = 'Order cannot be executed yet - health factor is still too high.';
        } else if (error.message.includes('Invalid signature')) {
          errorMessage = 'Order signature is invalid. The order may have been cancelled or expired.';
        } else if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction was rejected in your wallet.';
        }
      }

      alert(`Failed to execute order: ${errorMessage}`);
    }
  };

  const getHealthFactorBadge = (hf: number) => {
    const status = getHealthFactorStatus(hf);
    const colors = {
      safe: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      danger: 'bg-red-100 text-red-800',
      critical: 'bg-red-200 text-red-900',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
        {hf.toFixed(2)} - {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (!isConnected) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900 flex items-center justify-center'>
        <div className='bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl text-center max-w-md mx-auto'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white mb-4'>Connect Your Wallet</h1>
          <p className='text-gray-600 dark:text-gray-300 mb-6'>Please connect your wallet to browse the market.</p>
          <div className='flex justify-center mt-4'>
            <appkit-button />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      {/* Main Content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Header Section */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>Debt Position Market</h1>
          <p className='text-gray-600 dark:text-gray-300 mt-2'>
            Browse and purchase debt positions to help others avoid liquidation
          </p>
        </div>

        {/* Filters */}
        <div className='bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8'>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>Order Type</label>
              <select
                value={orderTypeFilter}
                onChange={e => setOrderTypeFilter(e.target.value as OrderType | 'all')}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700'
              >
                <option value='all'>All Types</option>
                <option value='full'>Full Sale</option>
                <option value='partial'>Partial Sale</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>Health Factor</label>
              <select
                value={healthFactorFilter}
                onChange={e => setHealthFactorFilter(e.target.value as HealthFactorStatus | 'all')}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700'
              >
                <option value='all'>All Levels</option>
                <option value='danger'>Danger (&lt; 1.1)</option>
                <option value='warning'>Warning (1.1 - 2.0)</option>
                <option value='safe'>Safe (&gt; 2.0)</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>Sort By</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700'
              >
                <option value='healthFactor'>Health Factor</option>
                <option value='profit'>Est. Profit</option>
                <option value='timeRemaining'>Time Remaining</option>
              </select>
            </div>

            <div className='flex items-end'>
              <div className='text-sm text-gray-600 dark:text-gray-400'>
                <span className='font-medium text-gray-900 dark:text-white'>{filteredOrders.length}</span> orders
                available
              </div>
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className='bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6'
            >
              {/* Order Header */}
              <div className='flex justify-between items-start mb-4'>
                <div className='flex items-center gap-3'>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.type === 'full'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                    }`}
                  >
                    {order.type === 'full' ? 'Full Sale' : 'Partial Sale'}
                  </div>
                  {getHealthFactorBadge(order.currentHealthFactor)}
                </div>
                <div className='text-right'>
                  <div className='text-sm text-gray-600 dark:text-gray-400'>Expires in</div>
                  <div className='font-medium text-orange-600 dark:text-orange-400'>
                    {formatTimeRemaining(order.validUntil)}
                  </div>
                </div>
              </div>

              {/* Position Info */}
              <div className='bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4'>
                <div className='grid grid-cols-2 gap-4 text-sm'>
                  <div>
                    <span className='text-gray-600 dark:text-gray-400'>Collateral:</span>
                    <span className='ml-2 font-medium text-gray-900 dark:text-white'>
                      {formatUSD(order.debtPosition.totalCollateralBase)}
                    </span>
                  </div>
                  <div>
                    <span className='text-gray-600 dark:text-gray-400'>Debt:</span>
                    <span className='ml-2 font-medium text-gray-900 dark:text-white'>
                      {formatUSD(order.debtPosition.totalDebtBase)}
                    </span>
                  </div>
                  <div>
                    <span className='text-gray-600 dark:text-gray-400'>Net Equity:</span>
                    <span className='ml-2 font-medium text-gray-900 dark:text-white'>
                      {formatUSD(order.debtPosition.totalCollateralBase - order.debtPosition.totalDebtBase)}
                    </span>
                  </div>
                  <div>
                    <span className='text-gray-600 dark:text-gray-400'>Health Factor:</span>
                    <span className='ml-2 font-medium text-gray-900 dark:text-white'>
                      {order.currentHealthFactor.toFixed(3)}
                    </span>
                  </div>
                </div>

                {/* Collateral Tokens */}
                {order.debtPosition.collaterals.length > 0 && (
                  <div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-600'>
                    <div className='text-xs text-gray-600 dark:text-gray-400 mb-2'>Collateral Tokens:</div>
                    <div className='flex flex-wrap gap-1'>
                      {order.debtPosition.collaterals.map((collateral, index) => (
                        <span
                          key={index}
                          className='px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs'
                        >
                          {collateral.symbol} ({formatUSD(collateral.balanceUSD)})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Debt Tokens */}
                {order.debtPosition.debts.length > 0 && (
                  <div className='mt-2'>
                    <div className='text-xs text-gray-600 dark:text-gray-400 mb-2'>Debt Tokens:</div>
                    <div className='flex flex-wrap gap-1'>
                      {order.debtPosition.debts.map((debt, index) => (
                        <span
                          key={index}
                          className='px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-xs'
                        >
                          {debt.symbol} ({formatUSD(debt.balanceUSD)})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-600'>
                  <div className='text-xs text-gray-600 dark:text-gray-400'>
                    <span>Seller: </span>
                    <span className='font-mono text-gray-900 dark:text-white'>{truncateAddress(order.seller)}</span>
                  </div>
                </div>
              </div>

              {/* Order Details */}
              <div className='space-y-3 mb-4'>
                <div className='flex justify-between'>
                  <span className='text-gray-600 dark:text-gray-400'>Order ID:</span>
                  <span className='font-mono text-xs text-gray-900 dark:text-white'>{order.id.slice(0, 8)}...</span>
                </div>

                <div className='flex justify-between'>
                  <span className='text-gray-600 dark:text-gray-400'>Trigger Health Factor:</span>
                  <span className='font-medium text-gray-900 dark:text-white'>
                    {order.triggerHealthFactor.toFixed(2)}
                  </span>
                </div>

                <div className='flex justify-between'>
                  <span className='text-gray-600 dark:text-gray-400'>Current vs Trigger HF:</span>
                  <span className='font-medium text-gray-900 dark:text-white'>
                    {order.currentHealthFactor.toFixed(3)} / {order.triggerHealthFactor.toFixed(3)}
                    {order.currentHealthFactor === order.triggerHealthFactor && (
                      <span className='text-xs text-gray-500 ml-1'>(estimated)</span>
                    )}
                  </span>
                </div>

                {order.type === 'full' && (
                  <>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Seller Gets:</span>
                      <span className='font-medium text-gray-900 dark:text-white'>
                        {formatPercentage(order.percentOfEquity || 0)} of equity
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Payment Token:</span>
                      <span className='font-mono text-xs text-gray-900 dark:text-white'>
                        {truncateAddress(order.paymentToken || '0x')}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Est. Profit:</span>
                      <span className='font-medium text-green-600 dark:text-green-400'>
                        {formatUSD(order.estimatedProfit || BigInt(0))}
                      </span>
                    </div>
                  </>
                )}

                {order.type === 'partial' && (
                  <>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Repay Amount:</span>
                      <span className='font-medium text-gray-900 dark:text-white'>
                        {formatUSD(order.repayAmount || BigInt(0))}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Repay Token:</span>
                      <span className='font-mono text-xs text-gray-900 dark:text-white'>
                        {truncateAddress(order.repayToken || '0x')}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Bonus:</span>
                      <span className='font-medium text-green-600 dark:text-green-400'>
                        {formatPercentage(order.bonus || 0)}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Collateral Tokens:</span>
                      <span className='font-medium text-gray-900 dark:text-white'>
                        {order.collateralTokens?.length || 0} token
                        {(order.collateralTokens?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </>
                )}

                {/* Execution Status */}
                <div className='pt-2 border-t border-gray-200 dark:border-gray-600'>
                  <div className='flex justify-between items-center'>
                    <span className='text-gray-600 dark:text-gray-400'>Execution Status:</span>
                    <div className='text-right'>
                      <span
                        className={`font-medium ${
                          order.isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {order.isActive ? 'Ready' : 'Waiting'}
                      </span>
                      {order.canExecuteReason && !order.isActive && (
                        <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>{order.canExecuteReason}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleExecuteOrder(order)}
                disabled={!order.isActive || (isExecuting && executingOrderId === order.id)}
                className='w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {isExecuting && executingOrderId === order.id
                  ? 'Executing...'
                  : !order.isActive
                  ? 'Not Executable'
                  : `Buy ${order.type === 'full' ? 'Position' : 'Order'}`}
              </button>
            </div>
          ))}
        </div>

        {!isLoading && filteredOrders.length === 0 && (
          <div className='text-center py-12'>
            <div className='text-4xl mb-4'>📭</div>
            <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-2'>No orders found</h3>
            <p className='text-gray-600 dark:text-gray-300'>
              {orders.length === 0
                ? 'No orders are currently available in the market.'
                : 'Try adjusting your filters to see more results.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
