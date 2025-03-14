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


{/* Helper function for profit calculation */}
export function calculateProfit (pair: CryptoPair): string {
  if (!pair?.opportunityMetrics?.keyLevels || !pair?.riskAnalysis?.positionSizing) {
    return '0.00';
  }
  
  const entry = pair.opportunityMetrics.keyLevels.entry;
  const target = pair.opportunityMetrics.keyLevels.target;
  const positionSize = pair.riskAnalysis.positionSizing.suggested;
  
  if (!entry || !target || !positionSize) return '0.00';
  
  const quantity = positionSize / entry;
  let profit = 0;
  
  if (pair.opportunityMetrics.direction === 'long') {
    profit = quantity * (target - entry);
  } else {
    profit = quantity * (entry - target);
  }
  
  return formatMoney(Math.abs(profit));
};

{/* Helper function for loss calculation */}
export function calculateLoss (pair: CryptoPair): string {
  if (!pair?.opportunityMetrics?.keyLevels || !pair?.riskAnalysis?.positionSizing) {
    return '0.00';
  }
  
  const entry = pair.opportunityMetrics.keyLevels.entry;
  const stop = pair.opportunityMetrics.keyLevels.stop;
  const positionSize = pair.riskAnalysis.positionSizing.suggested;
  
  if (!entry || !stop || !positionSize) return '0.00';
  
  const quantity = positionSize / entry;
  let loss = 0;
  
  if (pair.opportunityMetrics.direction === 'long') {
    loss = quantity * (entry - stop);
  } else {
    loss = quantity * (stop - entry);
  }
  
  return formatMoney(Math.abs(loss));
};

{/* Helper function for account impact (profit) */}
export function calculateAccountImpactProfit (pair: CryptoPair): string {
  if (!pair?.opportunityMetrics?.keyLevels || !pair?.riskAnalysis?.positionSizing) {
    return '0.00';
  }
  
  const profit = parseFloat(calculateProfit(pair).replace(/,/g, ''));
  const accountSize = 10000; // Default account size
  
  return (profit / accountSize * 100).toFixed(2);
};

{/* Helper function for account impact (loss) */}
export function calculateAccountImpactLoss (pair: CryptoPair): string {
  if (!pair?.opportunityMetrics?.keyLevels || !pair?.riskAnalysis?.positionSizing) {
    return '0.00';
  }
  
  // This should be the same as risk percentage, but we calculate directly for clarity
  const loss = parseFloat(calculateLoss(pair).replace(/,/g, ''));
  const accountSize = 10000; // Default account size
  
  return (loss / accountSize * 100).toFixed(2);
};


{/* Helper function to get base currency from pair */}
export function getPairBaseCurrency (pairString: string): string {
  if (!pairString) return '';
  // Extract the first part of the pair (e.g., "BTC" from "BTC-USD")
  return pairString.split('-')[0];
};


{/* Helper function to calculate token quantity */}
export function calculateTokenQuantity (pair: CryptoPair): string {
  if (!pair || !pair.riskAnalysis?.positionSizing.suggested || !pair.opportunityMetrics?.keyLevels.entry) {
    return '0';
  }
  
  const suggestedUSD = pair.riskAnalysis.positionSizing.suggested;
  const entryPrice = pair.opportunityMetrics.keyLevels.entry;
  
  if (!entryPrice || entryPrice === 0) return '0';
  
  const tokenQuantity = suggestedUSD / entryPrice;
  
  return formatTokenAmount(tokenQuantity);
};

{/* Helper function for formatting token amounts */}
export function formatTokenAmount (amount: number): string {
  if (!amount) return '0';
  
  // For very small amounts (like shiba inu, etc.)
  if (amount < 0.0001) {
    return amount.toExponential(4);
  }
  
  // For medium-small amounts (like ETH, etc.)
  if (amount < 1) {
    return amount.toFixed(6);
  }
  
  // For medium amounts (like DOT, LINK, etc.)
  if (amount < 100) {
    return amount.toFixed(4);
  }
  
  // For large amounts (like ADA, XRP, etc.)
  if (amount < 10000) {
    return amount.toFixed(2);
  }
  
  // For very large amounts (like SHIB, DOGE, etc.)
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2
  }).format(Math.round(amount));
};

{/* Helper function for formatting money values */}
export function formatMoney (value: number): string {
  if (!value) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};