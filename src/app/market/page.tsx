'use client';

import { getAaveRouterAddress } from '@/lib/contracts';
import { ERC20_ABI } from '@/lib/contracts/abis';
import { useOrderExecution } from '@/lib/hooks/useOrderExecution';
import { useMarketOrders } from '@/lib/hooks/useOrders';
import { usePriceTokens } from '@/lib/hooks/usePriceTokens';
import { HealthFactorStatus, MarketOrder, OrderType } from '@/lib/types';
import {
  formatPreciseHealthFactor,
  formatPrecisePercentage,
  formatPreciseWeiToUSD,
  formatTimeRemaining,
  getHealthFactorStatus,
  truncateAddress,
} from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';

export default function MarketPage() {
  const { isConnected, address, chainId } = useAccount();
  const { orders, isLoading, error, refetch } = useMarketOrders();
  const { executeOrder, isExecuting, executingOrderId } = useOrderExecution();
  const { getTokenSymbol, isLoading: tokensLoading, tokens } = usePriceTokens();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [filteredOrders, setFilteredOrders] = useState<MarketOrder[]>([]);
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderType | 'all'>('all');
  const [healthFactorFilter, setHealthFactorFilter] = useState<HealthFactorStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'healthFactor' | 'profit' | 'timeRemaining'>('healthFactor');

  // Enhanced state for execution options and approvals
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MarketOrder | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<{
    paymentToken: { needed: boolean; approved: boolean; amount: bigint };
    debtTokens: { token: string; needed: boolean; approved: boolean; amount: bigint }[];
  } | null>(null);
  const [isCheckingApprovals, setIsCheckingApprovals] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

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

  // Debug token data
  useEffect(() => {
    if (!tokensLoading && Object.keys(tokens).length > 0) {
      console.log('🔍 Token data loaded:', tokens);
      console.log('🔍 Available token addresses:', Object.keys(tokens));
    }
  }, [tokens, tokensLoading]);

  // Debug order token addresses
  useEffect(() => {
    if (orders.length > 0) {
      orders.forEach((order, index) => {
        console.log(`🔍 Order ${index + 1}:`, {
          paymentToken: order.paymentToken,
          repayToken: order.repayToken,
          type: order.type,
        });
      });
    }
  }, [orders]);

  const checkApprovalStatus = async (order: MarketOrder, autoLiquidate: boolean = false) => {
    if (!address || !order.paymentToken || !publicClient || !chainId) return;

    setIsCheckingApprovals(true);
    try {
      const routerAddress = getAaveRouterAddress(chainId);

      // Calculate payment amount
      const netEquity = order.debtPosition.totalCollateralBase - order.debtPosition.totalDebtBase;
      const sellerPercentageBasisPoints = Math.floor(order.percentOfEquity! * 100);
      const paymentAmount = (netEquity * BigInt(sellerPercentageBasisPoints)) / BigInt(10000);

      // Check payment token allowance
      const paymentAllowance = (await publicClient.readContract({
        address: order.paymentToken,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, routerAddress],
      })) as bigint;

      const paymentTokenStatus = {
        needed: paymentAmount > 0,
        approved: paymentAllowance >= paymentAmount,
        amount: paymentAmount,
      };

      // Check debt token allowances (only for auto-liquidation)
      const debtTokensStatus: { token: string; needed: boolean; approved: boolean; amount: bigint }[] = [];

      if (autoLiquidate) {
        for (const debt of order.debtPosition.debts) {
          if (debt.balance > 0) {
            const debtAllowance = (await publicClient.readContract({
              address: debt.token,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [address, routerAddress],
            })) as bigint;

            debtTokensStatus.push({
              token: debt.token,
              needed: true,
              approved: debtAllowance >= debt.balance,
              amount: debt.balance,
            });
          }
        }
      }

      setApprovalStatus({
        paymentToken: paymentTokenStatus,
        debtTokens: debtTokensStatus,
      });
    } catch (error) {
      console.error('Failed to check approval status:', error);
      // Set a default state to allow users to proceed even if approval check fails
      setApprovalStatus({
        paymentToken: { needed: true, approved: false, amount: BigInt(0) },
        debtTokens: [],
      });
    } finally {
      setIsCheckingApprovals(false);
    }
  };

  const handleApproveToken = async (tokenAddress: string, amount: bigint) => {
    if (!address || !chainId) return;

    setIsApproving(true);
    try {
      const routerAddress = getAaveRouterAddress(chainId);

      await writeContractAsync({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [routerAddress, amount],
      });

      // Refresh approval status
      if (selectedOrder) {
        await checkApprovalStatus(selectedOrder, (approvalStatus?.debtTokens?.length || 0) > 0);
      }
    } catch (error) {
      console.error('Failed to approve token:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const openExecutionModal = async (order: MarketOrder) => {
    setSelectedOrder(order);
    setShowExecutionModal(true);
    await checkApprovalStatus(order, false); // Check for standard purchase first
  };

  const handleExecutionModeChange = async (autoLiquidate: boolean) => {
    if (selectedOrder) {
      await checkApprovalStatus(selectedOrder, autoLiquidate);
    }
  };

  const canExecute = () => {
    if (!approvalStatus) return false;

    const paymentTokenReady = !approvalStatus.paymentToken.needed || approvalStatus.paymentToken.approved;
    const debtTokensReady = approvalStatus.debtTokens.every(token => !token.needed || token.approved);

    return paymentTokenReady && debtTokensReady;
  };

  const handleExecuteOrder = async (order: MarketOrder, autoLiquidate: boolean = false) => {
    if (!isConnected) {
      console.warn('⚠️ Please connect your wallet to execute orders');
      return;
    }

    try {
      console.log('🎯 Starting order execution for:', order.id, 'with auto-liquidation:', autoLiquidate);

      const options = {
        autoLiquidate,
        minProfit: BigInt(0), // Could be configurable in the future
      };

      const txHash = await executeOrder(order, options);

      if (order.type === 'full' && autoLiquidate) {
        console.log('🎉 Successfully executed full sale order with auto-liquidation!');
        console.log('📋 You now own the debt position and all debts have been repaid with collateral withdrawn.');
        console.log('🔗 Transaction confirmed:', txHash);
      } else if (order.type === 'full') {
        console.log('🎉 Successfully executed full sale order!');
        console.log('📋 You now own the debt position. You can manage the position from the Positions page.');
        console.log('🔗 Transaction confirmed:', txHash);
      } else {
        console.log('🎉 Successfully executed partial sale order!');
        console.log("📋 You've helped improve the seller's health factor and received collateral with bonus.");
        console.log('🔗 Transaction confirmed:', txHash);
      }

      // Close modal and reset selection only after confirmation
      setShowExecutionModal(false);
      setSelectedOrder(null);

      // Refresh orders after confirmation
      refetch();
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

      console.error('💥 Failed to execute order:', errorMessage);
    }
  };

  const closeExecutionModal = () => {
    setShowExecutionModal(false);
    setSelectedOrder(null);
  };

  const isOwnOrder = (order: MarketOrder) => {
    return address && order.seller.toLowerCase() === address.toLowerCase();
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
        {formatPreciseHealthFactor(hf, 2)} - {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Enhanced modal JSX
  const renderExecutionModal = () => {
    if (!showExecutionModal || !selectedOrder) return null;

    return (
      <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto'>
          <h3 className='text-xl font-bold text-gray-900 dark:text-white mb-4'>Execute Full Sale Order</h3>

          <div className='mb-6'>
            <div className='text-sm text-gray-600 dark:text-gray-400 mb-2'>
              Order: {selectedOrder.id.slice(0, 8)}... •{' '}
              {formatPreciseWeiToUSD(selectedOrder.estimatedProfit || BigInt(0))} profit
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              You'll pay {formatPrecisePercentage(selectedOrder.percentOfEquity || 0)} of net equity to the seller
            </div>
          </div>

          {/* Approval Status Section */}
          {isCheckingApprovals ? (
            <div className='mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
              <div className='text-sm text-gray-600 dark:text-gray-400'>Checking token approvals...</div>
            </div>
          ) : (
            approvalStatus && (
              <div className='mb-6'>
                <h4 className='font-medium text-gray-900 dark:text-white mb-3'>Token Approvals Required</h4>

                {/* Payment Token Approval */}
                <div className='space-y-2 mb-4'>
                  <div className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                    <div className='flex-1'>
                      <div className='text-sm font-medium text-gray-900 dark:text-white'>
                        Payment Token ({getTokenSymbol(selectedOrder.paymentToken || '0x')})
                      </div>
                      <div className='text-xs text-gray-600 dark:text-gray-400'>
                        Amount: {formatPreciseWeiToUSD(approvalStatus.paymentToken.amount)}
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      {approvalStatus.paymentToken.approved ? (
                        <span className='text-xs bg-green-100 text-green-800 px-2 py-1 rounded'>✓ Approved</span>
                      ) : (
                        <button
                          onClick={() =>
                            handleApproveToken(selectedOrder.paymentToken!, approvalStatus.paymentToken.amount)
                          }
                          disabled={isApproving}
                          className='text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50'
                        >
                          {isApproving ? 'Approving...' : 'Approve'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Debt Token Approvals (for auto-liquidation) */}
                {approvalStatus.debtTokens.length > 0 && (
                  <div className='space-y-2'>
                    <div className='text-sm font-medium text-gray-900 dark:text-white'>
                      Debt Token Approvals (for auto-liquidation)
                    </div>
                    {approvalStatus.debtTokens.map((debtToken, index) => (
                      <div
                        key={index}
                        className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'
                      >
                        <div className='flex-1'>
                          <div className='text-sm font-medium text-gray-900 dark:text-white'>
                            {getTokenSymbol(debtToken.token)}
                          </div>
                          <div className='text-xs text-gray-600 dark:text-gray-400'>
                            Amount: {formatPreciseWeiToUSD(debtToken.amount)}
                          </div>
                        </div>
                        <div className='flex items-center gap-2'>
                          {debtToken.approved ? (
                            <span className='text-xs bg-green-100 text-green-800 px-2 py-1 rounded'>✓ Approved</span>
                          ) : (
                            <button
                              onClick={() => handleApproveToken(debtToken.token, debtToken.amount)}
                              disabled={isApproving}
                              className='text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50'
                            >
                              {isApproving ? 'Approving...' : 'Approve'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          <div className='space-y-4 mb-6'>
            <div className='border border-gray-200 dark:border-gray-600 rounded-lg p-4'>
              <h4 className='font-medium text-gray-900 dark:text-white mb-2'>Option 1: Standard Purchase</h4>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-3'>
                Transfer ownership only. You'll need to manually repay debts and withdraw collateral afterwards.
              </p>
              <button
                onClick={() => {
                  handleExecutionModeChange(false);
                  if (canExecute()) {
                    handleExecuteOrder(selectedOrder, false);
                  }
                }}
                disabled={isExecuting || !canExecute()}
                className='w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {isExecuting && executingOrderId === selectedOrder.id
                  ? 'Executing...'
                  : !canExecute()
                    ? 'Approve Tokens First'
                    : 'Standard Purchase'}
              </button>
            </div>

            <div className='border border-blue-200 dark:border-blue-600 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20'>
              <h4 className='font-medium text-gray-900 dark:text-white mb-2'>
                Option 2: Auto-Liquidation{' '}
                <span className='text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded'>
                  Recommended
                </span>
              </h4>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-3'>
                Automatically repay all debts and withdraw all collateral in one transaction. You'll receive the net
                profit directly.
              </p>
              <div className='text-xs text-gray-500 dark:text-gray-400 mb-3'>
                This executes: Order purchase → Repay all debts → Withdraw all collateral
              </div>
              <button
                onClick={() => {
                  handleExecutionModeChange(true);
                  if (canExecute()) {
                    handleExecuteOrder(selectedOrder, true);
                  }
                }}
                disabled={isExecuting || !canExecute()}
                className='w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {isExecuting && executingOrderId === selectedOrder.id
                  ? 'Executing...'
                  : !canExecute()
                    ? 'Approve Tokens First'
                    : 'Auto-Liquidation'}
              </button>
            </div>
          </div>

          <div className='flex gap-3'>
            <button
              onClick={closeExecutionModal}
              disabled={isExecuting}
              className='flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
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
                      {formatPreciseWeiToUSD(order.debtPosition.totalCollateralBase)}
                    </span>
                  </div>
                  <div>
                    <span className='text-gray-600 dark:text-gray-400'>Debt:</span>
                    <span className='ml-2 font-medium text-gray-900 dark:text-white'>
                      {formatPreciseWeiToUSD(order.debtPosition.totalDebtBase)}
                    </span>
                  </div>
                  <div>
                    <span className='text-gray-600 dark:text-gray-400'>Net Equity:</span>
                    <span className='ml-2 font-medium text-gray-900 dark:text-white'>
                      {formatPreciseWeiToUSD(order.debtPosition.totalCollateralBase - order.debtPosition.totalDebtBase)}
                    </span>
                  </div>
                  <div>
                    <span className='text-gray-600 dark:text-gray-400'>Health Factor:</span>
                    <span className='ml-2 font-medium text-gray-900 dark:text-white'>
                      {formatPreciseHealthFactor(order.currentHealthFactor, 3)}
                    </span>
                  </div>
                </div>

                {/* Collateral and Debt Tokens - Compact Layout */}
                {(order.debtPosition.collaterals.length > 0 || order.debtPosition.debts.length > 0) && (
                  <div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-600'>
                    <div className='flex flex-wrap gap-4'>
                      {/* Collateral Tokens */}
                      {order.debtPosition.collaterals.length > 0 && (
                        <div className='flex-1 min-w-0'>
                          <div className='text-xs text-gray-600 dark:text-gray-400 mb-2'>Collateral:</div>
                          <div className='flex flex-wrap gap-1'>
                            {order.debtPosition.collaterals.map((collateral, index) => (
                              <span
                                key={index}
                                className='px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs'
                              >
                                {collateral.symbol} ({formatPreciseWeiToUSD(collateral.balanceUSD)})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Debt Tokens */}
                      {order.debtPosition.debts.length > 0 && (
                        <div className='flex-1 min-w-0'>
                          <div className='text-xs text-gray-600 dark:text-gray-400 mb-2'>Debt:</div>
                          <div className='flex flex-wrap gap-1'>
                            {order.debtPosition.debts.map((debt, index) => (
                              <span
                                key={index}
                                className='px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded text-xs'
                              >
                                {debt.symbol} ({formatPreciseWeiToUSD(debt.balanceUSD)})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
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
                    {formatPreciseHealthFactor(order.triggerHealthFactor, 2)}
                  </span>
                </div>

                <div className='flex justify-between'>
                  <span className='text-gray-600 dark:text-gray-400'>Current vs Trigger HF:</span>
                  <span className='font-medium text-gray-900 dark:text-white'>
                    {formatPreciseHealthFactor(order.currentHealthFactor, 3)} /{' '}
                    {formatPreciseHealthFactor(order.triggerHealthFactor, 3)}
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
                        {formatPrecisePercentage(order.percentOfEquity || 0)} of equity
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Payment Token:</span>
                      <span className='font-mono text-xs text-gray-900 dark:text-white'>
                        {tokensLoading ? 'Loading...' : getTokenSymbol(order.paymentToken || '0x')}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Est. Profit:</span>
                      <span className='font-medium text-green-600 dark:text-green-400'>
                        {formatPreciseWeiToUSD(order.estimatedProfit || BigInt(0))}
                      </span>
                    </div>
                  </>
                )}

                {order.type === 'partial' && (
                  <>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Repay Amount:</span>
                      <span className='font-medium text-gray-900 dark:text-white'>
                        {formatPreciseWeiToUSD(order.repayAmount || BigInt(0))}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Repay Token:</span>
                      <span className='font-mono text-xs text-gray-900 dark:text-white'>
                        {tokensLoading ? 'Loading...' : getTokenSymbol(order.repayToken || '0x')}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>Bonus:</span>
                      <span className='font-medium text-green-600 dark:text-green-400'>
                        {formatPrecisePercentage(order.bonus || 0)}
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
              <div className='space-y-2'>
                {isOwnOrder(order) ? (
                  <button
                    disabled={true}
                    className='w-full px-4 py-2 bg-gray-400 text-white rounded-lg opacity-50 cursor-not-allowed'
                  >
                    Your Order
                  </button>
                ) : order.type === 'partial' ? (
                  <button
                    onClick={() => openExecutionModal(order)}
                    disabled={!order.isActive || isExecuting}
                    className='w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                  >
                    {!order.isActive ? 'Not Executable' : 'Help & Earn Bonus'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openExecutionModal(order)}
                      disabled={!order.isActive || isExecuting}
                      className='w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                    >
                      {!order.isActive ? 'Not Executable' : 'Buy Position'}
                    </button>
                    <div className='text-xs text-gray-500 dark:text-gray-400 text-center'>
                      Click to choose execution options
                    </div>
                  </>
                )}
              </div>
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

      {/* Replace the existing modal with the enhanced one */}
      {renderExecutionModal()}
    </div>
  );
}
