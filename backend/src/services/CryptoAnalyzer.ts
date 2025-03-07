import moment from 'moment-timezone';
import { CandleData, CoinbaseDataFetcher } from './CoinbaseDataFetcher';
import * as ti from 'technicalindicators';
import { CandleModel } from '../models/Candle';
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

    async analyzePairs(pairs: string[]): Promise<any[]> {
        const results = [];
        
        for (const pair of pairs) {
          try {
            // Get data from MongoDB instead of API
            const threeMonthsAgo = moment().subtract(3, 'months').unix();
            const fiveYearsAgo = moment().subtract(5, 'years').unix();
            
            const [threeMonthCandles, allTimeCandles] = await Promise.all([
              CandleModel.find({ 
                pair, 
                timestamp: { $gte: threeMonthsAgo } 
              }).sort({ timestamp: 1 }),
              
              CandleModel.find({ 
                pair, 
                timestamp: { $gte: fiveYearsAgo } 
              }).sort({ timestamp: 1 }),
              
            //   this.dataFetcher.getCurrentPrice(pair)
            ]);
            
            if (threeMonthCandles.length === 0 || allTimeCandles.length === 0) {
              console.log(`No data available for ${pair}. Skipping...`);
              continue;
            }
            
            // Calculate USD volume
            const lastCandle = allTimeCandles[allTimeCandles.length - 1];
            const currentVolumeUSD = lastCandle.volume * lastCandle.close;
            
            // Add delay after fetching current price
            // await this.delay(this.API_DELAY);
            
            // Calculate other metrics
            const analysis = this.calculateIndicators(
              allTimeCandles.map((c: CandleData) => ({
                timestamp: c.timestamp,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
              })), 
              threeMonthCandles.map((c: CandleData) => ({
                timestamp: c.timestamp,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
              }))
            );
            
            results.push({
              pair,
              currentVolumeUSD: currentVolumeUSD.toFixed(2),
              ...analysis
            });
          } catch (error) {
            console.error(`Error analyzing ${pair} from database:`, error);
          }
        }
        
        return results;
      }

    private calculateIndicators(allTimeCandles: CandleData[], threeMonthCandles: CandleData[]) {
        const closePrices = allTimeCandles.map(candle => candle.close);
        const volumes = allTimeCandles.map(candle => candle.volume);
        const currentPrice = closePrices[closePrices.length - 1];

        // Calculate RSI
        const rsi = ti.RSI.calculate({
            values: closePrices,
            period: 14
        });

        // Calculate MACD
        const macd = ti.MACD.calculate({
            values: closePrices,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        });

        // Calculate moving averages
        const sma7 = ti.SMA.calculate({ values: closePrices, period: 7 });
        const sma30 = ti.SMA.calculate({ values: closePrices, period: 30 });
        const sma50 = ti.SMA.calculate({ values: closePrices, period: 50 });
        const sma200 = ti.SMA.calculate({ values: closePrices, period: 200 });
        
        const ema7 = ti.EMA.calculate({ values: closePrices, period: 7 });
        const ema30 = ti.EMA.calculate({ values: closePrices, period: 30 });
        const ema50 = ti.EMA.calculate({ values: closePrices, period: 50 });
        const ema200 = ti.EMA.calculate({ values: closePrices, period: 200 });

        // Calculate volume indicators
        const vma7 = ti.SMA.calculate({ values: volumes, period: 7 });
        const vma30 = ti.SMA.calculate({ values: volumes, period: 30 });

        const latestMACD = macd[macd.length - 1] || { MACD: 0, signal: 0, histogram: 0 };
        const volumeOscillator = ((vma7[vma7.length - 1] - vma30[vma30.length - 1]) / vma30[vma30.length - 1]) * 100;

        // Calculate historical highs and lows
        const allTimeHigh = Math.max(...allTimeCandles.map(c => c.high));
        const allTimeLow = Math.min(...allTimeCandles.map(c => c.low));
        const percentFromHigh = ((currentPrice - allTimeHigh) / allTimeHigh) * 100;
        const percentFromLow = ((currentPrice - allTimeLow) / allTimeLow) * 100;

        // Calculate three-month change
        const threeMonthStartPrice = threeMonthCandles[0]?.close || currentPrice;
        const threeMonthChange = ((currentPrice - threeMonthStartPrice) / threeMonthStartPrice) * 100;

        // Calculate short-term and long-term scores
        const shortTermScore = this.calculateShortTermScore(rsi[rsi.length - 1], latestMACD, sma7[sma7.length - 1], sma30[sma30.length - 1]);
        const longTermScore = this.calculateLongTermScore(sma50[sma50.length - 1], sma200[sma200.length - 1], percentFromHigh, percentFromLow);
        const riskAdjustedScore = (shortTermScore + longTermScore) / 2;

        return {
            currentPrice: currentPrice.toFixed(8),
            dailyPriceChange: this.calculateDailyPriceChange(allTimeCandles),
            percentChangeFromHigh: percentFromHigh.toFixed(2),
            percentChangeFromLow: percentFromLow.toFixed(2),
            percentChangeLastThreeMonths: threeMonthChange.toFixed(2),
            
            // Volume indicators
            vma_7: vma7[vma7.length - 1]?.toFixed(2),
            vma_30: vma30[vma30.length - 1]?.toFixed(2),
            volumeOscillator: volumeOscillator.toFixed(2),
            
            // Technical indicators
            rsi: rsi[rsi.length - 1]?.toFixed(2),
            
            // MACD
            macd: latestMACD?.MACD?.toFixed(8) ?? "0.00000000",
            signalLine: latestMACD?.signal?.toFixed(8) ?? "0.00000000",
            histogram: latestMACD?.histogram?.toFixed(8) ?? "0.00000000",
            macdTrend: this.calculateMACDTrend(macd),
            
            // Moving averages
            sma_7: sma7[sma7.length - 1]?.toFixed(8),
            sma_30: sma30[sma30.length - 1]?.toFixed(8),
            sma_50: sma50[sma50.length - 1]?.toFixed(8),
            sma_200: sma200[sma200.length - 1]?.toFixed(8),
            ema_7: ema7[ema7.length - 1]?.toFixed(8),
            ema_30: ema30[ema30.length - 1]?.toFixed(8),
            ema_50: ema50[ema50.length - 1]?.toFixed(8),
            ema_200: ema200[ema200.length - 1]?.toFixed(8),
            
            // Composite scores
            shortTermScore: shortTermScore.toFixed(2),
            longTermScore: longTermScore.toFixed(2),
            riskAdjustedScore: riskAdjustedScore.toFixed(2)
        };
    }

    private calculateShortTermScore(rsi: number, macd: any, sma7: number, sma30: number): number {
        let score = 0.5; // Start at neutral

        // RSI component (0.3 weight)
        if (rsi > 70) score -= 0.15;
        else if (rsi < 30) score += 0.15;
        else score += 0.15 * ((rsi - 30) / 40 - 0.5);

        // MACD component (0.4 weight)
        if (macd.histogram > 0) score += 0.2;
        if (macd.histogram < 0) score -= 0.2;

        // Short-term MA component (0.3 weight)
        if (sma7 > sma30) score += 0.15;
        if (sma7 < sma30) score -= 0.15;

        // Ensure score is between 0 and 1
        return Math.max(0, Math.min(1, score));
    }

    private calculateLongTermScore(sma50: number, sma200: number, percentFromHigh: number, percentFromLow: number): number {
        let score = 0.5; // Start at neutral

        // Long-term MA component (0.4 weight)
        if (sma50 > sma200) score += 0.2;
        if (sma50 < sma200) score -= 0.2;

        // Historical price levels component (0.6 weight)
        const pricePositionScore = (Math.abs(percentFromLow) - Math.abs(percentFromHigh)) / (Math.abs(percentFromLow) + Math.abs(percentFromHigh));
        score += 0.3 * pricePositionScore;

        // Ensure score is between 0 and 1
        return Math.max(0, Math.min(1, score));
    }

    private calculateDailyPriceChange(candles: CandleData[]): string {
        if (candles.length < 2) return "0.00";
        const latest = candles[candles.length - 1];
        const previous = candles[candles.length - 2];
        const change = ((latest.close - previous.close) / previous.close) * 100;
        return change.toFixed(2);
    }

    private calculateMACDTrend(macdData: any[]): string {
        if (!macdData || macdData.length < 2) return 'Neutral';
        
        const current = macdData[macdData.length - 1];
        const previous = macdData[macdData.length - 2];
        
        if (!current || !previous) return 'Neutral';

        const macdChange = current.MACD - previous.MACD;
        const signalChange = current.signal - previous.signal;
        const histogram = current.histogram;

        if (histogram > 0 && macdChange > 0) return 'Strong Uptrend';
        if (histogram < 0 && macdChange < 0) return 'Strong Downtrend';
        if (histogram > 0) return 'Weak Uptrend';
        if (histogram < 0) return 'Weak Downtrend';
        return 'Neutral';
    }
}