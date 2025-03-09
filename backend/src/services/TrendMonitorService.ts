// src/services/TrendMonitorService.ts
import { CandleModel } from '../models/Candle';
import { CryptoAnalyzer } from './CryptoAnalyzer';

interface TrendChange {
  pair: string;
  indicator: string;
  previousValue: string;
  newValue: string;
  timestamp: number;
  significance: 'low' | 'medium' | 'high';
}

export class TrendMonitorService {
  private readonly analyzer: CryptoAnalyzer;
  private lastAnalysis: Map<string, any> = new Map();
  
  constructor() {
    this.analyzer = new CryptoAnalyzer();
  }
  
  async monitorTrends(pairs: string[]): Promise<TrendChange[]> {
    const changes: TrendChange[] = [];
    
    // Analyze current data
    const currentAnalysis = await this.analyzer.analyzePairs(pairs);
    
    // Compare with previous analysis
    for (const analysis of currentAnalysis.pairs) {
      const pair = analysis.pair;
      const previous = this.lastAnalysis.get(pair);
      
      if (previous) {
        // Check for MACD trend changes
        if (previous.macdTrend !== analysis.macdTrend) {
          changes.push({
            pair,
            indicator: 'MACD Trend',
            previousValue: previous.macdTrend,
            newValue: analysis.macdTrend,
            timestamp: Date.now(),
            significance: 
              analysis.macdTrend.includes('Strong') ? 'high' : 
              analysis.macdTrend.includes('Weak') ? 'medium' : 'low'
          });
        }
        
        // Check for RSI crossing key levels
        const prevRSI = parseFloat(previous.rsi);
        const currentRSI = parseFloat(analysis.rsi);
        
        if ((prevRSI < 30 && currentRSI >= 30) || (prevRSI > 70 && currentRSI <= 70) ||
            (prevRSI < 70 && currentRSI >= 70) || (prevRSI > 30 && currentRSI <= 30)) {
          changes.push({
            pair,
            indicator: 'RSI',
            previousValue: previous.rsi,
            newValue: analysis.rsi,
            timestamp: Date.now(),
            significance: 'medium'
          });
        }
        
        // Check for significant price changes
        const prevPrice = parseFloat(previous.currentPrice);
        const currentPrice = parseFloat(analysis.currentPrice);
        const priceChange = ((currentPrice - prevPrice) / prevPrice) * 100;
        
        if (Math.abs(priceChange) > 5) {
          changes.push({
            pair,
            indicator: 'Price',
            previousValue: previous.currentPrice,
            newValue: analysis.currentPrice,
            timestamp: Date.now(),
            significance: Math.abs(priceChange) > 10 ? 'high' : 'medium'
          });
        }
        
        // Check for MA crossovers
        const prevEMA50 = parseFloat(previous.ema_50 || '0');
        const prevEMA200 = parseFloat(previous.ema_200 || '0');
        const currEMA50 = parseFloat(analysis.ema_50 || '0');
        const currEMA200 = parseFloat(analysis.ema_200 || '0');
        
        // Golden/Death cross detection
        if ((prevEMA50 <= prevEMA200 && currEMA50 > currEMA200) || 
            (prevEMA50 >= prevEMA200 && currEMA50 < currEMA200)) {
          changes.push({
            pair,
            indicator: 'EMA Crossover',
            previousValue: prevEMA50 > prevEMA200 ? 'Above (Golden Cross)' : 'Below (Death Cross)',
            newValue: currEMA50 > currEMA200 ? 'Above (Golden Cross)' : 'Below (Death Cross)',
            timestamp: Date.now(),
            significance: 'high'
          });
        }
      }
      
      // Update last analysis
      this.lastAnalysis.set(pair, analysis);
    }
    
    return changes;
  }
}