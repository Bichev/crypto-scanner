// server.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { CoinbaseDataFetcher } from './services/CoinbaseDataFetcher';
import { CryptoAnalyzer } from './services/CryptoAnalyzer';
import { rateLimiter } from './middleware/rateLimiter';
import moment from 'moment-timezone';
import { CandleModel } from './models/Candle';

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-scanner';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(rateLimiter);

const dataFetcher = new CoinbaseDataFetcher();
const analyzer = new CryptoAnalyzer();

// Initialize data fetching - run once at startup
async function initializeData() {
  try {
    const pairs = await dataFetcher.getAllPairs();
    
    // Just initialize for a few pairs initially to avoid long startup time
    const initialPairs = pairs.slice(0, 3);
    console.log(`Initializing data for ${initialPairs.length} pairs...`);

    for (const pair of initialPairs) {
      console.log(`Fetching historical data for ${pair}...`);
      await dataFetcher.fetchHistoricalData(
        pair, 
        moment().subtract(3, 'year'), 
        moment()
      );
      // Add delay between pairs to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Schedule regular updates every 5 minutes
    setInterval(async () => {
      console.log('Running scheduled update of current day data...');
      await dataFetcher.updateCurrentDayData();
    }, 5 * 60 * 1000);
    
    console.log('Initial data fetching complete');
  } catch (error) {
    console.error('Error initializing data:', error);
  }
}

initializeData();

// Modified route to only analyze pairs that exist in the database
app.get('/api/crypto/pairs', async (req, res, next) => {
  try {
    console.log('Fetching pairs from database');
    
    // Get distinct pairs from the database that have data
    const pairsInDb = await CandleModel.distinct('pair');
    console.log(`Found ${pairsInDb.length} pairs in database`);
    
    // If limit is specified, use it, otherwise use all pairs
    const limit = req.query.limit ? parseInt(req.query.limit as string) : pairsInDb.length;
    
    // Take only the requested number of pairs
    const pairsToAnalyze = pairsInDb.slice(0, limit);
    console.log(`Analyzing ${pairsToAnalyze.length} pairs: ${pairsToAnalyze.join(', ')}`);
    
    // Analyze only the pairs we have data for
    const analysisResults = await analyzer.analyzePairs(pairsToAnalyze);
    res.json(analysisResults);
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});