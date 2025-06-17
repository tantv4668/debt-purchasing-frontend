import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, sepolia } from '@reown/appkit/networks';
import { cookieStorage, createStorage } from '@wagmi/core';

// Get projectId from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId) {
  throw new Error('Project ID is not defined');
}

export const networks = [mainnet, sepolia];

// Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks,
});

export const config = wagmiAdapter.wagmiConfig;

// Debug logging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('🔧 AppKit Wagmi Config Debug:');
  console.log('Project ID:', projectId);
  console.log('Networks:', networks.length);
}

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
