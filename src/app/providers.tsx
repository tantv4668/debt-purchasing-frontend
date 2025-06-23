'use client';

import { projectId, wagmiAdapter } from '@/lib/wagmi';
import { mainnet, sepolia } from '@reown/appkit/networks';
import { createAppKit } from '@reown/appkit/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { WagmiProvider, cookieToInitialState, type Config } from 'wagmi';

// Set up queryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

// Debug logging
console.log('🔍 Environment Debug:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:', process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);
console.log('projectId from wagmi.ts:', projectId);

if (!projectId) {
  console.error('❌ Project ID is not defined!');
  console.error('Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  });
  throw new Error('Project ID is not defined');
}

// Set up metadata
const metadata = {
  name: 'Debt Purchasing Protocol',
  description: 'Trade debt positions on Aave V3 - Avoid liquidations, earn profits',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000',
  icons: ['https://walletconnect.com/walletconnect-logo.png'],
};

// Create the modal - moved inside component to ensure env vars are loaded
let modal: any = null;

function ContextProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies);

  useEffect(() => {
    if (!modal && projectId) {
      console.log('🚀 Creating AppKit modal with projectId:', projectId);
      modal = createAppKit({
        adapters: [wagmiAdapter],
        projectId,
        networks: [mainnet, sepolia],
        defaultNetwork: mainnet,
        metadata: metadata,
        features: {
          analytics: true,
        },
      });
    }
  }, []);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export { ContextProvider as Providers };
