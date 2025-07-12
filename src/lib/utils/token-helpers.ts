import { parseUnits } from "viem";
import { SUPPORTED_TOKENS } from "../contracts/tokens";
import { ChainId } from "../contracts/chains";

// Local precision utility to avoid circular imports
function toPreciseWei(value: number, precision: number = 4): bigint {
  const factor = Math.pow(10, 18); // 18 decimals for wei
  const precisionFactor = Math.pow(10, precision);

  // Truncate to the specified precision instead of rounding
  const truncatedValue = Math.floor(value * precisionFactor) / precisionFactor;

  // Convert to bigint with full precision
  const result = truncatedValue * factor;

  // Use Math.floor to avoid any rounding up
  return BigInt(Math.floor(result));
}

export interface TokenInfo {
  symbol: string;
  decimals: number;
  priceUSD: number;
}

export interface PriceApiResponse {
  success: boolean;
  data?: {
    tokens: Array<{
      id: string;
      symbol: string;
      decimals: number;
      priceUSD: string;
      oracleSource: string;
      lastUpdatedAt: string;
    }>;
    pagination: {
      limit: number;
      offset: number;
      count: number;
    };
  };
  error?: string;
  timestamp: string;
}

// Shared price API service
class TokenPriceService {
  private apiUrl: string;

  constructor() {
    this.apiUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002";
  }

  async getPrices(): Promise<Record<string, number>> {
    try {
      const response = await fetch(`${this.apiUrl}/api/prices`);
      if (!response.ok) {
        throw new Error("Failed to fetch token prices");
      }

      const data: PriceApiResponse = await response.json();
      const tokenPrices: Record<string, number> = {};

      if (data.data?.tokens && Array.isArray(data.data.tokens)) {
        data.data.tokens.forEach((token) => {
          if (token?.id && token?.priceUSD) {
            tokenPrices[token.id.toLowerCase()] = parseFloat(token.priceUSD);
          }
        });
      }

      return tokenPrices;
    } catch (error) {
      console.warn("Failed to fetch token prices, using defaults:", error);
      return {};
    }
  }

  async getTokenSymbols(): Promise<Record<string, string>> {
    try {
      const response = await fetch(`${this.apiUrl}/api/prices`);
      if (!response.ok) {
        throw new Error("Failed to fetch token data");
      }

      const data: PriceApiResponse = await response.json();
      const tokenSymbols: Record<string, string> = {};

      if (data.data?.tokens && Array.isArray(data.data.tokens)) {
        data.data.tokens.forEach((token) => {
          if (token?.id && token?.symbol) {
            tokenSymbols[token.id.toLowerCase()] = token.symbol;
          }
        });
      }

      return tokenSymbols;
    } catch (error) {
      console.warn("Failed to fetch token symbols, using defaults:", error);
      return {};
    }
  }
}

// Singleton instance
export const tokenPriceService = new TokenPriceService();

// Get token info by address - shared between hooks
export function getTokenInfo(
  tokenAddress: string,
  chainId: number,
  tokenPrices: Record<string, number> = {}
): TokenInfo {
  // Look up token in SUPPORTED_TOKENS by address
  const tokenEntry = Object.entries(SUPPORTED_TOKENS).find(
    ([, token]) =>
      token.addresses[
        chainId as keyof typeof token.addresses
      ]?.toLowerCase() === tokenAddress.toLowerCase()
  );

  if (tokenEntry) {
    const [symbol, tokenConfig] = tokenEntry;
    const priceUSD = tokenPrices[tokenAddress.toLowerCase()] || 1.0; // Use fetched price or default

    return {
      symbol,
      decimals: tokenConfig.decimals,
      priceUSD,
    };
  }

  // Fallback for unknown tokens
  return {
    symbol: "UNKNOWN",
    decimals: 18,
    priceUSD: tokenPrices[tokenAddress.toLowerCase()] || 1.0,
  };
}

// Calculate USD value with proper decimals handling
export function calculateUsdValue(
  amount: string,
  tokenAddress: string,
  chainId: number,
  tokenPrices: Record<string, number> = {}
): number {
  const tokenInfo = getTokenInfo(tokenAddress, chainId, tokenPrices);
  const amountFloat = parseFloat(amount);
  return amountFloat * tokenInfo.priceUSD;
}

// Shared function to format collateral/debt data - used by both hooks
export function formatTokenData(
  tokens: Array<{ token: string; amount: string; interestRateMode?: string }>,
  chainId: number,
  tokenPrices: Record<string, number> = {},
  type: "collateral" | "debt" = "collateral"
) {
  let totalUSD = 0;

  const formattedTokens = tokens.map((tokenData) => {
    const tokenInfo = getTokenInfo(tokenData.token, chainId, tokenPrices);
    const valueInUSD = calculateUsdValue(
      tokenData.amount,
      tokenData.token,
      chainId,
      tokenPrices
    );
    totalUSD += valueInUSD;

    const amountFloat = parseFloat(tokenData.amount);

    const amountInWei = parseUnits(amountFloat.toString(), tokenInfo.decimals);

    const baseToken = {
      token: tokenData.token as `0x${string}`,
      symbol: tokenInfo.symbol,
      name: tokenInfo.symbol,
      decimals: tokenInfo.decimals,
      balance: amountInWei, // Precisely converted to BigInt with decimals
      balanceUSD: toPreciseWei(valueInUSD), // Precise conversion to wei format as bigint
      balanceFormatted: amountFloat,
      valueInBase: valueInUSD,
      valueInUSD: valueInUSD,
    };

    if (type === "debt" && tokenData.interestRateMode) {
      return {
        ...baseToken,
        interestRateMode: parseInt(tokenData.interestRateMode) as 1 | 2,
        variableDebtTokenAddress:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
        stableDebtTokenAddress:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
      };
    }

    if (type === "collateral") {
      return {
        ...baseToken,
        aTokenAddress:
          "0x0000000000000000000000000000000000000000" as `0x${string}`,
      };
    }

    return baseToken;
  });

  return { formattedTokens, totalUSD };
}

/**
 * Get token decimals by address using SUPPORTED_TOKENS config
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID to match addresses
 * @returns Token decimals (defaults to 18 if unknown)
 */
export function getTokenDecimalsByAddress(
  tokenAddress: string,
  chainId: number
): number {
  const normalizedAddress = tokenAddress.toLowerCase();

  // Search through SUPPORTED_TOKENS to find matching address
  for (const [symbol, tokenConfig] of Object.entries(SUPPORTED_TOKENS)) {
    const configAddress = tokenConfig.addresses[chainId as ChainId];
    if (configAddress && configAddress.toLowerCase() === normalizedAddress) {
      return tokenConfig.decimals;
    }
  }

  // Default to 18 decimals if token not found
  console.warn(
    `Token decimals not found for ${tokenAddress} on chain ${chainId}, defaulting to 18`
  );
  return 18;
}

/**
 * Get token decimals by symbol using SUPPORTED_TOKENS config
 * @param symbol - Token symbol (e.g., 'USDC', 'DAI')
 * @returns Token decimals (defaults to 18 if unknown)
 */
export function getTokenDecimalsBySymbol(symbol: string): number {
  const tokenConfig = SUPPORTED_TOKENS[symbol];
  if (tokenConfig) {
    return tokenConfig.decimals;
  }

  console.warn(
    `Token decimals not found for symbol ${symbol}, defaulting to 18`
  );
  return 18;
}

/**
 * Convert decimal amount to wei format using proper token decimals
 * @param amount - Decimal amount as string (e.g., "1000.5")
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID to match addresses
 * @returns Wei amount as bigint
 */
export function decimalToWei(
  amount: string,
  tokenAddress: string,
  chainId: number
): bigint {
  const decimals = getTokenDecimalsByAddress(tokenAddress, chainId);
  const multiplier = Math.pow(10, decimals);
  return BigInt(Math.floor(parseFloat(amount) * multiplier));
}

/**
 * Convert wei amount to decimal format using proper token decimals
 * @param weiAmount - Wei amount as bigint
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID to match addresses
 * @returns Decimal amount as string
 */
export function weiToDecimal(
  weiAmount: bigint,
  tokenAddress: string,
  chainId: number
): string {
  const decimals = getTokenDecimalsByAddress(tokenAddress, chainId);
  const divisor = Math.pow(10, decimals);
  return (Number(weiAmount) / divisor).toString();
}
