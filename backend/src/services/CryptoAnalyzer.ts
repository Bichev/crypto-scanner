import moment from 'moment-timezone';
import { CandleData, CoinbaseDataFetcher } from './CoinbaseDataFetcher';
import * as ti from 'technicalindicators';
import { CandleModel } from '../models/Candle';

interface CryptoPair {
    dailyPriceChange: string;
    rsi: string;
    macd: string;
    macdTrend: string;
}

export interface IndicatorDescription {
    name: string;
    description: string;
    interpretation: string;
}

interface CacheEntry {
    timestamp: number;
    data: any[];
}

export class CryptoAnalyzer {
    private readonly dataFetcher: CoinbaseDataFetcher;
    private readonly indicatorDescriptions: Record<string, IndicatorDescription>;
    private cache: CacheEntry | null = null;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private readonly API_DELAY = 1000; // 1 second delay between API calls

    constructor() {
        this.dataFetcher = new CoinbaseDataFetcher();
        this.indicatorDescriptions = {
            volumeOscillator: {
                name: "Volume Oscillator",
                description: "Measures the difference between two volume moving averages",
                interpretation: "Positive values suggest increasing volume momentum, negative values suggest decreasing volume momentum"
            },
            rsi: {
                name: "Relative Strength Index (RSI)",
                description: "Momentum oscillator that measures the speed and magnitude of recent price changes",
                interpretation: "Values above 70 indicate overbought conditions, below 30 indicate oversold conditions"
            },
            macd: {
                name: "Moving Average Convergence Divergence (MACD)",
                description: "Trend-following momentum indicator showing the relationship between two moving averages",
                interpretation: "Positive MACD indicates upward momentum, negative indicates downward momentum"
            },
            // Add more indicator descriptions as needed
        };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getIndicatorDescription(indicator: string): IndicatorDescription | null {
        return this.indicatorDescriptions[indicator] || null;
    }

    async analyzePairs(pairs: string[]): Promise<{ pairs: any[]; marketSummary: any }> {
        const startTime = moment();
        const results = [];
        const thirtyDaysAgo = moment().subtract(30, 'days');
        const twoHundredDaysAgo = moment().subtract(200, 'days');
        
        // Process all pairs
        for (const pair of pairs) {
          try {
                // Get data in different time ranges for optimization
                const [recentCandles, longTermCandles] = await Promise.all([
                    // Recent data for most indicators (30 days)
              CandleModel.find({ 
                pair, 
                        timestamp: { $gte: thirtyDaysAgo.unix() } 
              }).sort({ timestamp: 1 }),
              
                    // Long-term data only for 200MA and long-term analysis
              CandleModel.find({ 
                pair, 
                        timestamp: { $gte: twoHundredDaysAgo.unix() } 
              }).sort({ timestamp: 1 }),
            ]);
            
                if (recentCandles.length === 0) {
              console.log(`No data available for ${pair}. Skipping...`);
              continue;
            }
            
            // Calculate USD volume using recent data
            const lastCandle = recentCandles[recentCandles.length - 1];
            const currentVolumeUSD = lastCandle.volume * lastCandle.close;
            
                // Calculate indicators with appropriate data ranges
            const analysis = this.calculateIndicators(
                    // Map candle data
                    longTermCandles.map((c: CandleData) => ({
                timestamp: c.timestamp,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
              })), 
                    recentCandles.map((c: CandleData) => ({
                timestamp: c.timestamp,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
              })),
              pair
            );
                
            // Add pump/dump detection
            const pumpDumpAnalysis = this.detectPumpDump(longTermCandles, recentCandles);
            
            results.push({
              pair,
              currentVolumeUSD: currentVolumeUSD.toFixed(2),
                    ...analysis,
                    isPumping: pumpDumpAnalysis.isPumping,
                    isDumping: pumpDumpAnalysis.isDumping,
                    pumpScore: pumpDumpAnalysis.pumpScore,
                    dumpScore: pumpDumpAnalysis.dumpScore,
                    volumeIncrease: pumpDumpAnalysis.volumeIncrease,
                    priceChange: pumpDumpAnalysis.priceChange,
                    intradayPriceChange: pumpDumpAnalysis.intradayPriceChange,
                    liquidityType: pumpDumpAnalysis.liquidityType,
                    volumeScore: pumpDumpAnalysis.volumeScore,
                    movementType: pumpDumpAnalysis.isPumping ? 
                                (pumpDumpAnalysis.liquidityType === 'Low' ? 'Low Liquidity Pump' : 'Volume Driven Pump') :
                                pumpDumpAnalysis.isDumping ? 
                                (pumpDumpAnalysis.liquidityType === 'Low' ? 'Low Liquidity Dump' : 'Volume Driven Dump') : 
                                'Normal'
            });
          } catch (error) {
            console.error(`Error analyzing ${pair} from database:`, error);
          }
        }
        
        // Calculate market breadth metrics after analyzing all pairs
        const marketBreadth = await this.calculateMarketBreadth(results);

        // Return both individual pair analysis and market breadth
        return {
            pairs: results,
            marketSummary: {
                timestamp: Date.now(),
                totalPairs: results.length,
                totalVolume: results.reduce((sum, p) => {
                    const volume = parseFloat(p.currentVolumeUSD);
                    return sum + (isNaN(volume) ? 0 : volume);
                }, 0),
                trendDistribution: {
                    strongUptrend: results.filter(p => p.macdTrend === 'Strong Uptrend').length,
                    weakUptrend: results.filter(p => p.macdTrend === 'Weak Uptrend').length,
                    neutral: results.filter(p => !p.macdTrend || p.macdTrend === 'Neutral').length,
                    weakDowntrend: results.filter(p => p.macdTrend === 'Weak Downtrend').length,
                    strongDowntrend: results.filter(p => p.macdTrend === 'Strong Downtrend').length
                },
                rsiDistribution: {
                    overbought: results.filter(p => parseFloat(p.rsi) > 70).length,
                    neutral: results.filter(p => parseFloat(p.rsi) >= 30 && parseFloat(p.rsi) <= 70).length,
                    oversold: results.filter(p => parseFloat(p.rsi) < 30).length
                },
                volumeChange: this.calculateTotalVolumeChange(results),
                topGainers: results
                    .sort((a, b) => parseFloat(b.dailyPriceChange) - parseFloat(a.dailyPriceChange))
                    .slice(0, 5)
                    .map(p => ({ pair: p.pair, change: p.dailyPriceChange })),
                topLosers: results
                    .sort((a, b) => parseFloat(a.dailyPriceChange) - parseFloat(b.dailyPriceChange))
                    .slice(0, 5)
                    .map(p => ({ pair: p.pair, change: p.dailyPriceChange })),
                marketSentiment: marketBreadth.marketSentiment,
                marketBreadth: {
                    advances: marketBreadth.advances,
                    declines: marketBreadth.declines,
                    averageRSI: marketBreadth.averageRSI,
                    advanceDeclineRatio: marketBreadth.advanceDeclineRatio,
                    percentStrongUptrend: marketBreadth.percentStrongUptrend,
                    percentStrongDowntrend: marketBreadth.percentStrongDowntrend,
                    averageMACD: marketBreadth.averageMACD
                }
            }
        };
    }

    private calculateTotalVolumeChange(pairs: any[]): number {
        // Calculate total current volume in USD
        const totalCurrentVolume = pairs.reduce((sum, p) => {
            const volume = parseFloat(p.currentVolumeUSD);
            return sum + (isNaN(volume) ? 0 : volume);
        }, 0);

        // Calculate total previous volume using 7-day moving average (also in USD)
        const totalPrevVolume = pairs.reduce((sum, p) => {
            const vma7 = parseFloat(p.vma_7); // This is already in USD from calculateIndicators
            return sum + (isNaN(vma7) ? 0 : vma7);
        }, 0);
        
        console.log('totalCurrentVolume USD:', totalCurrentVolume);
        console.log('totalPrevVolume USD:', totalPrevVolume);
        
        // Calculate percentage change
        if (totalCurrentVolume > 0 && totalPrevVolume > 0) {
            const change = ((totalCurrentVolume - totalPrevVolume) / totalPrevVolume) * 100;
            // Round to 2 decimal places
            return Math.round(change * 100) / 100;
        }
        
        return 0;
    }

    private calculateFibonacciLevels(high: number, low: number): { level: number; price: number }[] {
        const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const range = high - low;
        
        return fibLevels.map(level => ({
            level,
            price: high - (range * level)
        }));
    }

    private findSupportResistanceLevels(candles: CandleData[], pair: string, lookbackPeriod: number = 180): {
        supports: Array<{ price: number; strength: number; description?: string }>;
        resistances: Array<{ price: number; strength: number; description?: string }>;
        nearestSupport: number;
        nearestResistance: number;
    } {
        const recentCandles = candles.slice(-lookbackPeriod);
        const currentPrice = candles[candles.length - 1].close;
        const currentTimestamp = Date.now() / 1000;
        
        // Prepare price points with volume in USD terms
        const pricePoints = recentCandles.map(c => ({
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume * c.close, // Convert volume to USD
            timestamp: c.timestamp
        }));
    
        // Calculate average true range for adaptive threshold
        const atr = ti.ATR.calculate({
            high: recentCandles.map(c => c.high),
            low: recentCandles.map(c => c.low),
            close: recentCandles.map(c => c.close),
            period: 14
        });
        const currentATR = atr[atr.length - 1];
        
        // Use ATR-based threshold for grouping similar price levels (adjusted for BTCUSD vs small altcoins)
        // For very low-priced assets (like GYEN), we need a slightly different approach
        let priceThreshold: number;
        if (currentPrice < 0.01) {
            // For very low-priced assets, use percentage-based threshold
            priceThreshold = currentPrice * 0.01; // 1% of current price
        } else {
            // Otherwise use ATR-based threshold
            priceThreshold = currentATR * 0.5;
        }
    
        // Check if level aligns with significant psychological levels or round numbers
        const isSignificantLevel = (price: number): number => {
            // Handle different ranges based on price magnitude
            const priceLog = Math.floor(Math.log10(price));
            const priceMagnitude = Math.pow(10, priceLog);
            
            // For very low-priced assets like GYEN
            if (price < 0.01) {
                if (price % 0.001 === 0) return 0.3; // 0.001, 0.002, etc.
                if (price % 0.0001 === 0) return 0.2; // 0.0001, 0.0002, etc.
                return 0;
            }
            
            // For normal price ranges
            if (price % priceMagnitude === 0) return 0.3; // Major round number (e.g., 10000, 1000)
            if (price % (priceMagnitude / 2) === 0) return 0.2; // Half round number (e.g., 5000, 500)
            if (price % (priceMagnitude / 10) === 0) return 0.1; // Minor round number (e.g., 1000, 100)
            
            return 0;
        };
        
        // Group similar price levels
        const levels = new Map<number, { 
            count: number; 
            volumeUSD: number;
            touches: Array<{ 
                price: number; 
                volumeUSD: number; 
                timestamp: number;
                behavior: 'support' | 'resistance' | 'unknown';
                rejectionStrength: number; // Added: measure the strength of rejections
            }> 
        }>();
    
        // Helper function to determine if a price level acted as support or resistance
        const determineBehavior = (price: number, index: number): { 
            behavior: 'support' | 'resistance' | 'unknown'; 
            rejectionStrength: number;
        } => {
            if (index <= 0 || index >= pricePoints.length - 1) return { behavior: 'unknown', rejectionStrength: 0 };
            
            const prevCandle = pricePoints[index - 1];
            const currentCandle = pricePoints[index];
            const nextCandle = pricePoints[index + 1];
            
            // Look ahead a few candles to measure rejection strength
            const futureCandles = pricePoints.slice(index + 1, Math.min(index + 6, pricePoints.length));
            
            // Calculate price movement percentages
            const preTouchMove = (price - prevCandle.low) / prevCandle.low;
            const postTouchMove = (nextCandle.close - price) / price;
            
            // Measure rejection strength by looking at post-touch movement
            let rejectionStrength = 0;
            
            // Check for support behavior
            if (Math.abs(currentCandle.low - price) < priceThreshold) {
                if (preTouchMove < 0 && postTouchMove > 0) {
                    // Measure the strength of bounce (upward movement after touching support)
                    // Calculate average movement over next few candles
                    let avgUpMove = 0;
                    if (futureCandles.length > 0) {
                        const maxFuturePrice = Math.max(...futureCandles.map(c => c.high));
                        avgUpMove = (maxFuturePrice - price) / price;
                        rejectionStrength = Math.min(1, avgUpMove / (currentATR / price)); // Normalize by ATR
                    }
                    
                    return { behavior: 'support', rejectionStrength };
                }
            }
            
            // Check for resistance behavior
            if (Math.abs(currentCandle.high - price) < priceThreshold) {
                if (preTouchMove > 0 && postTouchMove < 0) {
                    // Measure the strength of bounce (downward movement after touching resistance)
                    let avgDownMove = 0;
                    if (futureCandles.length > 0) {
                        const minFuturePrice = Math.min(...futureCandles.map(c => c.low));
                        avgDownMove = (price - minFuturePrice) / price;
                        rejectionStrength = Math.min(1, avgDownMove / (currentATR / price)); // Normalize by ATR
                    }
                    
                    return { behavior: 'resistance', rejectionStrength };
                }
            }
            
            return { behavior: 'unknown', rejectionStrength: 0 };
        };
    
        // Analyze each price point
        pricePoints.forEach((point, index) => {
            [point.high, point.low].forEach(price => {
                let found = false;
                for (const [level, data] of levels) {
                    if (Math.abs(price - level) <= priceThreshold) {
                        // Update existing level with volume-weighted average
                        const newLevel = (level * data.volumeUSD + price * point.volume) / (data.volumeUSD + point.volume);
                        const { behavior, rejectionStrength } = determineBehavior(price, index);
                        levels.set(newLevel, {
                            count: data.count + 1,
                            volumeUSD: data.volumeUSD + point.volume,
                            touches: [...data.touches, { 
                                price, 
                                volumeUSD: point.volume, 
                                timestamp: point.timestamp,
                                behavior,
                                rejectionStrength
                            }]
                        });
                        levels.delete(level);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    const { behavior, rejectionStrength } = determineBehavior(price, index);
                    levels.set(price, { 
                        count: 1, 
                        volumeUSD: point.volume,
                        touches: [{ 
                            price, 
                            volumeUSD: point.volume, 
                            timestamp: point.timestamp,
                            behavior,
                            rejectionStrength
                        }]
                    });
                }
            });
        });
    
        const averageVolumeUSD = pricePoints.reduce((sum, point) => sum + point.volume, 0) / pricePoints.length;
    
        // Calculate strength with enhanced metrics
        const calculateEnhancedStrength = (levelData: { 
            count: number; 
            volumeUSD: number; 
            touches: Array<{ 
                price: number; 
                volumeUSD: number; 
                timestamp: number; 
                behavior: string;
                rejectionStrength: number;
            }> 
        }): { 
            strength: number; 
            type: 'support' | 'resistance';
            behaviorScore: number; // Added: normalized score from -1 (resistance) to +1 (support)
            description?: string;
        } => {
            if (!levelData) return { strength: 0, type: 'support', behaviorScore: 0 };
    
            // Enhanced volume strength with USD normalization (25%)
            const volumeStrength = Math.min(1, Math.sqrt(levelData.volumeUSD / (averageVolumeUSD * levelData.count)));
            
            // Touch count strength (20%)
            const touchesStrength = Math.min(1, levelData.count / 5);
            
            // Enhanced recency with exponential time decay (20%)
            const timeDecayTouches = levelData.touches.map(touch => {
                const ageInDays = (currentTimestamp - touch.timestamp) / (24 * 60 * 60);
                const decayFactor = Math.exp(-0.1 * ageInDays); // Exponential decay
                return {
                    ...touch,
                    weight: decayFactor
                };
            });
            
            const recencyScore = timeDecayTouches.reduce((sum, touch) => sum + touch.weight, 0) / 
                                Math.max(1, timeDecayTouches.length);
            
            // Behavior consistency and quality (25%)
            const supportCount = levelData.touches.filter(t => t.behavior === 'support').length;
            const resistanceCount = levelData.touches.filter(t => t.behavior === 'resistance').length;
            const type = supportCount > resistanceCount ? 'support' : 'resistance';
            
            // Calculate rejection quality - how strong were the bounces?
            const avgRejectionStrength = levelData.touches.reduce((sum, touch) => 
                sum + (touch.rejectionStrength || 0), 0) / Math.max(1, levelData.touches.length);
            
            // Normalized behavior score from -1 (pure resistance) to +1 (pure support)
            const behaviorScore = (supportCount - resistanceCount) / Math.max(1, supportCount + resistanceCount);
            
            // Psychological level bonus (10%)
            const psychologicalBonus = isSignificantLevel(levelData.touches[0].price);
            
            // Combined strength calculation
            const strength = Math.min(1, (
                volumeStrength * 0.25 + 
                touchesStrength * 0.20 + 
                recencyScore * 0.20 +
                avgRejectionStrength * 0.25 +
                psychologicalBonus * 0.10
            ));
            
            // Generate descriptive text for the level
            let description = '';
            if (strength >= 0.75) {
                description = `Strong ${type} with ${levelData.count} touches`;
                if (psychologicalBonus > 0) description += ', psychological level';
                if (recencyScore > 0.7) description += ', recent activity';
            } else if (strength >= 0.5) {
                description = `Moderate ${type} level`;
                if (psychologicalBonus > 0) description += ', psychological importance';
            } else {
                description = `Weak ${type} level, needs confirmation`;
            }
            
            return { strength, type, behaviorScore, description };
        };
    
        // Filter and sort levels
        const significantLevels = Array.from(levels.entries())
            .filter(([_, data]) => data.count >= 2)
            .map(([price, data]) => {
                const { strength, type, behaviorScore, description } = calculateEnhancedStrength(data);
                return { price, strength, type, behaviorScore, description };
            })
            .filter(level => level.strength > 0.15)
            .sort((a, b) => b.strength - a.strength);
    
        // Special handling for assets with tight trading ranges (like GYEN)
        const isTightRangeAsset = currentPrice < 0.01 || (currentATR / currentPrice) < 0.01;
   
        // Improved classification with buffer zone and behavioral score
        let supports = significantLevels
            .filter(level => {
                // For tight-range assets, be more lenient with classification
                if (isTightRangeAsset) {
                    return level.behaviorScore > 0 || level.price <= currentPrice;
                } else {
                    return level.price < currentPrice || 
                        (level.behaviorScore > 0.3 && level.price < currentPrice * 1.05);
                }
            })
            .map(level => ({
                price: level.price,
                strength: Math.round(level.strength * 100),
                description: level.description
            }))
            .sort((a, b) => b.price - a.price) // Sort from highest to lowest
            .slice(0, 3); // Take top 3
    
        let resistances = significantLevels
            .filter(level => {
                // For tight-range assets, be more lenient with classification
                if (isTightRangeAsset) {
                    return level.behaviorScore < 0 || level.price >= currentPrice;
                } else {
                    return level.price > currentPrice || 
                          (level.behaviorScore < -0.3 && level.price > currentPrice * 0.95);
                }
            })
            .map(level => ({
                price: level.price,
                strength: Math.round(level.strength * 100),
                description: level.description
            }))
            .sort((a, b) => a.price - b.price) // Sort from lowest to highest
            .slice(0, 3); // Take top 3

            // For tight trading ranges, make sure levels make sense (e.g., all supports below all resistances)
        if (isTightRangeAsset) {
            // Fix overlapping levels by classifying them based on position to current price
            const allLevels = [...significantLevels].sort((a, b) => a.price - b.price);
            
            // For close trading pairs like GYEN, separate levels by their relation to current price
            const belowLevels = allLevels.filter(level => level.price < currentPrice);
            const aboveLevels = allLevels.filter(level => level.price > currentPrice);
            const atLevels = allLevels.filter(level => Math.abs(level.price - currentPrice) / currentPrice < 0.005);
            
            // Re-classify levels
            if (belowLevels.length > 0 && aboveLevels.length > 0) {
                // We have both below and above levels, so classify normally
                supports = belowLevels
                    .map(level => ({
                        price: level.price,
                        strength: Math.round(level.strength * 100),
                        description: level.description
                    }))
                    .sort((a, b) => b.price - a.price)
                    .slice(0, 3);
                    
                resistances = aboveLevels
                    .map(level => ({
                        price: level.price,
                        strength: Math.round(level.strength * 100),
                        description: level.description
                    }))
                    .sort((a, b) => a.price - b.price)
                    .slice(0, 3);
            } else if (allLevels.length > 0) {
                // We have only levels on one side of current price
                // In this case, use the nearest levels on either side of current price
                const middleIndex = Math.floor(allLevels.length / 2);
                
                supports = allLevels.slice(0, middleIndex)
                    .map(level => ({
                        price: level.price,
                        strength: Math.round(level.strength * 100),
                        description: `${level.description} (price classification)`
                    }))
                    .sort((a, b) => b.price - a.price)
                    .slice(0, 3);
                    
                resistances = allLevels.slice(middleIndex)
                    .map(level => ({
                        price: level.price,
                        strength: Math.round(level.strength * 100),
                        description: `${level.description} (price classification)`
                    }))
                    .sort((a, b) => a.price - b.price)
                    .slice(0, 3);
            }
        
            // If we have a current price level, mark it as both support and resistance
            if (atLevels.length > 0) {
                const currentLevel = atLevels[0];
                if (supports.length < 3) {
                    supports.push({
                        price: currentLevel.price,
                        strength: Math.round(currentLevel.strength * 100),
                        description: "Current price level"
                    });
                }
                if (resistances.length < 3) {
                    resistances.push({
                        price: currentLevel.price,
                        strength: Math.round(currentLevel.strength * 100),
                        description: "Current price level"
                    });
                }
            }  
        }
    
        // Find nearest levels with fallbacks
        let nearestSupport = currentPrice * 0.85; // Default fallback
        if (supports.length > 0) {
            nearestSupport = supports.reduce((prev, curr) => 
                Math.abs(curr.price - currentPrice) < Math.abs(prev.price - currentPrice) ? curr : prev
            ).price;
        }
    
        let nearestResistance = currentPrice * 1.15; // Default fallback
        if (resistances.length > 0) {
            nearestResistance = resistances.reduce((prev, curr) => 
                Math.abs(curr.price - currentPrice) < Math.abs(prev.price - currentPrice) ? curr : prev
            ).price;
        }
    
        return {
            supports,
            resistances,
            nearestSupport,
            nearestResistance
        };
    }   

    private calculatePriceLevels(candles: CandleData[], pair: string): {
        fibonacci: { level: number; price: number }[];
        supports: Array<{ price: number; strength: number }>;
        resistances: Array<{ price: number; strength: number }>;
        nearestSupport: number;
        nearestResistance: number;
        distanceToSupport: number;
        distanceToResistance: number;
        priceChannelWidth: number;
    } {
        const currentPrice = candles[candles.length - 1].close;
        const high = Math.max(...candles.map(c => c.high));
        const low = Math.min(...candles.map(c => c.low));

        // Calculate Fibonacci levels from the high to low
        const fibLevels = this.calculateFibonacciLevels(high, low);

        // Find support and resistance levels
        const { supports, resistances, nearestSupport, nearestResistance } = 
            this.findSupportResistanceLevels(candles, pair);

        // Calculate distances as percentages
        const distanceToSupport = ((currentPrice - nearestSupport) / currentPrice) * 100;
        const distanceToResistance = ((nearestResistance - currentPrice) / currentPrice) * 100;
        
        // Calculate price channel width as percentage of current price
        const priceChannelWidth = ((nearestResistance - nearestSupport) / currentPrice) * 100;

        return {
            fibonacci: fibLevels,
            supports,
            resistances,
            nearestSupport,
            nearestResistance,
            distanceToSupport,
            distanceToResistance,
            priceChannelWidth
        };
    }

    private calculateIndicators(longTermCandles: CandleData[], recentCandles: CandleData[], pair: string) {
        const safeToFixed = (value: any, decimals: number): string => {
            if (value === undefined || value === null || isNaN(value)) {
                return "0";
            }
            return value.toFixed(decimals);
        };

        // Use recent data for most calculations
        const recentClosePrices = recentCandles.map(candle => candle.close);
        const recentVolumes = recentCandles.map(candle => candle.volume);
        const recentHighs = recentCandles.map(candle => candle.high);
        const recentLows = recentCandles.map(candle => candle.low);
        const currentPrice = recentClosePrices[recentClosePrices.length - 1];

        // Use long-term data only for specific indicators
        const longTermClosePrices = longTermCandles.map(candle => candle.close);
        const allTimeHigh = Math.max(...longTermClosePrices);
        const allTimeLow = Math.min(...longTermClosePrices);

        // Calculate RSI (14 days)
        const rsi = ti.RSI.calculate({
            values: recentClosePrices,
            period: 14
        });

        // Calculate MACD (26 days max)
        type MACDResult = {
            MACD?: number;
            signal?: number;
            histogram?: number;
        };
        
        let macd: MACDResult[] = [];
        if (longTermClosePrices.length >= 35) { // Minimum required periods: 26 + 9
            macd = ti.MACD.calculate({
                values: longTermClosePrices,  // Use long-term data for MACD
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
            });
            // console.log('MACD calculation successful:', { 
            //     dataPoints: longTermClosePrices.length,
            //     macdLength: macd.length,
            //     lastMACD: macd[macd.length - 1] 
            // });
        } else {
            console.log('Insufficient data for MACD calculation for pair: ', pair, {
                requiredPoints: 35,
                availablePoints: longTermClosePrices.length
            });
        }

        // Calculate recent moving averages
        const sma7 = ti.SMA.calculate({ values: recentClosePrices, period: 7 });
        const sma30 = ti.SMA.calculate({ values: recentClosePrices, period: 30 });
        
        // Calculate long-term moving averages
        const sma50 = ti.SMA.calculate({ values: longTermClosePrices, period: 50 });
        const sma200 = ti.SMA.calculate({ values: longTermClosePrices, period: 200 });

        // Calculate price levels
        const priceLevels = this.calculatePriceLevels(recentCandles, pair);

        // Calculate Stochastic Oscillator
        const stoch = ti.Stochastic.calculate({
            high: recentHighs,
            low: recentLows,
            close: recentClosePrices,
            period: 14,
            signalPeriod: 3
        });

        // Calculate Williams %R
        const williamsr = ti.WilliamsR.calculate({
            high: recentHighs,
            low: recentLows,
            close: recentClosePrices,
            period: 14
        });

        // Calculate CCI
        const cci = ti.CCI.calculate({
            high: recentHighs,
            low: recentLows,
            close: recentClosePrices,
            period: 20
        });

        // Calculate MFI
        const mfi = ti.MFI.calculate({
            high: recentHighs,
            low: recentLows,
            close: recentClosePrices,
            volume: recentVolumes,
            period: 14
        });

        // Calculate ADX
        const adxResult = ti.ADX.calculate({
            high: recentHighs,
            low: recentLows,
            close: recentClosePrices,
            period: 14
        });

        // Get latest values
        const latestStoch = stoch[stoch.length - 1] || { k: 50, d: 50 };
        const latestWilliamsR = williamsr[williamsr.length - 1] || 0;
        const latestCCI = cci[cci.length - 1] || 0;
        const latestMFI = mfi[mfi.length - 1] || 50;
        const latestADX = adxResult[adxResult.length - 1] || { adx: 0, pdi: 0, mdi: 0 };

        // Calculate trend strength based on ADX components
        const trendStrength = this.calculateTrendStrength({
            adx: latestADX.adx || 0,
            plusDI: latestADX.pdi || 0,
            minusDI: latestADX.mdi || 0
        });

        // Calculate moving averages
        const ema7 = ti.EMA.calculate({ values: recentClosePrices, period: 7 });
        const ema30 = ti.EMA.calculate({ values: recentClosePrices, period: 30 });
        const ema50 = ti.EMA.calculate({ values: recentClosePrices, period: 50 });
        const ema200 = ti.EMA.calculate({ values: recentClosePrices, period: 200 });
        
        // Calculate Bollinger Bands using the enhanced method
        const bollingerBands = this.calculateBollingerBands(recentClosePrices);

        // Calculate ATR (Average True Range)
        const atr = ti.ATR.calculate({
            high: recentHighs,
            low: recentLows,
            close: recentClosePrices,
            period: 14
        });

        // Calculate Stochastic RSI
        const stochRsi = ti.StochasticRSI.calculate({
            values: recentClosePrices,
            rsiPeriod: 14,
            stochasticPeriod: 14,
            kPeriod: 3,
            dPeriod: 3
        });

        // Calculate ROC (Rate of Change)
        const roc = ti.ROC.calculate({
            values: recentClosePrices,
            period: 14
        });

        // Volume analysis
        const recentVolumeUSD = recentCandles.map(candle => candle.volume * candle.close);
        const vma7 = ti.SMA.calculate({ values: recentVolumeUSD, period: 7 });
        const vma30 = ti.SMA.calculate({ values: recentVolumeUSD, period: 30 });
        const obv = ti.OBV.calculate({
            close: recentClosePrices,
            volume: recentVolumes
        });

        // Get latest values
        const latestMACD = macd[macd.length - 1] || { MACD: 0, signal: 0, histogram: 0 };
        const latestStochRSI = stochRsi[stochRsi.length - 1] || { k: 50, d: 50 };
        const latestROC = roc[roc.length - 1] || 0;
        const latestATR = atr[atr.length - 1] || 0;
        const volumeOscillator = ((vma7[vma7.length - 1] - vma30[vma30.length - 1]) / vma30[vma30.length - 1]) * 100;

        // Calculate historical highs and lows
        const percentFromHigh = ((currentPrice - allTimeHigh) / allTimeHigh) * 100;
        const percentFromLow = ((currentPrice - allTimeLow) / allTimeLow) * 100;

        // Calculate volatility
        const volatility = this.calculateVolatility(recentClosePrices, 14);
        
        // Calculate momentum
        const momentum = this.calculateMomentum(recentClosePrices, 14);

        // Calculate three-month change
        const threeMonthStartPrice = longTermCandles[0]?.close || currentPrice;
        const threeMonthChange = ((currentPrice - threeMonthStartPrice) / threeMonthStartPrice) * 100;

        // Calculate scores
        const shortTermScore = this.calculateShortTermScore(
            rsi[rsi.length - 1], 
            latestMACD, 
            sma7[sma7.length - 1], 
            sma30[sma30.length - 1],
            latestStochRSI,
            momentum
        );

        const longTermScore = this.calculateLongTermScore(
            sma50[sma50.length - 1], 
            sma200[sma200.length - 1], 
            percentFromHigh, 
            percentFromLow,
            latestADX.adx || 0
        );

        const riskAdjustedScore = this.calculateRiskAdjustedScore(
            shortTermScore,
            longTermScore,
            volatility,
            latestATR
        );

        // New indicators
        const ichimoku = this.calculateIchimoku(recentHighs, recentLows, recentClosePrices);
        const stochastic = this.calculateStochastic(recentHighs, recentLows, recentClosePrices);
        const advancedATR = this.calculateATR(recentHighs, recentLows, recentClosePrices);
        const supportResistance = this.calculateSupportResistance(recentClosePrices);
        // Make sure all the inputs to calculateAdvancedTrend have values
        const advancedTrend = macd && macd.length > 0 && rsi && rsi.length > 0 
        ? this.calculateAdvancedTrend(
            recentClosePrices, 
            macd, 
            rsi, 
            ema50,
            ema200
            )
        : 'Insufficient Data';
        const volatilityIndex = this.calculateVolatilityIndex(
            recentClosePrices,
            ti.ATR.calculate({ high: recentHighs, low: recentLows, close: recentClosePrices, period: 14 })
        );
        
        // Enhanced scores
        const enhancedScore = this.calculateEnhancedCompositeScore({
            rsi: rsi[rsi.length - 1],
            macdTrend: this.calculateMACDTrend(macd),
            volumeOscillator: ((vma7[vma7.length - 1] - vma30[vma30.length - 1]) / vma30[vma30.length - 1]) * 100,
            dailyPriceChange: this.calculateDailyPriceChange(recentCandles),
            sma_7: sma7[sma7.length - 1],
            sma_30: sma30[sma30.length - 1],
            sma_50: sma50[sma50.length - 1],
            sma_200: sma200[sma200.length - 1],
            atr: advancedATR.normalizedATR,
            percentChangeFromHigh: ((currentPrice - allTimeHigh) / allTimeHigh) * 100
        });

        return {
            currentPrice: currentPrice.toFixed(8),
            dailyPriceChange: this.calculateDailyPriceChange(recentCandles),
            percentChangeFromHigh: percentFromHigh.toFixed(2),
            percentChangeFromLow: percentFromLow.toFixed(2),
            percentChangeLastThreeMonths: threeMonthChange.toFixed(2),
            
            // Volume indicators
            vma_7: vma7[vma7.length - 1]?.toFixed(2),
            vma_30: vma30[vma30.length - 1]?.toFixed(2),
            volumeOscillator: volumeOscillator.toFixed(2),
            obv: obv[obv.length - 1]?.toString(),
            obvChange: ((obv[obv.length - 1] - obv[obv.length - 2]) / obv[obv.length - 2] * 100).toFixed(2),
            
            // RSI indicators
            rsi: rsi[rsi.length - 1]?.toFixed(2),
            rsiDivergence: this.calculateRSIDivergence(recentClosePrices, rsi, 14),
            stoch_k: latestStoch.k?.toFixed(2),
            stoch_d: latestStoch.d?.toFixed(2),
            stochRsi_k: latestStochRSI.k?.toFixed(2),
            stochRsi_d: latestStochRSI.d?.toFixed(2),
            
            // MACD
            macd: latestMACD?.MACD?.toFixed(8) ?? "0.00000000",
            signalLine: latestMACD?.signal?.toFixed(8) ?? "0.00000000",
            histogram: latestMACD?.histogram?.toFixed(8) ?? "0.00000000",
            macdTrend: this.calculateMACDTrend(macd),
            macdCrossover: this.calculateMACDCrossover(macd),
            
            // Moving averages
            sma_7: sma7[sma7.length - 1]?.toFixed(8),
            sma_30: sma30[sma30.length - 1]?.toFixed(8),
            sma_50: sma50[sma50.length - 1]?.toFixed(8),
            sma_200: sma200[sma200.length - 1]?.toFixed(8),
            ema_7: ema7[ema7.length - 1]?.toFixed(8),
            ema_30: ema30[ema30.length - 1]?.toFixed(8),
            ema_50: ema50[ema50.length - 1]?.toFixed(8),
            ema_200: ema200[ema200.length - 1]?.toFixed(8),
            
            // Bollinger Bands
            bb_middle: bollingerBands.middle?.toFixed(8),
            bb_upper: bollingerBands.upper?.toFixed(8),
            bb_lower: bollingerBands.lower?.toFixed(8),
            bb_width: ((bollingerBands.upper - bollingerBands.lower) / bollingerBands.middle * 100).toFixed(2),
            
            // Additional technical indicators
            atr: latestATR?.toFixed(8),
            roc: latestROC?.toFixed(2),
            williamsR: latestWilliamsR?.toFixed(2),
            cci: latestCCI?.toFixed(2),
            mfi: latestMFI?.toFixed(2),
            adx: latestADX?.adx?.toFixed(2),
            plusDI: latestADX?.pdi?.toFixed(2),
            minusDI: latestADX?.mdi?.toFixed(2),
            trendStrength: trendStrength,
            volatility: volatility.toFixed(2),
            momentum: momentum.toFixed(2),
            
            // Price levels analysis
            ...priceLevels,
            pricePositionAnalysis: {
                bbPosition: this.calculatePricePositionContext(currentPrice, {
                    bbUpper: bollingerBands.upper,
                    bbLower: bollingerBands.lower,
                    bbMiddle: bollingerBands.middle,
                    support: priceLevels.nearestSupport,
                    resistance: priceLevels.nearestResistance
                }),
                channelPosition: ((currentPrice - priceLevels.nearestSupport) / 
                    (priceLevels.nearestResistance - priceLevels.nearestSupport) * 100).toFixed(2) + '%'
            },
            // Trend signals
            maShortTrend: this.calculateMATrend(sma7, sma30),
            maLongTrend: this.calculateMATrend(sma50, sma200),

                    // New indicators
            // If the error is on a Bollinger Bands property
            bollingerBands: {
                upper: safeToFixed(bollingerBands.upper, 8),
                middle: safeToFixed(bollingerBands.middle, 8),
                lower: safeToFixed(bollingerBands.lower, 8),
                bandwidth: safeToFixed(bollingerBands.bandwidth, 2),
                percentB: safeToFixed(bollingerBands.percentB, 2),
                signal: bollingerBands.signal || 'Unknown'
            },
            
            // If the error is on an ichimoku property
            ichimoku: {
                tenkan: ichimoku.tenkan !== undefined ? safeToFixed(ichimoku.tenkan, 8) : null,
                kijun: ichimoku.kijun !== undefined ? safeToFixed(ichimoku.kijun, 8) : null,
                senkouA: ichimoku.senkouA !== undefined ? safeToFixed(ichimoku.senkouA, 8) : null,
                senkouB: ichimoku.senkouB !== undefined ? safeToFixed(ichimoku.senkouB, 8) : null,
                cloudSignal: ichimoku.cloudSignal || 'Unknown',
                tkCross: ichimoku.tkCross || 'None'
            },
            stochastic: {
                k: stochastic.k?.toFixed(2),
                d: stochastic.d?.toFixed(2),
                signal: stochastic.signal
            },

            atrAnalysis: {
                atr: advancedATR.atr?.toFixed(8),
                normalizedATR: advancedATR.normalizedATR?.toFixed(2),
                volatility: advancedATR.volatility
            },
            supportResistance: {
                supports: supportResistance.filter((level: any) => level.type === 'support').slice(0, 3),
                resistances: supportResistance.filter((level: any) => level.type === 'resistance').slice(0, 3)
            },
            volatilityIndex: {
                value: volatilityIndex.volatilityIndex?.toFixed(2),
                trend: volatilityIndex.trend
            },
            advancedTrend: advancedTrend,
            
            // Composite scores
            shortTermScore: shortTermScore.toFixed(2),
            longTermScore: longTermScore.toFixed(2),
            riskAdjustedScore: riskAdjustedScore.toFixed(2),
            enhancedScore: enhancedScore.toFixed(2)
        };
    }

    private calculateVolatility(prices: number[], period: number): number {
        // Calculate standard deviation of price changes
        const changes = prices.slice(1).map((price, i) => 
            ((price - prices[i]) / prices[i]) * 100
        );
        
        // Use the library's SD (Standard Deviation) indicator
        return ti.SD.calculate({
            period: period,
            values: changes
        })[0] || 0;
    }

    private calculateMomentum(prices: number[], period: number): number {
        return ti.ROC.calculate({
            values: prices,
            period: period
        })[0] || 0;
    }

    private calculateMATrend(shortMA: number[], longMA: number[]): string {
        const short = shortMA[shortMA.length - 1];
        const long = longMA[longMA.length - 1];
        const diff = ((short - long) / long) * 100;
        
        if (diff > 2) return 'Strong Uptrend';
        if (diff > 0.5) return 'Weak Uptrend';
        if (diff < -2) return 'Strong Downtrend';
        if (diff < -0.5) return 'Weak Downtrend';
        return 'Neutral';
    }

    private calculatePricePosition(price: number, bb: any): string {
        if (price > bb.upper) return 'Overbought';
        if (price < bb.lower) return 'Oversold';
        if (price > bb.middle) return 'Above Middle';
        if (price < bb.middle) return 'Below Middle';
        return 'At Middle';
    }

    private calculateShortTermScore(
        rsi: number, 
        macd: any, 
        sma7: number, 
        sma30: number,
        stochRSI: any,
        momentum: number
    ): number {
        let score = 0.5;

        // RSI component (0.2 weight)
        if (rsi > 70) score -= 0.1;
        else if (rsi < 30) score += 0.1;
        else score += 0.1 * ((rsi - 30) / 40 - 0.5);

        // MACD component (0.2 weight)
        if (macd.histogram > 0) score += 0.1;
        if (macd.histogram < 0) score -= 0.1;

        // Short-term MA component (0.2 weight)
        if (sma7 > sma30) score += 0.1;
        if (sma7 < sma30) score -= 0.1;

        // StochRSI component (0.2 weight)
        if (stochRSI.k > 80) score -= 0.1;
        else if (stochRSI.k < 20) score += 0.1;

        // Momentum component (0.2 weight)
        if (momentum > 0) score += 0.1 * Math.min(momentum / 10, 1);
        if (momentum < 0) score -= 0.1 * Math.min(Math.abs(momentum) / 10, 1);

        return Math.max(0, Math.min(1, score));
    }

    private calculateLongTermScore(
        sma50: number, 
        sma200: number, 
        percentFromHigh: number, 
        percentFromLow: number,
        adx: number
    ): number {
        let score = 0.5;

        // Long-term MA component (0.3 weight)
        if (sma50 > sma200) score += 0.15;
        if (sma50 < sma200) score -= 0.15;

        // Historical price levels component (0.4 weight)
        const pricePositionScore = (Math.abs(percentFromLow) - Math.abs(percentFromHigh)) / 
            (Math.abs(percentFromLow) + Math.abs(percentFromHigh));
        score += 0.2 * pricePositionScore;

        // Trend strength component (0.3 weight)
        if (adx > 50) score += 0.15;
        else if (adx > 25) score += 0.1;
        else if (adx < 20) score -= 0.1;

        return Math.max(0, Math.min(1, score));
    }

    private calculateRiskAdjustedScore(
        shortTermScore: number,
        longTermScore: number,
        volatility: number,
        atr: number
    ): number {
        const baseScore = (shortTermScore + longTermScore) / 2;
        const volatilityFactor = Math.max(0, 1 - (volatility / 100));
        const atrFactor = Math.max(0, 1 - (atr / 100));
        
        return baseScore * (volatilityFactor + atrFactor) / 2;
    }

    private calculateDailyPriceChange(candles: CandleData[]): string {
        if (candles.length < 2) return "0.00";
        // Since candles are in chronological order (oldest to newest)
        const latest = candles[candles.length - 1];
        const previous = candles[candles.length - 2];
        const change = ((latest.close - previous.close) / previous.close) * 100;
        return change.toFixed(2);
    }

    private calculateMACDTrend(macdData: any[]): string {
        if (!macdData || macdData.length < 2) {
            // console.log('Invalid MACD data:', { macdData });
            return 'Neutral';
        }
        
        const current = macdData[macdData.length - 1];
        const previous = macdData[macdData.length - 2];
        
        if (!current || !previous) {
            console.log('Missing current or previous MACD data:', { current, previous });
            return 'Neutral';
        }

        const macdChange = current.MACD - previous.MACD;
        const signalChange = current.signal - previous.signal;
        const histogram = current.histogram;
        const macdAboveSignal = current.MACD > current.signal;
        const prevMacdAboveSignal = previous.MACD > previous.signal;

        // Detect crossovers
        const bullishCrossover = !prevMacdAboveSignal && macdAboveSignal;
        const bearishCrossover = prevMacdAboveSignal && !macdAboveSignal;

        // Strong trend conditions
        if (macdAboveSignal && histogram > 0 && macdChange > 0 && signalChange > 0) {
            // console.log('Strong Uptrend detected');
            return 'Strong Uptrend';
        }
        if (!macdAboveSignal && histogram < 0 && macdChange < 0 && signalChange < 0) {
            // console.log('Strong Downtrend detected');
            return 'Strong Downtrend';
        }

        // Weak trend conditions
        if (bullishCrossover || (macdAboveSignal && histogram > 0)) {
            // console.log('Weak Uptrend detected');
            return 'Weak Uptrend';
        }
        if (bearishCrossover || (!macdAboveSignal && histogram < 0)) {
            // console.log('Weak Downtrend detected');
            return 'Weak Downtrend';
        }

        // console.log('No trend detected - Neutral');
        return 'Neutral';
    }

    private calculatePricePositionContext(price: number, context: any): string {
        if (price > context.bbUpper) return 'Overbought';
        if (price < context.bbLower) return 'Oversold';
        if (price > context.bbMiddle) return 'Above Middle';
        if (price < context.bbMiddle) return 'Below Middle';
        return 'At Middle';
    }

    private calculateTrendStrength(adxData: { adx: number; plusDI: number; minusDI: number }): string {
        const { adx, plusDI, minusDI } = adxData;
        
        if (adx > 25) {
            if (plusDI > minusDI) {
                return adx > 40 ? 'Strong Uptrend' : 'Moderate Uptrend';
            } else {
                return adx > 40 ? 'Strong Downtrend' : 'Moderate Downtrend';
            }
        } else if (adx > 20) {
            return plusDI > minusDI ? 'Weak Uptrend' : 'Weak Downtrend';
        }
        
        return 'No Clear Trend';
    }

    // Add RSI divergence detection
    private calculateRSIDivergence(prices: number[], rsiValues: number[], periods: number = 14): string {
        if (rsiValues.length < periods * 2) return 'Insufficient Data';
        
        const priceHigh1 = Math.max(...prices.slice(-periods * 2, -periods));
        const priceHigh2 = Math.max(...prices.slice(-periods));
        const priceTrend = priceHigh2 > priceHigh1 ? 'up' : 'down';
        
        const rsiHigh1 = Math.max(...rsiValues.slice(-periods * 2, -periods));
        const rsiHigh2 = Math.max(...rsiValues.slice(-periods));
        const rsiTrend = rsiHigh2 > rsiHigh1 ? 'up' : 'down';
        
        if (priceTrend === 'up' && rsiTrend === 'down') return 'Bearish Divergence';
        if (priceTrend === 'down' && rsiTrend === 'up') return 'Bullish Divergence';
        return 'No Divergence';
    }

    // Add MACD signal line crossover detection
    private calculateMACDCrossover(macdData: any[]): string {
        if (!macdData || macdData.length < 2) return 'Insufficient Data';
        
        const current = macdData[macdData.length - 1];
        const previous = macdData[macdData.length - 2];
        
        if (current.MACD > current.signal && previous.MACD <= previous.signal)
        return 'Bullish Crossover';
        if (current.MACD < current.signal && previous.MACD >= previous.signal)
        return 'Bearish Crossover';
        
        return 'No Crossover';
    }

    // Add Bollinger Bands calculation
    private calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): any {
        if (prices.length < period) {
            return {
                upper: 0,
                middle: 0,
                lower: 0,
                bandwidth: 0,
                percentB: 0.5,
                signal: 'Insufficient Data'
            };
        }

        const bb = ti.BollingerBands.calculate({
            values: prices,
            period,
            stdDev
        });

        const latest = bb[bb.length - 1];
        if (!latest) {
            return {
                upper: 0,
                middle: 0,
                lower: 0,
                bandwidth: 0,
                percentB: 0.5,
                signal: 'Calculation Error'
            };
        }

        const currentPrice = prices[prices.length - 1];
        const bandwidth = ((latest.upper - latest.lower) / latest.middle) * 100;
        const percentB = (currentPrice - latest.lower) / (latest.upper - latest.lower);

        // Determine signal based on price position and bandwidth
        let signal = 'Neutral';
        if (currentPrice > latest.upper) {
            signal = bandwidth > 20 ? 'Strong Overbought' : 'Overbought';
        } else if (currentPrice < latest.lower) {
            signal = bandwidth > 20 ? 'Strong Oversold' : 'Oversold';
        } else if (currentPrice > latest.middle) {
            signal = 'Above Middle Band';
        } else {
            signal = 'Below Middle Band';
        }

        return {
            upper: latest.upper,
            middle: latest.middle,
            lower: latest.lower,
            bandwidth,
            percentB,
            signal
        };
    }

    // Add Ichimoku Cloud calculation
    private calculateIchimoku(high: number[], low: number[], close: number[]): any {
        const ichimoku = ti.IchimokuCloud.calculate({
            high,
            low,
            conversionPeriod: 9,
            basePeriod: 26,
            spanPeriod: 52,
            displacement: 26
        });

        const latest = ichimoku[ichimoku.length - 1] || {};
        
        // Cloud analysis
        let signal = 'Neutral';
        if (latest.spanA && latest.spanB) {
            if (close[close.length - 1] > latest.spanA && close[close.length - 1] > latest.spanB) {
                signal = 'Strong Bullish';
            } else if (close[close.length - 1] < latest.spanA && close[close.length - 1] < latest.spanB) {
                signal = 'Strong Bearish';
            } else if (latest.spanA > latest.spanB) {
                signal = 'Bullish';
            } else {
                signal = 'Bearish';
            }
        }
        
        // TK Cross analysis
        let tkCross = 'None';
        if (latest.conversion > latest.base && ichimoku[ichimoku.length - 2]?.conversion <= ichimoku[ichimoku.length - 2]?.base) {
            tkCross = 'Bullish TK Cross';
        } else if (latest.conversion < latest.base && ichimoku[ichimoku.length - 2]?.conversion >= ichimoku[ichimoku.length - 2]?.base) {
            tkCross = 'Bearish TK Cross';
        }
        
        return {
            tenkan: latest.conversion,
            kijun: latest.base,
            senkouA: latest.spanA,
            senkouB: latest.spanB,
            currentPrice: close[close.length - 1],
            cloudSignal: signal,
            tkCross
        };
    }

    // Add Stochastic Oscillator
    private calculateStochastic(high: number[], low: number[], close: number[], period: number = 14, smoothK: number = 3, smoothD: number = 3): any {
        // Calculate %K
        const stochK = [];
        for (let i = period - 1; i < close.length; i++) {
        const currentClose = close[i];
        const highestHigh = Math.max(...high.slice(i - period + 1, i + 1));
        const lowestLow = Math.min(...low.slice(i - period + 1, i + 1));
        
        const k = (currentClose - lowestLow) / (highestHigh - lowestLow) * 100;
        stochK.push(k);
        }
        
        // Smooth %K
        const smoothedK = ti.SMA.calculate({ values: stochK, period: smoothK });
        
        // Calculate %D (SMA of %K)
        const smoothedD = ti.SMA.calculate({ values: smoothedK, period: smoothD });
        
        const latestK = smoothedK[smoothedK.length - 1];
        const latestD = smoothedD[smoothedD.length - 1];
        
        // Signal determination
        let signal = 'Neutral';
        if (latestK > 80 && latestD > 80) {
        signal = 'Overbought';
        } else if (latestK < 20 && latestD < 20) {
        signal = 'Oversold';
        } else if (latestK > latestD && smoothedK[smoothedK.length - 2] <= smoothedD[smoothedD.length - 2]) {
        signal = 'Bullish Crossover';
        } else if (latestK < latestD && smoothedK[smoothedK.length - 2] >= smoothedD[smoothedD.length - 2]) {
        signal = 'Bearish Crossover';
        }
        
        return {
        k: latestK,
        d: latestD,
        signal
        };
    }

    // Enhanced ATR calculation with interpretations
    private calculateATR(high: number[], low: number[], close: number[], period: number = 14): any {
        const atr = ti.ATR.calculate({ high, low, close, period });
        const latestATR = atr[atr.length - 1];
        const latestClose = close[close.length - 1];
        
        // Normalize ATR as percentage of price
        const normalizedATR = (latestATR / latestClose) * 100;
        
        // Volatility interpretation
        let volatility = 'Medium';
        if (normalizedATR > 5) volatility = 'Very High';
        else if (normalizedATR > 3) volatility = 'High';
        else if (normalizedATR < 1) volatility = 'Low';
        else if (normalizedATR < 0.5) volatility = 'Very Low';
        
        return {
        atr: latestATR,
        normalizedATR,
        volatility
        };
    }

    

    private calculateSupportResistance(close: number[], period: number = 20): any {
        const levels = [];
        
        // Use a rolling window approach
        for (let i = period; i < close.length - period; i++) {
        const leftWindow = close.slice(i - period, i);
        const rightWindow = close.slice(i + 1, i + period + 1);
        const currentPrice = close[i];
        
        // Check if this point is a local maximum
        if (currentPrice > Math.max(...leftWindow) && currentPrice > Math.max(...rightWindow)) {
            levels.push({ price: currentPrice, type: 'resistance', strength: 1 });
        }
        // Check if this point is a local minimum
        else if (currentPrice < Math.min(...leftWindow) && currentPrice < Math.min(...rightWindow)) {
            levels.push({ price: currentPrice, type: 'support', strength: 1 });
        }
        }
        
        // Cluster and consolidate close levels
        const clusteredLevels = this.clusterLevels(levels, close[close.length - 1] * 0.01); // 1% threshold
        
        // Sort by strength (descending)
        return clusteredLevels.sort((a, b) => b.strength - a.strength);
    }
    
    // Helper to cluster nearby levels
    private clusterLevels(levels: any[], threshold: number): any[] {
        if (levels.length === 0) return [];
        
        // Sort by price
        const sortedLevels = [...levels].sort((a, b) => a.price - b.price);
        const clusters = [];
        
        let currentCluster = [sortedLevels[0]];
        let clusterType = sortedLevels[0].type;
        
        for (let i = 1; i < sortedLevels.length; i++) {
        const lastLevel = currentCluster[currentCluster.length - 1];
        
        // If this level is close to the previous one and the same type, add to cluster
        if (sortedLevels[i].price - lastLevel.price < threshold && sortedLevels[i].type === clusterType) {
            currentCluster.push(sortedLevels[i]);
        } else {
            // Complete current cluster and start a new one
            clusters.push({
            price: currentCluster.reduce((sum, level) => sum + level.price, 0) / currentCluster.length,
            type: clusterType,
            strength: currentCluster.length
            });
            
            currentCluster = [sortedLevels[i]];
            clusterType = sortedLevels[i].type;
        }
        }
        
        // Add the last cluster
        if (currentCluster.length > 0) {
        clusters.push({
            price: currentCluster.reduce((sum, level) => sum + level.price, 0) / currentCluster.length,
            type: clusterType,
            strength: currentCluster.length
        });
        }
        
        return clusters;
    }

    // Advanced trend identification using multiple indicators
    private calculateAdvancedTrend(close: number[], macdData: any[], rsi: number[], ema50: number[], ema200: number[]): string {

          // Check if we have sufficient data
        if (!macdData || macdData.length === 0 || !rsi || rsi.length === 0 || 
            !ema50 || ema50.length === 0 || !ema200 || ema200.length === 0) {
        return 'Insufficient Data';
        }
        // Get latest values
        const latestPrice = close[close.length - 1];
        const latestMACD = macdData[macdData.length - 1];

        // Add a safety check for latestMACD
        if (!latestMACD || latestMACD.MACD === undefined) {
            return 'MACD Data Unavailable';
        }

        const latestRSI = rsi[rsi.length - 1];
        const latestEMA50 = ema50[ema50.length - 1];
        const latestEMA200 = ema200[ema200.length - 1];


        
        // Score-based trend determination
        let trendScore = 0;
        
        // MACD checks
        if (latestMACD.MACD > 0) trendScore += 1;
        if (latestMACD.MACD > latestMACD.signal) trendScore += 1;
        if (latestMACD.histogram > 0) trendScore += 1;
        
        // RSI checks
        if (latestRSI > 50) trendScore += 1;
        if (latestRSI > 60) trendScore += 1;
        
        // Moving average checks
        if (latestPrice > latestEMA50) trendScore += 2;
        if (latestEMA50 > latestEMA200) trendScore += 2;
        if (latestPrice > latestEMA200) trendScore += 1;
        
        // Overall trend interpretation
        if (trendScore >= 8) return 'Strong Uptrend';
        if (trendScore >= 6) return 'Uptrend';
        if (trendScore <= 2) return 'Strong Downtrend';
        if (trendScore <= 4) return 'Downtrend';
        return 'Neutral/Sideways';
    }

    // Calculate custom volatility index based on ATR and price movement
    private calculateVolatilityIndex(close: number[], atr: number[]): any {
        const period = 14;
        if (close.length < period * 2 || atr.length < period) return { volatilityIndex: 0, trend: 'Insufficient Data' };

        // Calculate price change rate
        const changes = [];
        for (let i = 1; i < close.length; i++) {
            changes.push(Math.abs(close[i] - close[i - 1]) / close[i - 1]);
        }

        // Get average change over period
        const avgChange = changes.slice(-period).reduce((sum, val) => sum + val, 0) / period;

        // Latest ATR (normalized)
        const latestATR = atr[atr.length - 1] / close[close.length - 1];

        // Volatility index as combination of ATR and price changes
        const volatilityIndex = (latestATR + avgChange) * 100;

        // Trend analysis
        const recentChanges = changes.slice(-period);
        const avgDirection = close.slice(-period).reduce((sum, val, i, arr) => {
            if (i === 0) return sum;
            return sum + (val > arr[i - 1] ? 1 : -1);
        }, 0);

        let trend = 'Neutral';
        if (volatilityIndex > 5) {
            trend = avgDirection > 0 ? 'Volatile Uptrend' : 'Volatile Downtrend';
        } else if (volatilityIndex < 1) {
            trend = 'Low Volatility';
        } else {
            trend = avgDirection > 0 ? 'Moderate Uptrend' : 'Moderate Downtrend';
        }

        return {
            volatilityIndex,
            trend
        };
    }

    // This would be a separate utility function that gets called periodically
    // to analyze the entire market state, not just individual pairs
    async calculateMarketBreadth(pairs: CryptoPair[]): Promise<any> {
        // Calculate advance/decline ratio
        const advances = pairs.filter(pair => parseFloat(pair.dailyPriceChange) > 0).length;
        const declines = pairs.filter(pair => parseFloat(pair.dailyPriceChange) < 0).length;
        const unchanged = pairs.length - advances - declines;

        const advanceDeclineRatio = advances / (declines || 1);

        // Calculate average indicators across market
        const avgRSI = pairs.reduce((sum, pair) => sum + parseFloat(pair.rsi || '0'), 0) / pairs.length;
        const avgMACD = pairs.reduce((sum, pair) => sum + parseFloat(pair.macd || '0'), 0) / pairs.length;

        // Calculate the percentage of assets in strong trends
        // console.log('Sample of MACD trends:', pairs.slice(0, 5).map((pair, index) => ({ index, trend: pair.macdTrend })));
        const strongUptrends = pairs.filter(pair => pair.macdTrend === 'Strong Uptrend').length;
        const strongDowntrends = pairs.filter(pair => pair.macdTrend === 'Strong Downtrend').length;
        console.log('Strong trends counts:', { strongUptrends, strongDowntrends });

        const percentStrongUptrend = (strongUptrends / pairs.length) * 100;
        const percentStrongDowntrend = (strongDowntrends / pairs.length) * 100;

        // Overall market sentiment
        let marketSentiment = 'Neutral';
        if (advanceDeclineRatio > 3 && avgRSI > 60) {
            marketSentiment = 'Strongly Bullish';
        } else if (advanceDeclineRatio > 1.5 && avgRSI > 50) {
            marketSentiment = 'Bullish';
        } else if (advanceDeclineRatio < 0.33 && avgRSI < 40) {
            marketSentiment = 'Strongly Bearish';
        } else if (advanceDeclineRatio < 0.67 && avgRSI < 50) {
            marketSentiment = 'Bearish';
        }

        return {
            advanceDeclineRatio,
            advances,
            declines,
            unchanged,
            averageRSI: avgRSI,
            averageMACD: avgMACD,
            percentStrongUptrend,
            percentStrongDowntrend,
            marketSentiment
        };
    }

    // A more sophisticated composite scoring system
    private calculateEnhancedCompositeScore(indicators: any): number {
        // Technical indicator weights
        const weights = {
        rsi: 0.15,
        macd: 0.20,
        volumeOscillator: 0.10,
        priceMovement: 0.15,
        movingAverages: 0.20,
        volatility: 0.10,
        supportResistance: 0.10
        };
        
        // RSI component
        let rsiScore = 0.5; // Neutral
        if (indicators.rsi > 70) rsiScore = 0.1; // Overbought
        else if (indicators.rsi < 30) rsiScore = 0.9; // Oversold
        else rsiScore = 0.5 + (indicators.rsi - 50) / 40; // Linear scaling between 0.25-0.75
        
        // MACD component
        let macdScore = 0.5;
        if (indicators.macdTrend === 'Strong Uptrend') macdScore = 0.9;
        else if (indicators.macdTrend === 'Weak Uptrend') macdScore = 0.7;
        else if (indicators.macdTrend === 'Weak Downtrend') macdScore = 0.3;
        else if (indicators.macdTrend === 'Strong Downtrend') macdScore = 0.1;
        
        // Volume component
        let volumeScore = 0.5;
        if (indicators.volumeOscillator > 15) volumeScore = 0.8;
        else if (indicators.volumeOscillator > 0) volumeScore = 0.6;
        else if (indicators.volumeOscillator < -15) volumeScore = 0.2;
        else if (indicators.volumeOscillator < 0) volumeScore = 0.4;
        
        // Price movement component
        const priceChangeValue = parseFloat(indicators.dailyPriceChange);
        let priceScore = 0.5;
        if (priceChangeValue > 10) priceScore = 0.9;
        else if (priceChangeValue > 5) priceScore = 0.7;
        else if (priceChangeValue < -10) priceScore = 0.1;
        else if (priceChangeValue < -5) priceScore = 0.3;
        else priceScore = 0.5 + (priceChangeValue / 10);
        
        // Moving averages component
        let maScore = 0.5;
        const above7_30 = indicators.sma_7 > indicators.sma_30;
        const above50_200 = indicators.sma_50 > indicators.sma_200;
        if (above7_30 && above50_200) maScore = 0.9;
        else if (!above7_30 && !above50_200) maScore = 0.1;
        else if (above7_30) maScore = 0.7;
        else if (above50_200) maScore = 0.6;
        
        // Volatility component (inverse - lower is better for risk-adjusted score)
        const atrValue = parseFloat(indicators.atr);
        let volatilityScore = 0.5;
        if (atrValue < 1) volatilityScore = 0.9;
        else if (atrValue < 2) volatilityScore = 0.7;
        else if (atrValue > 5) volatilityScore = 0.1;
        else if (atrValue > 3) volatilityScore = 0.3;
        else volatilityScore = 0.5 - ((atrValue - 2) / 6);
        
        // Support/Resistance component
        const percentFromHighValue = parseFloat(indicators.percentChangeFromHigh);
        let srScore = 0.5;
        if (percentFromHighValue < -50) srScore = 0.9; // Far from high - more upside potential
        else if (percentFromHighValue > -10) srScore = 0.2; // Close to high - less upside potential
        else srScore = 0.5 + ((Math.abs(percentFromHighValue) - 10) / 80) * 0.7;
        
        // Combine all components with their weights
        const compositeScore = 
        rsiScore * weights.rsi +
        macdScore * weights.macd +
        volumeScore * weights.volumeOscillator +
        priceScore * weights.priceMovement +
        maScore * weights.movingAverages +
        volatilityScore * weights.volatility +
        srScore * weights.supportResistance;
        
        return Math.max(0, Math.min(1, compositeScore)); // Ensure score is between 0 and 1
    }

    private detectPumpDump(candles: CandleData[], recentCandles: CandleData[]): {
        isPumping: boolean;
        isDumping: boolean;
        pumpScore: number;
        dumpScore: number;
        volumeIncrease: number;
        priceChange: number;
        intradayPriceChange: number;
        liquidityType: 'Low' | 'Normal' | 'High';
        volumeScore: number;
    } {
        // Get the most recent candle
        const currentCandle = recentCandles[recentCandles.length - 1];
        const previousCandle = recentCandles[recentCandles.length - 2];

        if (!currentCandle || !previousCandle || recentCandles.length < 30) {
            return {
                isPumping: false,
                isDumping: false,
                pumpScore: 0,
                dumpScore: 0,
                volumeIncrease: 0,
                priceChange: 0,
                intradayPriceChange: 0,
                liquidityType: 'Normal',
                volumeScore: 0
            };
        }

        const prices = recentCandles.map(c => c.close);
        const volumes = recentCandles.map(c => c.volume);
        const highs = recentCandles.map(c => c.high);
        const lows = recentCandles.map(c => c.low);

        // Calculate volume metrics
        const volumeSMA20 = ti.SMA.calculate({ values: volumes, period: 20 });
        const avgVolume20 = volumeSMA20[volumeSMA20.length - 1];
        const volumeIncrease = ((currentCandle.volume - avgVolume20) / avgVolume20) * 100;

        // Calculate price changes over different periods
        const priceChange = ((currentCandle.close - previousCandle.close) / previousCandle.close) * 100;
        
        // Add price velocity calculation (rate of price change)
        const priceVelocity = priceChange / (currentCandle.volume / avgVolume20); // Price change per unit of relative volume
        
        // Calculate low liquidity multiplier
        const lowLiquidityMultiplier = Math.min(2, Math.max(1, 1 + (1 - currentCandle.volume / avgVolume20)));

        // Calculate average true range for volatility context
        const atr = ti.ATR.calculate({
            high: highs,
            low: lows,
            close: prices,
            period: 14
        });
        const currentATR = atr[atr.length - 1];
        const normalizedATR = (currentATR / currentCandle.close) * 100;

        // Calculate price changes relative to recent ranges
        const currentDay = recentCandles[recentCandles.length - 1];
        const previousDay = recentCandles[recentCandles.length - 2];
        
        // Daily high-low range
        const dailyRange = ((currentDay.high - currentDay.low) / currentDay.low) * 100;
        
        // Day-over-day range
        const dayOverDayHigh = Math.max(currentDay.high, previousDay.high);
        const dayOverDayLow = Math.min(currentDay.low, previousDay.low);
        const dayOverDayRange = ((dayOverDayHigh - dayOverDayLow) / dayOverDayLow) * 100;

        // Intraday movement calculations
        const intradayPumpChange = ((currentDay.close - currentDay.low) / currentDay.low) * 100;
        const intradayDumpChange = ((currentDay.high - currentDay.close) / currentDay.high) * 100;

        // Technical indicators
        const rsi = ti.RSI.calculate({
            values: prices,
            period: 14
        });
        const currentRSI = rsi[rsi.length - 1];

        const bb = ti.BollingerBands.calculate({
            values: prices,
            period: 20,
            stdDev: 2
        });
        const latestBB = bb[bb.length - 1];
        
        // Price position relative to Bollinger Bands
        let pricePosition = 'Neutral';
        let bbDeviation = 0;
        if (latestBB && latestBB.upper !== undefined && latestBB.lower !== undefined && latestBB.middle !== undefined) {
            bbDeviation = ((currentCandle.close - latestBB.middle) / (latestBB.upper - latestBB.middle)) * 100;
            pricePosition = currentCandle.close > latestBB.upper ? 'Above Upper' :
                          currentCandle.close < latestBB.lower ? 'Below Lower' :
                          currentCandle.close > latestBB.middle ? 'Near Upper' : 'Near Lower';
        }

        const macd = ti.MACD.calculate({
            values: prices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        });
        const macdSlope = macd.length >= 2 ? 
            (macd[macd.length - 1]?.histogram || 0) - (macd[macd.length - 2]?.histogram || 0) : 0;

        // Enhanced Pump Score Components
        const pumpScore = (
            // Volume component (max 20 points, reduced from 30)
            (volumeIncrease > 300 ? 20 :
             volumeIncrease > 200 ? 15 :
             volumeIncrease > 100 ? 10 :
             volumeIncrease > 50 ? 5 : 0) +
            
            // Price change components (max 35 points, increased from 30)
            (priceChange > 20 ? 35 :
             priceChange > 15 ? 30 :
             priceChange > 10 ? 25 :
             priceChange > 5 ? 20 : 0) +
            
            // Add price velocity component (max 10 points)
            (priceVelocity > 5 ? 10 :
             priceVelocity > 3 ? 7 :
             priceVelocity > 1 ? 5 : 0) +
            
            // Intraday volatility component (max 15 points)
            (intradayPumpChange > dayOverDayRange ? 15 :
             intradayPumpChange > dayOverDayRange * 0.75 ? 10 :
             intradayPumpChange > dayOverDayRange * 0.5 ? 5 : 0) +
            
            // Technical indicators (max 20 points)
            // RSI component
            (currentRSI > 80 ? 10 :
             currentRSI > 70 ? 7 :
             currentRSI > 60 ? 5 : 0) +
            
            // Bollinger Band component
            (bbDeviation > 100 ? 7 :
             bbDeviation > 75 ? 5 :
             bbDeviation > 50 ? 3 : 0) +
            
            // MACD momentum
            (macdSlope > 0 ? 3 : 0)
        ) * lowLiquidityMultiplier; // Apply low liquidity multiplier

        // Enhanced Dump Score Components with similar adjustments
        const dumpScore = (
            // Volume component (max 20 points, reduced from 30)
            (volumeIncrease > 300 ? 20 :
             volumeIncrease > 200 ? 15 :
             volumeIncrease > 100 ? 10 :
             volumeIncrease > 50 ? 5 : 0) +
            
            // Price change components (max 35 points, increased from 30)
            (priceChange < -20 ? 35 :
             priceChange < -15 ? 30 :
             priceChange < -10 ? 25 :
             priceChange < -5 ? 20 : 0) +
            
            // Add price velocity component (max 10 points)
            (priceVelocity < -5 ? 10 :
             priceVelocity < -3 ? 7 :
             priceVelocity < -1 ? 5 : 0) +
            
            // Intraday volatility component (max 15 points)
            (intradayDumpChange > dayOverDayRange ? 15 :
             intradayDumpChange > dayOverDayRange * 0.75 ? 10 :
             intradayDumpChange > dayOverDayRange * 0.5 ? 5 : 0) +
            
            // Technical indicators (max 20 points)
            // RSI component
            (currentRSI < 20 ? 10 :
             currentRSI < 30 ? 7 :
             currentRSI < 40 ? 5 : 0) +
            
            // Bollinger Band component
            (bbDeviation < -100 ? 7 :
             bbDeviation < -75 ? 5 :
             bbDeviation < -50 ? 3 : 0) +
            
            // MACD momentum
            (macdSlope < 0 ? 3 : 0)
        ) * lowLiquidityMultiplier; // Apply low liquidity multiplier

        // Adjust thresholds based on market volatility and liquidity
        const volatilityAdjustment = Math.min(normalizedATR / 2, 10);
        const liquidityAdjustment = Math.max(0, 10 * (1 - currentCandle.volume / avgVolume20));
        const pumpThreshold = Math.max(50, 70 - volatilityAdjustment - liquidityAdjustment);
        const dumpThreshold = Math.max(50, 70 - volatilityAdjustment - liquidityAdjustment);

        // Determine liquidity type based on volume metrics
        const liquidityType = volumeIncrease > 200 ? 'High' :
                            currentCandle.volume < avgVolume20 * 0.5 ? 'Low' : 'Normal';

        // Calculate separate volume score for UI display
        const volumeScore = (volumeIncrease > 300 ? 20 :
                           volumeIncrease > 200 ? 15 :
                           volumeIncrease > 100 ? 10 :
                           volumeIncrease > 50 ? 5 : 0);

        return {
            isPumping: pumpScore >= pumpThreshold && priceChange > 0,
            isDumping: dumpScore >= dumpThreshold && priceChange < 0,
            pumpScore,
            dumpScore,
            volumeIncrease,
            priceChange,
            intradayPriceChange: Math.max(intradayPumpChange, intradayDumpChange),
            liquidityType,
            volumeScore
        };
    }
}