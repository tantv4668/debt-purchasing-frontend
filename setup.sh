#!/bin/bash

echo "🚀 Setting up Debt Purchasing Protocol Frontend"
echo "=============================================="

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 18+."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the debt-purchasing-frontend directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "🔧 Creating environment file..."
    cat > .env << 'EOF'
# Blockchain Configuration
NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_ENABLE_TESTNETS=true

# Contract Addresses (update with your deployed contracts)
NEXT_PUBLIC_AAVE_ROUTER_ADDRESS=0x...
NEXT_PUBLIC_AAVE_POOL_ADDRESS=0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
NEXT_PUBLIC_AAVE_ORACLE_ADDRESS=0x54586bE62E3c3580375aE3723C145253060Ca0C2

# Token Addresses (Mainnet)
NEXT_PUBLIC_WETH_ADDRESS=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
NEXT_PUBLIC_WBTC_ADDRESS=0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
NEXT_PUBLIC_USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
NEXT_PUBLIC_DAI_ADDRESS=0x6B175474E89094C44Da98b954EedeAC495271d0F

# RPC URLs (replace with your API keys)
NEXT_PUBLIC_MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.alchemyapi.io/v2/YOUR_API_KEY

# API Keys (get these from respective services)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key

# Subgraph URL (update when subgraph is deployed)
NEXT_PUBLIC_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/your-username/debt-purchasing-protocol

# Analytics (Optional)
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX

# App Configuration
NEXT_PUBLIC_APP_NAME="Debt Purchasing Protocol"
NEXT_PUBLIC_APP_DESCRIPTION="Trade debt positions on Aave V3"
EOF
    echo "✅ Environment file created at .env"
    echo "⚠️  Please update the environment variables with your actual values"
else
    echo "ℹ️  Environment file already exists"
fi

# Generate contract types (this will fail until contracts are built)
echo "🔄 Attempting to generate contract types..."
npm run generate 2>/dev/null || echo "⚠️  Contract generation failed - make sure contracts are compiled first"

# Check if we can run the dev server
echo "🧪 Running quick health check..."
npm run type-check 2>/dev/null || echo "⚠️  TypeScript check failed - this is expected until all files are created"

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Update .env with your API keys and contract addresses"
echo "2. Make sure the smart contracts are compiled: cd ../debt-purchasing-contracts && forge build"
echo "3. Generate contract types: npm run generate"
echo "4. Start development server: npm run dev"
echo ""
echo "🌐 The app will be available at: http://localhost:3000"
echo ""
echo "📚 For more information, see the README.md file" 