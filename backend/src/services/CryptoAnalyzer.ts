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

interface VolumeProfileData {
    poc: number;
    valueAreaHigh: number;
    valueAreaLow: number;
    maxVolume: number;
    hvnodes: Array<{ price: number; volume: number }>;
    trend: 'Increasing' | 'Decreasing' | 'Neutral';
    trendStrength: number;
    spikes: Array<{ timestamp: number; volume: number; type: 'buy' | 'sell' }>;
    levels: Array<{ price: number; type: SupportResistanceType }>;
}

type SupportResistanceType = 'Support' | 'Resistance';

interface VolumeLevel {
    price: number;
    type: SupportResistanceType;
}

interface PivotLevel extends VolumeLevel {
    strength: number;
    description?: string;
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
            
            // Calculate first seen timestamp using moment
            const firstSeenTimestamp = longTermCandles.length > 0 ? 
                moment.unix(longTermCandles[0].timestamp).valueOf() : null;
            
            // Add debug logging with moment formatting
            // console.log(`[${pair}] First seen analysis:`, {
            //     originalTimestamp: longTermCandles[0]?.timestamp,
            //     convertedTimestamp: firstSeenTimestamp,
            //     date: firstSeenTimestamp ? moment(firstSeenTimestamp).format('YYYY-MM-DD HH:mm:ss') : 'N/A',
            //     isRecent: firstSeenTimestamp && moment(firstSeenTimestamp).isAfter(moment().subtract(30, 'days')) ? 'Yes' : 'No'
            // });
            
            // Calculate market structure
            const marketStructure = this.calculateMarketStructure(recentCandles);

            results.push({
              pair,
              currentVolumeUSD: currentVolumeUSD.toFixed(2),
              firstSeenTimestamp,
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
                                  'Normal',
              marketStructure,
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
        const diff = high - low;
        
        // Standard Fibonacci ratios
        const levels = [
            { level: 0, price: low },
            { level: 0.236, price: low + diff * 0.236 },
            { level: 0.382, price: low + diff * 0.382 },
            { level: 0.5, price: low + diff * 0.5 },
            { level: 0.618, price: low + diff * 0.618 },
            { level: 0.786, price: low + diff * 0.786 },
            { level: 1, price: high },
            // Extension levels
            { level: 1.272, price: low + diff * 1.272 },
            { level: 1.618, price: low + diff * 1.618 },
            { level: 2.618, price: low + diff * 2.618 }
        ];

        // Add support/resistance strength to each level
        return levels.map(level => ({
            ...level,
            price: parseFloat(level.price.toFixed(8))
        }));
    }

    private findSupportResistanceLevels(candles: CandleData[], pair: string, lookbackPeriod: number = 180): {
        supports: Array<{ price: number; strength: number; description?: string }>;
        resistances: Array<{ price: number; strength: number; description?: string }>;
        nearestSupport: number;
        nearestResistance: number;
        fallbackSupport: { price: number; description: string };
        fallbackResistance: { price: number; description: string };
        brokenLevels?: {
            brokenSupports: Array<{
                price: number;
                strength: number;
                breakTime: number;
                priceAtBreak: number;
                volume24hAtBreak: number;
                description?: string;
            }>;
            brokenResistances: Array<{
                price: number;
                strength: number;
                breakTime: number;
                priceAtBreak: number;
                volume24hAtBreak: number;
                description?: string;
            }>;
        };
        isNewPair?: boolean;
    } {
        if (candles.length < 7) {
            const currentPrice = candles[candles.length - 1].close;
            return {
                supports: [],
                resistances: [],
                nearestSupport: currentPrice * 0.85,
                nearestResistance: currentPrice * 1.15,
                fallbackSupport: {
                    price: currentPrice * 0.85,
                    description: 'New pair - establishing support levels'
                },
                fallbackResistance: {
                    price: currentPrice * 1.15,
                    description: 'New pair - establishing resistance levels'
                },
                brokenLevels: {
                    brokenSupports: [],
                    brokenResistances: []
                },
                isNewPair: true
            };
        }

        // Get the current price from the last candle
        const currentPrice = candles[candles.length - 1].close;
        const recentCandles = candles.slice(-lookbackPeriod);
        const volume24h = recentCandles[recentCandles.length - 1].volume * recentCandles[recentCandles.length - 1].close;

        // Calculate support and resistance levels
        const { supports, resistances, nearestSupport, nearestResistance } = this.detectPriceLevels(recentCandles);

        // Initialize broken levels arrays
        const brokenLevels = {
            brokenSupports: [] as Array<{
                price: number;
                strength: number;
                breakTime: number;
                priceAtBreak: number;
                volume24hAtBreak: number;
                description?: string;
            }>,
            brokenResistances: [] as Array<{
                price: number;
                strength: number;
                breakTime: number;
                priceAtBreak: number;
                volume24hAtBreak: number;
                description?: string;
            }>
        };

        // Check for broken levels by comparing current price with detected levels
        // If we don't have any supports, it means they were broken
        if (supports.length === 0) {
            // console.log(`${pair}: No supports detected - treating as broken support`);
            const fallbackPrice = currentPrice * 0.85;
            brokenLevels.brokenSupports.push({
                price: fallbackPrice,
                strength: 1,
                breakTime: Math.floor(Date.now() / 1000),
                priceAtBreak: currentPrice,
                volume24hAtBreak: volume24h,
                description: `Support broken down with ${volume24h.toFixed(2)} volume`
            });
        }

        // If we don't have any resistances, it means they were broken
        if (resistances.length === 0) {
            console.log(`${pair}: No resistances detected - treating as broken resistance`);
            const fallbackPrice = currentPrice * 1.15;
            brokenLevels.brokenResistances.push({
                price: fallbackPrice,
                strength: 1,
                breakTime: Math.floor(Date.now() / 1000),
                priceAtBreak: currentPrice,
                volume24hAtBreak: volume24h,
                description: `Resistance broken up with ${volume24h.toFixed(2)} volume`
            });
        }

        // Log summary of broken levels
        // console.log(`${pair}: Found broken levels:`, {
        //     brokenSupports: brokenLevels.brokenSupports.length,
        //     brokenResistances: brokenLevels.brokenResistances.length,
        //     timestamp: Math.floor(Date.now() / 1000),
        //     currentPrice,
        //     volume24h
        // });

        // Calculate fallback support and resistance with more meaningful descriptions
        let fallbackSupport = {
            price: currentPrice * 0.85,
            description: brokenLevels.brokenSupports.length > 0 
                ? `Support broken - Next target ${(currentPrice * 0.85).toFixed(8)}`
                : 'No support level established yet'
        };

        let fallbackResistance = {
            price: currentPrice * 1.15,
            description: brokenLevels.brokenResistances.length > 0
                ? `Resistance broken - Next target ${(currentPrice * 1.15).toFixed(8)}`
                : 'No resistance level established yet'
        };

        // No need for additional updates since we're already handling broken levels above

        return {
            supports,
            resistances,
            nearestSupport,
            nearestResistance,
            fallbackSupport,
            fallbackResistance,
            brokenLevels,
            isNewPair: false
        };
    }

    private formatTimeAgo(timestamp: number): string {
        const now = Math.floor(Date.now() / 1000);
        const diff = now - timestamp;

        if (diff < 3600) {
            return `${Math.floor(diff / 60)}m ago`;
        }
        if (diff < 86400) {
            return `${Math.floor(diff / 3600)}h ago`;
        }
        return `${Math.floor(diff / 86400)}d ago`;
    }

    private detectPriceLevels(candles: CandleData[]): {
        supports: Array<{ price: number; strength: number }>;
        resistances: Array<{ price: number; strength: number }>;
        nearestSupport: number;
        nearestResistance: number;
    } {
        const currentPrice = candles[candles.length - 1].close;
        const high = Math.max(...candles.map(c => c.high));
        const low = Math.min(...candles.map(c => c.low));
        
        // Initialize arrays for supports and resistances
        let supports: Array<{ price: number; strength: number }> = [];
        let resistances: Array<{ price: number; strength: number }> = [];
        
        // Calculate ATR for adaptive thresholds
        const atr = this.calculateATR(candles, 14);
        const priceThreshold = atr * 0.5; // Use half ATR as threshold
        
        // Find potential levels by looking for price clusters
        const pricePoints = candles.map(c => ({
            high: c.high,
            low: c.low,
            volume: c.volume
        }));
        
        // Group price points into clusters
        const highClusters = this.findPriceClusters(pricePoints.map(p => p.high), priceThreshold);
        const lowClusters = this.findPriceClusters(pricePoints.map(p => p.low), priceThreshold);
        
        // Convert clusters to support/resistance levels
        for (const cluster of highClusters) {
            if (cluster.price > currentPrice) {
                resistances.push({
                    price: cluster.price,
                    strength: this.calculateLevelStrength(cluster, candles, 'Resistance')
                });
            }
        }
        
        for (const cluster of lowClusters) {
            if (cluster.price < currentPrice) {
                supports.push({
                    price: cluster.price,
                    strength: this.calculateLevelStrength(cluster, candles, 'Support')
                });
            }
        }
        
        // Sort by strength
        supports = supports.sort((a, b) => b.strength - a.strength);
        resistances = resistances.sort((a, b) => b.strength - a.strength);
        
        // Find nearest levels
        const nearestSupport = supports.length > 0 
            ? Math.max(...supports.map(s => s.price))
            : currentPrice * 0.85;
            
        const nearestResistance = resistances.length > 0
            ? Math.min(...resistances.map(r => r.price))
            : currentPrice * 1.15;
        
        return {
            supports,
            resistances,
            nearestSupport,
            nearestResistance
        };
    }

    private calculateATR(
        input: CandleData[] | { high: number[]; low: number[]; close: number[] },
        period: number = 14
    ): number {
        let trueRanges: number[] = [];

        if (Array.isArray(input)) {
            // Handle CandleData[] input
            if (input.length < 2) return 0;
            
            trueRanges = input.slice(1).map((candle, i) => {
                const prev = input[i];
                return Math.max(
                    candle.high - candle.low,
                    Math.abs(candle.high - prev.close),
                    Math.abs(candle.low - prev.close)
                );
            });
        } else {
            // Handle separate arrays input
            const { high, low, close } = input;
            if (high.length < 2 || low.length < 2 || close.length < 2) return 0;
            
            trueRanges = high.slice(1).map((h, i) => {
                const prevClose = close[i];
                return Math.max(
                    h - low[i + 1],
                    Math.abs(h - prevClose),
                    Math.abs(low[i + 1] - prevClose)
                );
            });
        }
        
        // Calculate simple moving average of true ranges
        const sum = trueRanges.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    private calculateEnhancedATR(candles: CandleData[]): {
        atr: number;
        normalizedATR: number;
        volatility: string;
    } {
        const atr = this.calculateATR(candles);
        const latestClose = candles[candles.length - 1].close;
        
        // Normalize ATR as percentage of price
        const normalizedATR = (atr / latestClose) * 100;
        
        // Volatility interpretation
        let volatility = 'Medium';
        if (normalizedATR > 5) volatility = 'Very High';
        else if (normalizedATR > 3) volatility = 'High';
        else if (normalizedATR < 1) volatility = 'Low';
        else if (normalizedATR < 0.5) volatility = 'Very Low';
        
        return {
            atr,
            normalizedATR,
            volatility
        };
    }

    private findPriceClusters(prices: number[], threshold: number): Array<{ price: number; touches: number }> {
        const clusters: Array<{ price: number; touches: number }> = [];
        
        for (const price of prices) {
            // Find existing cluster or create new one
            let found = false;
            for (const cluster of clusters) {
                if (Math.abs(cluster.price - price) <= threshold) {
                    // Update cluster average price
                    cluster.price = (cluster.price * cluster.touches + price) / (cluster.touches + 1);
                    cluster.touches++;
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                clusters.push({ price, touches: 1 });
            }
        }
        
        return clusters;
    }

    private calculateLevelStrength(
        cluster: any,
        candles: CandleData[],
        type: 'Support' | 'Resistance'
    ): number {
        const currentPrice = candles[candles.length - 1].close;
        
        // Base strength on number of touches (20%)
        let strength = Math.min(100, (cluster.touches / 3) * 20);
        
        // Volume component (25%)
        const volumeAtLevel = this.calculateVolumeAtLevel(candles, cluster.price);
        const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
        strength += Math.min(25, (volumeAtLevel / avgVolume) * 25);
        
        // Recency component (20%)
        const lastTouch = this.findLastTouch(candles, cluster.price, type);
        if (lastTouch > 0) {
            const recencyScore = Math.max(0, 20 - (candles.length - lastTouch) / 10);
            strength += recencyScore;
        }
        
        // Rejection strength (25%)
        const rejectionStrength = this.calculateRejectionStrength(candles, cluster.price, type);
        strength += Math.min(25, rejectionStrength * 25);
        
        // Psychological level bonus (10%)
        if (this.isPsychologicalLevel(cluster.price)) {
            strength += 10;
        }
        
        return Math.min(100, Math.max(0, strength));
    }

    private calculateVolumeAtLevel(candles: CandleData[], price: number): number {
        const threshold = price * 0.005; // 0.5% threshold
        return candles.reduce((sum, candle) => {
            if (Math.abs(candle.close - price) <= threshold) {
                return sum + candle.volume;
            }
            return sum;
        }, 0);
    }

    private findLastTouch(candles: CandleData[], price: number, type: SupportResistanceType): number {
        const threshold = price * 0.005; // 0.5% threshold
        for (let i = candles.length - 1; i >= 0; i--) {
            const candle = candles[i];
            if (type === 'Support' && Math.abs(candle.low - price) <= threshold) {
                return i;
            }
            if (type === 'Resistance' && Math.abs(candle.high - price) <= threshold) {
                return i;
            }
        }
        return -1;
    }

    private calculateRejectionStrength(candles: CandleData[], price: number, type: SupportResistanceType): number {
        const touches = candles.filter((candle, i) => {
            if (i === 0) return false;
            const prev = candles[i - 1];
            const threshold = price * 0.005;
            
            if (type === 'Support') {
                return Math.abs(candle.low - price) <= threshold && candle.close > prev.close;
            } else {
                return Math.abs(candle.high - price) <= threshold && candle.close < prev.close;
            }
        });
        
        return touches.length / candles.length;
    }

    private isPsychologicalLevel(price: number): boolean {
        // Check for round numbers
        const priceStr = price.toString();
        return /[0-9]0{4,}/.test(priceStr) || // e.g. 10000, 20000
               /[0-9]5{4,}/.test(priceStr) || // e.g. 15555, 25555
               /[0-9]{1,2}000/.test(priceStr); // e.g. 1000, 2000, etc
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

        const rsi_30 = ti.RSI.calculate({
            values: longTermClosePrices,
            period: 30
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
            macd = [{MACD: 0, signal: 0, histogram: 0}] //assign insufficent default values

            // console.log('Insufficient data for MACD calculation for pair: ', pair, {
            //     requiredPoints: 35,
            //     availablePoints: longTermClosePrices.length
            // });
        }

        // Calculate recent moving averages
        const sma7 = ti.SMA.calculate({ values: recentClosePrices, period: 7 });
        const sma30 = ti.SMA.calculate({ values: recentClosePrices, period: 30 });
        
        // Calculate long-term moving averages
        const sma50 = ti.SMA.calculate({ values: longTermClosePrices, period: 50 });
        const sma200 = ti.SMA.calculate({ values: longTermClosePrices, period: 200 });

        // Calculate price levels
        const priceLevels = this.findSupportResistanceLevels(recentCandles, pair);

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

        // Replace the ATR calculation with:
        const advancedATR = this.calculateEnhancedATR(recentCandles);

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
        const latestATR = advancedATR.atr || 0;
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
        const longTermHighs = longTermCandles.map(c => c.high);
        const longTermLows = longTermCandles.map(c => c.low);
        // const longTermClosePrices = longTermCandles.map(c => c.close);
        
        const ichimoku = this.calculateIchimoku(
            longTermHighs,
            longTermLows,
            longTermClosePrices
        );
        const stochastic = this.calculateStochastic(recentHighs, recentLows, recentClosePrices);
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

        // Calculate Fibonacci levels
        const recentSwingHigh = Math.max(...recentHighs.slice(-30));
        const recentSwingLow = Math.min(...recentLows.slice(-30));
        const fibLevels = this.calculateFibonacciLevels(recentSwingHigh, recentSwingLow);
        
        // Calculate current price position relative to Fibonacci levels
        const fibPosition = this.calculateFibonacciPosition(currentPrice, fibLevels);

        // Add volume profile analysis
        const volumeProfile = this.calculateVolumeProfile(recentCandles);

        const volumeAnalysis = this.calculateVolumeAnalysis(recentCandles);

        return {
            currentPrice: currentPrice.toFixed(8),
            dailyPriceChange: this.calculateDailyPriceChange(recentCandles),
            percentChangeFromHigh: percentFromHigh.toFixed(2),
            percentChangeFromLow: percentFromLow.toFixed(2),
            percentChangeLastThreeMonths: threeMonthChange.toFixed(2),
            
            // Add Fibonacci analysis
            fibonacciAnalysis: {
                levels: fibLevels,
                currentPosition: fibPosition.type, // This will be 'Retracement' or 'Extension'
                description: fibPosition.description, // This will be the detailed description
                swingPoints: {
                    high: recentSwingHigh,
                    low: recentSwingLow,
                    highTime: recentCandles[recentHighs.indexOf(recentSwingHigh)]?.timestamp,
                    lowTime: recentCandles[recentLows.indexOf(recentSwingLow)]?.timestamp
                }
            },

            // Volume indicators
            vma_7: vma7[vma7.length - 1]?.toFixed(2),
            vma_30: vma30[vma30.length - 1]?.toFixed(2),
            volumeOscillator: volumeOscillator.toFixed(2),
            obv: obv[obv.length - 1]?.toString(),
            obvChange: ((obv[obv.length - 1] - obv[obv.length - 2]) / obv[obv.length - 2] * 100).toFixed(2),
            
            // RSI indicators
            rsi: rsi[rsi.length - 1]?.toFixed(2),
            rsi_30: rsi_30[rsi_30.length - 1]?.toFixed(2),
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
            enhancedScore: enhancedScore.toFixed(2),
            volumeProfile,
            volumeAnalysis,
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
        // Check for minimum required data points
        const requiredPoints = 52 + 26; // spanPeriod + displacement
        if (high.length < requiredPoints || low.length < requiredPoints || close.length < requiredPoints) {
            // console.log('Insufficient data points for Ichimoku calculation:', {
            //     required: requiredPoints,
            //     available: {
            //         high: high.length,
            //         low: low.length,
            //         close: close.length
            //     }
            // });
            return {
                tenkan: null,
                kijun: null,
                senkouA: null,
                senkouB: null,
                currentPrice: close[close.length - 1],
                cloudSignal: 'Insufficient Data',
                tkCross: 'None'
            };
        }

        const ichimoku = ti.IchimokuCloud.calculate({
            high,
            low,
            conversionPeriod: 9,
            basePeriod: 26,
            spanPeriod: 52,
            displacement: 26
        });

        // console.log('Ichimoku calculation result:', {
        //     resultLength: ichimoku.length,
        //     latest: ichimoku[ichimoku.length - 1]
        // });

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
        
        const result = {
            tenkan: latest.conversion,
            kijun: latest.base,
            senkouA: latest.spanA,
            senkouB: latest.spanB,
            currentPrice: close[close.length - 1],
            cloudSignal: signal,
            tkCross
        };

        // console.log('Final Ichimoku values:', result);
        
        return result;
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
        //check if we have all the required indicators
        if (!indicators.rsi || !indicators.macdTrend || !indicators.volumeOscillator || !indicators.dailyPriceChange || !indicators.sma_7 || !indicators.sma_30 || !indicators.sma_50 || !indicators.sma_200 || !indicators.atr || !indicators.percentChangeFromHigh) {
            return 0;
        }

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

    private calculateFibonacciPosition(currentPrice: number, fibLevels: Array<{ level: number; price: number }>): { type: string; description: string } {
        // Sort levels by price in descending order
        const sortedLevels = [...fibLevels].sort((a, b) => b.price - a.price);
        
        // Find the levels the price is between
        for (let i = 0; i < sortedLevels.length - 1; i++) {
            if (currentPrice <= sortedLevels[i].price && currentPrice >= sortedLevels[i + 1].price) {
                const upperLevel = sortedLevels[i].level;
                const lowerLevel = sortedLevels[i + 1].level;
                
                // Calculate how far between the levels the price is
                const range = sortedLevels[i].price - sortedLevels[i + 1].price;
                const position = currentPrice - sortedLevels[i + 1].price;
                const percentage = (position / range * 100).toFixed(1);
                
                const description = `Between ${(lowerLevel * 100).toFixed(1)}% and ${(upperLevel * 100).toFixed(1)}% (${percentage}% from ${(lowerLevel * 100).toFixed(1)}%)`;
                
                // Determine if this is a retracement or extension level
                const type = upperLevel <= 1 ? 'Retracement' : 'Extension';
                
                return { type, description };
            }
        }
        
        // If price is above or below all levels
        if (currentPrice > sortedLevels[0].price) {
            return {
                type: 'Extension',
                description: `Above ${(sortedLevels[0].level * 100).toFixed(1)}%`
            };
        }
        return {
            type: 'Retracement',
            description: `Below ${(sortedLevels[sortedLevels.length - 1].level * 100).toFixed(1)}%`
        };
    }

    private calculateVolumeProfile(candles: CandleData[]): VolumeProfileData {
        // Calculate price levels and their volumes
        const volumeByPrice = new Map<number, number>();
        let maxVolume = 0;
        
        candles.forEach(candle => {
            const price = (candle.high + candle.low) / 2;
            const volume = candle.volume;
            const roundedPrice = Math.round(price * 100) / 100;
            
            volumeByPrice.set(
                roundedPrice,
                (volumeByPrice.get(roundedPrice) || 0) + volume
            );
            maxVolume = Math.max(maxVolume, volumeByPrice.get(roundedPrice) || 0);
        });

        // Find Point of Control (price level with highest volume)
        let poc = 0;
        let maxVol = 0;
        for (const [price, volume] of volumeByPrice.entries()) {
            if (volume > maxVol) {
                maxVol = volume;
                poc = price;
            }
        }

        // Calculate Value Area (70% of total volume)
        const totalVolume = Array.from(volumeByPrice.values()).reduce((a, b) => a + b, 0);
        const valueAreaTarget = totalVolume * 0.7;
        let currentVolume = 0;
        let valueAreaHigh = poc;
        let valueAreaLow = poc;
        
        // Expand value area until it contains 70% of volume
        while (currentVolume < valueAreaTarget) {
            const nextHighPrice = Math.max(...Array.from(volumeByPrice.keys()).filter(p => p > valueAreaHigh));
            const nextLowPrice = Math.min(...Array.from(volumeByPrice.keys()).filter(p => p < valueAreaLow));
            
            const highVolume = volumeByPrice.get(nextHighPrice) || 0;
            const lowVolume = volumeByPrice.get(nextLowPrice) || 0;
            
            if (highVolume > lowVolume) {
                valueAreaHigh = nextHighPrice;
                currentVolume += highVolume;
            } else {
                valueAreaLow = nextLowPrice;
                currentVolume += lowVolume;
            }
        }

        // Find High Volume Nodes (local maxima in volume)
        const hvnodes = Array.from(volumeByPrice.entries())
            .map(([price, volume]) => ({ price, volume }))
            .filter(node => node.volume > totalVolume / volumeByPrice.size * 1.5)
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);

        // Calculate Volume Trend
        const recentCandles = candles.slice(-14);
        const volumeTrend = this.calculateVolumeTrend(recentCandles);

        // Detect Volume Spikes
        const spikes = this.detectVolumeSpikes(recentCandles);

        // Find Volume-Based Support/Resistance Levels
        const levels = this.findVolumeLevels(candles);

        return {
            poc,
            valueAreaHigh,
            valueAreaLow,
            maxVolume,
            hvnodes,
            ...volumeTrend,
            spikes,
            levels
        };
    }

    private calculateVolumeTrend(candles: CandleData[]): { 
        trend: 'Increasing' | 'Decreasing' | 'Neutral';
        trendStrength: number;
    } {
        const volumes = candles.map(c => c.volume);
        const volumeSMA = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        
        const recentVolume = volumes.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const trendStrength = ((recentVolume - volumeSMA) / volumeSMA) * 100;
        
        let trend: 'Increasing' | 'Decreasing' | 'Neutral' = 'Neutral';
        if (trendStrength > 20) trend = 'Increasing';
        else if (trendStrength < -20) trend = 'Decreasing';
        
        return {
            trend,
            trendStrength: Math.abs(trendStrength)
        };
    }

    private detectVolumeSpikes(candles: CandleData[]): Array<{
        timestamp: number;
        volume: number;
        type: 'buy' | 'sell';
    }> {
        const volumes = candles.map(c => c.volume);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const stdDev = Math.sqrt(
            volumes.reduce((a, b) => a + Math.pow(b - avgVolume, 2), 0) / volumes.length
        );
        
        return candles
            .filter(candle => {
                return candle.volume > avgVolume + 2 * stdDev;
            })
            .map(candle => ({
                timestamp: new Date(candle.timestamp).getTime(),
                volume: candle.volume,
                type: candle.close > candle.open ? 'buy' as const : 'sell' as const
            }))
            .slice(-3);
    }

    private findVolumeLevels(candles: CandleData[]): VolumeLevel[] {
        const volumeByPrice = new Map<number, number>();
        
        candles.forEach(candle => {
            const price = (candle.high + candle.low) / 2;
            const volume = candle.volume;
            const roundedPrice = Math.round(price * 100) / 100;
            
            volumeByPrice.set(
                roundedPrice,
                (volumeByPrice.get(roundedPrice) || 0) + volume
            );
        });

        const currentPrice = candles[candles.length - 1].close;
        const levels = Array.from(volumeByPrice.entries())
            .map(([price, volume]) => ({
                price,
                volume,
                type: price > currentPrice ? 'Resistance' as const : 'Support' as const
            }))
            .filter(level => level.volume > Array.from(volumeByPrice.values()).reduce((a, b) => a + b, 0) / volumeByPrice.size * 2)
            .sort((a, b) => b.volume - a.volume)
            .map(({ price, type }) => ({ price, type }));

        return levels;
    }

    private calculateMarketStructure(candles: CandleData[]): {
        trend: 'Uptrend' | 'Downtrend' | 'Sideways' | 'Accumulation' | 'Distribution';
        strength: number;
        swingPoints: Array<{
            type: 'High' | 'Low';
            price: number;
            timestamp: number;
            significance: number;
            description?: string;
        }>;
        pivotLevels: Array<{
            type: 'Support' | 'Resistance';
            price: number;
            strength: number;
            description?: string;
        }>;
        phase: {
            current: 'Accumulation' | 'Mark-Up' | 'Distribution' | 'Mark-Down';
            duration: number;
            confidence: number;
            description?: string;
        };
        structure: {
            higherHighs: boolean;
            higherLows: boolean;
            lowerHighs: boolean;
            lowerLows: boolean;
            lastSwingHigh: number;
            lastSwingLow: number;
        };
    } {
        if (candles.length < 30) {
            return {
                trend: 'Sideways',
                strength: 0,
                swingPoints: [],
                pivotLevels: [],
                phase: {
                    current: 'Accumulation',
                    duration: 0,
                    confidence: 0,
                    description: 'Insufficient data for market structure analysis'
                },
                structure: {
                    higherHighs: false,
                    higherLows: false,
                    lowerHighs: false,
                    lowerLows: false,
                    lastSwingHigh: candles[candles.length - 1]?.high || 0,
                    lastSwingLow: candles[candles.length - 1]?.low || 0
                }
            };
        }

        const lookbackPeriod = 30;
        const swingPoints = this.findSwingPoints(candles.slice(-lookbackPeriod));
        const structure = this.analyzeStructure(swingPoints);
        const adx = this.calculateADXValue(candles.slice(-lookbackPeriod));
        const trendStrength = {
            strength: Math.min(100, adx * 2),
            adx
        };
        
        const trend = this.determineTrend(structure, trendStrength);
        const pivotLevels = this.findPivotLevels(candles.slice(-lookbackPeriod));
        const phase = this.determineMarketPhase(structure, trend, trendStrength, pivotLevels);

        return {
            trend,
            strength: trendStrength.strength,
            swingPoints,
            pivotLevels,
            phase,
            structure
        };
    }

    private calculateADXValue(candles: CandleData[]): number {
        const high = candles.map(c => Number(c.high));
        const low = candles.map(c => Number(c.low));
        const close = candles.map(c => Number(c.close));
        
        // Calculate True Range
        const tr = high.map((h, i) => {
            if (i === 0) return h - low[i];
            const yesterdayClose = close[i - 1];
            return Math.max(h - low[i], Math.abs(h - yesterdayClose), Math.abs(low[i] - yesterdayClose));
        });
        
        // Calculate +DM and -DM
        const plusDM = high.map((h, i) => {
            if (i === 0) return 0;
            const moveUp = h - high[i - 1];
            const moveDown = low[i - 1] - low[i];
            return moveUp > moveDown && moveUp > 0 ? moveUp : 0;
        });
        
        const minusDM = low.map((l, i) => {
            if (i === 0) return 0;
            const moveUp = high[i] - high[i - 1];
            const moveDown = low[i - 1] - l;
            return moveDown > moveUp && moveDown > 0 ? moveDown : 0;
        });
        
        // Calculate smoothed values
        const period = 14;
        const smoothedTR = this.smoothSeries(tr, period);
        const smoothedPlusDM = this.smoothSeries(plusDM, period);
        const smoothedMinusDM = this.smoothSeries(minusDM, period);
        
        // Calculate DI+ and DI-
        const plusDI = smoothedPlusDM.map((dm, i) => (dm / smoothedTR[i]) * 100);
        const minusDI = smoothedMinusDM.map((dm, i) => (dm / smoothedTR[i]) * 100);
        
        // Calculate ADX
        const dx = plusDI.map((plus, i) => {
            const diff = Math.abs(plus - minusDI[i]);
            const sum = plus + minusDI[i];
            return (diff / sum) * 100;
        });
        
        const adx = this.smoothSeries(dx, period);
        return adx[adx.length - 1];
    }

    private smoothSeries(series: number[], period: number): number[] {
        const smoothed: number[] = [];
        let sum = 0;
        
        // First value is simple average
        for (let i = 0; i < period; i++) {
            sum += series[i];
        }
        smoothed.push(sum / period);
        
        // Rest use smoothing formula
        for (let i = period; i < series.length; i++) {
            smoothed.push((smoothed[smoothed.length - 1] * (period - 1) + series[i]) / period);
        }
        
        return smoothed;
    }

    private findSwingPoints(candles: CandleData[]): Array<{
        type: 'High' | 'Low';
        price: number;
        timestamp: number;
        significance: number;
        description?: string;
    }> {
        const points: Array<{
            type: 'High' | 'Low';
            price: number;
            timestamp: number;
            significance: number;
            description?: string;
        }> = [];
        
        const prices = candles.map(c => Number(c.close));
        const timestamps = candles.map(c => c.timestamp);
        
        // Window size for swing point detection
        const window = 5;
        
        for (let i = window; i < prices.length - window; i++) {
            const currentPrice = prices[i];
            const leftPrices = prices.slice(i - window, i);
            const rightPrices = prices.slice(i + 1, i + window + 1);
            
            // Check for swing high
            if (currentPrice > Math.max(...leftPrices) && currentPrice > Math.max(...rightPrices)) {
                const significance = this.calculateSwingSignificance(currentPrice, leftPrices, rightPrices);
                points.push({
                    type: 'High',
                    price: currentPrice,
                    timestamp: timestamps[i],
                    significance,
                    description: `Swing High at ${currentPrice.toFixed(2)}`
                });
            }
            
            // Check for swing low
            if (currentPrice < Math.min(...leftPrices) && currentPrice < Math.min(...rightPrices)) {
                const significance = this.calculateSwingSignificance(currentPrice, leftPrices, rightPrices);
                points.push({
                    type: 'Low',
                    price: currentPrice,
                    timestamp: timestamps[i],
                    significance,
                    description: `Swing Low at ${currentPrice.toFixed(2)}`
                });
            }
        }
        
        // Sort by significance and return top points
        return points.sort((a, b) => b.significance - a.significance).slice(0, 5);
    }

    private calculateSwingSignificance(price: number, leftPrices: number[], rightPrices: number[]): number {
        const avgLeft = leftPrices.reduce((a, b) => a + b, 0) / leftPrices.length;
        const avgRight = rightPrices.reduce((a, b) => a + b, 0) / rightPrices.length;
        const deviation = Math.abs(price - (avgLeft + avgRight) / 2);
        return Math.min(100, (deviation / price) * 1000); // Scale to 0-100
    }

    private analyzeStructure(swingPoints: Array<{
        type: 'High' | 'Low';
        price: number;
        timestamp: number;
        significance: number;
    }>): {
        higherHighs: boolean;
        higherLows: boolean;
        lowerHighs: boolean;
        lowerLows: boolean;
        lastSwingHigh: number;
        lastSwingLow: number;
    } {
        const highs = swingPoints.filter(p => p.type === 'High').sort((a, b) => b.timestamp - a.timestamp);
        const lows = swingPoints.filter(p => p.type === 'Low').sort((a, b) => b.timestamp - a.timestamp);
        
        return {
            higherHighs: highs.length >= 2 && highs[0].price > highs[1].price,
            higherLows: lows.length >= 2 && lows[0].price > lows[1].price,
            lowerHighs: highs.length >= 2 && highs[0].price < highs[1].price,
            lowerLows: lows.length >= 2 && lows[0].price < lows[1].price,
            lastSwingHigh: highs[0]?.price || 0,
            lastSwingLow: lows[0]?.price || 0
        };
    }

    private determineTrend(
        structure: {
            higherHighs: boolean;
            higherLows: boolean;
            lowerHighs: boolean;
            lowerLows: boolean;
        },
        trendStrength: { strength: number; adx: number }
    ): 'Uptrend' | 'Downtrend' | 'Sideways' | 'Accumulation' | 'Distribution' {
        if (structure.higherHighs && structure.higherLows && trendStrength.strength > 50) {
            return 'Uptrend';
        } else if (structure.lowerHighs && structure.lowerLows && trendStrength.strength > 50) {
            return 'Downtrend';
        } else if (trendStrength.strength < 30) {
            if (structure.higherLows) return 'Accumulation';
            if (structure.lowerHighs) return 'Distribution';
            return 'Sideways';
        }
        return 'Sideways';
    }

    private findPivotLevels(candles: CandleData[]): PivotLevel[] {
        const prices = candles.map(c => Number(c.close));
        const volumes = candles.map(c => Number(c.volume));
        
        // Find price clusters
        const clusters = this.findPriceClusters(prices, 0.005); // 0.5% threshold
        
        // Convert clusters to pivot levels
        return clusters.map(cluster => {
            const isSupport = prices[prices.length - 1] > cluster.price;
            const volumeAtLevel = this.calculateVolumeAtLevel(candles, cluster.price);
            const strength = this.calculateLevelStrength(cluster, candles, isSupport ? 'Support' : 'Resistance');
            
            return {
                price: cluster.price,
                type: isSupport ? 'Support' as const : 'Resistance' as const,
                strength,
                description: `${isSupport ? 'Support' : 'Resistance'} level with ${cluster.touches} touches`
            };
        }).sort((a, b) => b.strength - a.strength).slice(0, 5);
    }

    private determineMarketPhase(
        structure: {
            higherHighs: boolean;
            higherLows: boolean;
            lowerHighs: boolean;
            lowerLows: boolean;
        },
        trend: string,
        trendStrength: { strength: number; adx: number },
        pivotLevels: PivotLevel[]
    ): {
        current: 'Accumulation' | 'Mark-Up' | 'Distribution' | 'Mark-Down';
        duration: number;
        confidence: number;
        description?: string;
    } {
        let phase: 'Accumulation' | 'Mark-Up' | 'Distribution' | 'Mark-Down';
        let confidence = 0;
        let description = '';

        if (trend === 'Uptrend' && structure.higherHighs && structure.higherLows) {
            phase = 'Mark-Up';
            confidence = trendStrength.strength;
            description = 'Strong uptrend with higher highs and higher lows';
        } else if (trend === 'Downtrend' && structure.lowerHighs && structure.lowerLows) {
            phase = 'Mark-Down';
            confidence = trendStrength.strength;
            description = 'Strong downtrend with lower highs and lower lows';
        } else if (trend === 'Sideways' || trend === 'Accumulation') {
            if (structure.higherLows) {
                phase = 'Accumulation';
                confidence = 60 + (trendStrength.adx / 5);
                description = 'Sideways movement with higher lows suggesting accumulation';
            } else {
                phase = 'Distribution';
                confidence = 60 + (trendStrength.adx / 5);
                description = 'Sideways movement with lower highs suggesting distribution';
            }
        } else {
            phase = 'Accumulation';
            confidence = 40;
            description = 'Unclear market phase, showing mixed signals';
        }

        return {
            current: phase,
            duration: 0, // This should be calculated based on when the phase started
            confidence: Math.min(100, Math.max(0, confidence)),
            description
        };
    }

    private calculateVolumeAnalysis(candles: CandleData[]): {
        volumeOscillator: number;
        vma_7: number;
        vma_30: number;
        trend: 'Strong Bullish' | 'Bullish' | 'Strong Bearish' | 'Bearish' | 'Neutral';
        trendStrength: number;
        signal: string;
        priceVolumeCorrelation: number;
    } {
        // Calculate volume moving averages in USD
        const volumes = candles.map(c => c.volume * c.close); // Convert to USD
        const prices = candles.map(c => c.close);
        
        // Calculate VMAs
        const vma7 = this.calculateSMA(volumes.slice(-7));
        const vma30 = this.calculateSMA(volumes.slice(-30));
        
        // Calculate volume oscillator
        const volumeOscillator = ((vma7 - vma30) / vma30) * 100;

        // Calculate price-volume correlation
        const priceChanges = prices.slice(1).map((price, i) => price - prices[i]);
        const volumeChanges = volumes.slice(1).map((vol, i) => vol - volumes[i]);
        const correlation = this.calculateCorrelation(priceChanges, volumeChanges);

        // Calculate recent volume trend
        const recentVolumes = volumes.slice(-5);
        const avgRecentVolume = this.calculateSMA(recentVolumes);
        const volumeStrength = (avgRecentVolume / this.calculateSMA(volumes)) - 1;

        // Determine trend and signal
        let trend: 'Strong Bullish' | 'Bullish' | 'Strong Bearish' | 'Bearish' | 'Neutral' = 'Neutral';
        let signal = '';

        const recentPriceChange = (prices[prices.length - 1] - prices[prices.length - 5]) / prices[prices.length - 5] * 100;

        if (volumeOscillator > 10 && correlation > 0.5 && recentPriceChange > 0) {
            trend = 'Strong Bullish';
            signal = 'High volume supporting price increase. Strong buying pressure.';
        } else if (volumeOscillator > 5 && correlation > 0.3 && recentPriceChange > 0) {
            trend = 'Bullish';
            signal = 'Moderate volume with upward price movement.';
        } else if (volumeOscillator < -10 && correlation < -0.5 && recentPriceChange < 0) {
            trend = 'Strong Bearish';
            signal = 'High volume with price decline. Strong selling pressure.';
        } else if (volumeOscillator < -5 && correlation < -0.3 && recentPriceChange < 0) {
            trend = 'Bearish';
            signal = 'Moderate volume with downward price movement.';
        } else {
            trend = 'Neutral';
            signal = Math.abs(volumeOscillator) < 5 
                ? 'Low volume indicating lack of conviction.'
                : 'Mixed signals. Watch for trend confirmation.';
        }

        return {
            volumeOscillator,
            vma_7: vma7,
            vma_30: vma30,
            trend,
            trendStrength: Math.abs(volumeStrength),
            signal,
            priceVolumeCorrelation: correlation
        };
    }

    private calculateCorrelation(array1: number[], array2: number[]): number {
        const mean1 = array1.reduce((acc, val) => acc + val, 0) / array1.length;
        const mean2 = array2.reduce((acc, val) => acc + val, 0) / array2.length;

        const variance1 = array1.reduce((acc, val) => acc + Math.pow(val - mean1, 2), 0);
        const variance2 = array2.reduce((acc, val) => acc + Math.pow(val - mean2, 2), 0);

        const covariance = array1.reduce((acc, val, i) => acc + (val - mean1) * (array2[i] - mean2), 0);

        return covariance / Math.sqrt(variance1 * variance2);
    }

    private calculateSMA(values: number[]): number {
        if (!values.length) return 0;
        return values.reduce((acc, val) => acc + val, 0) / values.length;
    }
}