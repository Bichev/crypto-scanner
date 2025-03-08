import axios from 'axios';
import { CryptoPair } from '../types/crypto';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

export const cryptoService = {
    async getCryptoPairs(): Promise<CryptoPair[]> {
        try {
            const response = await axios.get(`${API_BASE_URL}/crypto/pairs`);
            return response.data;
        } catch (error) {
            console.error('Error fetching crypto pairs:', error);
            return [];
        }
    },

    async getIndicatorDescription(indicator: string): Promise<string> {
        try {
            const response = await axios.get(`${API_BASE_URL}/crypto/indicators/${indicator}`);
            return response.data.description;
        } catch (error) {
            console.error(`Error fetching indicator description for ${indicator}:`, error);
            return '';
        }
    },

    async getMarketSummary() {
        try {
            const response = await axios.get(`${API_BASE_URL}/crypto/market/summary`);
            return response.data;
        } catch (error) {
            console.error('Error fetching market summary:', error);
            return null;
        }
    },
    
    async getCorrelations(limit = 10) {
        try {
            const response = await axios.get(`${API_BASE_URL}/crypto/market/correlations`, {
                params: { limit }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching correlations:', error);
            return [];
        }
    },
    
    async getTrendChanges(significance = 'all') {
        try {
            const response = await axios.get(`${API_BASE_URL}/crypto/trends`, {
                params: { significance }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching trend changes:', error);
            return [];
        }
    },
    
    async getPairDetails(pair: string) {
        try {
            const response = await axios.get(`${API_BASE_URL}/crypto/pair/${pair}/indicators`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching details for ${pair}:`, error);
            return null;
        }
    },    

    async fetchCryptoPairs(): Promise<CryptoPair[]> {
        try {
            const response = await fetch(`${API_BASE_URL}/crypto/pairs`);
            if (!response.ok) throw new Error('Failed to fetch crypto pairs');
            return await response.json();
        } catch (error) {
            console.error('Error fetching crypto pairs:', error);
            return [];
        }
    },

    async fetchRecentPairs(): Promise<{
        today: Array<{
            pair: string;
            firstSeen: string;
            lastSeen: string;
            candleCount: number;
        }>;
        week: Array<{
            pair: string;
            firstSeen: string;
            lastSeen: string;
            candleCount: number;
        }>;
    }> {
        try {
            const response = await fetch(`${API_BASE_URL}/crypto/pairs/recent`);
            if (!response.ok) throw new Error('Failed to fetch recent pairs');
            return await response.json();
        } catch (error) {
            console.error('Error fetching recent pairs:', error);
            return { today: [], week: [] };
        }
    },

    async getPumpDumpPairs(): Promise<{
        pumpingPairs: Array<{
            pair: string;
            score: number;
            volumeIncrease: number;
            priceChange: number;
            intradayPriceChange: number;
        }>;
        dumpingPairs: Array<{
            pair: string;
            score: number;
            volumeIncrease: number;
            priceChange: number;
            intradayPriceChange: number;
        }>;
    }> {
        const response = await fetch(`${API_BASE_URL}/crypto/market/pump-dump`);
        if (!response.ok) {
            throw new Error('Failed to fetch pump and dump pairs');
        }
        return response.json();
    },
};