export interface CryptoPair {
    pair: string;
    currentPrice: string;
    dailyPriceChange: string;
    currentVolumeUSD: string;
    percentChangeFromLow: string;
    percentChangeFromHigh: string;
    percentChangeLastThreeMonths: string;
    // Add Fibonacci analysis
    fibonacciAnalysis?: {
        levels: Array<{
            level: number;
            price: number;
        }>;
        currentPosition: string;
        swingPoints: {
            high: number;
            low: number;
            highTime?: number;
            lowTime?: number;
        };
    };
    // Price position analysis
    pricePositionAnalysis: {
        bbPosition: string;
        channelPosition: string;
    };
    bb_width: string;
    volatility: string;
    // Volume indicators
    vma_7: string;
    vma_30: string;
    volumeOscillator: string;
    volumeSpike: string;
    volumeSlope: string;
    volumeTrend: string;
    // OBV indicators
    obv: string;
    obvChange: string;
    obvSlope: string;
    normalizedOBV: string;
    normalizedOBVChange: string;
    // Technical indicators
    atr: string;
    roc: string;
    rsi: string;
    rsi_30: string;
    // Additional momentum indicators
    stoch_k: string;
    stoch_d: string;
    williamsR: string;
    cci: string;
    mfi: string;
    // Trend strength
    adx: string;
    plusDI: string;
    minusDI: string;
    trendStrength: string;
    // MACD
    macd: string;
    signalLine: string;
    histogram: string;
    normalizedMACD: string;
    macdSlope: string;
    macdTrend: string;
    // Moving averages
    vwap: string;
    vwapproximity: string;
    vwapcrossover: string;
    sma_7: string;
    sma_30: string;
    ema_7: string;
    ema_30: string;
    sma_50: string;
    sma_200: string;
    ema_50: string;
    ema_200: string;
    // Trend signals
    smaProximity: string;
    emaProximity: string;
    smaCrossover: string;
    emaCrossover: string;
    proximityShortTerm: string;
    proximityLongTerm: string;
    shortTermSignal: string;
    longTermSignal: string;
    longTermCrossover: string;
    smaTrend_7_30: string;
    smaTrend_50_200: string;
    // Composite scores
    shortTermScore: string;
    longTermScore: string;
    riskAdjustedScore: string;
    // New indicators from CryptoAnalyzer
    ichimoku?: {
        tenkan: string;
        kijun: string;
        senkouA: string;
        senkouB: string;
        cloudSignal: string;
        tkCross: string;
    };
    
    stochastic?: {
        k: string;
        d: string;
        signal: string;
    };
    
    atrAnalysis?: {
        atr: string;
        normalizedATR: string;
        volatility: string;
    };
    supports: Array<{price: number; strength: number; description?: string}>;
    resistances: Array<{price: number; strength: number; description?: string}>;
    bollingerBands?: {
        upper: string;
        middle: string;
        lower: string;
        bandwidth: string;
        percentB: string;
        signal: string;
    };
    volatilityIndex?: {
        value: string;
        trend: string;
    };
    
    advancedTrend: string;
    enhancedScore: string;
    // Pump and dump properties
    isPumping: boolean;
    isDumping: boolean;
    pumpScore: number;
    dumpScore: number;
    volumeIncrease: number;
    priceChange: number;
    intradayPriceChange: number;
    liquidityType: 'Low' | 'Normal' | 'High';
    volumeScore: number;
    movementType: 'Low Liquidity Pump' | 'Volume Driven Pump' | 'Low Liquidity Dump' | 'Volume Driven Dump' | 'Normal';
    // Add tracking for when pair was first seen
    firstSeenTimestamp?: number;
    // Add broken levels tracking
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
    fallbackSupport?: { price: number; description: string };
    fallbackResistance?: { price: number; description: string };
    volumeProfile?: {
        poc: number;
        valueAreaHigh: number;
        valueAreaLow: number;
        maxVolume: number;
        hvnodes: Array<{
            price: number;
            volume: number;
        }>;
        trend: 'Increasing' | 'Decreasing' | 'Neutral';
        trendStrength: number;
        spikes: Array<{
            timestamp: number;
            volume: number;
            type: 'buy' | 'sell';
        }>;
        levels: Array<{
            price: number;
            type: 'support' | 'resistance';
        }>;
    };
    marketStructure?: {
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
            duration: number; // in candles
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
    };
    volumeAnalysis?: {
        trend: 'Strong Bullish' | 'Bullish' | 'Strong Bearish' | 'Bearish' | 'Neutral';
        signal: string;
        trendStrength: number;
        priceVolumeCorrelation: number;
        volumeOscillator: number;
        vma_7: number;
        vma_30: number;
    };
}

export interface IndicatorDescription {
    name: string;
    description: string;
    interpretation: string;
}

export const INDICATOR_DESCRIPTIONS: Record<string, IndicatorDescription> = {
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
    stochastic: {
        name: "Stochastic Oscillator",
        description: "Compares current closing price to its price range over a period",
        interpretation: "Values above 80 indicate overbought, below 20 indicate oversold. %K crossing above %D is bullish"
    },
    adx: {
        name: "Average Directional Index (ADX)",
        description: "Measures the strength of a trend regardless of direction",
        interpretation: "ADX > 25 indicates strong trend, < 20 indicates weak trend. Use +DI and -DI for direction"
    },
    cci: {
        name: "Commodity Channel Index",
        description: "Measures current price level relative to average price level over a period",
        interpretation: "Above +100 suggests overbought, below -100 suggests oversold. Good for divergence trading"
    },
    williamsR: {
        name: "Williams %R",
        description: "Momentum indicator similar to Stochastic Oscillator",
        interpretation: "Below -80 indicates oversold, above -20 indicates overbought conditions"
    },
    mfi: {
        name: "Money Flow Index",
        description: "Volume-weighted RSI that measures buying and selling pressure",
        interpretation: "Above 80 indicates overbought, below 20 indicates oversold. Volume adds confirmation"
    },
    trendStrength: {
        name: "Trend Strength",
        description: "Composite indicator combining ADX and Directional Indicators",
        interpretation: "Strong trend when ADX > 25 and DI+ > DI- (uptrend) or DI- > DI+ (downtrend)"
    }
};

export interface MarketSummary {
    timestamp: number;
    totalPairs: number;
    totalVolume: number;
    trendDistribution: {
        strongUptrend: number;
        weakUptrend: number;
        neutral: number;
        weakDowntrend: number;
        strongDowntrend: number;
    };
    rsiDistribution: {
        overbought: number;
        neutral: number;
        oversold: number;
    };
    volumeChange: number;
    topGainers: Array<{ pair: string; change: string }>;
    topLosers: Array<{ pair: string; change: string }>;
    marketSentiment: string;
    marketBreadth: {
        advances: number;
        declines: number;
        averageRSI: number;
        advanceDeclineRatio: number;
        percentStrongUptrend: number;
        percentStrongDowntrend: number;
        averageMACD: number;
    };
}

export interface AnalyzerResponse {
    pairs: CryptoPair[];
    marketSummary: MarketSummary;
}

export interface DashboardProps {
    data: AnalyzerResponse;
    lastUpdated: Date | null;
}