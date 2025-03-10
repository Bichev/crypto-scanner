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
 * @returns Support level price
 */
export const getFallbackSupport = (pair: CryptoPair): number => {
  if (!pair) return 0;
  const currentPrice = parseFloat(pair.currentPrice || '0');
  return currentPrice * 0.85;
};

/**
 * Get fallback resistance level when none detected
 * @param pair Crypto pair object
 * @returns Resistance level price
 */
export const getFallbackResistance = (pair: CryptoPair): number => {
  if (!pair) return 0;
  const currentPrice = parseFloat(pair.currentPrice || '0');
  return currentPrice * 1.15;
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