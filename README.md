# Debt Purchasing Protocol - Frontend

Modern Next.js 14 frontend for the Debt Purchasing Protocol, enabling users to trade debt positions on Aave V3 with advanced liquidation protection.

## 🎯 Overview

The frontend application provides a comprehensive interface for:

- **Position Management**: Create, monitor, and manage leveraged positions on Aave V3
- **Debt Trading**: Create and execute full/partial debt sale orders
- **Liquidation Protection**: Automated order execution when Health Factors drop
- **Real-time Monitoring**: Live health factor tracking and risk management
- **Marketplace**: Browse and purchase available debt positions

## 🚀 Tech Stack

### Core Framework

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Shadcn/UI** for component library

### Web3 Integration

- **Wagmi v1** for blockchain interactions
- **RainbowKit** for wallet connections
- **Viem** as Ethereum library
- **TanStack Query** for data fetching

### State Management

- **Zustand** for global state
- **React Hook Form** for form management
- **Zod** for schema validation

### Data & Analytics

- **Apollo Client** for GraphQL/Subgraph
- **Recharts** for financial charts
- **Tremor** for dashboard components

## 📋 Prerequisites

- **Node.js 18+**
- **npm/yarn/pnpm**
- **MetaMask** or compatible wallet

## 🛠️ Installation

### 1. Quick Setup (Recommended)

```bash
# Navigate to frontend directory
cd debt-purchasing-frontend

# Run automated setup script
./setup.sh
```

The setup script will automatically:

- Install all dependencies
- Create `.env` with template values
- Generate contract types (if contracts are available)
- Run health checks

### 2. Manual Installation

```bash
# Install dependencies
npm install

# Or with yarn
yarn install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 3. Configure Environment Variables

Create `.env` with:

```bash
# Blockchain Configuration
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_ENABLE_TESTNETS=true

# Contract Addresses
NEXT_PUBLIC_AAVE_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_AAVE_POOL_ADDRESS=0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2

# API Keys
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=your_api_key

# Subgraph
NEXT_PUBLIC_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/your-subgraph
```

### 4. Generate Contract Types

```bash
# Generate typed contracts from Foundry project
npm run generate
```

## 🚀 Development

### Start Development Server

```bash
npm run dev
# App will be available at http://localhost:3000
```

### Build for Production

```bash
npm run build
npm start
```

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Type checking
npm run type-check
```

## 🐛 Debugging

### VS Code Debug Configurations

The project includes comprehensive VS Code debugging setup with 6 different configurations:

```bash
# Debugging commands
npm run dev:debug        # Development with debugger enabled
npm run dev:debug-brk    # Development with debugger break on start
```

### Available Debug Configurations

1. **Next.js: Debug Server-Side** - Debug SSR, API routes, middleware
2. **Next.js: Debug Client-Side** - Debug React components in Chrome
3. **Next.js: Debug Full Stack** - Debug both server and client simultaneously
4. **Web3: Debug Wagmi/Viem** - Specialized for Web3 interactions
5. **Next.js: Debug API Routes** - Focus on backend logic
6. **Next.js: Attach to Running Dev Server** - Attach to existing dev server

### Quick Start Debugging

1. **Press `F5`** in VS Code
2. **Select configuration** based on your debugging needs
3. **Set breakpoints** by clicking line numbers
4. **Use debug console** for live evaluation

### Web3 Debugging Tips

```typescript
// Debug Wagmi hooks with breakpoints
const { data, error, isLoading } = useContractRead({
  // ... config
  onSuccess: data => {
    console.log('Contract read success:', data);
    debugger; // Breakpoint triggers here
  },
  onError: error => {
    console.error('Contract read error:', error);
    debugger; // Breakpoint for errors
  },
});

// Debug wallet connections
const { address, isConnected } = useAccount({
  onConnect: ({ address, connector }) => {
    console.log('Wallet connected:', address, connector?.name);
    debugger; // Debug connection flow
  },
});
```

### Debugging Best Practices

- **Conditional Breakpoints**: Right-click → "Add Conditional Breakpoint"
- **Watch Variables**: Monitor `isConnected`, `address`, `chain?.id`
- **Debug Console**: Evaluate expressions like `typeof variable`
- **Source Maps**: Debug original TypeScript files, not compiled JS

## 📁 Project Structure

```
src/
├── app/                    # Next.js 14 app directory
│   ├── dashboard/          # User dashboard pages
│   ├── positions/          # Position management
│   ├── marketplace/        # Order marketplace
│   ├── layout.tsx          # Root layout
│   ├── page.tsx           # Landing page
│   ├── providers.tsx      # Web3 providers
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # Shadcn/UI components
│   ├── web3/              # Web3-specific components
│   ├── positions/         # Position components
│   └── orders/            # Order components
├── hooks/
│   ├── useHealthFactor.ts # Health factor monitoring
│   ├── usePositions.ts    # Position management
│   └── useOrders.ts       # Order management
├── stores/
│   ├── positions.ts       # Position state
│   └── orders.ts          # Order state
├── utils/
│   ├── calculations.ts    # Financial calculations
│   ├── formatting.ts      # Number formatting
│   └── orderSigning.ts    # EIP-712 signatures
├── lib/
│   ├── wagmi.ts          # Wagmi configuration
│   └── constants.ts       # App constants
└── generated.ts           # Auto-generated contract types
```

## 🔧 Key Features

### 1. Dashboard

- Real-time health factor monitoring
- Position overview and management
- Risk alerts and notifications

### 2. Position Management

- Create new leveraged positions
- Supply collateral and borrow assets
- Monitor health factors and risks
- Withdraw and repay functionality

### 3. Order Creation

- Full sale orders for complete position transfer
- Partial sale orders for debt reduction
- EIP-712 signature creation and verification
- Time-based and trigger-based execution

### 4. Marketplace

- Browse available debt positions
- Filter by risk level, size, and terms
- Execute orders with multicall optimization
- Real-time order status updates

### 5. Analytics

- Historical health factor charts
- Profit/loss tracking
- Market statistics and trends
- Risk analysis and insights

## 📊 Smart Contract Integration

### Multicall Transactions

```typescript
// Create position with supply and borrow in one transaction
const multicallData = [
  router.interface.encodeFunctionData('createDebt', []),
  router.interface.encodeFunctionData('callSupply', [predictedAddress, WETH, amount]),
  router.interface.encodeFunctionData('callBorrow', [predictedAddress, USDC, amount, 2, user]),
];

await router.multicall(multicallData);
```

### Order Signing

```typescript
// Sign full sale order with EIP-712
const signature = await signTypedData({
  domain: { ... },
  types: { ... },
  primaryType: 'FullSellOrder',
  message: order
});
```

### Real-time Monitoring

```typescript
// Monitor health factors with automatic updates
const { data: healthFactor } = useContractRead({
  address: AAVE_POOL_ADDRESS,
  abi: aavePoolAbi,
  functionName: 'getUserAccountData',
  args: [debtAddress],
  watch: true,
});
```

## 🔒 Security Features

- **EIP-712 Signatures**: Structured data signing for orders
- **Nonce Management**: Automatic order invalidation
- **Type Safety**: Full TypeScript coverage
- **Input Validation**: Zod schema validation
- **Transaction Simulation**: Pre-execution validation

## 🎨 UI/UX Features

- **Responsive Design**: Mobile-first approach
- **Dark Mode**: Full dark/light theme support
- **Accessibility**: WCAG compliant components
- **Real-time Updates**: Live data synchronization
- **Loading States**: Skeleton loading and spinners
- **Error Handling**: Comprehensive error boundaries

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Manual Deployment

```bash
npm run build
# Deploy 'out' directory to your hosting provider
```

## 🧪 Testing Strategy

- **Unit Tests**: Component and utility testing
- **Integration Tests**: Web3 interaction testing
- **E2E Tests**: Full user workflow testing
- **Contract Testing**: Mock contract interactions

## 📝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the DeFi community**
