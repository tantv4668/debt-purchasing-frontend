'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import CreatePositionModal from '../../components/CreatePositionModal';
import { formatHealthFactor, useUserDebtPositions, useUserPositionSummary } from '../../lib/hooks/useDebtPositions';

export default function PositionsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const { positions, isLoading, error } = useUserDebtPositions();
  const summary = useUserPositionSummary();

  if (!isConnected) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-gray-900 mb-4'>Connect Your Wallet</h1>
          <p className='text-gray-600'>Please connect your wallet to view your debt positions.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>Loading your positions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-red-600 mb-4'>Error Loading Positions</h1>
          <p className='text-gray-600'>Failed to load positions. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Header */}
        <div className='flex justify-between items-center mb-8'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>Debt Positions</h1>
            <p className='text-gray-600 mt-2'>Manage your leveraged positions and monitor health factors</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className='bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors'
          >
            Create Position
          </button>
        </div>

        {/* Summary Cards */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
          <div className='bg-white rounded-xl shadow-sm p-6 border border-gray-200'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Total Positions</p>
                <p className='text-2xl font-bold text-gray-900'>{summary.totalPositions}</p>
              </div>
              <div className='w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center'>
                <svg className='w-6 h-6 text-blue-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
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

          <div className='bg-white rounded-xl shadow-sm p-6 border border-gray-200'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Total Debt Value</p>
                <p className='text-2xl font-bold text-gray-900'>${summary.totalDebtValue.toLocaleString()}</p>
              </div>
              <div className='w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center'>
                <svg className='w-6 h-6 text-red-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
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

          <div className='bg-white rounded-xl shadow-sm p-6 border border-gray-200'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Total Collateral</p>
                <p className='text-2xl font-bold text-gray-900'>${summary.totalCollateralValue.toLocaleString()}</p>
              </div>
              <div className='w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center'>
                <svg className='w-6 h-6 text-green-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className='bg-white rounded-xl shadow-sm p-6 border border-gray-200'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-600'>Avg Health Factor</p>
                <p className='text-2xl font-bold text-gray-900'>{summary.averageHealthFactor.toFixed(2)}</p>
              </div>
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  summary.averageHealthFactor > 2
                    ? 'bg-green-100'
                    : summary.averageHealthFactor > 1.5
                    ? 'bg-yellow-100'
                    : 'bg-red-100'
                }`}
              >
                <svg
                  className={`w-6 h-6 ${
                    summary.averageHealthFactor > 2
                      ? 'text-green-600'
                      : summary.averageHealthFactor > 1.5
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 10V3L4 14h7v7l9-11h-7z' />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Positions List */}
        {positions.length === 0 ? (
          <div className='bg-white rounded-xl shadow-sm border border-gray-200'>
            <div className='text-center py-12'>
              <div className='w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                <svg className='w-12 h-12 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                  />
                </svg>
              </div>
              <h3 className='text-lg font-medium text-gray-900 mb-2'>No Debt Positions</h3>
              <p className='text-gray-600 mb-6 max-w-md mx-auto'>
                You haven't created any debt positions yet. Create your first position to start leveraging your assets.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className='bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors'
              >
                Create Your First Position
              </button>
            </div>
          </div>
        ) : (
          <div className='space-y-6'>
            {positions.map((position, index) => {
              const healthFactor = formatHealthFactor(position.healthFactor);

              return (
                <div key={index} className='bg-white rounded-xl shadow-sm border border-gray-200 p-6'>
                  <div className='flex justify-between items-start mb-4'>
                    <div>
                      <h3 className='text-lg font-semibold text-gray-900 mb-1'>Position #{index + 1}</h3>
                      <p className='text-sm text-gray-600 font-mono'>{position.address}</p>
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

                  <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                    {/* Collateral */}
                    <div>
                      <h4 className='text-sm font-medium text-gray-700 mb-3'>Collateral</h4>
                      <div className='space-y-2'>
                        {position.collaterals.map((collateral, idx) => (
                          <div key={idx} className='flex justify-between items-center'>
                            <span className='text-sm text-gray-600'>{collateral.symbol}</span>
                            <div className='text-right'>
                              <div className='text-sm font-medium'>{collateral.balanceFormatted}</div>
                              <div className='text-xs text-gray-500'>${collateral.valueInUSD.toLocaleString()}</div>
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
                  <div className='mt-6 pt-4 border-t border-gray-200'>
                    <div className='flex space-x-3'>
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

      {/* Create Position Modal */}
      <CreatePositionModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
}
