import { ChainId } from './chains';

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  addresses: Record<ChainId, string>;
  oracle?: Record<ChainId, string>;
  logo?: string;
}

export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    decimals: 18,
    addresses: {
      [ChainId.MAINNET]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      [ChainId.SEPOLIA]: '0xd6c774778564ec1973b24a15ee4a5d00742e6575',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0x4d5f545400937997a594eb9f5b052381430e38d5',
    },
  },
  wstETH: {
    symbol: 'wstETH',
    name: 'Wrapped liquid staked Ether 2.0',
    decimals: 18,
    addresses: {
      [ChainId.MAINNET]: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
      [ChainId.SEPOLIA]: '0xb8057e942399f3714d40c0be7f4391ee447f42c9',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0xff7997e167b9d8709fe2a764672c075be1d734ec',
    },
  },
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    addresses: {
      [ChainId.MAINNET]: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      [ChainId.SEPOLIA]: '0x1b8ea7c3b44465be550ebaef50ff6bc5f25ee50c',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0xcf3bc3dae51092f2a0bc3ca119bc761e73166cda',
    },
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    addresses: {
      [ChainId.MAINNET]: '0xa0b86a33e6e6ed6c7f7b8d4b7f8f6b7e6e6e6e6e',
      [ChainId.SEPOLIA]: '0x005104eb2fd93a0c8f26e18934289ab91596e6bf',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0x7d4b1defb01610bcc0f7088649ed53bb7bfd9aa2',
    },
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    addresses: {
      [ChainId.MAINNET]: '0x6b175474e89094c44da98b954eedeac495271d0f',
      [ChainId.SEPOLIA]: '0xe0f11265b326df8f5c3e1db6aa8dcd506fd4cc5b',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0x6b02ded5e53730a3d046831068df843634fc3be3',
    },
  },
  LINK: {
    symbol: 'LINK',
    name: 'Chainlink Token',
    decimals: 18,
    addresses: {
      [ChainId.MAINNET]: '0x514910771af9ca656af840dff83e8264ecf986ca',
      [ChainId.SEPOLIA]: '0x2aa4fc36242b9e4e169542305d16dff2cc0ecdae',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0xbf3575382f32c37b268113b1f4b30a9bc8e9cbec',
    },
  },
  AAVE: {
    symbol: 'AAVE',
    name: 'Aave Token',
    decimals: 18,
    addresses: {
      [ChainId.MAINNET]: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
      [ChainId.SEPOLIA]: '0xbf088f3702000ebd6728b647a511ff0ae6867fc6',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0xfadcad80259cb08eb9db330b4e9b28d17fc97960',
    },
  },
  cbETH: {
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    decimals: 18,
    addresses: {
      [ChainId.MAINNET]: '0xbe9895146f7af43049ca1c1ae358b0541ea49704',
      [ChainId.SEPOLIA]: '0x9204befc95e67e6c8b5f58e09659cc4658af8730',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0xcd6cda9fdf5170c94ad8a8faad4c9955f523a020',
    },
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    addresses: {
      [ChainId.MAINNET]: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      [ChainId.SEPOLIA]: '0xd9126e24fc2e1bb395cca8b03c5e2aefabac35ea',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0xcf09ddcb2328446983058f41fdf75be8cc656e5d',
    },
  },
  rETH: {
    symbol: 'rETH',
    name: 'Rocket Pool ETH',
    decimals: 18,
    addresses: {
      [ChainId.MAINNET]: '0xae78736cd615f374d3085123a210448e74fc6393',
      [ChainId.SEPOLIA]: '0x5e0e0d4a40b5d20b51b3f591485b00513c68b519',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0x1fb2ad8b17996a4b8a87e1d8d599c95c6b9b918a',
    },
  },
  LUSD: {
    symbol: 'LUSD',
    name: 'Liquity USD',
    decimals: 18,
    addresses: {
      [ChainId.MAINNET]: '0x5f98805a4e8be255a32880fdec7f6728c6568ba0',
      [ChainId.SEPOLIA]: '0xae1107d669f519fcb8ec58304a8cce04cbcb0349',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0xd5a1668be77ce93c5bd82e2f82dad5b529cb2c13',
    },
  },
  CRV: {
    symbol: 'CRV',
    name: 'Curve DAO Token',
    decimals: 18,
    addresses: {
      [ChainId.MAINNET]: '0xd533a949740bb3306d119cc777fa900ba034cd52',
      [ChainId.SEPOLIA]: '0x28614b7a40ca9e9c6bf0ca66f4f841594d3223b9',
    },
    oracle: {
      [ChainId.MAINNET]: '',
      [ChainId.SEPOLIA]: '0x251936fc84a0e1e585c3cbe74234a987c3c3c18e',
    },
  },
} as const;

// Helper function to get token by symbol
export function getToken(symbol: string): TokenConfig | undefined {
  return SUPPORTED_TOKENS[symbol];
}

// Helper function to get token address for a specific chain
export function getTokenAddress(symbol: string, chainId: ChainId): string {
  const token = getToken(symbol);
  if (!token) {
    throw new Error(`Token ${symbol} not found`);
  }

  const address = token.addresses[chainId];
  if (!address) {
    throw new Error(`Token ${symbol} not available on chain ${chainId}`);
  }

  return address;
}
