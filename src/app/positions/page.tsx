'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import Link from 'next/link';

export default function PositionsPage() {
  const { isConnected, address } = useAccount();

  if (!isConnected) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center'>
        <div className='bg-white p-8 rounded-2xl shadow-xl text-center max-w-md mx-auto'>
          <h1 className='text-2xl font-bold text-gray-900 mb-4'>Connect Your Wallet</h1>
          <p className='text-gray-600 mb-6'>Please connect your wallet to view your positions.</p>
          <ConnectButton />
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
                <Link href='/dashboard' className='text-gray-500 hover:text-gray-900'>
                  Dashboard
                </Link>
                <Link href='/positions' className='text-blue-600 font-medium'>
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
        {/* Header Section */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900'>Your Debt Positions</h1>
          <p className='text-gray-600 mt-2'>Monitor and manage your Aave V3 debt positions</p>
        </div>

        {/* Summary Cards */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
          <div className='bg-white p-6 rounded-xl shadow-sm border'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Total Debt Value</p>
                <p className='text-2xl font-bold text-gray-900'>$12,450</p>
              </div>
              <div className='w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center'>
                <span className='text-2xl'>💳</span>
              </div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-xl shadow-sm border'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Average Health Factor</p>
                <p className='text-2xl font-bold text-green-600'>2.35</p>
              </div>
              <div className='w-12 h-12 bg-green-100 rounded-full flex items-center justify-center'>
                <span className='text-2xl'>🛡️</span>
              </div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-xl shadow-sm border'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Active Positions</p>
                <p className='text-2xl font-bold text-purple-600'>3</p>
              </div>
              <div className='w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center'>
                <span className='text-2xl'>📊</span>
              </div>
            </div>
          </div>
        </div>

        {/* Positions Table */}
        <div className='bg-white rounded-xl shadow-sm border overflow-hidden'>
          <div className='p-6 border-b'>
            <div className='flex justify-between items-center'>
              <h2 className='text-xl font-semibold text-gray-900'>All Positions</h2>
              <button className='px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700'>
                Create Sale Order
              </button>
            </div>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Asset
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Debt Amount
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Collateral
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Health Factor
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    APY
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className='bg-white divide-y divide-gray-200'>
                <tr className='hover:bg-gray-50'>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='flex items-center'>
                      <div className='w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold'>
                        U
                      </div>
                      <div className='ml-4'>
                        <div className='text-sm font-medium text-gray-900'>USDC</div>
                        <div className='text-sm text-gray-500'>Stablecoin</div>
                      </div>
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='text-sm font-medium text-gray-900'>$8,500.00</div>
                    <div className='text-sm text-gray-500'>8,500 USDC</div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='text-sm font-medium text-gray-900'>$25,000.00</div>
                    <div className='text-sm text-gray-500'>10 ETH</div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                      2.8 - Safe
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>5.2%</td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                    <button className='text-blue-600 hover:text-blue-900 mr-4'>Sell</button>
                    <button className='text-gray-600 hover:text-gray-900'>Details</button>
                  </td>
                </tr>

                <tr className='hover:bg-gray-50'>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='flex items-center'>
                      <div className='w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold'>
                        E
                      </div>
                      <div className='ml-4'>
                        <div className='text-sm font-medium text-gray-900'>ETH</div>
                        <div className='text-sm text-gray-500'>Ethereum</div>
                      </div>
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='text-sm font-medium text-gray-900'>$3,950.00</div>
                    <div className='text-sm text-gray-500'>1.58 ETH</div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='text-sm font-medium text-gray-900'>$12,000.00</div>
                    <div className='text-sm text-gray-500'>12,000 USDC</div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'>
                      1.9 - Warning
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>3.8%</td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                    <button className='text-blue-600 hover:text-blue-900 mr-4'>Sell</button>
                    <button className='text-gray-600 hover:text-gray-900'>Details</button>
                  </td>
                </tr>

                <tr className='hover:bg-gray-50'>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='flex items-center'>
                      <div className='w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold'>
                        W
                      </div>
                      <div className='ml-4'>
                        <div className='text-sm font-medium text-gray-900'>WBTC</div>
                        <div className='text-sm text-gray-500'>Wrapped Bitcoin</div>
                      </div>
                    </div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='text-sm font-medium text-gray-900'>$0.00</div>
                    <div className='text-sm text-gray-500'>0 WBTC</div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='text-sm font-medium text-gray-900'>$8,000.00</div>
                    <div className='text-sm text-gray-500'>0.2 WBTC</div>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                      ∞ - No Debt
                    </span>
                  </td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>0%</td>
                  <td className='px-6 py-4 whitespace-nowrap text-sm font-medium'>
                    <button className='text-gray-400 cursor-not-allowed mr-4'>Sell</button>
                    <button className='text-gray-600 hover:text-gray-900'>Details</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Help Section */}
        <div className='mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6'>
          <div className='flex items-start gap-4'>
            <div className='text-3xl'>💡</div>
            <div>
              <h3 className='text-lg font-semibold text-blue-900 mb-2'>Liquidation Protection Tips</h3>
              <ul className='text-sm text-blue-800 space-y-1'>
                <li>• Create sale orders for positions with Health Factor below 2.0</li>
                <li>• Monitor your positions regularly to avoid sudden liquidations</li>
                <li>• Consider partial sales to maintain healthy ratios</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
