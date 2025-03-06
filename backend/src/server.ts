import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { CoinbaseDataFetcher } from './services/CoinbaseDataFetcher';
import { CryptoAnalyzer } from './services/CryptoAnalyzer';
import { rateLimiter } from './middleware/rateLimiter';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(rateLimiter);

const dataFetcher = new CoinbaseDataFetcher();
const analyzer = new CryptoAnalyzer();

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Endpoint to get all crypto pairs with their analysis
app.get('/api/crypto/pairs', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const pairs = await dataFetcher.getAllPairs();
        //get only 5 first pairs
        const analysisResults = await analyzer.analyzePairs(pairs.slice(0, 5));
        res.json(analysisResults);
    } catch (error) {
        next(error);
    }
});

// Endpoint to get indicator descriptions
app.get('/api/crypto/indicators/:indicator', (req: Request, res: Response) => {
    const { indicator } = req.params;
    const description = analyzer.getIndicatorDescription(indicator);
    if (description) {
        res.json({ description });
    } else {
        res.status(404).json({ error: 'Indicator not found' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});