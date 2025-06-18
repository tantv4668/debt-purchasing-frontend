'use client';

import { useEffect, useState } from 'react';
import { parseUnits } from 'viem';
import { useAccount } from 'wagmi';
import { ChainId } from '../lib/contracts';
import { SUPPORTED_TOKENS } from '../lib/contracts/tokens';
import { useMultiTokenOperations } from '../lib/hooks/useContracts';
import { useCreatePosition, usePredictDebtAddress, useTokenBalances } from '../lib/hooks/useDebtPositions';
import { useModalCache } from '../lib/hooks/useModalCache';
import type { CreatePositionParams, TokenSymbol } from '../lib/types/debt-position';

interface CreateDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'select-supply' | 'select-borrow' | 'review' | 'pending' | 'success';

export default function CreateDebtModal({ isOpen, onClose }: CreateDebtModalProps) {
  const { address } = useAccount();
  const { tokenBalances } = useTokenBalances();
  const { predictedAddress } = usePredictDebtAddress();
  const { createPosition, isPending: isCreating } = useCreatePosition();
  const multiTokenOps = useMultiTokenOperations(ChainId.SEPOLIA);
  const { cachedState, saveToCache, clearCache, hasValidCache } = useModalCache();

  const [step, setStep] = useState<Step>('select-supply');
  const [isApproving, setIsApproving] = useState(false);
  const [approvedTokens, setApprovedTokens] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  // Initialize default state
  const getDefaultCollateralAssets = () =>
    Object.keys(SUPPORTED_TOKENS).map(symbol => ({
      symbol: symbol as TokenSymbol,
      amount: '',
      selected: false,
    }));

  const getDefaultBorrowAssets = () =>
    Object.keys(SUPPORTED_TOKENS).map(symbol => ({
      symbol: symbol as TokenSymbol,
      amount: '',
      selected: false,
      interestRateMode: 2 as 1 | 2,
    }));

  const [collateralAssets, setCollateralAssets] = useState(getDefaultCollateralAssets);
  const [borrowAssets, setBorrowAssets] = useState(getDefaultBorrowAssets);

  // Auto-restore cached data when modal opens
  useEffect(() => {
    if (isOpen && !hasInitialized && hasValidCache() && cachedState) {
      setStep(cachedState.step);
      setCollateralAssets(cachedState.collateralAssets);
      setBorrowAssets(cachedState.borrowAssets);
      setApprovedTokens(new Set(cachedState.approvedTokens));
      setHasInitialized(true);
    } else if (isOpen && !hasInitialized) {
      setHasInitialized(true);
    }
  }, [isOpen, hasInitialized, hasValidCache, cachedState]);

  // Reset hasInitialized when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen]);

  // Manual reset function
  const resetModal = () => {
    setStep('select-supply');
    setApprovedTokens(new Set());
    setCollateralAssets(getDefaultCollateralAssets());
    setBorrowAssets(getDefaultBorrowAssets());
    clearCache();
  };

  const handleClose = () => {
    onClose();
  };

  const handleSuccessClose = () => {
    resetModal();
    onClose();
  };

  // Get tokens configuration for current chain
  const getTokenConfig = (chainId: ChainId) => {
    const tokenConfig: Partial<
      Record<TokenSymbol, { address: `0x${string}`; symbol: string; name: string; decimals: number }>
    > = {};

    Object.entries(SUPPORTED_TOKENS).forEach(([symbol, token]) => {
      if (token && token.addresses[chainId]) {
        tokenConfig[symbol as TokenSymbol] = {
          address: token.addresses[chainId] as `0x${string}`,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
        };
      }
    });

    return tokenConfig as Record<
      TokenSymbol,
      { address: `0x${string}`; symbol: string; name: string; decimals: number }
    >;
  };

  const tokens = getTokenConfig(ChainId.SEPOLIA);

  // Helper function to get token color
  const getTokenColor = (symbol: string) => {
    const colorMap: Record<string, string> = {
      WETH: 'bg-blue-600',
      wstETH: 'bg-blue-500',
      WBTC: 'bg-orange-500',
      USDC: 'bg-blue-500',
      DAI: 'bg-yellow-500',
      LINK: 'bg-blue-700',
      AAVE: 'bg-purple-600',
      cbETH: 'bg-blue-400',
      USDT: 'bg-green-500',
      rETH: 'bg-orange-400',
      LUSD: 'bg-indigo-500',
      CRV: 'bg-purple-500',
    };
    return colorMap[symbol] || 'bg-gray-600';
  };

  const handleNext = () => {
    saveToCache({
      step: step === 'select-supply' ? 'select-borrow' : 'review',
      collateralAssets,
      borrowAssets,
      approvedTokens: Array.from(approvedTokens),
    });
    if (step === 'select-supply') setStep('select-borrow');
    else if (step === 'select-borrow') setStep('review');
  };

  const handleApprove = async () => {
    debugger;
    if (!address) return;

    const selectedCollaterals = collateralAssets.filter(
      asset => asset.selected && asset.amount && parseFloat(asset.amount) > 0,
    );
    if (selectedCollaterals.length === 0) return;

    setIsApproving(true);
    try {
      const tokensToApprove = selectedCollaterals.map(asset => {
        const token = tokens[asset.symbol];
        return {
          symbol: asset.symbol,
          amount: parseUnits(asset.amount, token.decimals),
        };
      });

      const { allApproved, approvalResults } = await multiTokenOps.approveMultipleTokens(tokensToApprove);

      approvalResults.forEach(result => {
        if (result.success) {
          setApprovedTokens(prev => new Set(prev).add(result.symbol));
        }
      });

      // Check for tokens that already had sufficient allowance
      const allowanceCheck = await multiTokenOps.checkMultipleAllowances(tokensToApprove);
      allowanceCheck.forEach(check => {
        if (!check.needsApproval) {
          setApprovedTokens(prev => new Set(prev).add(check.symbol));
        }
      });

      saveToCache({
        step,
        collateralAssets,
        borrowAssets,
        approvedTokens: Array.from(approvedTokens),
      });
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleCreatePosition = async () => {
    if (!address || !predictedAddress) return;

    saveToCache({
      step: 'pending',
      collateralAssets,
      borrowAssets,
      approvedTokens: Array.from(approvedTokens),
    });

    setStep('pending');
    setTransactionError(null);

    try {
      const params: CreatePositionParams = {
        collateralAssets: collateralAssets
          .filter(asset => asset.selected && asset.amount && parseFloat(asset.amount) > 0)
          .map(asset => {
            const token = tokens[asset.symbol];
            return {
              asset: token.address,
              amount: parseUnits(asset.amount, token.decimals),
              symbol: asset.symbol,
            };
          }),
        borrowAssets: borrowAssets
          .filter(asset => asset.selected && asset.amount && parseFloat(asset.amount) > 0)
          .map(asset => {
            const token = tokens[asset.symbol];
            return {
              asset: token.address,
              amount: parseUnits(asset.amount, token.decimals),
              symbol: asset.symbol,
              interestRateMode: asset.interestRateMode,
            };
          }),
      };

      await createPosition(params);
      await new Promise(resolve => setTimeout(resolve, 1000));

      clearCache();
      setStep('success');
    } catch (error) {
      console.error('Position creation failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      const isUserRejection =
        errorMessage.toLowerCase().includes('reject') ||
        errorMessage.toLowerCase().includes('denied') ||
        errorMessage.toLowerCase().includes('cancelled');

      setTransactionError(isUserRejection ? 'Transaction was rejected' : errorMessage);
      setStep('review');
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 overflow-y-auto'>
      <div className='flex min-h-screen items-center justify-center p-4'>
        <div className='fixed inset-0 bg-black bg-opacity-50' onClick={handleClose} />

        <div className='relative w-full max-w-2xl bg-white rounded-2xl shadow-xl'>
          {/* Header */}
          <div className='flex items-center justify-between p-6 border-b'>
            <h2 className='text-xl font-semibold text-gray-900'>Create Debt Position</h2>
            <div className='flex items-center space-x-2'>
              {(step === 'select-supply' || step === 'select-borrow' || step === 'review') && (
                <button
                  onClick={resetModal}
                  className='px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50'
                  title='Reset all data'
                >
                  Reset
                </button>
              )}
              <button onClick={handleClose} className='text-gray-400 hover:text-gray-600'>
                <svg
                  className='w-6 h-6'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  suppressHydrationWarning={true}
                >
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress Steps */}
          <div className='px-6 py-4 border-b'>
            <div className='flex items-center space-x-2'>
              {['Supply', 'Borrow', 'Review'].map((label, index) => (
                <div key={label} className='flex items-center'>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index === 0 && step === 'select-supply'
                        ? 'bg-blue-600 text-white'
                        : index === 1 && step === 'select-borrow'
                        ? 'bg-blue-600 text-white'
                        : index === 2 && (step === 'review' || step === 'pending')
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className='ml-2 text-sm text-gray-600'>{label}</span>
                  {index < 2 && <div className='w-8 h-px bg-gray-300 mx-2' />}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className='p-6'>
            {/* Step 1: Multi-Asset Supply Selection */}
            {step === 'select-supply' && (
              <div className='space-y-6'>
                <div>
                  <label className='block text-sm font-semibold text-gray-800 mb-3'>
                    Collateral Assets (Multi-Select)
                  </label>
                  <div className='space-y-3 max-h-64 overflow-y-auto pr-2'>
                    {Object.entries(tokens).map(([symbol, token]) => {
                      const assetState = collateralAssets.find(a => a.symbol === symbol);
                      return (
                        <div
                          key={symbol}
                          className={`p-4 border-2 rounded-xl transition-all duration-200 ${
                            assetState?.selected
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : 'border-gray-300 bg-white hover:border-blue-300 hover:shadow-sm'
                          }`}
                        >
                          <div className='flex items-center justify-between'>
                            <div className='flex items-center space-x-3'>
                              <button
                                onClick={() => {
                                  setCollateralAssets(prev =>
                                    prev.map(asset =>
                                      asset.symbol === symbol ? { ...asset, selected: !asset.selected } : asset,
                                    ),
                                  );
                                }}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  assetState?.selected
                                    ? 'border-blue-500 bg-blue-500'
                                    : 'border-gray-300 hover:border-blue-400'
                                }`}
                              >
                                {assetState?.selected && (
                                  <svg className='w-3 h-3 text-white' fill='currentColor' viewBox='0 0 20 20'>
                                    <path
                                      fillRule='evenodd'
                                      d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                      clipRule='evenodd'
                                    />
                                  </svg>
                                )}
                              </button>

                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${getTokenColor(
                                  symbol,
                                )}`}
                              >
                                {symbol.charAt(0)}
                              </div>

                              <div className='flex-1'>
                                <div className='font-semibold text-gray-900 text-sm'>{symbol}</div>
                                <div className='text-xs text-gray-600 font-medium'>
                                  Balance:{' '}
                                  {parseFloat(
                                    tokenBalances[symbol as keyof typeof tokenBalances]?.formatted || '0',
                                  ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>

                            {assetState?.selected && (
                              <div className='flex items-center space-x-2'>
                                <input
                                  type='number'
                                  placeholder='0.0'
                                  value={assetState.amount}
                                  onChange={e => {
                                    setCollateralAssets(prev =>
                                      prev.map(asset =>
                                        asset.symbol === symbol ? { ...asset, amount: e.target.value } : asset,
                                      ),
                                    );
                                  }}
                                  className='w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium text-sm'
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(() => {
                  const selectedCollaterals = collateralAssets.filter(a => a.selected).length;
                  const assetsWithAmounts = collateralAssets.filter(
                    a => a.selected && a.amount && parseFloat(a.amount) > 0,
                  ).length;

                  return (
                    <button
                      onClick={handleNext}
                      disabled={assetsWithAmounts === 0}
                      className='w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      {selectedCollaterals === 0
                        ? 'Select Supply Assets to Continue'
                        : `Continue (${selectedCollaterals} Asset${selectedCollaterals > 1 ? 's' : ''} Selected)`}
                    </button>
                  );
                })()}
              </div>
            )}

            {/* Step 2: Multi-Asset Borrow Selection */}
            {step === 'select-borrow' && (
              <div className='space-y-6'>
                <div>
                  <label className='block text-sm font-semibold text-gray-800 mb-3'>Borrow Assets (Multi-Select)</label>
                  <div className='space-y-3 max-h-64 overflow-y-auto pr-2'>
                    {Object.entries(tokens).map(([symbol, token]) => {
                      const isCollateral = collateralAssets.find(a => a.symbol === symbol && a.selected);
                      const borrowState = borrowAssets.find(a => a.symbol === symbol);
                      return (
                        <div
                          key={symbol}
                          className={`p-4 border-2 rounded-xl transition-all duration-200 ${
                            borrowState?.selected && !isCollateral
                              ? 'border-green-500 bg-green-50 shadow-md'
                              : isCollateral
                              ? 'border-gray-200 bg-gray-100 opacity-60'
                              : 'border-gray-300 bg-white hover:border-green-300 hover:shadow-sm'
                          }`}
                        >
                          <div className='flex items-center justify-between'>
                            <div className='flex items-center space-x-3'>
                              <button
                                onClick={() => {
                                  if (!isCollateral) {
                                    setBorrowAssets(prev =>
                                      prev.map(asset =>
                                        asset.symbol === symbol ? { ...asset, selected: !asset.selected } : asset,
                                      ),
                                    );
                                  }
                                }}
                                disabled={!!isCollateral}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  borrowState?.selected && !isCollateral
                                    ? 'border-green-500 bg-green-500'
                                    : isCollateral
                                    ? 'border-gray-300 bg-gray-200 cursor-not-allowed'
                                    : 'border-gray-300 hover:border-green-400'
                                }`}
                              >
                                {borrowState?.selected && !isCollateral && (
                                  <svg className='w-3 h-3 text-white' fill='currentColor' viewBox='0 0 20 20'>
                                    <path
                                      fillRule='evenodd'
                                      d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                      clipRule='evenodd'
                                    />
                                  </svg>
                                )}
                              </button>

                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${getTokenColor(
                                  symbol,
                                )}`}
                              >
                                {symbol.charAt(0)}
                              </div>

                              <div className='flex-1'>
                                <div
                                  className={`font-semibold text-gray-900 text-sm ${
                                    isCollateral ? 'text-gray-500' : ''
                                  }`}
                                >
                                  {symbol}
                                </div>
                                <div
                                  className={`text-xs font-medium ${isCollateral ? 'text-gray-400' : 'text-gray-600'}`}
                                >
                                  {isCollateral ? 'Collateral' : 'Can borrow'}
                                </div>
                              </div>
                            </div>

                            {borrowState?.selected && !isCollateral && (
                              <div className='flex items-center space-x-3'>
                                <input
                                  type='number'
                                  placeholder='0.0'
                                  value={borrowState.amount}
                                  onChange={e => {
                                    setBorrowAssets(prev =>
                                      prev.map(asset =>
                                        asset.symbol === symbol ? { ...asset, amount: e.target.value } : asset,
                                      ),
                                    );
                                  }}
                                  className='w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 font-medium text-sm'
                                />
                                <select
                                  value={borrowState.interestRateMode}
                                  onChange={e => {
                                    setBorrowAssets(prev =>
                                      prev.map(asset =>
                                        asset.symbol === symbol
                                          ? { ...asset, interestRateMode: parseInt(e.target.value) as 1 | 2 }
                                          : asset,
                                      ),
                                    );
                                  }}
                                  className='px-2 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 font-medium text-xs'
                                >
                                  <option value={1}>Stable</option>
                                  <option value={2}>Variable</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className='flex space-x-3'>
                  <button
                    onClick={() => setStep('select-supply')}
                    className='flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50'
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!borrowAssets.some(a => a.selected && a.amount && parseFloat(a.amount) > 0)}
                    className='flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50'
                  >
                    {(() => {
                      const selectedBorrows = borrowAssets.filter(
                        a => a.selected && a.amount && parseFloat(a.amount) > 0,
                      ).length;
                      if (selectedBorrows === 0) return 'Select Borrow Assets';
                      return `Review (${selectedBorrows} Asset${selectedBorrows > 1 ? 's' : ''})`;
                    })()}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 'review' && (
              <div className='space-y-6'>
                {/* Collateral Assets */}
                <div className='bg-blue-50 rounded-lg p-4'>
                  <h3 className='font-semibold text-blue-900 mb-3'>💰 Collateral Assets</h3>
                  <div className='space-y-2'>
                    {collateralAssets
                      .filter(asset => asset.selected && asset.amount && parseFloat(asset.amount) > 0)
                      .map(asset => (
                        <div key={asset.symbol} className='flex justify-between items-center'>
                          <span className='text-blue-800'>{asset.symbol}</span>
                          <span className='font-medium text-blue-900'>
                            {asset.amount} {asset.symbol}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Borrow Assets */}
                <div className='bg-green-50 rounded-lg p-4'>
                  <h3 className='font-semibold text-green-900 mb-3'>📈 Borrow Assets</h3>
                  <div className='space-y-2'>
                    {borrowAssets
                      .filter(asset => asset.selected && asset.amount && parseFloat(asset.amount) > 0)
                      .map(asset => (
                        <div key={asset.symbol}>
                          <div className='flex justify-between items-center'>
                            <span className='text-green-800'>{asset.symbol}</span>
                            <span className='font-medium text-green-900'>
                              {asset.amount} {asset.symbol}
                            </span>
                          </div>
                          <div className='text-xs text-green-600 text-right'>
                            {asset.interestRateMode === 1 ? 'Stable Rate' : 'Variable Rate'}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Position Details */}
                <div className='bg-gray-50 rounded-lg p-4 space-y-2'>
                  <h3 className='font-semibold text-gray-900 mb-3'>🏦 Position Details</h3>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Debt Address:</span>
                    <span className='font-mono text-sm text-gray-900'>
                      {typeof predictedAddress === 'string'
                        ? predictedAddress.slice(0, 12) + '...' + predictedAddress.slice(-4)
                        : 'Loading...'}
                    </span>
                  </div>
                </div>

                <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
                  <div className='flex items-start space-x-3'>
                    <div className='text-blue-600 mt-1'>ℹ️</div>
                    <div className='text-sm text-blue-800'>
                      <div className='font-medium mb-1'>Transaction Steps:</div>
                      <ol className='list-decimal list-inside space-y-1'>
                        <li>Approve all collateral assets for spending</li>
                        <li>Create debt position at predicted address</li>
                        <li>Supply multiple assets as collateral</li>
                        <li>Borrow selected assets to your wallet</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Error display */}
                {transactionError && (
                  <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
                    <div className='flex items-start space-x-3'>
                      <div className='text-red-600 mt-1'>❌</div>
                      <div className='text-sm text-red-800'>
                        <div className='font-medium mb-1'>Transaction Failed</div>
                        <div>{transactionError}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Token approval and creation steps */}
                <div className='space-y-3'>
                  {(() => {
                    const selectedCollaterals = collateralAssets.filter(
                      asset => asset.selected && asset.amount && parseFloat(asset.amount) > 0,
                    );
                    const allApproved = selectedCollaterals.every(asset => approvedTokens.has(asset.symbol));

                    return (
                      <button
                        onClick={handleApprove}
                        disabled={isApproving || allApproved}
                        className={`w-full py-3 rounded-lg font-medium transition-colors ${
                          allApproved
                            ? 'bg-green-600 text-white cursor-default'
                            : 'bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50'
                        }`}
                      >
                        {allApproved ? (
                          <div className='flex items-center justify-center space-x-2'>
                            <svg className='w-5 h-5' fill='currentColor' viewBox='0 0 20 20'>
                              <path
                                fillRule='evenodd'
                                d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                clipRule='evenodd'
                              />
                            </svg>
                            <span>✅ All Assets Approved</span>
                          </div>
                        ) : isApproving ? (
                          'Approving...'
                        ) : (
                          '1. Approve Selected Assets'
                        )}
                      </button>
                    );
                  })()}

                  <button
                    onClick={handleCreatePosition}
                    disabled={
                      isCreating ||
                      !(() => {
                        const selectedCollaterals = collateralAssets.filter(
                          asset => asset.selected && asset.amount && parseFloat(asset.amount) > 0,
                        );
                        return selectedCollaterals.every(asset => approvedTokens.has(asset.symbol));
                      })()
                    }
                    className='w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50'
                  >
                    {isCreating ? 'Creating Position...' : '2. Create Position'}
                  </button>
                </div>

                <button
                  onClick={() => setStep('select-borrow')}
                  className='w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50'
                >
                  Back to Edit
                </button>
              </div>
            )}

            {/* Step 4: Pending Transaction */}
            {step === 'pending' && (
              <div className='text-center space-y-6'>
                <div className='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                </div>

                <div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-2'>Creating Position...</h3>
                  <p className='text-gray-600 mb-4'>Please wait while your transaction is being processed.</p>
                  <div className='text-sm text-gray-500'>This may take a few moments to complete.</div>
                </div>

                <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
                  <div className='flex items-start space-x-3'>
                    <div className='text-yellow-600 mt-1'>⚠️</div>
                    <div className='text-sm text-yellow-800'>
                      <div className='font-medium mb-1'>Transaction in Progress</div>
                      <div>Do not close this window until the transaction is confirmed.</div>
                    </div>
                  </div>
                </div>

                {/* Emergency reset button for stuck states */}
                <div className='pt-4 border-t border-gray-200'>
                  <p className='text-xs text-gray-500 mb-3'>
                    Transaction taking too long or stuck? You can reset and try again.
                  </p>
                  <button
                    onClick={() => {
                      setStep('review');
                      setTransactionError('Transaction was cancelled. Please try again.');
                    }}
                    className='px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
                  >
                    Cancel & Go Back to Review
                  </button>
                </div>
              </div>
            )}

            {/* Success */}
            {step === 'success' && (
              <div className='text-center space-y-6'>
                <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto'>
                  <svg
                    className='w-8 h-8 text-green-600'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                    suppressHydrationWarning={true}
                  >
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                  </svg>
                </div>

                <div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-2'>Position Created!</h3>
                  <p className='text-gray-600'>Your debt position has been successfully created.</p>
                </div>

                <button
                  onClick={handleSuccessClose}
                  className='w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700'
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
