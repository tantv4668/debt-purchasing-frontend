'use client';

import { config } from '@/lib/wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import * as React from 'react';
import { WagmiProvider } from 'wagmi';

import '@rainbow-me/rainbowkit/styles.css';

interface Web3ProviderProps {
  children: React.ReactNode;
}

export default function Web3Provider({ children }: Web3ProviderProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <RainbowKitProvider showRecentTransactions={true} coolMode={true} modalSize='compact'>
        {mounted ? children : <div className='animate-pulse'>Loading...</div>}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
