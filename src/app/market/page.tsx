'use client';

import { HealthFactorStatus, MarketOrder, OrderType } from '@/lib/types';
import {
  formatPercentage,
  formatTimeRemaining,
  formatUSD,
  generateMockAddress,
  generateMockOrderId,
  getHealthFactorStatus,
  truncateAddress,
} from '@/lib/utils';
// AppKit button will be used instead
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Address } from 'viem';
import { useAccount } from 'wagmi';

// Mock data for development - replace with real data
const generateMockOrders = (): MarketOrder[] => {
  return [
    {
      id: generateMockOrderId(),
      type: 'full',
      seller: generateMockAddress(),
      debtPosition: {
        address: generateMockAddress(),
        owner: generateMockAddress(),
        nonce: BigInt(1),
        totalCollateralBase: BigInt('2500000000000'), // $25,000
        totalDebtBase: BigInt('1000000000000'), // $10,000
        availableBorrowsBase: BigInt('500000000000'), // $5,000
        currentLiquidationThreshold: BigInt(8500), // 85%
        ltv: BigInt(8000), // 80%
        healthFactor: BigInt('1800000000000000000'), // 1.8
        collaterals: [
          {
            token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address,
            symbol: 'WETH',
            name: 'Wrapped Ethereum',
            decimals: 18,
            balance: BigInt('10000000000000000000'), // 10 ETH
            balanceUSD: BigInt('2000000000000'), // $20,000
          },
          {
            token: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as Address,
            symbol: 'WBTC',
            name: 'Wrapped Bitcoin',
            decimals: 8,
            balance: BigInt('12500000'), // 0.125 BTC
            balanceUSD: BigInt('500000000000'), // $5,000
          },
        ],
        debts: [
          {
            token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            balance: BigInt('10000000000'), // 10,000 USDC
            balanceUSD: BigInt('1000000000000'), // $10,000
          },
        ],
      },
      triggerHealthFactor: 1.5,
      currentHealthFactor: 1.8,
      estimatedProfit: BigInt('150000000000'), // $1,500
      validUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
      isActive: true,
      percentOfEquity: 90,
      paymentToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as Address,
    },
    {
      id: generateMockOrderId(),
      type: 'partial',
      seller: generateMockAddress(),
      debtPosition: {
        address: generateMockAddress(),
        owner: generateMockAddress(),
        nonce: BigInt(2),
        totalCollateralBase: BigInt('1500000000000'), // $15,000
        totalDebtBase: BigInt('800000000000'), // $8,000
        availableBorrowsBase: BigInt('200000000000'), // $2,000
        currentLiquidationThreshold: BigInt(8500), // 85%
        ltv: BigInt(8000), // 80%
        healthFactor: BigInt('1400000000000000000'), // 1.4
        collaterals: [
          {
            token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address,
            symbol: 'WETH',
            name: 'Wrapped Ethereum',
            decimals: 18,
            balance: BigInt('6000000000000000000'), // 6 ETH
            balanceUSD: BigInt('1200000000000'), // $12,000
          },
          {
            token: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Address,
            symbol: 'DAI',
            name: 'Dai Stablecoin',
            decimals: 18,
            balance: BigInt('3000000000000000000000'), // 3,000 DAI
            balanceUSD: BigInt('300000000000'), // $3,000
          },
        ],
        debts: [
          {
            token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            balance: BigInt('5000000000'), // 5,000 USDC
            balanceUSD: BigInt('500000000000'), // $5,000
          },
          {
            token: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Address,
            symbol: 'DAI',
            name: 'Dai Stablecoin',
            decimals: 18,
            balance: BigInt('3000000000000000000000'), // 3,000 DAI
            balanceUSD: BigInt('300000000000'), // $3,000
          },
        ],
      },
      triggerHealthFactor: 1.3,
      currentHealthFactor: 1.4,
      estimatedProfit: BigInt('75000000000'), // $750
      validUntil: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
      isActive: true,
      repayToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
      repayAmount: BigInt('2000000000'), // 2,000 USDC
      bonus: 2,
      collateralTokens: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address],
    },
  ];
};

export default function MarketPage() {
  const { isConnected } = useAccount();
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<MarketOrder[]>([]);
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderType | 'all'>('all');
  const [healthFactorFilter, setHealthFactorFilter] = useState<HealthFactorStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'healthFactor' | 'profit' | 'timeRemaining'>('healthFactor');
  const [selectedOrder, setSelectedOrder] = useState<MarketOrder | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    // Load mock data - replace with real API call
    setOrders(generateMockOrders());
  }, []);

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

    setIsExecuting(true);
    setSelectedOrder(order);

    try {
      // Simulate order execution - replace with real contract call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update order status
      setOrders(prev => prev.filter(o => o.id !== order.id));
      alert(`Successfully executed ${order.type} order!`);
    } catch (error) {
      alert('Failed to execute order');
    } finally {
      setIsExecuting(false);
      setSelectedOrder(null);
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
      <div className='min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center'>
        <div className='bg-white p-8 rounded-2xl shadow-xl text-center max-w-md mx-auto'>
          <h1 className='text-2xl font-bold text-gray-900 mb-4'>Connect Your Wallet</h1>
          <p className='text-gray-600 mb-6'>Please connect your wallet to browse the market.</p>
          <div className='flex justify-center mt-4'>
            <appkit-button />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <header className='bg-white shadow-sm border-b'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4'>
          <div className='flex justify-between items-center'>
            <div className='flex items-center gap-8'>
              <Link href='/' className='flex items-center gap-3'>
                <span className='text-xl font-bold text-gray-900'>Debt Protocol</span>
              </Link>
              <nav className='hidden md:flex space-x-8'>
                <Link href='/dashboard' className='text-gray-500 hover:text-gray-900'>
                  Dashboard
                </Link>
                <Link href='/positions' className='text-gray-500 hover:text-gray-900'>
                  Positions
                </Link>
                <Link href='/market' className='text-blue-600 font-medium'>
                  Market
                </Link>
                <Link href='/orders' className='text-gray-500 hover:text-gray-900'>
                  Orders
                </Link>
              </nav>
            </div>
            <appkit-button />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Header Section */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900'>Debt Position Market</h1>
          <p className='text-gray-600 mt-2'>Browse and purchase debt positions to help others avoid liquidation</p>
        </div>

        {/* Filters */}
        <div className='bg-white p-6 rounded-xl shadow-sm border mb-8'>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Order Type</label>
              <select
                value={orderTypeFilter}
                onChange={e => setOrderTypeFilter(e.target.value as OrderType | 'all')}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500'
              >
                <option value='all'>All Types</option>
                <option value='full'>Full Sale</option>
                <option value='partial'>Partial Sale</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Health Factor</label>
              <select
                value={healthFactorFilter}
                onChange={e => setHealthFactorFilter(e.target.value as HealthFactorStatus | 'all')}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500'
              >
                <option value='all'>All Levels</option>
                <option value='danger'>Danger (&lt; 1.1)</option>
                <option value='warning'>Warning (1.1 - 2.0)</option>
                <option value='safe'>Safe (&gt; 2.0)</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Sort By</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500'
              >
                <option value='healthFactor'>Health Factor</option>
                <option value='profit'>Est. Profit</option>
                <option value='timeRemaining'>Time Remaining</option>
              </select>
            </div>

            <div className='flex items-end'>
              <div className='text-sm text-gray-600'>
                <span className='font-medium'>{filteredOrders.length}</span> orders available
              </div>
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {filteredOrders.map(order => (
            <div key={order.id} className='bg-white rounded-xl shadow-sm border p-6'>
              {/* Order Header */}
              <div className='flex justify-between items-start mb-4'>
                <div className='flex items-center gap-3'>
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.type === 'full' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {order.type === 'full' ? 'Full Sale' : 'Partial Sale'}
                  </div>
                  {getHealthFactorBadge(order.currentHealthFactor)}
                </div>
                <div className='text-right'>
                  <div className='text-sm text-gray-600'>Expires in</div>
                  <div className='font-medium text-orange-600'>{formatTimeRemaining(order.validUntil)}</div>
                </div>
              </div>

              {/* Position Info */}
              <div className='bg-gray-50 p-4 rounded-lg mb-4'>
                <div className='grid grid-cols-2 gap-4 text-sm'>
                  <div>
                    <span className='text-gray-600'>Collateral:</span>
                    <span className='ml-2 font-medium'>{formatUSD(order.debtPosition.totalCollateralBase)}</span>
                  </div>
                  <div>
                    <span className='text-gray-600'>Debt:</span>
                    <span className='ml-2 font-medium'>{formatUSD(order.debtPosition.totalDebtBase)}</span>
                  </div>
                  <div>
                    <span className='text-gray-600'>Net Equity:</span>
                    <span className='ml-2 font-medium'>
                      {formatUSD(order.debtPosition.totalCollateralBase - order.debtPosition.totalDebtBase)}
                    </span>
                  </div>
                  <div>
                    <span className='text-gray-600'>Seller:</span>
                    <span className='ml-2 font-mono text-xs'>{truncateAddress(order.seller)}</span>
                  </div>
                </div>
              </div>

              {/* Order Details */}
              <div className='space-y-3 mb-4'>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>Trigger Health Factor:</span>
                  <span className='font-medium'>{order.triggerHealthFactor.toFixed(2)}</span>
                </div>

                {order.type === 'full' && (
                  <>
                    <div className='flex justify-between'>
                      <span className='text-gray-600'>Seller Gets:</span>
                      <span className='font-medium'>{formatPercentage(order.percentOfEquity || 0)}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600'>Your Potential Profit:</span>
                      <span className='font-medium text-green-600'>
                        {formatUSD(order.estimatedProfit || BigInt(0))}
                      </span>
                    </div>
                  </>
                )}

                {order.type === 'partial' && (
                  <>
                    <div className='flex justify-between'>
                      <span className='text-gray-600'>Repay Amount:</span>
                      <span className='font-medium'>{formatUSD(order.repayAmount || BigInt(0))}</span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600'>Your Bonus:</span>
                      <span className='font-medium text-green-600'>{formatPercentage(order.bonus || 0)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleExecuteOrder(order)}
                disabled={isExecuting && selectedOrder?.id === order.id}
                className='w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {isExecuting && selectedOrder?.id === order.id
                  ? 'Executing...'
                  : `Buy ${order.type === 'full' ? 'Position' : 'Order'}`}
              </button>
            </div>
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <div className='text-center py-12'>
            <div className='text-4xl mb-4'>📭</div>
            <h3 className='text-lg font-medium text-gray-900 mb-2'>No orders found</h3>
            <p className='text-gray-600'>Try adjusting your filters to see more results.</p>
          </div>
        )}
      </main>
    </div>
  );
}
