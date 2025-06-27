'use client';

// AppKit button will be used instead
import Link from 'next/link';
import { useAccount } from 'wagmi';

export default function DashboardPage() {
  const { isConnected, address } = useAccount();

  if (!isConnected) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900 flex items-center justify-center'>
        <div className='bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl text-center max-w-md mx-auto'>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white mb-4'>Connect Your Wallet</h1>
          <p className='text-gray-600 dark:text-gray-300 mb-6'>Please connect your wallet to access the dashboard.</p>
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
        {/* Welcome Section */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>Dashboard</h1>
          <p className='text-gray-600 dark:text-gray-300 mt-2'>
            Welcome back, {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>

        {/* Stats Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
          <div className='bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>Health Factor</p>
                <p className='text-2xl font-bold text-green-600'>2.45</p>
              </div>
              <div className='w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center'>
                <span className='text-2xl'>🛡️</span>
              </div>
            </div>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>Safe position</p>
          </div>

          <div className='bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>Total Debt</p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>$12,450</p>
              </div>
              <div className='w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center'>
                <span className='text-2xl'>💳</span>
              </div>
            </div>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>Across 3 positions</p>
          </div>

          <div className='bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>Active Orders</p>
                <p className='text-2xl font-bold text-orange-600'>2</p>
              </div>
              <div className='w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center'>
                <span className='text-2xl'>📋</span>
              </div>
            </div>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>1 sell, 1 buy</p>
          </div>

          <div className='bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border dark:border-gray-700'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>Total Savings</p>
                <p className='text-2xl font-bold text-purple-600'>$1,250</p>
              </div>
              <div className='w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center'>
                <span className='text-2xl'>💰</span>
              </div>
            </div>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>From liquidation protection</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
          {/* Your Positions */}
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700'>
            <div className='p-6 border-b dark:border-gray-700'>
              <h2 className='text-xl font-semibold text-gray-900 dark:text-white'>Your Debt Positions</h2>
            </div>
            <div className='p-6'>
              <div className='space-y-4'>
                <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                  <div className='flex items-center gap-3'>
                    <div className='w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold'>
                      U
                    </div>
                    <div>
                      <p className='font-medium text-gray-900 dark:text-white'>USDC Debt</p>
                      <p className='text-sm text-gray-500 dark:text-gray-400'>Mainnet • Aave V3</p>
                    </div>
                  </div>
                  <div className='text-right'>
                    <p className='font-medium text-gray-900 dark:text-white'>$8,500</p>
                    <p className='text-sm text-green-600'>HF: 2.8</p>
                  </div>
                </div>

                <div className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                  <div className='flex items-center gap-3'>
                    <div className='w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold'>
                      E
                    </div>
                    <div>
                      <p className='font-medium text-gray-900 dark:text-white'>ETH Debt</p>
                      <p className='text-sm text-gray-500 dark:text-gray-400'>Mainnet • Aave V3</p>
                    </div>
                  </div>
                  <div className='text-right'>
                    <p className='font-medium text-gray-900 dark:text-white'>$3,950</p>
                    <p className='text-sm text-yellow-600'>HF: 1.9</p>
                  </div>
                </div>
              </div>

              <div className='mt-6'>
                <Link
                  href='/positions'
                  className='w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                >
                  View All Positions
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700'>
            <div className='p-6 border-b dark:border-gray-700'>
              <h2 className='text-xl font-semibold text-gray-900 dark:text-white'>Recent Activity</h2>
            </div>
            <div className='p-6'>
              <div className='space-y-4'>
                <div className='flex items-center gap-3'>
                  <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white'>Sale order created</p>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>USDC debt position • 2 hours ago</p>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <div className='w-2 h-2 bg-blue-500 rounded-full'></div>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white'>Position purchased</p>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>ETH debt • 1 day ago</p>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <div className='w-2 h-2 bg-orange-500 rounded-full'></div>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white'>Health factor warning</p>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>ETH position • 2 days ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
