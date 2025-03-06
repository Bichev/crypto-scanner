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
};