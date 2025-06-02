# Debt Purchasing Protocol Frontend

## Project Overview

Frontend application for a debt purchasing protocol that enables trading debt positions on Aave V3. Users can sell debt positions to avoid liquidations while buyers can purchase distressed positions at discount.

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS + modern UI components
- **Web3**: Wagmi v2, RainbowKit v2, Viem
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation
- **Data Fetching**: TanStack Query + Apollo Client for subgraph
- **Charts**: Recharts, Tremor for analytics

## Core Features

1. **Liquidation Protection**: Auto-execute sale orders when health factor drops
2. **Debt Position Trading**: Buy/sell debt positions with partial/full order support
3. **Health Factor Monitoring**: Real-time position monitoring
4. **EIP-712 Signatures**: Secure off-chain order signing
5. **Aave V3 Integration**: Direct protocol interaction

## Project Structure

- `src/app/`: Next.js 14 app directory structure
- `src/app/page.tsx`: Landing page with protocol overview
- `src/app/dashboard/page.tsx`: User dashboard with portfolio overview
- `src/app/positions/page.tsx`: Debt positions management
- `src/lib/`: Shared utilities and Web3 configurations
- `src/lib/wagmi.ts`: Wagmi configuration for Web3 integration

## Current Status

✅ **COMPLETED:**

- Next.js 14 project structure with App Router
- Web3 dependencies installed (Wagmi v2, RainbowKit v2, TanStack Query)
- Wagmi configuration with mainnet, sepolia, and hardhat chains
- Web3 providers setup in layout
- Homepage with landing page and "Launch App" button
- Dashboard page with portfolio overview and stats
- Positions page with debt position management interface
- Responsive Tailwind CSS styling
- Wallet connection functionality with RainbowKit
- Development server running on localhost:3000

## Next Steps

- Create market page for browsing available positions to buy
- Create orders page for managing buy/sell orders
- Implement Aave V3 integration with real data
- Add health factor monitoring with real-time updates
- Integrate with subgraph for historical data
- Add form validation with React Hook Form + Zod
- Implement EIP-712 signatures for order creation

## Pages Created

1. **Homepage (/)**: Landing page with protocol features and navigation
2. **Dashboard (/dashboard)**: Portfolio overview with health factors and stats
3. **Positions (/positions)**: Detailed debt position management with tables

## Development Notes

- TypeScript errors present for RainbowKit/Wagmi imports (likely due to type definitions)
- Application is functional and running on localhost:3000
- Navigation between pages working correctly
- Wallet connection working with RainbowKit
- All styling implemented with Tailwind CSS
