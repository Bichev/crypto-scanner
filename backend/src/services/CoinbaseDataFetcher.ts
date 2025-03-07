import axios from 'axios';
import moment from 'moment-timezone';
import mongoose from 'mongoose';
import { CandleModel } from '../models/Candle';

export interface CandleData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

function identifyMissingDateRanges(startDate: moment.Moment, endDate: moment.Moment, existingTimestamps: Set<number>): { start: moment.Moment, end: moment.Moment }[] {
    const missingRanges = [];
    let currentStart = startDate.clone();
    let rangeStart: moment.Moment | null = null;

    while (currentStart.isBefore(endDate)) {
        const currentTimestamp = currentStart.unix();

        if (!existingTimestamps.has(currentTimestamp)) {
            if (!rangeStart) {
                rangeStart = currentStart.clone();
            }
        } else if (rangeStart) {
            missingRanges.push({
                start: rangeStart,
                end: currentStart.clone()
            });
            rangeStart = null;
        }

        currentStart = currentStart.clone().add(1, 'day');
    }

    // Don't forget to add the last range if it exists
    if (rangeStart) {
        missingRanges.push({
            start: rangeStart,
            end: endDate.clone()
        });
    }

    return missingRanges;
}

export class CoinbaseDataFetcher {
    private readonly BASE_URL = 'https://api.exchange.coinbase.com/products';
    private readonly MAX_CANDLES_PER_REQUEST = 300;

    async getAllPairs(): Promise<string[]> {
        try {
            const response = await axios.get(this.BASE_URL);
            const pairs = response.data
                .filter((pair: any) => 
                    pair.quote_currency === 'USD' && 
                    pair.status !== 'delisted' &&
                    !['GUSD', 'PAX', 'DAI', 'PYUSD', 'USDT', 'USDC'].includes(pair.base_currency)
                )
                .map((pair: any) => `${pair.base_currency}-${pair.quote_currency}`);
            return pairs;
        } catch (error) {
            console.error('Error fetching pairs from Coinbase:', error);
            return [];
        }
    }

    async fetchDailyCandles(pair: string, start: moment.Moment, end: moment.Moment): Promise<CandleData[]> {
        let allCandles: CandleData[] = [];
        let startTime = start.clone();

        while (startTime.isBefore(end)) {
            const chunkEndTime = moment.min(
                startTime.clone().add(this.MAX_CANDLES_PER_REQUEST, 'days'),
                end
            );

            try {
                console.log(`Fetching candles for ${pair} from ${startTime.format('YYYY-MM-DD')} to ${chunkEndTime.format('YYYY-MM-DD')}`);
                const response = await axios.get(`${this.BASE_URL}/${pair}/candles`, {
                    params: {
                        granularity: 86400, // Daily candles
                        start: startTime.toISOString(),
                        end: chunkEndTime.toISOString(),
                    },
                });

                const formattedCandles = response.data.map((candle: any) => ({
                    timestamp: candle[0],
                    open: candle[1],
                    high: candle[2],
                    low: candle[3],
                    close: candle[4],
                    volume: candle[5],
                }));

                allCandles = allCandles.concat(formattedCandles);
                console.log(`Fetched ${formattedCandles.length} candles for ${pair}`);

                // Add delay between chunk requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 429) {
                    console.log('Rate limit reached, waiting for 60 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    continue; // Retry the same chunk
                }
                console.error(`Error fetching data for ${pair}:`, error);
                break;
            }

            startTime = chunkEndTime.clone();
        }

        return allCandles;
    }

    async getCurrentPrice(pair: string): Promise<number | null> {
        try {
            const response = await axios.get(`${this.BASE_URL}/${pair}/ticker`);
            return parseFloat(response.data.price);
        } catch (error) {
            console.error(`Error fetching current price for ${pair}:`, error);
            return null;
        }
    }

    async fetchHistoricalData(pair: string, startDate: moment.Moment, endDate: moment.Moment): Promise<CandleData[]> {
        console.log(`Checking existing data for ${pair} from ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);
        
        // First check what data we already have in MongoDB
        const existingCandles = await CandleModel.find({
          pair,
          timestamp: { 
            $gte: startDate.unix(), 
            $lte: endDate.unix() 
          }
        }).sort({ timestamp: 1 });
        
        // Identify missing date ranges
        const existingTimestamps = new Set(existingCandles.map(candle => candle.timestamp));
        const missingRanges = identifyMissingDateRanges(startDate, endDate, existingTimestamps);
        
        console.log(`Found ${missingRanges.length} missing date ranges for ${pair}`);
        
        // Fetch only missing data from Coinbase
        let newCandles: CandleData[] = [];
        for (const range of missingRanges) {
          console.log(`Fetching missing data for ${pair} from ${range.start.format('YYYY-MM-DD')} to ${range.end.format('YYYY-MM-DD')}`);
          const fetchedCandles = await this.fetchDailyCandles(pair, range.start, range.end);
          
          // Store new candles in MongoDB
          if (fetchedCandles.length > 0) {
            const candlesToInsert = fetchedCandles.map(candle => ({
              pair,
              timestamp: candle.timestamp,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume
            }));
            
            await CandleModel.insertMany(candlesToInsert);
            console.log(`Inserted ${candlesToInsert.length} candles for ${pair}`);
            newCandles = newCandles.concat(fetchedCandles);
          }
          
          // Add delay between ranges to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Combine existing and new data
        return [...existingCandles, ...newCandles].sort((a, b) => a.timestamp - b.timestamp);
    }

    async updateCurrentDayData(): Promise<void> {
        const pairs = await this.getAllPairs();
        const today = moment().startOf('day');
        const tomorrow = moment().startOf('day').add(1, 'day');
        
        for (const pair of pairs) {
          try {
            // Fetch just today's candle
            const currentDayCandle = await this.fetchDailyCandles(pair, today, tomorrow);
            
            if (currentDayCandle.length > 0) {
              // Upsert the candle (update if exists, insert if not)
              await CandleModel.updateOne(
                { pair, timestamp: currentDayCandle[0].timestamp },
                { 
                  $set: {
                    open: currentDayCandle[0].open,
                    high: currentDayCandle[0].high,
                    low: currentDayCandle[0].low,
                    close: currentDayCandle[0].close,
                    volume: currentDayCandle[0].volume,
                    lastUpdated: new Date()
                  }
                },
                { upsert: true }
              );
            }
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`Error updating current day data for ${pair}:`, error);
          }
        }
      }
}