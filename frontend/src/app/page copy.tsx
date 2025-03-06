'use client';

import React, { useEffect, useState } from 'react';
import { CryptoTable } from '../components/CryptoTable';
import { cryptoService } from '../services/cryptoService';
import { CryptoPair } from '../types/crypto';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

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
        setAnalyzedPairs(data.length);
        setLastUpdated(new Date());
        setLoading(false);
      } catch (err) {
        setError('Failed to fetch crypto data. Please try again later.');
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground">
            Crypto Scanner
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Real-time analysis and insights for cryptocurrency markets
          </p>
        </div>

        {loading && cryptoPairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <LoadingSpinner size="lg" />
            <p className="text-muted-foreground mt-4">Loading cryptocurrency data...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
            <p className="text-destructive">{error}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {lastUpdated && (
                  <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Analyzed pairs: {analyzedPairs}/{totalPairs}
              </div>
            </div>
            
            <CryptoTable data={cryptoPairs} />
            
            {loading && (
              <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span className="text-sm">Refreshing data...</span>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}