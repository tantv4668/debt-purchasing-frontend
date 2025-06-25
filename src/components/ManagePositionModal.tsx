'use client';

import { useEffect, useState } from 'react';
import { parseUnits } from 'viem';
import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { ChainId } from '../lib/contracts';
import { SUPPORTED_TOKENS } from '../lib/contracts/tokens';
import { useMultiTokenOperations, usePositionManagement } from '../lib/hooks/useContracts';
import { useTokenBalances } from '../lib/hooks/useDebtPositions';
import { usePriceTokens } from '../lib/hooks/usePriceTokens';
import type { TokenSymbol } from '../lib/types/debt-position';

interface ManagePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: any; // The debt position to manage
  onPositionUpdated?: () => void;
}

type ActionTab = 'supply' | 'borrow' | 'repay' | 'withdraw';

interface AssetSelection {
  symbol: TokenSymbol;
  amount: string;
  selected: boolean;
  interestRateMode?: 1 | 2; // For borrow operations
}

export default function ManagePositionModal({
  isOpen,
  onClose,
  position,
  onPositionUpdated,
}: ManagePositionModalProps) {
  const { address } = useAccount();
  const { tokenBalances } = useTokenBalances();
  const multiTokenOps = useMultiTokenOperations(ChainId.SEPOLIA);
  const positionOps = usePositionManagement(ChainId.SEPOLIA);
  const {
    calculateUSDValue,
    formatUSDValue,
    getTotalUSDValue,
    getPriceBySymbol,
    isLoading: pricesLoading,
    error: pricesError,
    refreshPrices,
  } = usePriceTokens();

  const [activeTab, setActiveTab] = useState<ActionTab>('supply');
  const [assets, setAssets] = useState<AssetSelection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvedTokens, setApprovedTokens] = useState<Set<string>>(new Set());
  const [pendingApprovals, setPendingApprovals] = useState<Set<string>>(new Set());
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | undefined>(undefined);

  // Wait for transaction receipt
  const {
    data: receipt,
    isLoading: isWaitingForReceipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: transactionHash,
  });

  // Handle transaction completion
  useEffect(() => {
    if (receipt && transactionHash) {
      if (receipt.status === 'success') {
        setTransactionError(null);
        setTransactionHash(undefined);
        setIsProcessing(false);
        onPositionUpdated?.();
        resetForm();
      } else {
        setTransactionError('Transaction failed on blockchain');
        setTransactionHash(undefined);
        setIsProcessing(false);
      }
    }
  }, [receipt, transactionHash, onPositionUpdated]);

  // Handle transaction receipt error
  useEffect(() => {
    if (receiptError && transactionHash) {
      const errorMessage = receiptError instanceof Error ? receiptError.message : 'Transaction failed';
      setTransactionError(errorMessage);
      setTransactionHash(undefined);
      setIsProcessing(false);
    }
  }, [receiptError, transactionHash]);

  // Initialize default state
  const getDefaultAssets = () =>
    Object.keys(SUPPORTED_TOKENS).map(symbol => ({
      symbol: symbol as TokenSymbol,
      amount: '',
      selected: false,
      interestRateMode: 2 as 1 | 2,
    }));

  // Reset form when tab changes
  useEffect(() => {
    setAssets(getDefaultAssets());
    setTransactionError(null);
    setApprovedTokens(new Set());
    setPendingApprovals(new Set());
  }, [activeTab]);

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

  const resetForm = () => {
    setAssets(getDefaultAssets());
    setTransactionError(null);
    setTransactionHash(undefined);
    setIsProcessing(false);
    setApprovedTokens(new Set());
    setPendingApprovals(new Set());
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getSelectedAssets = () => {
    return assets.filter(asset => asset.selected && asset.amount && parseFloat(asset.amount) > 0);
  };

  const getPositionAssetSymbols = (assetType: 'collateral' | 'debt') => {
    if (!position) return [];
    const positionAssets = assetType === 'collateral' ? position.collaterals : position.debts;
    return positionAssets.map((asset: any) => asset.symbol);
  };

  const isAssetInPosition = (symbol: string, assetType: 'collateral' | 'debt') => {
    return getPositionAssetSymbols(assetType).includes(symbol);
  };

  const handleApprove = async () => {
    if (!address || (activeTab !== 'supply' && activeTab !== 'repay')) return;

    const selectedAssets = getSelectedAssets();
    if (selectedAssets.length === 0) return;

    setIsApproving(true);
    try {
      const tokensToApprove = selectedAssets.map(asset => {
        const token = tokens[asset.symbol];
        return {
          symbol: asset.symbol,
          amount: parseUnits(asset.amount, token.decimals),
        };
      });

      const { allApproved, approvalResults } = await multiTokenOps.approveMultipleTokens(tokensToApprove);

      // Track pending approvals
      approvalResults.forEach(result => {
        if (result.success) {
          setPendingApprovals(prev => new Set(prev).add(result.symbol));
        }
      });

      // Start polling to check for confirmation
      const pollForConfirmation = async (tokens: typeof tokensToApprove, attempts = 0) => {
        if (attempts >= 20) {
          console.warn('Approval confirmation timeout reached');
          return;
        }

        try {
          const recheck = await multiTokenOps.checkMultipleAllowances(tokens);
          let allConfirmed = true;

          recheck.forEach(check => {
            if (!check.needsApproval) {
              setApprovedTokens(prev => new Set(prev).add(check.symbol));
              setPendingApprovals(prev => {
                const newSet = new Set(prev);
                newSet.delete(check.symbol);
                return newSet;
              });
            } else {
              allConfirmed = false;
            }
          });

          if (!allConfirmed) {
            setTimeout(() => pollForConfirmation(tokens, attempts + 1), 3000);
          }
        } catch (error) {
          console.error('Error checking allowances:', error);
          setTimeout(() => pollForConfirmation(tokens, attempts + 1), 3000);
        }
      };

      setTimeout(() => pollForConfirmation(tokensToApprove), 2000);

      // Check for tokens that already had sufficient allowance
      const allowanceCheck = await multiTokenOps.checkMultipleAllowances(tokensToApprove);
      allowanceCheck.forEach(check => {
        if (!check.needsApproval) {
          setApprovedTokens(prev => new Set(prev).add(check.symbol));
        }
      });
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!address || !position) return;

    const selectedAssets = getSelectedAssets();
    if (selectedAssets.length === 0) return;

    setIsProcessing(true);
    setTransactionError(null);
    setTransactionHash(undefined);

    try {
      for (const asset of selectedAssets) {
        const token = tokens[asset.symbol];
        const amount = parseUnits(asset.amount, token.decimals);
        let txHash: `0x${string}` | undefined;

        if (activeTab === 'supply') {
          txHash = await positionOps.supplyToPosition(position.address, token.address, amount);
        } else if (activeTab === 'borrow') {
          txHash = await positionOps.borrowFromPosition(
            position.address,
            token.address,
            amount,
            asset.interestRateMode || 2,
            address,
          );
        } else if (activeTab === 'repay') {
          txHash = await positionOps.repayPosition(
            position.address,
            token.address,
            amount,
            asset.interestRateMode || 2,
          );
        } else if (activeTab === 'withdraw') {
          txHash = await positionOps.withdrawFromPosition(position.address, token.address, amount, address);
        }

        // Store the last transaction hash for receipt waiting
        if (txHash) {
          setTransactionHash(txHash);
        }
      }
    } catch (error) {
      console.error(`${activeTab} operation failed:`, error);
      const errorMessage = error instanceof Error ? error.message : `${activeTab} operation failed`;
      const isUserRejection =
        errorMessage.toLowerCase().includes('reject') ||
        errorMessage.toLowerCase().includes('denied') ||
        errorMessage.toLowerCase().includes('cancelled');

      setTransactionError(isUserRejection ? 'Transaction was rejected' : errorMessage);
      setIsProcessing(false);
    }
  };

  const getTabDescription = () => {
    switch (activeTab) {
      case 'supply':
        return 'Add more collateral to your position to improve your health factor and reduce liquidation risk.';
      case 'borrow':
        return 'Borrow additional assets against your existing collateral if your position is safe.';
      case 'repay':
        return 'Pay back existing debt to improve your health factor and reduce interest payments.';
      case 'withdraw':
        return 'Remove collateral from your position if your health factor allows it.';
      default:
        return '';
    }
  };

  const getAssetFilterForTab = () => {
    if (activeTab === 'repay') {
      // For repay, only show assets that are currently borrowed
      return assets.filter(asset => isAssetInPosition(asset.symbol, 'debt'));
    } else if (activeTab === 'withdraw') {
      // For withdraw, only show assets that are currently collateral
      return assets.filter(asset => isAssetInPosition(asset.symbol, 'collateral'));
    }
    // For supply and borrow, show all assets
    return assets;
  };

  const getActionButtonText = () => {
    const selectedCount = getSelectedAssets().length;
    const totalValue = getTotalUSDValue(getSelectedAssets().map(a => ({ symbol: a.symbol, amount: a.amount })));

    const actionText = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);

    if (selectedCount === 0) {
      return `Select Assets to ${actionText}`;
    }

    return `${actionText} ${selectedCount} Asset${selectedCount > 1 ? 's' : ''}${
      totalValue > 0 ? ` • ${formatUSDValue(totalValue)}` : ''
    }`;
  };

  const needsApproval = () => {
    return activeTab === 'supply' || activeTab === 'repay';
  };

  const isReadyToExecute = () => {
    const selectedAssets = getSelectedAssets();
    if (selectedAssets.length === 0) return false;

    if (needsApproval()) {
      return selectedAssets.every(asset => approvedTokens.has(asset.symbol));
    }

    return true;
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 overflow-y-auto'>
      <div className='flex min-h-screen items-center justify-center p-4'>
        <div className='fixed inset-0 bg-black bg-opacity-50' onClick={handleClose} />

        <div className='relative w-full max-w-3xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl'>
          {/* Header */}
          <div className='flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600'>
            <div>
              <h2 className='text-xl font-semibold text-gray-900 dark:text-white'>Manage Position</h2>
              <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                Position:{' '}
                {position?.address ? `${position.address.slice(0, 10)}...${position.address.slice(-4)}` : 'Loading...'}
              </p>
            </div>
            <button onClick={handleClose} className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'>
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

          {/* Tab Navigation */}
          <div className='px-6 py-4 border-b border-gray-200 dark:border-gray-600'>
            <div className='flex space-x-1'>
              {(['supply', 'borrow', 'repay', 'withdraw'] as ActionTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <p className='text-sm text-gray-600 dark:text-gray-400 mt-3'>{getTabDescription()}</p>
          </div>

          {/* Content */}
          <div className='p-6'>
            {/* Price Status Indicator */}
            {pricesError && (
              <div className='bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-6'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center space-x-2'>
                    <div className='text-yellow-600 dark:text-yellow-400'>⚠️</div>
                    <span className='text-sm text-yellow-800 dark:text-yellow-200'>
                      Price data unavailable - using fallback values
                    </span>
                  </div>
                  <button
                    onClick={refreshPrices}
                    className='text-xs text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100 underline'
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Asset Selection */}
            <div className='space-y-4'>
              <label className='block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3'>
                Select Assets for {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </label>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2'>
                {getAssetFilterForTab().map(asset => {
                  const token = tokens[asset.symbol];
                  const isInPosition = isAssetInPosition(asset.symbol, activeTab === 'repay' ? 'debt' : 'collateral');

                  return (
                    <div
                      key={asset.symbol}
                      className={`p-4 border-2 rounded-xl transition-all duration-200 ${
                        asset.selected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 shadow-md'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-300 hover:shadow-sm'
                      }`}
                    >
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center space-x-3'>
                          <button
                            onClick={() => {
                              setAssets(prev =>
                                prev.map(a => (a.symbol === asset.symbol ? { ...a, selected: !a.selected } : a)),
                              );
                            }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              asset.selected
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300 dark:border-gray-500 hover:border-blue-400'
                            }`}
                          >
                            {asset.selected && (
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
                              asset.symbol,
                            )}`}
                          >
                            {asset.symbol.charAt(0)}
                          </div>

                          <div className='flex-1'>
                            <div className='font-semibold text-gray-900 dark:text-white text-sm'>
                              {asset.symbol}
                              {isInPosition && (
                                <span className='ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full'>
                                  In Position
                                </span>
                              )}
                            </div>
                            <div className='text-xs text-gray-600 dark:text-gray-400 font-medium'>
                              Balance:{' '}
                              {parseFloat(
                                tokenBalances[asset.symbol as keyof typeof tokenBalances]?.formatted || '0',
                              ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className='text-xs text-gray-500 dark:text-gray-500'>
                              {(() => {
                                const price = getPriceBySymbol(asset.symbol);
                                return price > 0 ? `$${price.toFixed(4)}` : 'Price loading...';
                              })()}
                            </div>
                          </div>
                        </div>

                        {asset.selected && (
                          <div className='flex items-center space-x-2'>
                            <div className='text-right'>
                              <input
                                type='number'
                                placeholder='0.0'
                                value={asset.amount}
                                onChange={e => {
                                  setAssets(prev =>
                                    prev.map(a => (a.symbol === asset.symbol ? { ...a, amount: e.target.value } : a)),
                                  );
                                }}
                                className='w-24 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white dark:bg-gray-800 font-medium text-sm'
                              />
                              {asset.amount && parseFloat(asset.amount) > 0 && (
                                <div className='text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium'>
                                  {formatUSDValue(calculateUSDValue(asset.amount, asset.symbol))}
                                </div>
                              )}
                            </div>

                            {activeTab === 'borrow' && (
                              <select
                                value={asset.interestRateMode}
                                onChange={e => {
                                  setAssets(prev =>
                                    prev.map(a =>
                                      a.symbol === asset.symbol
                                        ? { ...a, interestRateMode: parseInt(e.target.value) as 1 | 2 }
                                        : a,
                                    ),
                                  );
                                }}
                                className='px-2 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white dark:bg-gray-800 font-medium text-xs'
                              >
                                <option value={1}>Stable</option>
                                <option value={2}>Variable</option>
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Error display */}
            {transactionError && (
              <div className='bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4 mt-6'>
                <div className='flex items-start space-x-3'>
                  <div className='text-red-600 dark:text-red-400 mt-1'>❌</div>
                  <div className='text-sm text-red-800 dark:text-red-200'>
                    <div className='font-medium mb-1'>Transaction Failed</div>
                    <div>{transactionError}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className='mt-6 space-y-3'>
              {needsApproval() && (
                <button
                  onClick={handleApprove}
                  disabled={
                    isApproving ||
                    getSelectedAssets().every(asset => approvedTokens.has(asset.symbol)) ||
                    getSelectedAssets().some(asset => pendingApprovals.has(asset.symbol))
                  }
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    getSelectedAssets().every(asset => approvedTokens.has(asset.symbol))
                      ? 'bg-green-600 text-white cursor-default'
                      : getSelectedAssets().some(asset => pendingApprovals.has(asset.symbol))
                      ? 'bg-yellow-600 text-white cursor-default'
                      : 'bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50'
                  }`}
                >
                  {getSelectedAssets().every(asset => approvedTokens.has(asset.symbol)) ? (
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
                  ) : getSelectedAssets().some(asset => pendingApprovals.has(asset.symbol)) ? (
                    <div className='flex items-center justify-center space-x-2'>
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                      <span>⏳ Confirming Approvals...</span>
                    </div>
                  ) : isApproving ? (
                    <div className='flex items-center justify-center space-x-2'>
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                      <span>Approving...</span>
                    </div>
                  ) : (
                    '1. Approve Selected Assets'
                  )}
                </button>
              )}

              <button
                onClick={handleExecuteAction}
                disabled={isProcessing || !isReadyToExecute()}
                className='w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {isProcessing ? (
                  <div className='flex items-center justify-center space-x-2'>
                    <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  `${needsApproval() ? '2. ' : ''}${getActionButtonText()}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
