import moment from 'moment-timezone';
import { CandleData, CoinbaseDataFetcher } from './CoinbaseDataFetcher';
import * as ti from 'technicalindicators';

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
        // Check cache first
        if (this.cache && (Date.now() - this.cache.timestamp) < this.CACHE_DURATION) {
            console.log('Returning cached data');
            return this.cache.data;
        }

        console.log(`Fetching fresh data for all pairs (${pairs.length} pairs total)`);
        const results = [];
        const now = moment();
        const threeMonthsAgo = now.clone().subtract(3, 'months');
        const fiveYearsAgo = now.clone().subtract(5, 'years');

        let analyzedCount = 0;
        for (const pair of pairs) {
            try {
                analyzedCount++;
                console.log(`Processing ${pair}... (${analyzedCount}/${pairs.length})`);
                const [threeMonthCandles, allTimeCandles] = await Promise.all([
                    this.dataFetcher.fetchDailyCandles(pair, threeMonthsAgo, now),
                    this.dataFetcher.fetchDailyCandles(pair, fiveYearsAgo, now)
                ]);

                if (threeMonthCandles.length === 0 || allTimeCandles.length === 0) {
                    console.log(`No data available for ${pair}. Skipping...`);
                    continue;
                }

                const analysis = this.calculateIndicators(allTimeCandles, threeMonthCandles);
                results.push({
                    pair,
                    ...analysis
                });

                // Add delay between pairs to avoid rate limiting
                await this.delay(this.API_DELAY);
            } catch (error: any) {
                console.error(`Error analyzing ${pair}:`, error);
                if (error.response?.data?.message === 'Public rate limit exceeded') {
                    console.log('Rate limit hit, increasing delay...');
                    await this.delay(this.API_DELAY * 2);
                }
            }
        }

        // Update cache
        this.cache = {
            timestamp: Date.now(),
            data: results
        };

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
        const ema7 = ti.EMA.calculate({ values: closePrices, period: 7 });
        const ema30 = ti.EMA.calculate({ values: closePrices, period: 30 });

        // Calculate volume indicators
        const vma7 = ti.SMA.calculate({ values: volumes, period: 7 });
        const vma30 = ti.SMA.calculate({ values: volumes, period: 30 });

        const latestMACD = macd[macd.length - 1] || { MACD: 0, signal: 0, histogram: 0 };
        const volumeOscillator = ((vma7[vma7.length - 1] - vma30[vma30.length - 1]) / vma30[vma30.length - 1]) * 100;

        return {
            currentPrice: currentPrice.toFixed(8),
            dailyPriceChange: this.calculateDailyPriceChange(allTimeCandles),
            rsi: rsi[rsi.length - 1]?.toFixed(2),
            macd: latestMACD?.MACD?.toFixed(8) ?? "0.00000000",
            signalLine: latestMACD?.signal?.toFixed(8) ?? "0.00000000",
            histogram: latestMACD?.histogram?.toFixed(8) ?? "0.00000000",
            macdTrend: this.calculateMACDTrend(macd),
            volumeOscillator: volumeOscillator.toFixed(2),
            sma7: sma7[sma7.length - 1]?.toFixed(8),
            sma30: sma30[sma30.length - 1]?.toFixed(8),
            ema7: ema7[ema7.length - 1]?.toFixed(8),
            ema30: ema30[ema30.length - 1]?.toFixed(8),
            // Add more indicators as needed
        };
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