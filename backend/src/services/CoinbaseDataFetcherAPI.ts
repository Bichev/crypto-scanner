import axios from 'axios';
import moment from 'moment-timezone';

export interface CandleData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
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
                const response = await axios.get(`${this.BASE_URL}/${pair}/candles`, {
                    params: {
                        granularity: 86400, // Daily candles
                        start: startTime.toISOString(),
                        end: chunkEndTime.toISOString(),
                    },
                });

                const formattedCandles = response.data.reverse().map((candle: any) => ({
                    timestamp: candle[0],
                    open: candle[1],
                    high: candle[2],
                    low: candle[3],
                    close: candle[4],
                    volume: candle[5],
                }));

                allCandles = allCandles.concat(formattedCandles);
                console.log(`Fetched ${formattedCandles.length} candles for ${pair} from ${startTime.format()} to ${chunkEndTime.format()}`);
            } catch (error) {
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
}