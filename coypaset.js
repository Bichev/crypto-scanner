const axios = require('axios');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const { createObjectCsvWriter } = require('csv-writer');
const ti = require('technicalindicators');

// Coinbase API Base URL
const BASE_URL = 'https://api.exchange.coinbase.com/products';

// Function to fetch historical data for a pair
async function fetchDailyCandles(pair, start, end) {
    let allCandles = [];
    const MAX_CANDLES_PER_REQUEST = 300; // Coinbase API limit
    let startTime = start.clone();

    while (startTime.isBefore(end)) {
        const chunkEndTime = moment.min(startTime.clone().add(MAX_CANDLES_PER_REQUEST, 'days'), end);

        try {
            const response = await axios.get(`${BASE_URL}/${pair}/candles`, {
                params: {
                    granularity: 86400, // Daily candles
                    start: startTime.toISOString(),
                    end: chunkEndTime.toISOString(),
                },
            });
            allCandles = allCandles.concat(response.data.reverse()); // Reverse for chronological order
            console.log(`Fetched ${response.data.length} candles for ${pair} from ${startTime.format()} to ${chunkEndTime.format()}`);
        } catch (error) {
            console.error(`Error fetching data for ${pair}:`, error.message);
            break;
        }

        startTime = chunkEndTime.clone();
    }

    return allCandles;
}

// Function to fetch the current price of a pair
async function fetchCurrentPrice(pair) {
    try {
        const response = await axios.get(`${BASE_URL}/${pair}/ticker`);
        return parseFloat(response.data.price);
    } catch (error) {
        console.error(`Error fetching current price for ${pair}:`, error.message);
        return null;
    }
}

// Function to calculate percentage change
function calculatePercentChange(newPrice, oldPrice) {
    return ((newPrice - oldPrice) / oldPrice) * 100;
}

function calculateOBVSlope(obvValues, periods) {
    const x = Array.from({ length: periods }, (_, i) => i + 1); // Time steps
    const y = obvValues.slice(-periods); // Last N OBV values

    const n = x.length;
    const sumX = x.reduce((acc, val) => acc + val, 0);
    const sumY = y.reduce((acc, val) => acc + val, 0);
    const sumXY = x.reduce((acc, val, idx) => acc + val * y[idx], 0);
    const sumX2 = x.reduce((acc, val) => acc + val ** 2, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
    return slope;
}

function calculateVolumeSlope(volumeValues, periods) {
    if (!Array.isArray(volumeValues) || volumeValues.length < periods) return 0; // Safeguard

    const recentVolumes = volumeValues.slice(-periods);
    const x = Array.from({ length: recentVolumes.length }, (_, i) => i + 1);

    const n = x.length;
    const sumX = x.reduce((acc, val) => acc + val, 0);
    const sumY = recentVolumes.reduce((acc, val) => acc + val, 0);
    const sumXY = x.reduce((acc, val, idx) => acc + val * recentVolumes[idx], 0);
    const sumX2 = x.reduce((acc, val) => acc + val ** 2, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
    return slope;
}

function calculateVolumeTrend(volumeData, volumeSlope, periods = 14) {
    // Safeguard against insufficient data
    if (!Array.isArray(volumeData) || volumeData.length < periods) {
        console.warn(`Not enough volume data for trend calculation. Returning default values.`);
        return { volumeSlope: 0, volumeTrend: "Neutral" };
    }

    const y = volumeData.slice(-periods);

    // Calculate dynamic thresholds based on the data
    const meanVolume = y.reduce((acc, val) => acc + val, 0) / y.length;
    const dynamicThreshold = meanVolume * 0.05; // 5% of the mean volume as a threshold

    // Categorize the trend based on the slope
    let volumeTrend;
    if (volumeSlope > dynamicThreshold * 2) {
        volumeTrend = "Strong Uptrend";
    } else if (volumeSlope > 0) {
        volumeTrend = "Weak Uptrend";
    } else if (volumeSlope < -dynamicThreshold * 2) {
        volumeTrend = "Strong Downtrend";
    } else if (volumeSlope < 0) {
        volumeTrend = "Weak Downtrend";
    } else {
        volumeTrend = "Neutral";
    }

    return volumeTrend;
}

function calculateMASlope(maValues, periods) {
    // Ensure maValues is an array
    if (!Array.isArray(maValues) || maValues.length < periods) {
        //console.error("Invalid maValues input for slope calculation. Value:", maValues);
        return 0; // Return a default value
    }

    const x = Array.from({ length: periods }, (_, i) => i + 1); // Time steps
    const y = maValues.slice(-periods); // Last N MA values

    const n = x.length;
    const sumX = x.reduce((acc, val) => acc + val, 0);
    const sumY = y.reduce((acc, val) => acc + val, 0);
    const sumXY = x.reduce((acc, val, idx) => acc + val * y[idx], 0);
    const sumX2 = x.reduce((acc, val) => acc + val ** 2, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
    return slope;
}

function calculateMATrend(shortTermMA, longTermMA, periods) {
    if (!Array.isArray(shortTermMA) || !Array.isArray(longTermMA) || shortTermMA.length < periods || longTermMA.length < periods) {
        console.warn(`Invalid MA values for trend calculation. Returning default values.`);
        return { trend: "Neutral", shortMASlope: 0, longMASlope: 0 };
    }
    const shortMASlope = calculateMASlope(shortTermMA, periods);
    const longMASlope = calculateMASlope(longTermMA, periods);
    const maDifference = shortTermMA[shortTermMA.length - 1] - longTermMA[longTermMA.length - 1];

    let trend;

    if (shortMASlope > 0 && longMASlope > 0) {
        // Both MAs are rising
        if (maDifference > 0) {
            trend = shortMASlope > longMASlope ? "Strong Uptrend" : "Weak Uptrend";
        } else {
            trend = "Weak Uptrend";
        }
    } else if (shortMASlope < 0 && longMASlope < 0) {
        // Both MAs are falling
        if (maDifference < 0) {
            trend = Math.abs(shortMASlope) > Math.abs(longMASlope) ? "Strong Downtrend" : "Weak Downtrend";
        } else {
            trend = "Weak Downtrend";
        }
    } else {
        // Mixed slopes or flattening
        if (maDifference > 0) {
            trend = "Bullish Flattening";
        } else {
            trend = "Bearish Flattening";
        }
    }

    return { trend, shortMASlope, longMASlope };
}

function calculateMACDTrend(macdData, periods = 7) {
    // Check if macdData has enough points
    if (!macdData || macdData.length < periods) {
        console.warn(`Not enough MACD data for trend calculation. Returning default values.`);
        return { macdSlope: 0, macdTrend: "Neutral" };
    }

    const recentMACD = macdData.slice(-periods).map(data => data.MACD); // Last N MACD Line values
    if (recentMACD.length < periods) {
        console.warn(`MACD data is insufficient for trend calculation. Returning default values.`);
        return { macdSlope: 0, macdTrend: "Neutral" };
    }
    const x = Array.from({ length: recentMACD.length }, (_, i) => i + 1); // Time indices
    const n = x.length;

    const sumX = x.reduce((acc, val) => acc + val, 0);
    const sumY = recentMACD.reduce((acc, val) => acc + val, 0);
    const sumXY = x.reduce((acc, val, idx) => acc + val * recentMACD[idx], 0);
    const sumX2 = x.reduce((acc, val) => acc + val ** 2, 0);

    const macdSlope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);

    // Categorize the trend based on the slope
    let macdTrend;
    if (macdSlope > 0.5) macdTrend = "Strong Uptrend";
    else if (macdSlope > 0) macdTrend = "Weak Uptrend";
    else if (macdSlope < -0.5) macdTrend = "Strong Downtrend";
    else if (macdSlope < 0) macdTrend = "Weak Downtrend";
    else macdTrend = "Neutral";

    return { macdSlope, macdTrend };
}

function normalize(value, min, max) {
    if (min === max) {
        console.warn("Normalization error: min equals max", { value, min, max });
        return 0; // Avoid division by zero
    }
    return (value - min) / (max - min);
}

function calculateCompositeScore(indicators, weights) {
    //console.log("Indicators for Composite Score:", indicators); // Debug log
    //const dailyPriceChangeScore = indicators.dailyPriceChange || 0; // Use directly without normalization
    const normalizedDailyPriceChange = normalize(indicators.dailyPriceChange, -5, 5);
    const normalizedROC1 = normalize(indicators.roc_1, -5, 5);
    const normalizedROC7 = normalize(indicators.roc_7, -10, 10);
    const normalizedROC30 = normalize(indicators.roc_30, -20, 20);
    const normalizedVolumeSpike = normalize(indicators.volumeSpike, 0, 10);
    const normalizedMACDHistogram = normalize(indicators.histogram, -100, 100);
    const normalizedVWAPProximity = normalize(indicators.vwapProximity, -20, 20);
    const normalizedATR = normalize(indicators.atr, 0, 20);
    const normalizedRSI = normalize(indicators.rsi, 0, 100);
    const normalizedMACDSlope = normalize(indicators.macdSlope, -500, 500);
    const normalizedProximityEMA = normalize(indicators.emaProximity, -10, 10);

    // console.log("Normalized Values:", {
    //     normalizedDailyPriceChange,
    //     normalizedROC1,
    //     normalizedROC7,
    //     normalizedROC30,
    //     normalizedVolumeSpike,
    //     normalizedMACDHistogram,
    //     normalizedVWAPProximity,
    //     normalizedATR,
    //     normalizedRSI,
    //     normalizedMACDSlope,
    //     normalizedProximityEMA,
    // });

    return (
        weights.dailyPriceChange * normalizedDailyPriceChange +
        weights.roc_1 * normalizedROC1 +
        weights.roc_7 * normalizedROC7 +
        weights.roc_30 * normalizedROC30 +
        weights.volumeSpike * normalizedVolumeSpike +
        weights.macdHistogram * normalizedMACDHistogram +
        weights.vwapProximity * normalizedVWAPProximity +
        weights.atr * normalizedATR +
        weights.rsi * normalizedRSI +
        weights.macdSlope * normalizedMACDSlope +
        weights.proximityEMA * normalizedProximityEMA
    );
}


// Function to calculate technical indicators
function calculateIndicators(candles) {
    const closePrices = candles.map(candle => candle[4]);
    const highPrices = candles.map(candle => candle[2]);
    const lowPrices = candles.map(candle => candle[3]);
    const volumes = candles.map(candle => candle[5]);
    const currentPrice = closePrices[closePrices.length - 1]; // Current closing price
    const usdVolumes = volumes.map(volume => volume * currentPrice); // Convert to USD volume
    const totaUSDlVolume = usdVolumes.reduce((sum, vol) => sum + vol, 0); // Total volume over the period
    const dailyPriceChange = ((currentPrice - closePrices[closePrices.length - 2]) / closePrices[closePrices.length - 2]) * 100; // Daily price change

    // Calculate ATR (14-period by default)
    const atrValues = ti.ATR.calculate({
        high: highPrices,
        low: lowPrices,
        close: closePrices,
        period: 14,
    });
    const atr = atrValues.slice(-1)[0]; // Most recent ATR value
    // Normalize ATR as a percentage of current price
    const normalizedATR = (atr / currentPrice) * 100;

    // Calculate MACD using technicalindicators
    const macdData = ti.MACD.calculate({
        values: closePrices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
    });
    // const latestMACD = macdData.slice(-1)[0]; // Most recent MACD values
    const latestMACD = macdData.slice(-1)[0] || { MACD: 0, signal: 0, histogram: 0 };
    // Normalize MACD Line by Current Price
    const normalizedMACD = (latestMACD.MACD / currentPrice) * 100;
    // Analyze MACD Trend
    const { macdSlope, macdTrend } = calculateMACDTrend(macdData) || { macdSlope: 0, macdTrend: "Neutral" };

    // Calculate VWAP
    const vwapValues = ti.VWAP.calculate({
        high: highPrices,
        low: lowPrices,
        close: closePrices,
        volume: usdVolumes,
    });

    // Short-term and long-term Volume Moving Averages
    const vma_7 = ti.SMA.calculate({ values: usdVolumes, period: 7 }).slice(-1)[0]; // 7-day VMA
    const vma_30 = ti.SMA.calculate({ values: usdVolumes, period: 30 }).slice(-1)[0]; // 30-day VMA

    // Volume Oscillator
    const volumeOscillator = ((vma_7 - vma_30) / vma_30) * 100;

    // Volume Spike
    const averageVolume = usdVolumes.slice(-30).reduce((sum, v) => sum + v, 0) / 30; // 30-day average volume
    const currentVolume = usdVolumes[usdVolumes.length - 1];
    const volumeSpike = currentVolume / averageVolume; //How to anayze this?
    const volumeSlope = calculateVolumeSlope(usdVolumes, 14); // Slope of volume over last 30 days
    const volumeTrend = calculateVolumeTrend(usdVolumes, volumeSlope, 14);

    // On Balance Volume (OBV)
    const obvValues = ti.OBV.calculate({ close: closePrices, volume: usdVolumes });
    const obv = obvValues.slice(-1)[0];
    const obvChange = obv - obvValues.slice(-30)[0]; // Change over 30 days
    const obvSlope = calculateOBVSlope(obvValues, 30); // Slope of OBV over last 30 days
    // Normalized OBV
    const normalizedOBV = obv / currentPrice;
    const normalizedOBVChange = obvChange / totaUSDlVolume;
    const normalizedOBVSlope = obvSlope / totaUSDlVolume;

    // Calculate VWAP
    //const vwapValues = ti.VWAP.calculate({ close: closePrices, volume: volumes, period: 14 }); // 14-period VWAP
    const vwap = vwapValues.slice(-1)[0]; // Last VWAP value
    // VWAP Proximity
    const vwapProximity = ((currentPrice - vwap) / vwap) * 100;
    // VWAP Crossover (Recent Direction)
    const crossover = currentPrice > vwap ? 'Above VWAP' : 'Below VWAP';

    // Short-Term MA Calculations
    const sma_7 = ti.SMA.calculate({ values: closePrices, period: 7 }).slice(-1)[0]; // 7-day SMA
    const sma_7_values = ti.SMA.calculate({ values: closePrices, period: 7 });
    const sma_30 = ti.SMA.calculate({ values: closePrices, period: 30 }).slice(-1)[0]; // 30-day SMA
    const sma_30_values = ti.SMA.calculate({ values: closePrices, period: 30 });
    const ema_7 = ti.EMA.calculate({ values: closePrices, period: 7 }).slice(-1)[0]; // 7-day EMA
    const ema_30 = ti.EMA.calculate({ values: closePrices, period: 30 }).slice(-1)[0]; // 30-day EMA

    // Long-Term MA Calculations (50 and 200 periods)
    const sma_50 = closePrices.length >= 50 ? ti.SMA.calculate({ values: closePrices, period: 50 }).slice(-1)[0] : null;
    const sma_50_values = closePrices.length >= 50 ? ti.SMA.calculate({ values: closePrices, period: 50 }) : null;
    const sma_200 = closePrices.length >= 200 ? ti.SMA.calculate({ values: closePrices, period: 200 }).slice(-1)[0] : null;
    const sma_200_values = closePrices.length >= 200 ? ti.SMA.calculate({ values: closePrices, period: 200 }) : null;
    const ema_50 = closePrices.length >= 50 ? ti.EMA.calculate({ values: closePrices, period: 50 }).slice(-1)[0] : null;
    const ema_200 = closePrices.length >= 200 ? ti.EMA.calculate({ values: closePrices, period: 200 }).slice(-1)[0] : null;
    
    // Calculate Proximities
    const smaProximity = ((currentPrice - sma_30) / sma_30) * 100; // Proximity to 30-day SMA
    const emaProximity = ((currentPrice - ema_30) / ema_30) * 100; // Proximity to 30-day EMA

    // Short-Term Crossovers
    const smaCrossover = sma_7 && sma_30 ? (sma_7 > sma_30 ? 'Bullish SMA Crossover' : 'Bearish SMA Crossover') : 'Insufficient Data';
    const emaCrossover = ema_7 && ema_30 ? (ema_7 > ema_30 ? 'Bullish EMA Crossover' : 'Bearish EMA Crossover') : 'Insufficient Data';

    // Long-Term Crossovers
    const longTermCrossover = sma_50 && sma_200
        ? (sma_50 > sma_200 ? 'Golden Cross' : 'Death Cross')
        : 'Insufficient Data';

    // Proximity Calculation for Crossovers
    const proximityShortTerm = sma_7 && sma_30
        ? Math.abs(sma_7 - sma_30) / ((sma_7 + sma_30) / 2) * 100
        : null;

    const proximityLongTerm = sma_50 && sma_200
       ? Math.abs(sma_50 - sma_200) / ((sma_50 + sma_200) / 2) * 100
       : null;

    // Threshold for "Happened" and "Approaching" Crossovers
    const threshold = 0.1; // 0.1% proximity
    const approachingThreshold = 2.0; // 2% proximity for "Approaching"

    // Short-Term Signal Logic
    let shortTermSignal = 'Not Close';
    if (proximityShortTerm !== null) {
        if (proximityShortTerm <= threshold) {
            shortTermSignal = sma_7 > sma_30
                ? 'Bullish Crossover Happened'
                : 'Bearish Crossover Happened';
        } else if (proximityShortTerm <= approachingThreshold) {
            shortTermSignal = sma_7 > sma_30
                ? 'Approaching Bullish Crossover'
                : 'Approaching Bearish Crossover';
        } else if (sma_7 > sma_30) {
            shortTermSignal = 'Passed Bullish Crossover';
        } else if (sma_7 < sma_30) {
            shortTermSignal = 'Passed Bearish Crossover';
        }
    }

    // Long-Term Signal Logic
    let longTermSignal = 'Not Close';
    if (proximityLongTerm !== null) {
        if (proximityLongTerm <= threshold) {
            longTermSignal = sma_50 > sma_200
                ? 'Golden Cross Happened'
                : 'Death Cross Happened';
        } else if (proximityLongTerm <= approachingThreshold) {
            longTermSignal = sma_50 > sma_200
                ? 'Approaching Golden Cross'
                : 'Approaching Death Cross';
        } else if (sma_50 > sma_200) {
            longTermSignal = 'Passed Golden Cross';
        } else if (sma_50 < sma_200) {
            longTermSignal = 'Passed Death Cross';
        }
    }

    const smaTrend_7_30 = calculateMATrend(sma_7_values, sma_30_values, 14); // Trend for 7/30
    const smaTrend_50_200 = calculateMATrend(sma_50_values, sma_200_values, 50); // Trend for 50/200


    return {
        dailyPriceChange: dailyPriceChange, // Daily price change
        atr: normalizedATR, // Normalized ATR (Volatility Index)
        roc_1: ti.ROC.calculate({ values: closePrices, period: 1 }).slice(-1)[0], // 1-day ROC
        roc_7: ti.ROC.calculate({ values: closePrices, period: 7 }).slice(-1)[0], // 7-day ROC
        roc_30: ti.ROC.calculate({ values: closePrices, period: 30 }).slice(-1)[0], // 30-day ROC
        rsi: ti.RSI.calculate({ values: closePrices, period: 14 }).slice(-1)[0], // RSI
        vma_7: vma_7, // 7-day VMA
        vma_30: vma_30, // 30-day VMA
        volumeOscillator: volumeOscillator,  // Volume Oscillator
        volumeSpike: volumeSpike, // Volume Spike
        volumeSlope: volumeSlope, // Volume Slope
        volumeTrend: volumeTrend, // Volume Trend
        obv: obv, // On Balance Volume
        obvChange: obvChange, // OBV Change over 30 days
        obvSlope: obvSlope, // OBV Slope over 30 days
        normalizedOBV: normalizedOBV, // Normalized OBV
        normalizedOBVChange: normalizedOBVChange, // Normalized OBV Change
        //normalizedOBVSlope: normalizedOBVSlope, // Normalized OBV Slope
        macd: latestMACD.MACD,
        signalLine: latestMACD.signal,
        histogram: latestMACD.histogram,
        normalizedMACD: normalizedMACD,
        macdSlope: macdSlope,
        macdTrend: macdTrend,
        vwap: vwap, // VWAP
        vwapProximity: vwapProximity, // VWAP Proximity
        vwapCrossover: crossover, // VWAP Crossover
        sma_7,
        sma_30,
        ema_7,
        ema_30,
        sma_50,
        sma_200,
        ema_50,
        ema_200,
        smaCrossover,
        emaCrossover,
        longTermCrossover,
        smaProximity,
        emaProximity,
        proximityShortTerm,
        proximityLongTerm,
        shortTermSignal,
        longTermSignal,
        smaTrend_7_30,
        smaTrend_50_200,
    };
}

// Function to generate the CSV file
async function generateCSV(pairs, simulationDate) {
    const results = [];
    const simulatedToday = moment(simulationDate);
    const threeMonthsAgo = simulatedToday.clone().subtract(3, 'months');
    const fiveYearsAgo = simulatedToday.clone().subtract(5, 'years');

    for (const pair of pairs) {
        console.log(`Processing ${pair}...`);

        // Fetch daily candles for the last three months and the full history
        const threeMonthCandles = await fetchDailyCandles(pair, threeMonthsAgo, simulatedToday);
        const allTimeCandles = await fetchDailyCandles(pair, fiveYearsAgo, simulatedToday);

        if (threeMonthCandles.length === 0 || allTimeCandles.length === 0) {
            console.log(`No data available for ${pair}. Skipping...`);
            continue;
        }

        const indicators = calculateIndicators(allTimeCandles);

        if (!indicators) {
            console.warn(`Missing indicators for ${pair}. Skipping...`);
            continue;
        }

        //const currentPrice = threeMonthCandles[threeMonthCandles.length - 1][4]; // Closing price of the last simulated day
        //const currentPrice = axios.allTimeCandles[allTimeCandles.length - 1][4]; // Closing price of the last simulated day
        const todayCandle = threeMonthCandles[threeMonthCandles.length - 1]; // Today's candle
        const todayOpen = todayCandle[3]; // Today's open price
        const todayClose = todayCandle[4]; // Today's close price
        const dailyPriceChange = ((todayClose - todayOpen) / todayOpen) * 100; // Daily price change percentage
        const currentPrice = todayClose; // Closing price of the last simulated day
        const lowestPrice = Math.min(...allTimeCandles.map(candle => candle[1])); // Low price from all-time data
        const highestPrice = Math.max(...allTimeCandles.map(candle => candle[2])); // High price from all-time data
        const threeMonthPriceStart = threeMonthCandles[0][4]; // Closing price 3 months ago

        const currentVolume = threeMonthCandles[threeMonthCandles.length - 1][5]; // Volume of the last simulated day
        const currentVolumeUSD = currentPrice * currentVolume; // USD volume of the last simulated day

        const percentChangeFromLow = calculatePercentChange(currentPrice, lowestPrice);
        const percentChangeFromHigh = calculatePercentChange(currentPrice, highestPrice);
        const percentChangeLastThreeMonths = calculatePercentChange(currentPrice, threeMonthPriceStart);

        // Composite Scoring
        const shortTermScore = calculateCompositeScore(indicators, {
            dailyPriceChange: 0.15,
            roc_1: 0.1,
            roc_7: 0.15,
            roc_30: 0.15,
            volumeSpike: 0.1,
            macdHistogram: 0.2,
            vwapProximity: 0.15,
            atr: 0,
            rsi: 0,
            macdSlope: 0,
            proximityEMA: 0,
        });

        const longTermScore = calculateCompositeScore(indicators, {
            dailyPriceChange: 0,
            roc_1: 0,
            roc_7: 0,
            roc_30: 0,
            volumeSpike: 0,
            macdHistogram: 0,
            vwapProximity: 0,
            atr: -0.3,
            rsi: 0.2,
            macdSlope: 0.2,
            proximityEMA: 0.15,
        });

        const riskAdjustedScore = calculateCompositeScore(indicators, {
            dailyPriceChange: 0.1,
            roc_1: 0,
            roc_7: 0,
            roc_30: 0.15,
            volumeSpike: 0.1,
            macdHistogram: 0.2,
            vwapProximity: 0.15,
            atr: -0.2,
            rsi: 0,
            macdSlope: 0,
            proximityEMA: 0.1,
        });

        // console.log("Composite Score Calculation for", pair, {
        //     shortTermScore,
        //     longTermScore,
        //     riskAdjustedScore,
        // });

        results.push({
            pair,
            currentPrice : currentPrice.toFixed(8),
            dailyPriceChange: dailyPriceChange.toFixed(2),
            currentVolumeUSD: currentVolumeUSD.toFixed(0),
            percentChangeFromLow: percentChangeFromLow.toFixed(2),
            percentChangeFromHigh: percentChangeFromHigh.toFixed(2),
            percentChangeLastThreeMonths: percentChangeLastThreeMonths.toFixed(2),
            vma_7: indicators.vma_7?.toFixed(2),
            vma_30: indicators.vma_30?.toFixed(2),
            volumeOscillator: indicators.volumeOscillator?.toFixed(2),
            volumeSpike: indicators.volumeSpike?.toFixed(2),
            volumeSlope: indicators.volumeSlope?.toFixed(2),
            volumeTrend: indicators.volumeTrend,
            obv: indicators.obv?.toFixed(2),
            obvChange: indicators.obvChange?.toFixed(2),
            obvSlope: indicators.obvSlope?.toFixed(2),
            normalizedOBV: indicators.normalizedOBV?.toFixed(2),
            normalizedOBVChange: indicators.normalizedOBVChange?.toFixed(2),
            //normalizedOBVSlope: indicators.normalizedOBVSlope?.toFixed(2),
            atr: indicators.atr?.toFixed(2), //Normalized ATR as Volatility Index
            roc_1: indicators.roc_1?.toFixed(2),
            roc_7: indicators.roc_7?.toFixed(2),
            roc_30: indicators.roc_30?.toFixed(2),
            rsi: indicators.rsi?.toFixed(2),
            macd: indicators.macd?.toFixed(8),
            signalLine: indicators.signalLine?.toFixed(8),
            histogram: indicators.histogram?.toFixed(8),
            normalizedMACD: indicators.normalizedMACD?.toFixed(2), // Normalized MACD (%)  
            macdSlope: indicators.macdSlope?.toFixed(8) || "0.00000000",
            macdTrend: indicators.macdTrend || "Neutral",      
            vwap: indicators.vwap?.toFixed(8),
            vwapproximity: indicators.vwapProximity?.toFixed(2),
            vwapcrossover: indicators.vwapCrossover,
            sma_7: indicators.sma_7?.toFixed(8),
            sma_30: indicators.sma_30?.toFixed(8),
            ema_7: indicators.ema_7?.toFixed(8),
            ema_30: indicators.ema_30?.toFixed(8),
            sma_50: indicators.sma_50?.toFixed(8),
            sma_200: indicators.sma_200?.toFixed(8),
            ema_50: indicators.ema_50?.toFixed(8),
            ema_200: indicators.ema_200?.toFixed(8),
            smaProximity: indicators.smaProximity?.toFixed(2),
            emaProximity: indicators.emaProximity?.toFixed(2),
            smaCrossover: indicators.smaCrossover,
            emaCrossover: indicators.emaCrossover,
            longTermCrossover: indicators.longTermCrossover,
            proximityShortTerm: indicators.proximityShortTerm?.toFixed(2),
            proximityLongTerm: indicators.proximityLongTerm?.toFixed(2),
            shortTermSignal: indicators.shortTermSignal,
            longTermSignal: indicators.longTermSignal,
            smaTrend_7_30: indicators.smaTrend_7_30.trend,
            smaTrend_50_200: indicators.smaTrend_50_200.trend,
            shortTermScore: shortTermScore.toFixed(2),
            longTermScore: longTermScore.toFixed(2),
            riskAdjustedScore: riskAdjustedScore.toFixed(2),
        });
    }

    // Sort results by percent change in the last three months
    //results.sort((a, b) => parseFloat(b.percentChangeLastThreeMonths) - parseFloat(a.percentChangeLastThreeMonths));
    results.sort((a, b) => parseFloat(b.shortTermScore) - parseFloat(a.shortTermScore));
    

    // Write to CSV
    const csvWriter = createObjectCsvWriter({
        path: path.join(__dirname, `pair_analysis_${simulationDate}.csv`),
        header: [
            { id: 'pair', title: 'Pair Name' },
            { id: 'currentPrice', title: 'Current Price (USD)' },
            { id: 'dailyPriceChange', title: 'Daily Price Change (%)' },
            { id: 'currentVolumeUSD', title: 'Current Volume (USD)' },
            { id: 'percentChangeFromLow', title: 'Percent Change from Lowest Price (%)' },
            { id: 'percentChangeFromHigh', title: 'Percent Change from All-Time High (%)' },
            { id: 'percentChangeLastThreeMonths', title: 'Percent Change in Last Three Months (%)' },
            { id: 'vma_7', title: '7-Day Volume Moving Average' },
            { id: 'vma_30', title: '30-Day Volume Moving Average' },
            { id: 'volumeOscillator', title: 'Volume Oscillator' },
            { id: 'volumeSpike', title: 'Volume Spike' },
            { id: 'volumeSlope', title: 'Volume Slope' },
            { id: 'volumeTrend', title: 'Volume Trend' },
            { id: 'obv', title: 'On Balance Volume (OBV)' },
            { id: 'obvChange', title: 'On Balance Volume Change (30 Days)' },
            { id: 'obvSlope', title: 'On Balance Volume Slope (30 Days)' },
            { id: 'normalizedOBV', title: 'Normalized On Balance Volume' },
            { id: 'normalizedOBVChange', title: 'Normalized On Balance Volume Change' },
            //{ id: 'normalizedOBVSlope', title: 'Normalized OBV Slope' },
            { id: 'atr', title: 'Normalized Volatility Index (ATR) (%)' },
            { id: 'roc_1', title: 'Rate of Change (1 Day)' },
            { id: 'roc_7', title: 'Rate of Change (7 Days)' },
            { id: 'roc_30', title: 'Rate of Change (30 Days)' },
            { id: 'rsi', title: 'RSI' },
            { id: 'macd', title: 'MACD Line' },
            { id: 'signalLine', title: 'MACD Signal Line' },
            { id: 'histogram', title: 'MACD Histogram' },
            { id: 'normalizedMACD', title: 'Normalized MACD (%)' },
            { id: 'macdSlope', title: 'MACD Slope' },
            { id: 'macdTrend', title: 'MACD Trend' },
            { id: 'vwap', title: 'VWAP' },
            { id: 'vwapproximity', title: 'VWAP Proximity (%)' },
            { id: 'vwapcrossover', title: 'VWAP Crossover' },
            { id: 'sma_7', title: '7-Day Simple Moving Average' },
            { id: 'sma_30', title: '30-Day Simple Moving Average' },
            { id: 'ema_7', title: '7-Day Exponential Moving Average' },
            { id: 'ema_30', title: '30-Day Exponential Moving Average' },
            { id: 'sma_50', title: '50-Day Simple Moving Average' },
            { id: 'sma_200', title: '200-Day Simple Moving Average' },
            { id: 'ema_50', title: '50-Day Exponential Moving Average' },
            { id: 'ema_200', title: '200-Day Exponential Moving Average' },
            { id: 'smaProximity', title: 'Proximity to 30-Day SMA (%)' },
            { id: 'emaProximity', title: 'Proximity to 30-Day EMA (%)' },
            { id: 'smaCrossover', title: 'SMA Crossover' },
            { id: 'emaCrossover', title: 'EMA Crossover' },
            { id: 'proximityShortTerm', title: 'Proximity to Short-Term Crossover (%)' },
            { id: 'shortTermSignal', title: 'Short-Term Signal' },
            { id: 'proximityLongTerm', title: 'Proximity to Long-Term Crossover (%)' },
            { id: 'longTermSignal', title: 'Long-Term Signal' },
            { id: 'longTermCrossover', title: 'Long-Term Crossover' },
            { id: 'smaTrend_7_30', title: 'Trend for 7/30 SMA' },
            { id: 'smaTrend_50_200', title: 'Trend for 50/200 SMA' },
            { id: 'shortTermScore', title: 'Short-Term Composite Score' },
            { id: 'longTermScore', title: 'Long-Term Composite Score' },
            { id: 'riskAdjustedScore', title: 'Risk-Adjusted Composite Score' },
        ],
    });

    await csvWriter.writeRecords(results);
    console.log(`CSV file generated for simulated date ${simulationDate}: pair_analysis_${simulationDate}.csv`);
}

// Function to load all pairs
async function loadAllPairs() {
    try {
        const response = await axios.get(BASE_URL);
        const pairs = response.data;
        // Filter pairs to include only those quoted in USD
        const usdPairs = pairs
            .filter(pair => pair.quote_currency === 'USD' && pair.status != 'delisted' && pair.base_currency !== 'GUSD' && pair.base_currency !== 'PAX' && pair.base_currency !== 'DAI' && pair.base_currency !== 'PYUSD' && pair.base_currency !== 'USDT' && pair.base_currency !== 'USDC')
            .map(pair => `${pair.base_currency}-${pair.quote_currency}`);
        return usdPairs; // Return an array of pairs, e.g., ['BTC-USD', 'ETH-USD', 'LTC-USD']
    } catch (error) {
        console.error('Error fetching pairs from Coinbase:', error.message);
        return [];
    }
}

// Main function
async function main() {
    const simulationDate = process.argv[2] || moment().format('YYYY-MM-DD'); // Use current date if no simulation date is provided
    const pairs = await loadAllPairs(); // Fetch all pairs from Coinbase
    //const pairs = ["LDO-USD","BTC-USD","MKR-USD"]; // Only include BTC-USD for testing
    if (pairs.length === 0) {
        console.error('No pairs found. Exiting.');
        return;
    }
    await generateCSV(pairs, simulationDate); // Generate the CSV file
}

main();
