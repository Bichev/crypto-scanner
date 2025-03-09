import axios from 'axios';
import { CryptoPair, AnalyzerResponse } from '../types/crypto';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

export const cryptoService = {
    async getCryptoPairs(): Promise<AnalyzerResponse> {
        try {
            const response = await axios.get(`${API_BASE_URL}/crypto/pairs`);
            return response.data;
        } catch (error) {
            console.error('Error fetching crypto pairs:', error);
            return { pairs: [], marketSummary: {
                timestamp: Date.now(),
                totalPairs: 0,
                trendDistribution: {
                    strongUptrend: 0,
                    weakUptrend: 0,
                    neutral: 0,
                    weakDowntrend: 0,
                    strongDowntrend: 0
                },
                rsiDistribution: {
                    overbought: 0,
                    neutral: 0,
                    oversold: 0
                },
                volumeChange: 0,
                topGainers: [],
                topLosers: [],
                marketSentiment: 'Neutral',
                marketBreadth: {
                    advances: 0,
                    declines: 0,
                    averageRSI: 0,
                    advanceDeclineRatio: 0,
                    percentStrongUptrend: 0,
                    percentStrongDowntrend: 0,
                    averageMACD: 0
                }
            }};
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
        month: Array<{
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
            return { today: [], week: [], month: [] };
        }
    },

    async getPumpDumpPairs(): Promise<{
        pumpingPairs: Array<{
            pair: string;
            score: number;
            volumeIncrease: number;
            priceChange: number;
            intradayPriceChange: number;
            liquidityType: 'Low' | 'Normal' | 'High';
            volumeScore: number;
        }>;
        dumpingPairs: Array<{
            pair: string;
            score: number;
            volumeIncrease: number;
            priceChange: number;
            intradayPriceChange: number;
            liquidityType: 'Low' | 'Normal' | 'High';
            volumeScore: number;
        }>;
    }> {
        try {
            const response = await fetch(`${API_BASE_URL}/crypto/market/pump-dump`);
            if (!response.ok) {
                throw new Error('Failed to fetch pump and dump pairs');
            }
            return response.json();
        } catch (error) {
            console.error('Error fetching pump and dump pairs:', error);
            return { pumpingPairs: [], dumpingPairs: [] };
        }
    },
};