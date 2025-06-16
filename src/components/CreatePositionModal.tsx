'use client';

import { useState } from 'react';
import { parseUnits } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';
import { ChainId, ERC20_ABI, getAaveRouterAddress, getTokenConfig } from '../lib/contracts';
import { useCreatePosition, usePredictDebtAddress, useTokenBalances } from '../lib/hooks/useDebtPositions';
import type { CreatePositionParams, TokenSymbol } from '../lib/types/debt-position';

interface CreatePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'select-supply' | 'select-borrow' | 'review' | 'pending' | 'success';

export default function CreatePositionModal({ isOpen, onClose }: CreatePositionModalProps) {
  const { address } = useAccount();
  const { tokenBalances } = useTokenBalances();
  const { predictedAddress } = usePredictDebtAddress();
  const { createPosition, isPending: isCreating } = useCreatePosition();
  const { writeContract: approveToken } = useWriteContract();

  const [step, setStep] = useState<Step>('select-supply');
  const [collateralAsset, setCollateralAsset] = useState<TokenSymbol>('USDC');
  const [borrowAsset, setBorrowAsset] = useState<TokenSymbol>('DAI');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [interestRateMode, setInterestRateMode] = useState<1 | 2>(2);
  const [txHash, setTxHash] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  // New multi-collateral state
  const [collateralAssets, setCollateralAssets] = useState<
    Array<{
      symbol: TokenSymbol;
      amount: string;
      selected: boolean;
    }>
  >([
    { symbol: 'WETH', amount: '', selected: false },
    { symbol: 'USDC', amount: '', selected: true },
    { symbol: 'DAI', amount: '', selected: false },
    { symbol: 'WBTC', amount: '', selected: false },
  ]);
  const [isMultiCollateralMode, setIsMultiCollateralMode] = useState(false);

  // New multi-borrow state
  const [borrowAssets, setBorrowAssets] = useState<
    Array<{
      symbol: TokenSymbol;
      amount: string;
      selected: boolean;
      interestRateMode: 1 | 2;
    }>
  >([
    { symbol: 'WETH', amount: '', selected: false, interestRateMode: 2 },
    { symbol: 'USDC', amount: '', selected: false, interestRateMode: 2 },
    { symbol: 'DAI', amount: '', selected: true, interestRateMode: 2 },
    { symbol: 'WBTC', amount: '', selected: false, interestRateMode: 2 },
  ]);

  // Get tokens configuration for current chain (defaulting to Sepolia)
  const tokens = getTokenConfig(ChainId.SEPOLIA);
  const aaveRouterAddress = getAaveRouterAddress(ChainId.SEPOLIA);

  const reset = () => {
    setStep('select-supply');
    setCollateralAmount('');
    setBorrowAmount('');
    setTxHash('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleNext = () => {
    if (step === 'select-supply') setStep('select-borrow');
    else if (step === 'select-borrow') setStep('review');
  };

  const handleApprove = async () => {
    if (!address) return;

    setIsApproving(true);
    try {
      const token = tokens[collateralAsset];
      const amount = parseUnits(collateralAmount, token.decimals);

      await approveToken({
        address: token.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [aaveRouterAddress, amount],
      });
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleCreatePosition = async () => {
    if (!address || !predictedAddress) return;

    setStep('pending');

    try {
      const params: CreatePositionParams = isMultiCollateralMode
        ? {
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
          }
        : {
            collateralAssets: [
              {
                asset: tokens[collateralAsset].address,
                amount: parseUnits(collateralAmount, tokens[collateralAsset].decimals),
                symbol: collateralAsset,
              },
            ],
            borrowAssets: [
              {
                asset: tokens[borrowAsset].address,
                amount: parseUnits(borrowAmount, tokens[borrowAsset].decimals),
                symbol: borrowAsset,
                interestRateMode,
              },
            ],
          };

      await createPosition(params);
      setStep('success');
    } catch (error) {
      console.error('Position creation failed:', error);
      setStep('review');
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 overflow-y-auto'>
      <div className='flex min-h-screen items-center justify-center p-4'>
        <div className='fixed inset-0 bg-black bg-opacity-50' onClick={handleClose} />

        <div className='relative w-full max-w-md bg-white rounded-2xl shadow-xl'>
          {/* Header */}
          <div className='flex items-center justify-between p-6 border-b'>
            <h2 className='text-xl font-semibold text-gray-900'>Create Debt Position</h2>
            <button onClick={handleClose} className='text-gray-400 hover:text-gray-600'>
              <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
              </svg>
            </button>
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
            {/* Multi-Asset Mode Selection */}
            {step === 'select-supply' && (
              <div className='mb-6'>
                <div className='bg-gray-50 border border-gray-200 rounded-xl p-4'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center space-x-3'>
                      <div className='w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center'>
                        <svg className='w-5 h-5 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                          />
                        </svg>
                      </div>
                      <div>
                        <div className='font-semibold text-gray-900'>Collateral Mode</div>
                        <div className='text-sm text-gray-600'>
                          {isMultiCollateralMode ? 'Multiple assets as collateral' : 'Single asset as collateral'}
                        </div>
                      </div>
                    </div>

                    <div className='flex items-center space-x-3'>
                      <div className='text-right'>
                        <div className='text-sm font-medium text-gray-700'>Multi-Asset</div>
                        <div className='text-xs text-gray-500'>Like Aave V3</div>
                      </div>
                      <button
                        onClick={() => setIsMultiCollateralMode(!isMultiCollateralMode)}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-200 shadow-sm border-2 ${
                          isMultiCollateralMode
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-gray-200 border-gray-300 hover:border-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                            isMultiCollateralMode ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {isMultiCollateralMode && (
                    <div className='mt-4 pt-4 border-t border-gray-200'>
                      <div className='flex items-start space-x-3'>
                        <div className='text-blue-600 mt-0.5'>✨</div>
                        <div className='text-sm text-blue-800'>
                          <div className='font-semibold mb-1'>Multi-Asset Mode Active</div>
                          <div>
                            You can now select multiple assets as collateral in one position, just like real Aave V3
                            protocol. This gives you more flexibility and better capital efficiency.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Step 1: Select Supply Assets */}
            {step === 'select-supply' && !isMultiCollateralMode && (
              <div className='space-y-6'>
                <div>
                  <label className='block text-sm font-semibold text-gray-800 mb-3'>Collateral Asset (Supply)</label>
                  <div className='grid grid-cols-2 gap-3'>
                    {Object.entries(tokens).map(([symbol, token]) => (
                      <button
                        key={symbol}
                        onClick={() => setCollateralAsset(symbol as TokenSymbol)}
                        className={`p-4 border-2 rounded-xl flex items-center space-x-3 transition-all duration-200 ${
                          collateralAsset === symbol
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-300 hover:border-blue-300 hover:shadow-sm bg-white'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                            symbol === 'WETH'
                              ? 'bg-blue-600'
                              : symbol === 'USDC'
                              ? 'bg-blue-500'
                              : symbol === 'DAI'
                              ? 'bg-yellow-500'
                              : symbol === 'USDT'
                              ? 'bg-green-500'
                              : 'bg-purple-600'
                          }`}
                        >
                          {symbol.charAt(0)}
                        </div>
                        <div className='text-left flex-1'>
                          <div className='font-semibold text-gray-900 text-sm'>{symbol}</div>
                          <div className='text-xs text-gray-600 font-medium'>
                            Balance:{' '}
                            {tokenBalances[symbol as keyof typeof tokenBalances]?.formatted.slice(0, 8) || '0.00'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-semibold text-gray-800 mb-3'>
                    Supply Amount ({collateralAsset})
                  </label>
                  <div className='relative'>
                    <input
                      type='number'
                      value={collateralAmount}
                      onChange={e => setCollateralAmount(e.target.value)}
                      placeholder='0.0'
                      className='w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium text-lg pr-24'
                    />
                    <div className='absolute right-3 top-4 text-sm text-gray-600 font-medium bg-gray-50 px-2 py-1 rounded'>
                      Balance: {tokenBalances[collateralAsset]?.formatted.slice(0, 8) || '0.00'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  disabled={!collateralAmount || parseFloat(collateralAmount) <= 0}
                  className='w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Continue to Borrow
                </button>
              </div>
            )}

            {/* Step 1: Multi-Collateral Supply Selection */}
            {step === 'select-supply' && isMultiCollateralMode && (
              <div className='space-y-6'>
                <div>
                  <label className='block text-sm font-semibold text-gray-800 mb-3'>
                    Collateral Assets (Multi-Select)
                  </label>
                  <div className='space-y-3'>
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
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                                  symbol === 'WETH'
                                    ? 'bg-blue-600'
                                    : symbol === 'USDC'
                                    ? 'bg-blue-500'
                                    : symbol === 'DAI'
                                    ? 'bg-yellow-500'
                                    : symbol === 'WBTC'
                                    ? 'bg-orange-500'
                                    : 'bg-purple-600'
                                }`}
                              >
                                {symbol.charAt(0)}
                              </div>

                              <div className='flex-1'>
                                <div className='font-semibold text-gray-900 text-sm'>{symbol}</div>
                                <div className='text-xs text-gray-600 font-medium'>
                                  Balance:{' '}
                                  {tokenBalances[symbol as keyof typeof tokenBalances]?.formatted.slice(0, 8) || '0.00'}
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
                                <span className='text-xs text-gray-600 font-medium'>{symbol}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  disabled={!collateralAssets.some(a => a.selected && a.amount && parseFloat(a.amount) > 0)}
                  className='w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {(() => {
                    const selectedCollaterals = collateralAssets.filter(
                      a => a.selected && a.amount && parseFloat(a.amount) > 0,
                    ).length;
                    if (selectedCollaterals === 0) return 'Select Supply Assets to Continue';
                    return `Continue to Borrow (${selectedCollaterals} Asset${
                      selectedCollaterals > 1 ? 's' : ''
                    } Selected)`;
                  })()}
                </button>
              </div>
            )}

            {/* Step 2: Select Borrow Assets */}
            {step === 'select-borrow' && !isMultiCollateralMode && (
              <div className='space-y-6'>
                <div>
                  <label className='block text-sm font-semibold text-gray-800 mb-3'>Borrow Asset</label>
                  <div className='grid grid-cols-2 gap-3'>
                    {Object.entries(tokens).map(([symbol, token]) => (
                      <button
                        key={symbol}
                        onClick={() => setBorrowAsset(symbol as TokenSymbol)}
                        disabled={symbol === collateralAsset}
                        className={`p-4 border-2 rounded-xl flex items-center space-x-3 transition-all duration-200 ${
                          borrowAsset === symbol && symbol !== collateralAsset
                            ? 'border-green-500 bg-green-50 shadow-md'
                            : symbol === collateralAsset
                            ? 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                            : 'border-gray-300 hover:border-green-300 hover:shadow-sm bg-white'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                            symbol === collateralAsset
                              ? 'bg-gray-400'
                              : symbol === 'WETH'
                              ? 'bg-green-600'
                              : symbol === 'USDC'
                              ? 'bg-green-500'
                              : symbol === 'DAI'
                              ? 'bg-orange-500'
                              : symbol === 'USDT'
                              ? 'bg-teal-500'
                              : 'bg-indigo-600'
                          }`}
                        >
                          {symbol.charAt(0)}
                        </div>
                        <div className='text-left flex-1'>
                          <div
                            className={`font-semibold text-sm ${
                              symbol === collateralAsset ? 'text-gray-500' : 'text-gray-900'
                            }`}
                          >
                            {symbol}
                          </div>
                          <div
                            className={`text-xs font-medium ${
                              symbol === collateralAsset ? 'text-gray-400' : 'text-gray-600'
                            }`}
                          >
                            {symbol === collateralAsset ? 'Same as collateral' : 'Available to borrow'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-semibold text-gray-800 mb-3'>
                    Borrow Amount ({borrowAsset})
                  </label>
                  <input
                    type='number'
                    value={borrowAmount}
                    onChange={e => setBorrowAmount(e.target.value)}
                    placeholder='0.0'
                    className='w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 font-medium text-lg'
                  />
                </div>

                <div>
                  <label className='block text-sm font-semibold text-gray-800 mb-3'>Interest Rate Mode</label>
                  <div className='grid grid-cols-2 gap-3'>
                    <button
                      onClick={() => setInterestRateMode(1)}
                      className={`p-4 border-2 rounded-xl text-center transition-all duration-200 ${
                        interestRateMode === 1
                          ? 'border-green-500 bg-green-50 shadow-md'
                          : 'border-gray-300 hover:border-green-300 hover:shadow-sm bg-white'
                      }`}
                    >
                      <div className='font-semibold text-gray-900 text-sm'>Stable</div>
                      <div className='text-xs text-gray-600 font-medium'>Fixed rate</div>
                    </button>
                    <button
                      onClick={() => setInterestRateMode(2)}
                      className={`p-4 border-2 rounded-xl text-center transition-all duration-200 ${
                        interestRateMode === 2
                          ? 'border-green-500 bg-green-50 shadow-md'
                          : 'border-gray-300 hover:border-green-300 hover:shadow-sm bg-white'
                      }`}
                    >
                      <div className='font-semibold text-gray-900 text-sm'>Variable</div>
                      <div className='text-xs text-gray-600 font-medium'>Market rate</div>
                    </button>
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
                    disabled={!borrowAmount || parseFloat(borrowAmount) <= 0}
                    className='flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50'
                  >
                    Review Position
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Multi-Asset Borrow Selection */}
            {step === 'select-borrow' && isMultiCollateralMode && (
              <div className='space-y-6'>
                <div>
                  <label className='block text-sm font-semibold text-gray-800 mb-3'>Borrow Assets (Multi-Select)</label>
                  <div className='space-y-3'>
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
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                                  isCollateral
                                    ? 'bg-gray-400'
                                    : symbol === 'WETH'
                                    ? 'bg-green-600'
                                    : symbol === 'USDC'
                                    ? 'bg-green-500'
                                    : symbol === 'DAI'
                                    ? 'bg-orange-500'
                                    : symbol === 'WBTC'
                                    ? 'bg-teal-500'
                                    : 'bg-indigo-600'
                                }`}
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
                                  {isCollateral ? 'Used as collateral' : 'Available to borrow'}
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
                                <span className='text-xs text-gray-600 font-medium'>{symbol}</span>
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
                      return `Review Position (${selectedBorrows} Asset${selectedBorrows > 1 ? 's' : ''})`;
                    })()}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 'review' && (
              <div className='space-y-6'>
                <div className='bg-gray-50 rounded-lg p-4 space-y-3'>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Collateral:</span>
                    <span className='font-medium'>
                      {collateralAmount} {collateralAsset}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Borrow:</span>
                    <span className='font-medium'>
                      {borrowAmount} {borrowAsset}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Interest Rate:</span>
                    <span className='font-medium'>{interestRateMode === 1 ? 'Stable' : 'Variable'}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Position Address:</span>
                    <span className='font-mono text-sm'>
                      {typeof predictedAddress === 'string' ? predictedAddress.slice(0, 10) + '...' : 'Loading...'}
                    </span>
                  </div>
                </div>

                <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
                  <div className='flex items-start space-x-3'>
                    <div className='text-blue-600 mt-1'>ℹ️</div>
                    <div className='text-sm text-blue-800'>
                      <div className='font-medium mb-1'>What happens next:</div>
                      <ol className='list-decimal list-inside space-y-1'>
                        <li>Approve {collateralAsset} for spending</li>
                        <li>Create debt position at predicted address</li>
                        <li>
                          Supply {collateralAmount} {collateralAsset} as collateral
                        </li>
                        <li>
                          Borrow {borrowAmount} {borrowAsset} to your wallet
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Token approval step */}
                <div className='space-y-3'>
                  <button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className='w-full py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50'
                  >
                    {isApproving ? 'Approving...' : `1. Approve ${collateralAsset}`}
                  </button>

                  <button
                    onClick={handleCreatePosition}
                    disabled={isCreating}
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

            {/* Success */}
            {step === 'success' && (
              <div className='text-center space-y-6'>
                <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto'>
                  <svg className='w-8 h-8 text-green-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                  </svg>
                </div>

                <div>
                  <h3 className='text-lg font-semibold text-gray-900 mb-2'>Position Created!</h3>
                  <p className='text-gray-600'>Your debt position has been successfully created.</p>
                </div>

                {txHash && (
                  <div className='bg-gray-50 rounded-lg p-4'>
                    <div className='text-sm text-gray-600 mb-1'>Transaction Hash:</div>
                    <div className='font-mono text-sm break-all'>{txHash}</div>
                  </div>
                )}

                <button
                  onClick={handleClose}
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
