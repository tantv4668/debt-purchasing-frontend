import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia, hardhat } from 'viem/chains';

export const config = getDefaultConfig({
  appName: 'Debt Purchasing Protocol',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains: [mainnet, sepolia, hardhat],
  ssr: true,
});
