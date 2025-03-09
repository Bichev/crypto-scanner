// src/services/CorrelationService.ts
import { CandleModel } from '../models/Candle';

interface CorrelationAnalysis {
  pair1: string;
  pair2: string;
  correlation: number;
  pValue: number;
  volumeScore: number;
  volatilityAdjustedCorr: number;
  timeframes: {
    '7d': number;
    '30d': number;
    '90d': number;
  };
  strength: string;
  significance: 'High' | 'Medium' | 'Low';
  averageDailyVolume: number;
  volatility: number;
}

interface TimeSeriesData {
  prices: number[];
  volumes: number[];
  timestamps: number[];
}

export class CorrelationService {
  private readonly VOLUME_THRESHOLD = 300000; // $300k minimum daily USD volume
  private readonly SIGNIFICANCE_LEVELS = {
    HIGH: 0.01,    // 99% confidence
    MEDIUM: 0.05,  // 95% confidence
    LOW: 0.1       // 90% confidence
  };

  // Calculate Pearson correlation coefficient with volume weighting
  private calculateCorrelation(x: number[], y: number[], volumes?: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    // Ensure arrays are of equal length
    x = x.slice(0, n);
    y = y.slice(0, n);
    
    // Apply volume weighting if available
    const weights = volumes ? volumes.slice(0, n).map(v => Math.sqrt(v)) : Array(n).fill(1);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    // Calculate weighted means
    const xMean = x.reduce((sum, val, i) => sum + val * weights[i], 0) / totalWeight;
    const yMean = y.reduce((sum, val, i) => sum + val * weights[i], 0) / totalWeight;
    
    // Calculate weighted covariance and standard deviations
    let covariance = 0;
    let xStdDev = 0;
    let yStdDev = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      const weight = weights[i];
      
      covariance += weight * xDiff * yDiff;
      xStdDev += weight * xDiff * xDiff;
      yStdDev += weight * yDiff * yDiff;
    }
    
    // Avoid division by zero
    if (xStdDev === 0 || yStdDev === 0) return 0;
    
    // Calculate weighted correlation coefficient
    return covariance / (Math.sqrt(xStdDev) * Math.sqrt(yStdDev));
  }

  // Calculate p-value for correlation coefficient
  private calculatePValue(correlation: number, n: number): number {
    const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    // Calculate two-tailed p-value using t-distribution approximation
    const df = n - 2;
    const x = df / (df + t * t);
    const beta = Math.exp(
      0.5 * (Math.log(x) * (df / 2) + Math.log(1 - x) * 0.5 - Math.log(2) / 2)
    );
    return 2 * (1 - (1 - beta));
  }

  // Calculate volatility (standard deviation of returns)
  private calculateVolatility(prices: number[]): number {
    const returns = prices.slice(1).map((price, i) => Math.log(price / prices[i]));
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  private async getTimeSeriesData(pair: string, startTime: number): Promise<TimeSeriesData> {
    const candles = await CandleModel.find({ 
      pair, 
      timestamp: { $gte: startTime } 
    }).sort({ timestamp: 1 });

    return {
      prices: candles.map(c => c.close),
      volumes: candles.map(c => c.volume * c.close), // Convert to USD volume
      timestamps: candles.map(c => c.timestamp)
    };
  }

  private getCorrelationStrength(correlation: number): string {
    const absCorrelation = Math.abs(correlation);
    if (absCorrelation > 0.9) return 'Very Strong';
    if (absCorrelation > 0.7) return 'Strong';
    if (absCorrelation > 0.5) return 'Moderate';
    if (absCorrelation > 0.3) return 'Weak';
    return 'Very Weak';
  }

  async analyzeCorrelations(pairs: string[]): Promise<CorrelationAnalysis[]> {
    const results: CorrelationAnalysis[] = [];
    const now = Math.floor(Date.now() / 1000);
    
    // Define timeframes
    const timeframes = {
      '7d': now - (7 * 86400),
      '30d': now - (30 * 86400),
      '90d': now - (90 * 86400)
    };

    // Get data for all pairs
    const pairData = new Map<string, TimeSeriesData>();
    
    for (const pair of pairs) {
      const data = await this.getTimeSeriesData(pair, timeframes['90d']); // Get 90d data for all calculations
      if (data.prices.length >= 7) { // Minimum data requirement
        pairData.set(pair, data);
      }
    }

    // Calculate correlations between each pair
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const pair1 = pairs[i];
        const pair2 = pairs[j];
        
        const data1 = pairData.get(pair1);
        const data2 = pairData.get(pair2);
        
        if (data1 && data2) {
          // Calculate average daily volume
          const avgVolume1 = data1.volumes.reduce((sum, v) => sum + v, 0) / data1.volumes.length;
          const avgVolume2 = data2.volumes.reduce((sum, v) => sum + v, 0) / data2.volumes.length;
          
          // Skip if volume is too low
          if (avgVolume1 < this.VOLUME_THRESHOLD || avgVolume2 < this.VOLUME_THRESHOLD) {
            continue;
          }

          // Calculate volatilities
          const vol1 = this.calculateVolatility(data1.prices);
          const vol2 = this.calculateVolatility(data2.prices);
          const avgVolatility = (vol1 + vol2) / 2;

          // Calculate correlations for different timeframes
          const timeframeCorrelations = {
            '7d': this.calculateCorrelation(
              data1.prices.slice(-7),
              data2.prices.slice(-7),
              data1.volumes.slice(-7)
            ),
            '30d': this.calculateCorrelation(
              data1.prices.slice(-30),
              data2.prices.slice(-30),
              data1.volumes.slice(-30)
            ),
            '90d': this.calculateCorrelation(
              data1.prices,
              data2.prices,
              data1.volumes
            )
          };

          // Use 30d as the main correlation
          const mainCorrelation = timeframeCorrelations['30d'];
          const pValue = this.calculatePValue(mainCorrelation, 30);
          
          // Calculate volume-weighted score
          const volumeScore = (avgVolume1 + avgVolume2) / (2 * this.VOLUME_THRESHOLD);
          
          // Adjust correlation by volatility
          const volatilityAdjustedCorr = mainCorrelation * (1 - Math.min(avgVolatility, 1));

          // Determine significance
          let significance: 'High' | 'Medium' | 'Low';
          if (pValue <= this.SIGNIFICANCE_LEVELS.HIGH) significance = 'High';
          else if (pValue <= this.SIGNIFICANCE_LEVELS.MEDIUM) significance = 'Medium';
          else significance = 'Low';

          results.push({
            pair1,
            pair2,
            correlation: mainCorrelation,
            pValue,
            volumeScore,
            volatilityAdjustedCorr,
            timeframes: timeframeCorrelations,
            strength: this.getCorrelationStrength(mainCorrelation),
            significance,
            averageDailyVolume: (avgVolume1 + avgVolume2) / 2,
            volatility: avgVolatility
          });
        }
      }
    }
    
    // Sort by absolute correlation and significance
    return results
      .sort((a, b) => {
        const sigScore = { 'High': 3, 'Medium': 2, 'Low': 1 };
        const scoreDiff = sigScore[b.significance] - sigScore[a.significance];
        if (scoreDiff !== 0) return scoreDiff;
        return Math.abs(b.correlation) - Math.abs(a.correlation);
      });
  }
}