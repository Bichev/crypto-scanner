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
    private readonly PUBLIC_RATE_LIMIT = 10; // requests per second
    private readonly BATCH_SIZE = 5; // process 5 pairs at a time

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
        const now = moment();
        const today = now.clone().startOf('day');
        const yesterday = today.clone().subtract(1, 'day');

        // Validate dates to ensure we're not fetching future data
        if (today.isAfter(now)) {
            console.warn('Attempted to fetch future data, adjusting date range...');
            today.subtract(1, 'day');
            yesterday.subtract(1, 'day');
        }

        console.log(`Updating data for date range: ${yesterday.format('YYYY-MM-DD')} to ${today.format('YYYY-MM-DD')}`);
        
        // Process pairs in batches
        for (let i = 0; i < pairs.length; i += this.BATCH_SIZE) {
            const batch = pairs.slice(i, i + this.BATCH_SIZE);
            console.log(`Processing batch ${i / this.BATCH_SIZE + 1} of ${Math.ceil(pairs.length / this.BATCH_SIZE)}`);
            
            await this.processBatch(batch, yesterday, today);
            
            // Add delay between batches to respect rate limits
            const delayMs = (1000 / this.PUBLIC_RATE_LIMIT) * this.BATCH_SIZE;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        console.log('Finished updating current day data for all pairs');
    }

    private async processBatch(pairs: string[], yesterday: moment.Moment, today: moment.Moment): Promise<void> {
        const batchPromises = pairs.map(async pair => {
            try {
                // Ensure we're not fetching future data
                const endDate = moment.min(today, moment());
                console.log(`Fetching recent data for ${pair} from ${yesterday.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')}`);
                
                const recentCandles = await this.fetchDailyCandles(pair, yesterday, endDate);
                
                if (recentCandles.length > 0) {
                    const operations = recentCandles.map(candle => ({
                        updateOne: {
                            filter: { pair, timestamp: candle.timestamp },
                            update: {
                                $set: {
                                    open: candle.open,
                                    high: candle.high,
                                    low: candle.low,
                                    close: candle.close,
                                    volume: candle.volume,
                                    lastUpdated: new Date()
                                }
                            },
                            upsert: true
                        }
                    }));

                    await CandleModel.bulkWrite(operations);
                    console.log(`Updated ${recentCandles.length} candles for ${pair}`);
                }
            } catch (error) {
                console.error(`Error updating data for ${pair}:`, error);
            }
        });

        await Promise.all(batchPromises);
    }
}