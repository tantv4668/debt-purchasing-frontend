import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask, safe, walletConnect } from 'wagmi/connectors';
import { ChainId, SUPPORTED_CHAINS } from './contracts';

export const config = createConfig({
  chains: [sepolia, mainnet],
  connectors: [
    injected(),
    metaMask(),
    coinbaseWallet({
      appName: 'Debt Purchasing Protocol',
      appLogoUrl: undefined, // Remove broken URL
    }),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'c9f6ad2f0f8f4b1b9a7c3d2e1f0a9b8c',
      metadata: {
        name: 'Debt Purchasing Protocol',
        description: 'Trade debt positions on Aave V3 - Avoid liquidations, earn profits',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000',
        icons: [],
      },
      showQrModal: true,
    }),
    safe(),
  ],
  transports: {
    [sepolia.id]: http(SUPPORTED_CHAINS[ChainId.SEPOLIA].rpcUrl),
    [mainnet.id]: http(SUPPORTED_CHAINS[ChainId.MAINNET].rpcUrl),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
