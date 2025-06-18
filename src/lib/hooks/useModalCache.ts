import { useEffect, useState } from 'react';
import type { TokenSymbol } from '../types/debt-position';

export interface CachedModalState {
  step: 'select-supply' | 'select-borrow' | 'review' | 'pending' | 'success';
  collateralAssets: Array<{
    symbol: TokenSymbol;
    amount: string;
    selected: boolean;
  }>;
  borrowAssets: Array<{
    symbol: TokenSymbol;
    amount: string;
    selected: boolean;
    interestRateMode: 1 | 2;
  }>;
  approvedTokens: string[];
  timestamp: number;
}

const CACHE_KEY = 'debt-modal-cache';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

export function useModalCache() {
  const [cachedState, setCachedState] = useState<CachedModalState | null>(null);

  // Load cached state on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedModalState = JSON.parse(cached);

        // Check if cache is still valid (not expired)
        if (Date.now() - parsed.timestamp < CACHE_EXPIRY) {
          setCachedState(parsed);
        } else {
          // Clear expired cache
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (error) {
      console.warn('Failed to load modal cache:', error);
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  const saveToCache = (state: Omit<CachedModalState, 'timestamp'>) => {
    try {
      const stateWithTimestamp: CachedModalState = {
        ...state,
        timestamp: Date.now(),
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(stateWithTimestamp));
      setCachedState(stateWithTimestamp);
    } catch (error) {
      console.warn('Failed to save modal cache:', error);
    }
  };

  const clearCache = () => {
    try {
      localStorage.removeItem(CACHE_KEY);
      setCachedState(null);
    } catch (error) {
      console.warn('Failed to clear modal cache:', error);
    }
  };

  const hasValidCache = () => {
    return (
      cachedState !== null &&
      (cachedState.collateralAssets.some(a => a.selected) || cachedState.borrowAssets.some(a => a.selected))
    );
  };

  return {
    cachedState,
    saveToCache,
    clearCache,
    hasValidCache,
  };
}
