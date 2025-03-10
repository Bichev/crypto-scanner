/**
 * Support and Resistance Helper Functions
 * This utility file contains helper functions for the Support & Resistance component
 */

import { CryptoPair } from '../types/crypto';

/**
 * Format price based on its magnitude
 * @param price The price to format
 * @returns Formatted price string with appropriate decimal places
 */
export const formatPrice = (price: number): string => {
  if (price === undefined || price === null) return "0.00";
  const numPrice = parseFloat(price.toString());
  
  if (isNaN(numPrice)) return "0.00";
  
  if (numPrice > 1000) return numPrice.toFixed(2);
  if (numPrice > 1) return numPrice.toFixed(4);
  if (numPrice > 0.01) return numPrice.toFixed(6);
  if (numPrice > 0.00001) return numPrice.toFixed(8);
  return numPrice.toFixed(10);
};

/**
 * Check if two price levels are essentially the same (within percentage threshold)
 * @param price1 First price
 * @param price2 Second price
 * @param percentThreshold Threshold percentage difference (default 0.5%)
 * @returns Boolean indicating if the prices are effectively the same
 */
export const isSameLevel = (price1: number, price2: number, percentThreshold: number = 0.5): boolean => {
  if (!price1 || !price2) return false;
  const p1 = parseFloat(price1.toString());
  const p2 = parseFloat(price2.toString());
  
  if (isNaN(p1) || isNaN(p2)) return false;
  
  return Math.abs((p1 - p2) / p2 * 100) <= percentThreshold;
};

/**
 * Get fallback support level when none detected
 * @param pair Crypto pair object
 * @returns Support level price and description
 */
export const getFallbackSupport = (pair: CryptoPair): { price: number; description: string } => {
  if (!pair || !pair.fallbackSupport) return { price: 0, description: 'No data available' };
  return pair.fallbackSupport;
};

/**
 * Get fallback resistance level when none detected
 * @param pair Crypto pair object
 * @returns Resistance level price and description
 */
export const getFallbackResistance = (pair: CryptoPair): { price: number; description: string } => {
  if (!pair || !pair.fallbackResistance) return { price: 0, description: 'No data available' };
  return pair.fallbackResistance;
};

/**
 * Format time ago from timestamp
 * @param timestamp Unix timestamp in seconds
 * @returns Formatted string like "2h ago" or "3d ago"
 */
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 3600) {
    return `${Math.floor(diff / 60)}m ago`;
  }
  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h ago`;
  }
  return `${Math.floor(diff / 86400)}d ago`;
};

/**
 * Calculate price channel width as percentage
 * @param pair Crypto pair object
 * @returns Price channel width as percentage
 */
export const getPriceChannelWidth = (pair: CryptoPair): number => {
  if (!pair) return 0;
  if (!pair.supports?.length || !pair.resistances?.length) return 0;
  
  const lowestSupport = Math.min(...pair.supports.map(s => s.price));
  const highestResistance = Math.max(...pair.resistances.map(r => r.price));
  const currentPrice = parseFloat(pair.currentPrice || '0');
  
  return ((highestResistance - lowestSupport) / currentPrice) * 100;
};

/**
 * Check if support and resistance levels overlap (common in tightly-trading pairs)
 * @param pair Crypto pair object
 * @returns Boolean indicating if there are any overlapping levels
 */
export const hasOverlappingLevels = (pair: CryptoPair): boolean => {
  if (!pair) return false;
  if (!pair.supports || !pair.resistances) return false;
  if (pair.supports.length === 0 || pair.resistances.length === 0) return false;
  
  for (const support of pair.supports) {
    for (const resistance of pair.resistances) {
      if (parseFloat(resistance.price.toString()) <= parseFloat(support.price.toString())) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Get the distance from current price to nearest support/resistance as percentage
 * @param pair Crypto pair object
 * @param type Either 'support' or 'resistance'
 * @returns Distance as percentage
 */
export const getDistanceToLevel = (pair: CryptoPair, type: 'support' | 'resistance'): number => {
  if (!pair || !pair.currentPrice) return 0;
  if (!pair.supports?.length || !pair.resistances?.length) return 0;
  
  const currentPrice = parseFloat(pair.currentPrice);
  
  if (type === 'support') {
    const nearestSupport = Math.max(...pair.supports.map(s => s.price));
    return ((currentPrice - nearestSupport) / currentPrice) * 100;
  }
  
  if (type === 'resistance') {
    const nearestResistance = Math.min(...pair.resistances.map(r => r.price));
    return ((nearestResistance - currentPrice) / currentPrice) * 100;
  }
  
  return 0;
};

/**
 * Get recently broken support/resistance levels for dashboard display
 * @param pair Crypto pair object
 * @param type 'support' or 'resistance'
 * @param timeframeDays Number of days to look back (default 7)
 * @returns Array of broken levels with formatted descriptions
 */
export const getRecentBrokenLevels = (
  pair: CryptoPair,
  type: 'support' | 'resistance',
  timeframeDays: number = 7
): Array<{
  pair: string;
  price: number;
  priceAtBreak: number;
  breakTime: number;
  strength: number;
  volumeAtBreak: number;
  description: string;
}> => {
  if (!pair || !pair.brokenLevels) return [];

  const now = Math.floor(Date.now() / 1000);
  const timeframeSeconds = timeframeDays * 24 * 60 * 60;
  const levels = type === 'support' 
    ? pair.brokenLevels.brokenSupports 
    : pair.brokenLevels.brokenResistances;

  return levels
    .filter(level => (now - level.breakTime) <= timeframeSeconds)
    .map(level => ({
      pair: pair.pair,
      price: level.price,
      priceAtBreak: level.priceAtBreak,
      breakTime: level.breakTime,
      strength: level.strength,
      volumeAtBreak: level.volume24hAtBreak,
      description: type === 'support'
        ? `Support at ${formatPrice(level.price)} broken down with ${formatPrice(level.volume24hAtBreak)} volume`
        : `Resistance at ${formatPrice(level.price)} broken up with ${formatPrice(level.volume24hAtBreak)} volume`
    }))
    .sort((a, b) => b.breakTime - a.breakTime);
};

/**
 * Get significant broken levels summary for market overview
 * @param pairs Array of crypto pairs
 * @param timeframeDays Number of days to look back
 * @returns Summary of broken levels across all pairs
 */
export const getBrokenLevelsSummary = (
  pairs: CryptoPair[],
  timeframeDays: number = 7
): {
  recentBrokenSupports: number;
  recentBrokenResistances: number;
  significantBreaks: Array<{
    pair: string;
    type: 'support' | 'resistance';
    price: number;
    strength: number;
    breakTime: number;
    description: string;
  }>;
} => {
  const brokenSupports = pairs.flatMap(pair => 
    getRecentBrokenLevels(pair, 'support', timeframeDays)
      .map(level => ({
        pair: pair.pair,
        type: 'support' as const,
        price: level.price,
        strength: level.strength,
        breakTime: level.breakTime,
        description: level.description
      }))
  );

  const brokenResistances = pairs.flatMap(pair => 
    getRecentBrokenLevels(pair, 'resistance', timeframeDays)
      .map(level => ({
        pair: pair.pair,
        type: 'resistance' as const,
        price: level.price,
        strength: level.strength,
        breakTime: level.breakTime,
        description: level.description
      }))
  );

  // Get most significant breaks (highest strength)
  const significantBreaks = [...brokenSupports, ...brokenResistances]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);

  return {
    recentBrokenSupports: brokenSupports.length,
    recentBrokenResistances: brokenResistances.length,
    significantBreaks
  };
};