'use client';

import React, { useEffect, useState } from 'react';
import { CryptoTable } from '../components/CryptoTable';
import { CryptoDashboard } from '@/components/CryptoDashboard';
import { cryptoService } from '../services/cryptoService';
import { CryptoPair, AnalyzerResponse } from '../types/crypto';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MoonIcon, SunIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const [cryptoPairs, setCryptoPairs] = useState<AnalyzerResponse>({ 
    pairs: [], 
    marketSummary: {
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
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [totalPairs, setTotalPairs] = useState<number>(0);
  const [analyzedPairs, setAnalyzedPairs] = useState<number>(0);
  const [manualRefresh, setManualRefresh] = useState<boolean>(false);
  const { theme, setTheme } = useTheme();

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const data = await cryptoService.getCryptoPairs();
      setCryptoPairs(data);
      setTotalPairs(data.pairs.length);
      setAnalyzedPairs(data.pairs.length);
      setLastUpdated(new Date());
      setLoading(false);
      setManualRefresh(false);
    } catch (err) {
      setError('Failed to fetch crypto data. Please try again later.');
      setLoading(false);
      setManualRefresh(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setManualRefresh(true);
    fetchData();
  };

  return (
    <main className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4 md:px-8">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-2xl bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">Crypto Scanner</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 px-0"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <SunIcon className="h-4 w-4" />
              ) : (
                <MoonIcon className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 gap-1"
              onClick={handleManualRefresh}
              disabled={loading || manualRefresh}
            >
              <ArrowPathIcon className={`h-3.5 w-3.5 ${manualRefresh ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 md:px-8 mt-6">
        <Tabs defaultValue="dashboard" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList className="grid grid-cols-2 w-[280px]">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="scanner">Scanner</TabsTrigger>
            </TabsList>
            
            <div className="flex flex-col text-right">
              {lastUpdated && (
                <span className="text-sm text-muted-foreground">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                Analyzed pairs: {analyzedPairs}/{totalPairs}
              </span>
            </div>
          </div>

          {loading && cryptoPairs.pairs.length === 0 ? (
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
              <TabsContent value="dashboard" className="mt-0">
                <CryptoDashboard data={cryptoPairs} lastUpdated={lastUpdated} />
              </TabsContent>
              
              <TabsContent value="scanner" className="mt-0">
                <CryptoTable data={cryptoPairs.pairs} />
              </TabsContent>
              
              {loading && (
                <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm">Refreshing data...</span>
                </div>
              )}
            </>
          )}
        </Tabs>
      </div>
    </main>
  );
}