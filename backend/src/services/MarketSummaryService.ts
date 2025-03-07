// src/services/MarketSummaryService.ts
import { CryptoAnalyzer } from './CryptoAnalyzer';
import { CandleModel } from '../models/Candle';
import mongoose from 'mongoose';

interface MarketSummary {
  timestamp: number;
  totalPairs: number;
  trendDistribution: {
    strongUptrend: number;
    weakUptrend: number;
    neutral: number;
    weakDowntrend: number;
    strongDowntrend: number;
  };
  rsiDistribution: {
    oversold: number;
    neutral: number;
    overbought: number;
  };
  volumeChange: number;
  topGainers: { pair: string; change: string }[];
  topLosers: { pair: string; change: string }[];
  marketSentiment: string;
}

export class MarketSummaryService {
  private readonly analyzer: CryptoAnalyzer;
  
  constructor() {
    this.analyzer = new CryptoAnalyzer();
  }
  
  async generateMarketSummary(): Promise<MarketSummary> {
    // Get all pairs from database
    const pairs = await CandleModel.distinct('pair');
    
    // Analyze all pairs
    const analyses = await this.analyzer.analyzePairs(pairs);
    
    // Calculate distributions
    const trendDistribution = {
      strongUptrend: 0,
      weakUptrend: 0,
      neutral: 0,
      weakDowntrend: 0,
      strongDowntrend: 0
    };
    
    const rsiDistribution = {
      oversold: 0,
      neutral: 0,
      overbought: 0
    };
    
    let totalVolume = 0;
    let prevTotalVolume = 0;
    
    // Process each analysis
    analyses.forEach(analysis => {
      // Count trend types
      if (analysis.macdTrend?.includes('Strong Up')) trendDistribution.strongUptrend++;
      else if (analysis.macdTrend?.includes('Weak Up')) trendDistribution.weakUptrend++;
      else if (analysis.macdTrend?.includes('Strong Down')) trendDistribution.strongDowntrend++;
      else if (analysis.macdTrend?.includes('Weak Down')) trendDistribution.weakDowntrend++;
      else trendDistribution.neutral++;
      
      // Count RSI distribution
      const rsi = parseFloat(analysis.rsi);
      if (rsi >= 70) rsiDistribution.overbought++;
      else if (rsi <= 30) rsiDistribution.oversold++;
      else rsiDistribution.neutral++;
      
      // Sum volumes
      totalVolume += parseFloat(analysis.currentVolumeUSD || '0');
      prevTotalVolume += parseFloat(analysis.vma_7 || '0');
    });
    
    // Calculate volume change
    const volumeChange = prevTotalVolume > 0 ? 
      ((totalVolume - prevTotalVolume) / prevTotalVolume) * 100 : 0;
    
    // Sort for top gainers/losers
    const sortedByChange = [...analyses].sort(
      (a, b) => parseFloat(b.dailyPriceChange) - parseFloat(a.dailyPriceChange)
    );
    
    // Get top 5 gainers and losers
    const topGainers = sortedByChange.slice(0, 5).map(a => ({ 
      pair: a.pair, 
      change: a.dailyPriceChange 
    }));
    
    const topLosers = sortedByChange.slice(-5).reverse().map(a => ({ 
      pair: a.pair, 
      change: a.dailyPriceChange 
    }));
    
    // Determine overall market sentiment
    let marketSentiment = 'Neutral';
    const bullishCount = trendDistribution.strongUptrend + trendDistribution.weakUptrend;
    const bearishCount = trendDistribution.strongDowntrend + trendDistribution.weakDowntrend;
    const totalCount = analyses.length;
    
    const bullishPercentage = (bullishCount / totalCount) * 100;
    const bearishPercentage = (bearishCount / totalCount) * 100;
    
    if (bullishPercentage > 60) marketSentiment = 'Bullish';
    else if (bullishPercentage > 75) marketSentiment = 'Strongly Bullish';
    else if (bearishPercentage > 60) marketSentiment = 'Bearish';
    else if (bearishPercentage > 75) marketSentiment = 'Strongly Bearish';
    
    return {
      timestamp: Date.now(),
      totalPairs: analyses.length,
      trendDistribution,
      rsiDistribution,
      volumeChange,
      topGainers,
      topLosers,
      marketSentiment
    };
  }
}