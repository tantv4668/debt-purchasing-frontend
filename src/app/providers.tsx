'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import * as React from 'react';

// Dynamically import Web3 provider to avoid SSR issues with indexedDB
const Web3Provider = dynamic(() => import('./web3-provider'), {
  ssr: false,
});

export function Providers({ children }: { children: React.ReactNode }) {
  // Create a client for React Query - use useState to ensure single instance
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Web3Provider>{children}</Web3Provider>
    </QueryClientProvider>
  );
}
