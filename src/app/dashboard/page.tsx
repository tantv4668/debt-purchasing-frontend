'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useAccount } from 'wagmi';

export default function DashboardPage() {
  const { isConnected, address } = useAccount();

  if (!isConnected) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center'>
        <div className='bg-white p-8 rounded-2xl shadow-xl text-center max-w-md mx-auto'>
          <h1 className='text-2xl font-bold text-gray-900 mb-4'>Connect Your Wallet</h1>
          <p className='text-gray-600 mb-6'>Please connect your wallet to access the dashboard.</p>
          <div className='flex justify-center'>
            <ConnectButton />
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
                <div className='w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold'>
                  DP
                </div>
                <span className='text-xl font-bold text-gray-900'>Debt Protocol</span>
              </Link>
              <nav className='hidden md:flex space-x-8'>
                <Link href='/dashboard' className='text-blue-600 font-medium'>
                  Dashboard
                </Link>
                <Link href='/positions' className='text-gray-500 hover:text-gray-900'>
                  Positions
                </Link>
                <Link href='/market' className='text-gray-500 hover:text-gray-900'>
                  Market
                </Link>
                <Link href='/orders' className='text-gray-500 hover:text-gray-900'>
                  Orders
                </Link>
              </nav>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Welcome Section */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900'>Dashboard</h1>
          <p className='text-gray-600 mt-2'>
            Welcome back, {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>

        {/* Stats Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
          <div className='bg-white p-6 rounded-xl shadow-sm border'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Health Factor</p>
                <p className='text-2xl font-bold text-green-600'>2.45</p>
              </div>
              <div className='w-12 h-12 bg-green-100 rounded-full flex items-center justify-center'>
                <span className='text-2xl'>🛡️</span>
              </div>
            </div>
            <p className='text-xs text-gray-500 mt-2'>Safe position</p>
          </div>

          <div className='bg-white p-6 rounded-xl shadow-sm border'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Total Debt</p>
                <p className='text-2xl font-bold text-gray-900'>$12,450</p>
              </div>
              <div className='w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center'>
                <span className='text-2xl'>💳</span>
              </div>
            </div>
            <p className='text-xs text-gray-500 mt-2'>Across 3 positions</p>
          </div>

          <div className='bg-white p-6 rounded-xl shadow-sm border'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Active Orders</p>
                <p className='text-2xl font-bold text-orange-600'>2</p>
              </div>
              <div className='w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center'>
                <span className='text-2xl'>📋</span>
              </div>
            </div>
            <p className='text-xs text-gray-500 mt-2'>1 sell, 1 buy</p>
          </div>

          <div className='bg-white p-6 rounded-xl shadow-sm border'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Total Savings</p>
                <p className='text-2xl font-bold text-purple-600'>$1,250</p>
              </div>
              <div className='w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center'>
                <span className='text-2xl'>💰</span>
              </div>
            </div>
            <p className='text-xs text-gray-500 mt-2'>From liquidation protection</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
          {/* Your Positions */}
          <div className='bg-white rounded-xl shadow-sm border'>
            <div className='p-6 border-b'>
              <h2 className='text-xl font-semibold text-gray-900'>Your Debt Positions</h2>
            </div>
            <div className='p-6'>
              <div className='space-y-4'>
                <div className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
                  <div className='flex items-center gap-3'>
                    <div className='w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold'>
                      U
                    </div>
                    <div>
                      <p className='font-medium text-gray-900'>USDC Debt</p>
                      <p className='text-sm text-gray-500'>Mainnet • Aave V3</p>
                    </div>
                  </div>
                  <div className='text-right'>
                    <p className='font-medium text-gray-900'>$8,500</p>
                    <p className='text-sm text-green-600'>HF: 2.8</p>
                  </div>
                </div>

                <div className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
                  <div className='flex items-center gap-3'>
                    <div className='w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold'>
                      E
                    </div>
                    <div>
                      <p className='font-medium text-gray-900'>ETH Debt</p>
                      <p className='text-sm text-gray-500'>Mainnet • Aave V3</p>
                    </div>
                  </div>
                  <div className='text-right'>
                    <p className='font-medium text-gray-900'>$3,950</p>
                    <p className='text-sm text-yellow-600'>HF: 1.9</p>
                  </div>
                </div>
              </div>

              <div className='mt-6'>
                <Link
                  href='/positions'
                  className='w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50'
                >
                  View All Positions
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className='bg-white rounded-xl shadow-sm border'>
            <div className='p-6 border-b'>
              <h2 className='text-xl font-semibold text-gray-900'>Recent Activity</h2>
            </div>
            <div className='p-6'>
              <div className='space-y-4'>
                <div className='flex items-center gap-3'>
                  <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-gray-900'>Sale order created</p>
                    <p className='text-xs text-gray-500'>USDC debt position • 2 hours ago</p>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <div className='w-2 h-2 bg-blue-500 rounded-full'></div>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-gray-900'>Position purchased</p>
                    <p className='text-xs text-gray-500'>ETH debt • 1 day ago</p>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <div className='w-2 h-2 bg-orange-500 rounded-full'></div>
                  <div className='flex-1'>
                    <p className='text-sm font-medium text-gray-900'>Health factor warning</p>
                    <p className='text-xs text-gray-500'>ETH position • 2 days ago</p>
                  </div>
                </div>
              </div>

              <div className='mt-6'>
                <Link
                  href='/orders'
                  className='w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50'
                >
                  View All Activity
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
