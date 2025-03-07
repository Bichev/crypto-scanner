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

    private calculateFibonacciLevels(high: number, low: number): { level: number; price: number }[] {
        const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const range = high - low;
        
        return fibLevels.map(level => ({
            level,
            price: high - (range * level)
        }));
    }

    private findSupportResistanceLevels(candles: CandleData[], lookbackPeriod: number = 90): {
        supports: number[];
        resistances: number[];
        nearestSupport: number;
        nearestResistance: number;
    } {
        const recentCandles = candles.slice(-lookbackPeriod);
        const pricePoints = recentCandles.map(c => ({
            high: c.high,
            low: c.low,
            volume: c.volume
        }));

        // Group similar price levels (within 0.5% range)
        const levels = new Map<number, { count: number; volume: number }>();
        
        pricePoints.forEach(point => {
            [point.high, point.low].forEach(price => {
                let found = false;
                for (const [level, data] of levels) {
                    if (Math.abs((price - level) / level) <= 0.005) {
                        // Update existing level with volume-weighted average
                        const newLevel = (level * data.volume + price * point.volume) / (data.volume + point.volume);
                        levels.set(newLevel, {
                            count: data.count + 1,
                            volume: data.volume + point.volume
                        });
                        levels.delete(level);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    levels.set(price, { count: 1, volume: point.volume });
                }
            });
        });

        // Filter significant levels (touched at least 3 times)
        const significantLevels = Array.from(levels.entries())
            .filter(([_, data]) => data.count >= 3)
            .sort(([a], [b]) => a - b);

        const currentPrice = candles[candles.length - 1].close;
        const supports = significantLevels
            .filter(([price]) => price < currentPrice)
            .map(([price]) => price);
        const resistances = significantLevels
            .filter(([price]) => price > currentPrice)
            .map(([price]) => price);

        return {
            supports,
            resistances,
            nearestSupport: supports.length > 0 ? supports[supports.length - 1] : currentPrice,
            nearestResistance: resistances.length > 0 ? resistances[0] : currentPrice
        };
    }

    private calculatePriceLevels(candles: CandleData[]): {
        fibonacci: { level: number; price: number }[];
        supports: number[];
        resistances: number[];
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
            this.findSupportResistanceLevels(candles);

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

    private calculateIndicators(allTimeCandles: CandleData[], threeMonthCandles: CandleData[]) {
        // Example of safe toFixed usage with null check
        const safeToFixed = (value: any, decimals: number): string => {
            if (value === undefined || value === null || isNaN(value)) {
            return "0"; // Or any default value you prefer
            }
            return value.toFixed(decimals);
        };

        const closePrices = allTimeCandles.map(candle => candle.close);
        const volumes = allTimeCandles.map(candle => candle.volume);
        const highs = allTimeCandles.map(candle => candle.high);
        const lows = allTimeCandles.map(candle => candle.low);
        const currentPrice = closePrices[closePrices.length - 1];

        // Calculate price levels
        const priceLevels = this.calculatePriceLevels(allTimeCandles);

        // Calculate RSI with multiple periods
        const rsi = ti.RSI.calculate({
            values: closePrices,
            period: 14
        });

        // Calculate Stochastic Oscillator
        const stoch = ti.Stochastic.calculate({
            high: highs,
            low: lows,
            close: closePrices,
            period: 14,
            signalPeriod: 3
        });

        // Calculate Williams %R
        const williamsr = ti.WilliamsR.calculate({
            high: highs,
            low: lows,
            close: closePrices,
            period: 14
        });

        // Calculate CCI
        const cci = ti.CCI.calculate({
            high: highs,
            low: lows,
            close: closePrices,
            period: 20
        });

        // Calculate MFI
        const mfi = ti.MFI.calculate({
            high: highs,
            low: lows,
            close: closePrices,
            volume: volumes,
            period: 14
        });

        // Calculate ADX
        const adxResult = ti.ADX.calculate({
            high: highs,
            low: lows,
            close: closePrices,
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

        // Calculate Bollinger Bands
        const bb = ti.BollingerBands.calculate({
            values: closePrices,
            period: 20,
            stdDev: 2
        });

        // Calculate ATR (Average True Range)
        const atr = ti.ATR.calculate({
            high: highs,
            low: lows,
            close: closePrices,
            period: 14
        });

        // Calculate Stochastic RSI
        const stochRsi = ti.StochasticRSI.calculate({
            values: closePrices,
            rsiPeriod: 14,
            stochasticPeriod: 14,
            kPeriod: 3,
            dPeriod: 3
        });

        // Calculate ROC (Rate of Change)
        const roc = ti.ROC.calculate({
            values: closePrices,
            period: 14
        });

        // Volume analysis
        const vma7 = ti.SMA.calculate({ values: volumes, period: 7 });
        const vma30 = ti.SMA.calculate({ values: volumes, period: 30 });
        const obv = ti.OBV.calculate({
            close: closePrices,
            volume: volumes
        });

        // Get latest values
        const latestMACD = macd[macd.length - 1] || { MACD: 0, signal: 0, histogram: 0 };
        const latestBB = bb[bb.length - 1] || { middle: currentPrice, upper: currentPrice, lower: currentPrice };
        const latestStochRSI = stochRsi[stochRsi.length - 1] || { k: 50, d: 50 };
        const latestROC = roc[roc.length - 1] || 0;
        const latestATR = atr[atr.length - 1] || 0;
        const volumeOscillator = ((vma7[vma7.length - 1] - vma30[vma30.length - 1]) / vma30[vma30.length - 1]) * 100;

        // Calculate historical highs and lows
        const allTimeHigh = Math.max(...allTimeCandles.map(c => c.high));
        const allTimeLow = Math.min(...allTimeCandles.map(c => c.low));
        const percentFromHigh = ((currentPrice - allTimeHigh) / allTimeHigh) * 100;
        const percentFromLow = ((currentPrice - allTimeLow) / allTimeLow) * 100;

        // Calculate volatility
        const volatility = this.calculateVolatility(closePrices, 14);
        
        // Calculate price momentum
        const momentum = this.calculateMomentum(closePrices, 14);

        // Calculate three-month change
        const threeMonthStartPrice = threeMonthCandles[0]?.close || currentPrice;
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
        const bollingerBands = this.calculateBollingerBands(closePrices);
        const ichimoku = this.calculateIchimoku(highs, lows, closePrices);
        const stochastic = this.calculateStochastic(highs, lows, closePrices);
        const advancedATR = this.calculateATR(highs, lows, closePrices);
        const supportResistance = this.calculateSupportResistance(closePrices);
        // Make sure all the inputs to calculateAdvancedTrend have values
        const advancedTrend = macd && macd.length > 0 && rsi && rsi.length > 0 
        ? this.calculateAdvancedTrend(
            closePrices, 
            macd, 
            rsi, 
            ema50,
            ema200
            )
        : 'Insufficient Data';
        const volatilityIndex = this.calculateVolatilityIndex(
            closePrices,
            ti.ATR.calculate({ high: highs, low: lows, close: closePrices, period: 14 })
        );
        
        // Enhanced scores
        const enhancedScore = this.calculateEnhancedCompositeScore({
            rsi: rsi[rsi.length - 1],
            macdTrend: this.calculateMACDTrend(macd),
            volumeOscillator: ((vma7[vma7.length - 1] - vma30[vma30.length - 1]) / vma30[vma30.length - 1]) * 100,
            dailyPriceChange: this.calculateDailyPriceChange(allTimeCandles),
            sma_7: sma7[sma7.length - 1],
            sma_30: sma30[sma30.length - 1],
            sma_50: sma50[sma50.length - 1],
            sma_200: sma200[sma200.length - 1],
            atr: advancedATR.normalizedATR,
            percentChangeFromHigh: ((currentPrice - allTimeHigh) / allTimeHigh) * 100
        });

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
            obv: obv[obv.length - 1]?.toString(),
            obvChange: ((obv[obv.length - 1] - obv[obv.length - 2]) / obv[obv.length - 2] * 100).toFixed(2),
            
            // RSI indicators
            rsi: rsi[rsi.length - 1]?.toFixed(2),
            rsiDivergence: this.calculateRSIDivergence(closePrices, rsi, 14),
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
            bb_middle: latestBB.middle?.toFixed(8),
            bb_upper: latestBB.upper?.toFixed(8),
            bb_lower: latestBB.lower?.toFixed(8),
            bb_width: ((latestBB.upper - latestBB.lower) / latestBB.middle * 100).toFixed(2),
            
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
                    bbUpper: latestBB.upper,
                    bbLower: latestBB.lower,
                    bbMiddle: latestBB.middle,
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
                upper: bollingerBands.upper !== undefined ? safeToFixed(bollingerBands.upper, 8) : "0",
                middle: bollingerBands.sma !== undefined ? safeToFixed(bollingerBands.sma, 8) : "0",
                lower: bollingerBands.lower !== undefined ? safeToFixed(bollingerBands.lower, 8) : "0",
                bandwidth: bollingerBands.bandwidth !== undefined ? safeToFixed(bollingerBands.bandwidth, 2) : "0",
                percentB: bollingerBands.percentB !== undefined ? safeToFixed(bollingerBands.percentB, 2) : "0",
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
        const returns = prices.slice(1).map((price, i) => 
            ((price - prices[i]) / prices[i]) * 100
        );
        const meanReturn = returns.slice(-period).reduce((a, b) => a + b, 0) / period;
        const variance = returns.slice(-period)
            .reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / period;
        return Math.sqrt(variance);
    }

    private calculateMomentum(prices: number[], period: number): number {
        const currentPrice = prices[prices.length - 1];
        const previousPrice = prices[prices.length - 1 - period];
        return ((currentPrice - previousPrice) / previousPrice) * 100;
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
        const sma = ti.SMA.calculate({ values: prices, period });
        
        // Calculate standard deviation
        const stdDevValues: number[] = [];
        for (let i = period - 1; i < prices.length; i++) {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = slice.reduce((sum, val) => sum + val, 0) / period;
        const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
        stdDevValues.push(Math.sqrt(variance));
        }
        
        // Calculate upper and lower bands
        const upperBand = sma.map((val, i) => val + (stdDevValues[i] * stdDev));
        const lowerBand = sma.map((val, i) => val - (stdDevValues[i] * stdDev));
        
        const latestPrice = prices[prices.length - 1];
        const latestSMA = sma[sma.length - 1];
        const latestUpper = upperBand[upperBand.length - 1];
        const latestLower = lowerBand[lowerBand.length - 1];
        
        // Calculate bandwidth and %B
        const bandwidth = (latestUpper - latestLower) / latestSMA * 100;
        const percentB = (latestPrice - latestLower) / (latestUpper - latestLower);
        
        return {
        sma: latestSMA,
        upper: latestUpper,
        lower: latestLower,
        bandwidth,
        percentB,
        signal: percentB > 1 ? 'Overbought' : percentB < 0 ? 'Oversold' : 'Neutral'
        };
    }

    // Add Ichimoku Cloud calculation
    private calculateIchimoku(high: number[], low: number[], close: number[]): any {
        const tenkanPeriod = 9;
        const kijunPeriod = 26;
        const senkouBPeriod = 52;
        const displacement = 26;
        
        // Calculate Tenkan-sen (Conversion Line)
        const tenkan = [];
        for (let i = tenkanPeriod - 1; i < high.length; i++) {
        const highVal = Math.max(...high.slice(i - tenkanPeriod + 1, i + 1));
        const lowVal = Math.min(...low.slice(i - tenkanPeriod + 1, i + 1));
        tenkan.push((highVal + lowVal) / 2);
        }
        
        // Calculate Kijun-sen (Base Line)
        const kijun = [];
        for (let i = kijunPeriod - 1; i < high.length; i++) {
        const highVal = Math.max(...high.slice(i - kijunPeriod + 1, i + 1));
        const lowVal = Math.min(...low.slice(i - kijunPeriod + 1, i + 1));
        kijun.push((highVal + lowVal) / 2);
        }
        
        // Calculate Senkou Span A (Leading Span A)
        const senkouA = [];
        for (let i = 0; i < tenkan.length && i < kijun.length; i++) {
        senkouA.push((tenkan[i] + kijun[i]) / 2);
        }
        
        // Calculate Senkou Span B (Leading Span B)
        const senkouB = [];
        for (let i = senkouBPeriod - 1; i < high.length; i++) {
        const highVal = Math.max(...high.slice(i - senkouBPeriod + 1, i + 1));
        const lowVal = Math.min(...low.slice(i - senkouBPeriod + 1, i + 1));
        senkouB.push((highVal + lowVal) / 2);
        }
        
        // Calculate Chikou Span (Lagging Span)
        const chikou = close.slice(displacement);
        
        const currentPrice = close[close.length - 1];
        const latestTenkan = tenkan[tenkan.length - 1];
        const latestKijun = kijun[kijun.length - 1];
        const latestSenkouA = senkouA[senkouA.length - displacement - 1] || null;
        const latestSenkouB = senkouB[senkouB.length - displacement - 1] || null;
        
        // Cloud analysis
        let signal = 'Neutral';
        if (latestSenkouA && latestSenkouB) {
        if (currentPrice > latestSenkouA && currentPrice > latestSenkouB) {
            signal = 'Strong Bullish';
        } else if (currentPrice < latestSenkouA && currentPrice < latestSenkouB) {
            signal = 'Strong Bearish';
        } else if (latestSenkouA > latestSenkouB) {
            signal = 'Bullish';
        } else {
            signal = 'Bearish';
        }
        }
        
        // TK Cross analysis
        let tkCross = 'None';
        if (latestTenkan > latestKijun && tenkan[tenkan.length - 2] <= kijun[kijun.length - 2]) {
        tkCross = 'Bullish TK Cross';
        } else if (latestTenkan < latestKijun && tenkan[tenkan.length - 2] >= kijun[kijun.length - 2]) {
        tkCross = 'Bearish TK Cross';
        }
        
        return {
        tenkan: latestTenkan,
        kijun: latestKijun,
        senkouA: latestSenkouA,
        senkouB: latestSenkouB,
        currentPrice,
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

    // Calculate potential support and resistance levels
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
        const strongUptrends = pairs.filter(pair => pair.macdTrend === 'Strong Uptrend').length;
        const strongDowntrends = pairs.filter(pair => pair.macdTrend === 'Strong Downtrend').length;
        
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
}