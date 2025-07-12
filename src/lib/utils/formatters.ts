/**
 * Format a number to a compact string representation
 * @param value - The number to format
 * @param decimals - Number of decimal places to show
 * @returns Formatted string (e.g., "1.2K", "3.4M", "1.1B")
 */
export function formatCompactNumber(
  value: number,
  decimals: number = 1
): string {
  if (value === 0) return "0";

  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(decimals)}B`;
  } else if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(decimals)}M`;
  } else if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(decimals)}K`;
  } else {
    return `${sign}${absValue.toFixed(decimals)}`;
  }
}

/**
 * Format a USD value with proper currency formatting
 * @param value - The USD value to format
 * @param compact - Whether to use compact notation (K, M, B)
 * @returns Formatted USD string
 */
export function formatUSD(value: number, compact: boolean = false): string {
  if (compact) {
    return `$${formatCompactNumber(value)}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a percentage value
 * @param value - The percentage value (0-100)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a token amount with proper decimal places
 * @param value - The token amount
 * @param decimals - Token decimals (default 18)
 * @param displayDecimals - Number of decimal places to show
 * @returns Formatted token amount string
 */
export function formatTokenAmount(
  value: string | number,
  decimals: number = 18,
  displayDecimals: number = 4
): string {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  const adjustedValue = numValue / Math.pow(10, decimals);

  if (adjustedValue >= 1e6) {
    return `${(adjustedValue / 1e6).toFixed(2)}M`;
  } else if (adjustedValue >= 1e3) {
    return `${(adjustedValue / 1e3).toFixed(2)}K`;
  } else {
    return adjustedValue.toFixed(displayDecimals);
  }
}
