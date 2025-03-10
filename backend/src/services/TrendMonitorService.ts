// src/services/TrendMonitorService.ts
import { CandleModel } from '../models/Candle';
import { CryptoAnalyzer } from './CryptoAnalyzer';

interface TimeframedTrendChange {
  pair: string;
  indicator: string;
  previousValue: string;
  newValue: string;
  timestamp: number;
    timeframe: 'intraday' | '1d' | '7d' | '30d';  // Modified timeframes
    intradayUpdate: {  // Added intraday tracking
        lastUpdate: number;
        updateCount: number;
        significantChanges: {
            timestamp: number;
            value: string;
            volume: number;
        }[];
    };
  significance: 'low' | 'medium' | 'high';
    confirmation: {
        shorterTimeframe: string;
        longerTimeframe: string;
    };
    volumeMetrics: {
        currentVolume: number;
        averageVolume: number;
        volumeIncrease: number;
        isSignificant: boolean;
        intradayVolumeProfile?: {  // Added intraday volume tracking
            hourlyVolume: number;
            averageHourlyVolume: number;
            volumeSpikes: number[];
        };
    };
    marketContext: MarketContext;
    trendStrength: TrendStrength;
    riskMetrics: RiskMetrics;
    confirmations: SignalConfirmation;
}

interface MarketContext {
    marketTrend: 'bullish' | 'bearish' | 'neutral';
    volatilityRegime: 'high' | 'normal' | 'low';
    sectorPerformance: Record<string, number>;
    marketSentiment: string;
    globalCorrelation: number;
}

interface TrendStrength {
    momentum: number;        // Rate of price change
    consistency: number;     // Trend consistency
    support: number;        // Support level strength
    volumeProfile: number;  // Volume trend strength
    duration: number;       // How long the trend has persisted
    qualityScore: number;   // Overall trend quality
}

interface RiskMetrics {
    volatility: number;
    liquidityScore: number;
    stopLossLevels: {
        tight: number;
        medium: number;
        wide: number;
    };
    riskRewardRatio: number;
    maxDrawdown: number;
    sharpeRatio: number;
}

interface SignalConfirmation {
    macd: boolean;
    rsi: boolean;
    volume: boolean;
    priceAction: boolean;
    movingAverages: boolean;
    support: boolean;
    resistance: boolean;
    confidence: number;
}

export class TrendMonitorService {
  private readonly analyzer: CryptoAnalyzer;
    private readonly RSI_CONFIRMATION_PERIODS = 3;
    private readonly VOLUME_SIGNIFICANCE_THRESHOLD = 50;
    private readonly BATCH_SIZE = 10;
    private readonly INTRADAY_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
    private readonly intradayChanges: Map<string, {
        lastValue: string;
        updates: Array<{ timestamp: number; value: string; volume: number }>;
    }> = new Map();
  
  constructor() {
    this.analyzer = new CryptoAnalyzer();
  }
  
    private isSignificantIntradayChange(
        previousValue: string,
        newValue: string,
        indicator: 'RSI' | 'MACD' | 'Volume' | 'Price'
    ): boolean {
        const prev = parseFloat(previousValue);
        const curr = parseFloat(newValue);
        
        if (isNaN(prev) || isNaN(curr)) return false;

        // Define thresholds for different indicators
        const thresholds = {
            'RSI': 5,        // 5 point change in RSI
            'MACD': 0.1,     // 10% change in MACD
            'Volume': 20,    // 20% change in volume
            'Price': 2       // 2% change in price
        } as const;

        const percentChange = Math.abs((curr - prev) / prev * 100);
        const threshold = thresholds[indicator];

        return percentChange > threshold;
    }

    private async trackIntradayChange(
        pair: string,
        indicator: string,
        value: string,
        volume: number
    ): Promise<{
        isSignificant: boolean;
        updates: Array<{ timestamp: number; value: string; volume: number }>;
    }> {
        const key = `${pair}-${indicator}`;
        const current = this.intradayChanges.get(key) || {
            lastValue: value,
            updates: []
        };

        const isSignificant = this.isSignificantIntradayChange(current.lastValue, value, indicator as 'RSI' | 'MACD' | 'Volume' | 'Price');
        
        if (isSignificant) {
            current.updates.push({
            timestamp: Date.now(),
                value,
                volume
            });

            // Keep only today's updates
            const startOfDay = new Date().setHours(0, 0, 0, 0);
            current.updates = current.updates.filter(update => update.timestamp >= startOfDay);
            
            this.intradayChanges.set(key, {
                lastValue: value,
                updates: current.updates
            });
        }

        return {
            isSignificant,
            updates: current.updates
        };
    }

    private async calculateMarketContext(pairs: string[]): Promise<MarketContext> {
        const analysis = await this.analyzer.analyzePairs(pairs);
        const uptrends = analysis.pairs.filter(p => parseFloat(p.rsi) > 50).length;
        const downtrends = analysis.pairs.filter(p => parseFloat(p.rsi) < 50).length;
        
        return {
            marketTrend: uptrends > downtrends ? 'bullish' : downtrends > uptrends ? 'bearish' : 'neutral',
            volatilityRegime: this.determineVolatilityRegime(analysis.pairs),
            sectorPerformance: this.calculateSectorPerformance(analysis.pairs),
            marketSentiment: analysis.marketSummary.marketSentiment,
            globalCorrelation: await this.calculateGlobalCorrelation(pairs)
        };
    }

    private determineVolatilityRegime(pairs: any[]): 'high' | 'normal' | 'low' {
        const avgVolatility = pairs.reduce((acc, pair) => 
            acc + (parseFloat(pair.volatility) || 0), 0) / pairs.length;
        
        if (avgVolatility > 30) return 'high';
        if (avgVolatility < 10) return 'low';
        return 'normal';
    }

    private calculateSectorPerformance(pairs: any[]): Record<string, number> {
        const sectors: Record<string, { total: number; count: number }> = {};
        
        pairs.forEach(pair => {
            const sector = this.determineSector(pair.pair);
            if (!sectors[sector]) {
                sectors[sector] = { total: 0, count: 0 };
            }
            sectors[sector].total += parseFloat(pair.dailyPriceChange) || 0;
            sectors[sector].count++;
        });

        return Object.entries(sectors).reduce((acc, [sector, data]) => ({
            ...acc,
            [sector]: data.total / data.count
        }), {});
    }

    private async calculateGlobalCorrelation(pairs: string[]): Promise<number> {
        // Implementation for calculating average correlation between all pairs
        return 0.5; // Placeholder
    }

    private determineSector(pair: string): string {
        // Simple sector determination logic - can be enhanced
        if (pair.includes('BTC') || pair.includes('ETH')) return 'Major';
        if (pair.includes('USDT') || pair.includes('USDC')) return 'Stablecoin';
        if (pair.includes('SOL') || pair.includes('ADA')) return 'Layer1';
        if (pair.includes('UNI') || pair.includes('AAVE')) return 'DeFi';
        return 'Other';
    }

    private async calculateTrendStrength(pair: any, historicalData: any[]): Promise<TrendStrength> {
        const momentum = this.calculateMomentum(historicalData);
        const consistency = this.calculateTrendConsistency(historicalData);
        const support = this.calculateSupportStrength(historicalData);
        const volumeProfile = this.calculateVolumeProfile(historicalData);
        const duration = this.calculateTrendDuration(historicalData);
        
        return {
            momentum,
            consistency,
            support,
            volumeProfile,
            duration,
            qualityScore: (momentum + consistency + support + volumeProfile) / 4
        };
    }

    private calculateMomentum(data: any[]): number {
        // Implementation for momentum calculation
        return 0.75; // Placeholder
    }

    private calculateTrendConsistency(data: any[]): number {
        // Implementation for trend consistency calculation
        return 0.8; // Placeholder
    }

    private calculateSupportStrength(data: any[]): number {
        // Implementation for support strength calculation
        return 0.7; // Placeholder
    }

    private calculateVolumeProfile(data: any[]): number {
        // Implementation for volume profile calculation
        return 0.65; // Placeholder
    }

    private calculateTrendDuration(data: any[]): number {
        // Implementation for trend duration calculation
        return 5; // Placeholder: 5 periods
    }

    private async calculateRiskMetrics(pair: any, historicalData: any[]): Promise<RiskMetrics> {
        const volatility = this.calculateVolatility(historicalData);
        const liquidityScore = this.calculateLiquidity(pair);
        const stopLevels = this.calculateStopLevels(historicalData);
        
        return {
            volatility,
            liquidityScore,
            stopLossLevels: stopLevels,
            riskRewardRatio: this.calculateRiskRewardRatio(stopLevels, pair),
            maxDrawdown: this.calculateMaxDrawdown(historicalData),
            sharpeRatio: this.calculateSharpeRatio(historicalData)
        };
    }

    private calculateVolatility(data: any[]): number {
        // Implementation for volatility calculation
        return 15.5; // Placeholder
    }

    private calculateLiquidity(pair: any): number {
        // Implementation for liquidity score calculation
        return 0.8; // Placeholder
    }

    private calculateStopLevels(data: any[]): { tight: number; medium: number; wide: number } {
        // Implementation for stop loss levels calculation
        return {
            tight: 0.98,
            medium: 0.95,
            wide: 0.90
        };
    }

    private calculateRiskRewardRatio(stopLevels: any, pair: any): number {
        // Implementation for risk/reward ratio calculation
        return 2.5; // Placeholder
    }

    private calculateMaxDrawdown(data: any[]): number {
        // Implementation for max drawdown calculation
        return 0.15; // Placeholder
    }

    private calculateSharpeRatio(data: any[]): number {
        // Implementation for Sharpe ratio calculation
        return 1.2; // Placeholder
    }

    private async validateSignal(signal: TimeframedTrendChange): Promise<SignalConfirmation> {
        const confirmations = {
            macd: this.confirmMACD(signal),
            rsi: this.confirmRSI(signal),
            volume: this.confirmVolume(signal),
            priceAction: this.confirmPriceAction(signal),
            movingAverages: this.confirmMovingAverages(signal),
            support: this.confirmSupport(signal),
            resistance: this.confirmResistance(signal),
            confidence: 0
        };

        // Calculate overall confidence based on confirmations
        const totalConfirmations = Object.values(confirmations).filter(v => v === true).length;
        confirmations.confidence = totalConfirmations / (Object.keys(confirmations).length - 1);

        return confirmations;
    }

    private confirmMACD(signal: TimeframedTrendChange): boolean {
        // Implementation for MACD confirmation
        return true; // Placeholder
    }

    private confirmRSI(signal: TimeframedTrendChange): boolean {
        // Implementation for RSI confirmation
        return true; // Placeholder
    }

    private confirmVolume(signal: TimeframedTrendChange): boolean {
        // Implementation for volume confirmation
        return signal.volumeMetrics.isSignificant;
    }

    private confirmPriceAction(signal: TimeframedTrendChange): boolean {
        // Implementation for price action confirmation
        return true; // Placeholder
    }

    private confirmMovingAverages(signal: TimeframedTrendChange): boolean {
        // Implementation for moving averages confirmation
        return true; // Placeholder
    }

    private confirmSupport(signal: TimeframedTrendChange): boolean {
        // Implementation for support level confirmation
        return true; // Placeholder
    }

    private confirmResistance(signal: TimeframedTrendChange): boolean {
        // Implementation for resistance level confirmation
        return true; // Placeholder
    }

    async monitorTrends(pairs: string[]): Promise<TimeframedTrendChange[]> {
        const changes: TimeframedTrendChange[] = [];
        const marketContext = await this.calculateMarketContext(pairs);
        
        // Process pairs in batches
        const batches = this.chunkArray(pairs, this.BATCH_SIZE);
        for (const batch of batches) {
            const batchChanges = await this.processBatch(batch, marketContext);
            
            // Process intraday changes
            for (const change of batchChanges) {
                const { isSignificant, updates } = await this.trackIntradayChange(
                    change.pair,
                    change.indicator,
                    change.newValue,
                    change.volumeMetrics.currentVolume
                );

                if (isSignificant || updates.length > 0) {
                    change.timeframe = 'intraday';
                    change.intradayUpdate = {
                        lastUpdate: Date.now(),
                        updateCount: updates.length,
                        significantChanges: updates
                    };
                } else {
                    change.timeframe = '1d';
                }

                changes.push(change);
            }
        }
        
        return changes;
    }

    private async processBatch(pairs: string[], marketContext: MarketContext): Promise<TimeframedTrendChange[]> {
        const batchChanges: TimeframedTrendChange[] = [];
        const analyses = await Promise.all(pairs.map(pair => this.analyzePair(pair, marketContext)));
        
        for (const analysis of analyses) {
            if (analysis) {
                batchChanges.push(analysis);
            }
        }
        
        return batchChanges;
    }

    private async analyzePair(pair: string, marketContext: MarketContext): Promise<TimeframedTrendChange | null> {
        // Implementation for analyzing individual pair
        // This would include all the trend analysis logic
        return null; // Placeholder
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
  }
}