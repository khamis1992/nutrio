// Currency configuration for the application
export const CURRENCY = {
  code: "QAR",
  symbol: "QAR",
  name: "Qatari Riyal",
  locale: "en-QA",
};

/**
 * Format a number as currency with QAR
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the currency symbol (default: true)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number | string | null | undefined, showSymbol = true): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  
  if (numAmount === null || numAmount === undefined || isNaN(numAmount)) {
    return showSymbol ? `${CURRENCY.symbol} 0.00` : "0.00";
  }
  
  const formatted = numAmount.toFixed(2);
  return showSymbol ? `${CURRENCY.symbol} ${formatted}` : formatted;
}

/**
 * Format a number as currency without decimals (for display purposes)
 * @param amount - The amount to format
 * @returns Formatted currency string without decimals
 */
export function formatCurrencyCompact(amount: number | string | null | undefined): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  
  if (numAmount === null || numAmount === undefined || isNaN(numAmount)) {
    return `${CURRENCY.symbol} 0`;
  }
  
  return `${CURRENCY.symbol} ${Math.round(numAmount)}`;
}
