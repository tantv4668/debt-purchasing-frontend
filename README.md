# Debt Purchasing Frontend

Frontend application for the debt purchasing platform, providing a user interface for interacting with the smart contracts.

## Overview

The frontend application allows users to:

- Connect their wallets and manage their funds
- Deposit collateral and borrow assets on Aave
- Create debt sale offers with specific conditions
- Purchase debt positions from other users
- Track ownership of debt positions

## Features

- **Borrower Dashboard**: Manage collateral, borrowings, and debt sales
- **Buyer Marketplace**: Browse and purchase available debt positions
- **Analytics Dashboard**: View platform statistics and user metrics

## Tech Stack

- React
- Ethers.js for blockchain interaction
- Web3Modal for wallet connections
- React Router for navigation
- CSS with responsive design

## Setup

### Prerequisites

- Node.js (v16+)
- MetaMask or other Ethereum wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/debt-purchasing-frontend.git
cd debt-purchasing-frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your specific configuration
```

### Running

```bash
# Start the development server
npm start

# Build for production
npm run build
```

### Testing

```bash
# Run tests
npm test
```

## Configuration

The frontend requires several environment variables:

- `REACT_APP_BACKEND_URL`: URL of the backend API
- `REACT_APP_CHAIN_ID`: Chain ID of the deployed contracts
- `REACT_APP_DEBT_VAULT_ADDRESS`: Address of the DebtVault contract
- `REACT_APP_DEBT_SALE_MANAGER_ADDRESS`: Address of the DebtSaleManager contract

## License

This project is licensed under the MIT License.
