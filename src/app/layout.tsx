import { ReactPlugin } from '@stagewise-plugins/react';
import { StagewiseToolbar } from '@stagewise/toolbar-next';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Debt Purchasing Protocol',
  description: 'Trade debt positions on Aave V3 - Avoid liquidations, earn profits',
  keywords: ['DeFi', 'Aave', 'Debt Trading', 'Liquidation Protection'],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const cookies = headersList.get('cookie');

  return (
    <html lang='en' suppressHydrationWarning>
      <body className={inter.className}>
        <Providers cookies={cookies}>{children}</Providers>
        <StagewiseToolbar
          config={{
            plugins: [ReactPlugin],
          }}
        />
      </body>
    </html>
  );
}
