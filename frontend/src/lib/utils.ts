import { CryptoPair } from "@/types/crypto";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format number with appropriate decimals and separators
export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Format currency values
export function formatCurrency(value: number, currency: string = 'USD', decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Format percentage values
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '+' : ''}${formatNumber(value, decimals)}%`;
}

// Format large numbers with K, M, B suffixes
export function formatCompactNumber(value: number): string {
  const formatter = Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  return formatter.format(value);
}

// Get appropriate color class based on value trend
export function getTrendColor(value: number): string {
  if (value > 0) return 'crypto-value-up';
  if (value < 0) return 'crypto-value-down';
  return 'crypto-value-neutral';
}

// Format timestamp to locale time string
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatLargeNumber(value: number): string {
    if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(2)}B`;
    } else if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(2)}M`;
    } else if (value >= 1_000) {
        return `${(value / 1_000).toFixed(2)}K`;
    }
    return value.toFixed(2);
} 

{/* Helper function for formatting money values */}
export function formatMoney (value: number): string {
  if (!value) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

{/* Helper function to get base currency from pair */}
export function getPairBaseCurrency (pairString: string): string {
  if (!pairString) return '';
  // Extract the first part of the pair (e.g., "BTC" from "BTC-USD")
  return pairString.split('-')[0];
};

{/* Helper function to calculate accurate token quantity */}
export function calculateTokenQuantity (pair: CryptoPair): string {
  if (!pair || !pair.riskAnalysis?.positionSizing.suggested || !pair.currentPrice) {
    return '0';
  }
  
  // Convert suggested USD position size to token quantity
  const suggestedUSD = pair.riskAnalysis.positionSizing.suggested;
  const currentPrice = parseFloat(pair.currentPrice);
  
  if (!currentPrice || currentPrice === 0) return '0';
  
  const tokenQuantity = suggestedUSD / currentPrice;
  
  // Format based on token value
  return formatTokenAmount(tokenQuantity);
};


{/* Helper function for formatting token amounts */}
export function formatTokenAmount (amount: number): string {
  if (!amount) return '0';
  
  // If amount is very small, use scientific notation
  if (amount < 0.0001) {
    return amount.toExponential(4);
  }
  
  // If amount is less than 1, show more decimal places
  if (amount < 1) {
    return amount.toFixed(6);
  }
  
  // If amount is less than 1000, round to 4 decimal places
  if (amount < 1000) {
    return amount.toFixed(4);
  }
  
  // If amount is large, format with comma separators
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2
  }).format(amount);
};