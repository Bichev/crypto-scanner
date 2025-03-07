// src/services/CorrelationService.ts
import { CandleModel } from '../models/Candle';

interface CorrelationAnalysis {
  pair1: string;
  pair2: string;
  correlation: number;
  period: string;
  strength: string;
}

export class CorrelationService {
  // Calculate Pearson correlation coefficient
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    
    // Ensure arrays are of equal length
    x = x.slice(0, n);
    y = y.slice(0, n);
    
    // Calculate means
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;
    
    // Calculate covariance and standard deviations
    let covariance = 0;
    let xStdDev = 0;
    let yStdDev = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      
      covariance += xDiff * yDiff;
      xStdDev += xDiff * xDiff;
      yStdDev += yDiff * yDiff;
    }
    
    // Avoid division by zero
    if (xStdDev === 0 || yStdDev === 0) return 0;
    
    // Calculate correlation coefficient
    return covariance / (Math.sqrt(xStdDev) * Math.sqrt(yStdDev));
  }
  
  // Get correlation strength description
  private getCorrelationStrength(correlation: number): string {
    const absCorrelation = Math.abs(correlation);
    
    if (absCorrelation > 0.9) return 'Very Strong';
    if (absCorrelation > 0.7) return 'Strong';
    if (absCorrelation > 0.5) return 'Moderate';
    if (absCorrelation > 0.3) return 'Weak';
    return 'Very Weak';
  }
  
  async analyzeCorrelations(pairs: string[], period: number = 30): Promise<CorrelationAnalysis[]> {
    const results: CorrelationAnalysis[] = [];
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - (period * 86400); // Convert days to seconds
    
    // Get closing prices for all pairs
    const pairData = new Map<string, number[]>();
    
    for (const pair of pairs) {
      const candles = await CandleModel.find({ 
        pair, 
        timestamp: { $gte: startTime } 
      }).sort({ timestamp: 1 });
      
      if (candles.length > 0) {
        pairData.set(pair, candles.map(c => c.close));
      }
    }
    
    // Calculate correlation between each pair
    for (let i = 0; i < pairs.length; i++) {
      for (let j = i + 1; j < pairs.length; j++) {
        const pair1 = pairs[i];
        const pair2 = pairs[j];
        
        const prices1 = pairData.get(pair1);
        const prices2 = pairData.get(pair2);
        
        if (prices1 && prices2 && prices1.length >= 7 && prices2.length >= 7) {
          const correlation = this.calculateCorrelation(prices1, prices2);
          const strength = this.getCorrelationStrength(correlation);
          
          results.push({
            pair1,
            pair2,
            correlation,
            period: `${period} days`,
            strength
          });
        }
      }
    }
    
    // Sort by absolute correlation (highest first)
    return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }
}