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

type Step = 'select-assets' | 'set-amounts' | 'review' | 'pending' | 'success';

export default function CreatePositionModal({ isOpen, onClose }: CreatePositionModalProps) {
  const { address } = useAccount();
  const { tokenBalances } = useTokenBalances();
  const { predictedAddress } = usePredictDebtAddress();
  const { createPosition, isPending: isCreating } = useCreatePosition();
  const { writeContract: approveToken } = useWriteContract();

  const [step, setStep] = useState<Step>('select-assets');
  const [collateralAsset, setCollateralAsset] = useState<TokenSymbol>('USDC');
  const [borrowAsset, setBorrowAsset] = useState<TokenSymbol>('DAI');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [interestRateMode, setInterestRateMode] = useState<1 | 2>(2);
  const [txHash, setTxHash] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  // Get tokens configuration for current chain (defaulting to Sepolia)
  const tokens = getTokenConfig(ChainId.SEPOLIA);
  const aaveRouterAddress = getAaveRouterAddress(ChainId.SEPOLIA);

  const reset = () => {
    setStep('select-assets');
    setCollateralAmount('');
    setBorrowAmount('');
    setTxHash('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleNext = () => {
    if (step === 'select-assets') setStep('set-amounts');
    else if (step === 'set-amounts') setStep('review');
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
      const collateralToken = tokens[collateralAsset];
      const borrowToken = tokens[borrowAsset];

      const params: CreatePositionParams = {
        collateralAsset: collateralToken.address,
        collateralAmount: parseUnits(collateralAmount, collateralToken.decimals),
        borrowAsset: borrowToken.address,
        borrowAmount: parseUnits(borrowAmount, borrowToken.decimals),
        interestRateMode,
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
              {['Assets', 'Amounts', 'Review'].map((label, index) => (
                <div key={label} className='flex items-center'>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index === 0 && step === 'select-assets'
                        ? 'bg-blue-600 text-white'
                        : index === 1 && step === 'set-amounts'
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
            {/* Step 1: Select Assets */}
            {step === 'select-assets' && (
              <div className='space-y-6'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Collateral Asset (Supply)</label>
                  <div className='grid grid-cols-2 gap-3'>
                    {Object.entries(tokens).map(([symbol, token]) => (
                      <button
                        key={symbol}
                        onClick={() => setCollateralAsset(symbol as TokenSymbol)}
                        className={`p-3 border rounded-lg flex items-center space-x-3 ${
                          collateralAsset === symbol
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className='w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm'>
                          {symbol[0]}
                        </div>
                        <div className='text-left'>
                          <div className='font-medium text-sm'>{symbol}</div>
                          <div className='text-xs text-gray-500'>
                            {tokenBalances[symbol as keyof typeof tokenBalances]?.formatted.slice(0, 8) || '0'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Borrow Asset</label>
                  <div className='grid grid-cols-2 gap-3'>
                    {Object.entries(tokens).map(([symbol, token]) => (
                      <button
                        key={symbol}
                        onClick={() => setBorrowAsset(symbol as TokenSymbol)}
                        disabled={symbol === collateralAsset}
                        className={`p-3 border rounded-lg flex items-center space-x-3 ${
                          borrowAsset === symbol
                            ? 'border-blue-500 bg-blue-50'
                            : symbol === collateralAsset
                            ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className='w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm'>
                          {symbol[0]}
                        </div>
                        <div className='text-left'>
                          <div className='font-medium text-sm'>{symbol}</div>
                          <div className='text-xs text-gray-500'>Borrow</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  className='w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700'
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 2: Set Amounts */}
            {step === 'set-amounts' && (
              <div className='space-y-6'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Collateral Amount ({collateralAsset})
                  </label>
                  <div className='relative'>
                    <input
                      type='number'
                      value={collateralAmount}
                      onChange={e => setCollateralAmount(e.target.value)}
                      placeholder='0.0'
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    />
                    <div className='absolute right-3 top-3 text-sm text-gray-500'>
                      Balance: {tokenBalances[collateralAsset]?.formatted.slice(0, 8) || '0'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Borrow Amount ({borrowAsset})</label>
                  <input
                    type='number'
                    value={borrowAmount}
                    onChange={e => setBorrowAmount(e.target.value)}
                    placeholder='0.0'
                    className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>Interest Rate Mode</label>
                  <div className='grid grid-cols-2 gap-3'>
                    <button
                      onClick={() => setInterestRateMode(1)}
                      className={`p-3 border rounded-lg text-center ${
                        interestRateMode === 1 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className='font-medium text-sm'>Stable</div>
                      <div className='text-xs text-gray-500'>Fixed rate</div>
                    </button>
                    <button
                      onClick={() => setInterestRateMode(2)}
                      className={`p-3 border rounded-lg text-center ${
                        interestRateMode === 2 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className='font-medium text-sm'>Variable</div>
                      <div className='text-xs text-gray-500'>Market rate</div>
                    </button>
                  </div>
                </div>

                <div className='flex space-x-3'>
                  <button
                    onClick={() => setStep('select-assets')}
                    className='flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50'
                  >
                    Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!collateralAmount || !borrowAmount}
                    className='flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50'
                  >
                    Review
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
                  onClick={() => setStep('set-amounts')}
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
