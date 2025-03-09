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
import { TrendMonitorService } from './services/TrendMonitorService';
import { MarketSummaryService } from './services/MarketSummaryService';
import { CorrelationService } from './services/CorrelationService';

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-scanner';

// Initialize services
const trendMonitor = new TrendMonitorService();
const marketSummary = new MarketSummaryService();
const correlationService = new CorrelationService();

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

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected, attempting to reconnect...');
    setTimeout(() => {
      mongoose.connect(MONGODB_URI)
        .catch(err => console.error('Error reconnecting to MongoDB:', err));
    }, 5000);
  });

// Initialize data fetching - run once at startup
async function initializeData() {
  try {
    const pairs = await dataFetcher.getAllPairs();
    console.log(`Found ${pairs.length} pairs to initialize...`);

    // First, check which pairs need initialization
    const startDate = moment().subtract(3, 'year');
    const endDate = moment();
    
    const pairsToInitialize = [];
    for (const pair of pairs) {
      // Check if we have any data for this pair
      const existingData = await CandleModel.findOne({ 
        pair,
        timestamp: { 
          $gte: startDate.unix(),
          $lte: endDate.unix()
        }
      });
      
      if (!existingData) {
        pairsToInitialize.push(pair);
      }
    }

    console.log(`${pairsToInitialize.length} pairs need initialization...`);

    // Initialize only pairs that don't have data
    for (const pair of pairsToInitialize) {
      console.log(`Fetching historical data for ${pair}...`);
      await dataFetcher.fetchHistoricalData(
        pair, 
        startDate,
        endDate
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
    console.log('/api/crypto/pairs call - fetching pairs from database');
    
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
    
    // Log volume change for verification
    console.log('Market Summary - Volume Change:', analysisResults.marketSummary.volumeChange);
    console.log('Sample of current volumes:', analysisResults.pairs.slice(0, 3).map(p => ({
      pair: p.pair,
      currentVolume: p.currentVolumeUSD,
      vma7: p.vma_7
    })));
    
    res.json(analysisResults);
  } catch (error) {
    next(error);
  }
});


// Add to server.ts
app.get('/api/crypto/pairs/:pair/history', async (req, res, next) => {
    try {
      const { pair } = req.params;
      const { start, end, granularity } = req.query;
      
      // Fetch candles for specific time range
      const candles = await CandleModel.find({
        pair,
        timestamp: { 
          $gte: parseInt(start as string), 
          $lte: parseInt(end as string) 
        }
      }).sort({ timestamp: 1 });
      
      res.json(candles);
    } catch (error) {
      next(error);
    }
  });

    // Add new endpoints
    app.get('/api/crypto/market/summary', async (req, res, next) => {
        try {
        const summary = await marketSummary.generateMarketSummary();
        res.json(summary);
        } catch (error) {
        next(error);
        }
    });
  
  app.get('/api/crypto/market/correlations', async (req, res, next) => {
    try {
      const pairs = await CandleModel.distinct('pair');
      const period = req.query.period ? parseInt(req.query.period as string) : 30;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      // Get top pairs by volume if limit specified
      let pairsToAnalyze = pairs;
      if (pairs.length > limit) {
        const topPairs = await analyzer.analyzePairs(pairs);
        pairsToAnalyze = topPairs.pairs
          .sort((a, b) => parseFloat(b.currentVolumeUSD) - parseFloat(a.currentVolumeUSD))
          .slice(0, limit)
          .map(p => p.pair);
      }
      
      const correlations = await correlationService.analyzeCorrelations(pairsToAnalyze, period);
      res.json(correlations);
    } catch (error) {
      next(error);
    }
  });  

  app.get('/api/crypto/pair/:pair/indicators', async (req, res, next) => {
    try {
      const { pair } = req.params;
      
      // Check if pair exists in database
      const exists = await CandleModel.exists({ pair });
      if (!exists) {
        return res.status(404).json({ error: 'Pair not found' });
      }
      
      // Analyze single pair in detail
      const analysis = await analyzer.analyzePairs([pair]);
      if (analysis.pairs.length === 0) {
        return res.status(404).json({ error: 'Analysis not available' });
      }
      
      res.json(analysis.pairs[0]);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/crypto/trends', async (req, res, next) => {
    try {
      const pairs = await CandleModel.distinct('pair');
      const changes = await trendMonitor.monitorTrends(pairs);
      
      // Filter by significance if requested
      const significance = req.query.significance as string;
      let filteredChanges = changes;
      
      if (significance === 'high') {
        filteredChanges = changes.filter(c => c.significance === 'high');
      } else if (significance === 'medium') {
        filteredChanges = changes.filter(c => c.significance !== 'low');
      }
      
      res.json(filteredChanges);
    } catch (error) {
      next(error);
    }
  });

  // Add new endpoint for recently added pairs
  app.get('/api/crypto/pairs/recent', async (req, res, next) => {
    try {
      const today = moment().startOf('day');
      const weekAgo = moment().subtract(7, 'days').startOf('day');
      const thirtyDaysAgo = moment().subtract(30, 'days').startOf('day');

      // Find pairs added today
      const todayPairs = await CandleModel.aggregate([
        {
          $group: {
            _id: '$pair',
            firstCandle: { $min: '$timestamp' },
            lastCandle: { $max: '$timestamp' },
            candleCount: { $sum: 1 }
          }
        },
        {
          $match: {
            firstCandle: { $gte: today.unix() }
          }
        },
        {
          $sort: { firstCandle: -1 }
        }
      ]);

      // Find pairs added in the last 7 days
      const weekPairs = await CandleModel.aggregate([
        {
          $group: {
            _id: '$pair',
            firstCandle: { $min: '$timestamp' },
            lastCandle: { $max: '$timestamp' },
            candleCount: { $sum: 1 }
          }
        },
        {
          $match: {
            firstCandle: { 
              $gte: weekAgo.unix(),
              $lt: today.unix()
            }
          }
        },
        {
          $sort: { firstCandle: -1 }
        }
      ]);

      // Find pairs added between 7 and 30 days ago
      const monthPairs = await CandleModel.aggregate([
        {
          $group: {
            _id: '$pair',
            firstCandle: { $min: '$timestamp' },
            lastCandle: { $max: '$timestamp' },
            candleCount: { $sum: 1 }
          }
        },
        {
          $match: {
            firstCandle: { 
              $gte: thirtyDaysAgo.unix(),
              $lt: weekAgo.unix()
            }
          }
        },
        {
          $sort: { firstCandle: -1 }
        }
      ]);

      const formatPairInfo = (pair: any) => ({
        pair: pair._id,
        firstSeen: moment.unix(pair.firstCandle).format('YYYY-MM-DD HH:mm:ss'),
        lastSeen: moment.unix(pair.lastCandle).format('YYYY-MM-DD HH:mm:ss'),
        candleCount: pair.candleCount
      });

      res.json({
        today: todayPairs.map(formatPairInfo),
        week: weekPairs.map(formatPairInfo),
        month: monthPairs.map(formatPairInfo)
      });
    } catch (error) {
      console.error('Error fetching recent pairs:', error);
      next(error);
    }
  });

// // Add new endpoint for pump and dump pairs
// app.get('/api/crypto/market/pump-dump', async (req, res, next) => {
//   try {
//     const pairs = await CandleModel.distinct('pair');
//     const analysis = await analyzer.analyzePairs(pairs);
    
//     const pumpingPairs = analysis.pairs
//       .filter(pair => pair.isPumping)
//       .sort((a, b) => b.pumpScore - a.pumpScore)
//       .map(pair => ({
//         pair: pair.pair,
//         score: pair.pumpScore,
//         volumeIncrease: pair.volumeIncrease,
//         priceChange: pair.priceChange,
//         intradayPriceChange: pair.intradayPriceChange
//       }));

//     const dumpingPairs = analysis.pairs
//       .filter(pair => pair.isDumping)
//       .sort((a, b) => b.dumpScore - a.dumpScore)
//       .map(pair => ({
//         pair: pair.pair,
//         score: pair.dumpScore,
//         volumeIncrease: pair.volumeIncrease,
//         priceChange: pair.priceChange,
//         intradayPriceChange: pair.intradayPriceChange
//       }));

//     res.json({
//       timestamp: Date.now(),
//       pumpingPairs,
//       dumpingPairs
//     });
//   } catch (error) {
//     next(error);
//   }
// });

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});