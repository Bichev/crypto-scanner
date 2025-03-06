'use client';

import React, { useEffect, useState } from 'react';
import { CryptoTable } from '../components/CryptoTable';
import { cryptoService } from '../services/cryptoService';
import { CryptoPair } from '../types/crypto';

export default function Home() {
  const [cryptoPairs, setCryptoPairs] = useState<CryptoPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [totalPairs, setTotalPairs] = useState<number>(0);
  const [analyzedPairs, setAnalyzedPairs] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await cryptoService.getCryptoPairs();
        setCryptoPairs(data);
        setTotalPairs(data.length);
        setAnalyzedPairs(data.length); // Set analyzed pairs to total when complete
        setLastUpdated(new Date());
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch crypto data. Please try again later.');
        setLoading(false);
      }
    };

    fetchData();

    // Refresh data every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Crypto Scanner
        </h1>
        <p className="text-gray-600 mb-8">
          Real-time analysis and insights for cryptocurrency markets
        </p>
        
        {loading && cryptoPairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-600">Loading cryptocurrency data...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-500">
                {lastUpdated && (
                  <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                Analyzed pairs: {analyzedPairs}/{totalPairs}
              </div>
            </div>
            <CryptoTable data={cryptoPairs} />
            {loading && (
              <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center space-x-2">
                <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
                <span>Refreshing data...</span>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}