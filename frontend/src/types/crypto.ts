export interface CryptoPair {
    pair: string;
    currentPrice: string;
    dailyPriceChange: string;
    currentVolumeUSD: string;
    percentChangeFromLow: string;
    percentChangeFromHigh: string;
    percentChangeLastThreeMonths: string;
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
    roc_1: string;
    roc_7: string;
    roc_30: string;
    rsi: string;
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
    // Add more indicator descriptions as needed
};