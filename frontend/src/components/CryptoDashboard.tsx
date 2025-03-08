import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CryptoPair } from '@/types/crypto';
import { formatNumber, formatPercentage, getTrendColor, cn } from '@/lib/utils';
import { ArrowUpIcon, ArrowDownIcon, ChartBarIcon, PlusCircleIcon } from '@heroicons/react/24/solid';
import { MarketDistributionChart, RSIDistributionChart, PriceChangeChart } from '@/components/chart-coponent';
import { cryptoService } from '@/services/cryptoService';
import { BollingerDistributionChart, VolatilityRadarChart, AdvancedTrendChart } from '@/components/advanced-charts';

interface DashboardProps {
    data: CryptoPair[];
    lastUpdated: Date | null;
}

// Add market summary interface
interface MarketSummary {
    timestamp: number;
    totalPairs: number;
    trendDistribution: {
      strongUptrend: number;
      weakUptrend: number;
      neutral: number;
      weakDowntrend: number;
      strongDowntrend: number;
    };
    rsiDistribution: {
      oversold: number;
      neutral: number;
      overbought: number;
    };
    volumeChange: number;
    topGainers: { pair: string; change: string }[];
    topLosers: { pair: string; change: string }[];
    marketSentiment: string;
  }

export function CryptoDashboard({ data, lastUpdated }: DashboardProps) {
    const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(null);
    const [correlations, setCorrelations] = useState<any[]>([]);
    const [trendChanges, setTrendChanges] = useState<any[]>([]);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [loadingCorrelations, setLoadingCorrelations] = useState(true);
    const [loadingTrendChanges, setLoadingTrendChanges] = useState(true);

    
    const [recentPairs, setRecentPairs] = React.useState<{
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
    }>({ today: [], week: [] });

    useEffect(() => {
        const loadRecentPairs = async () => {
            const pairs = await cryptoService.fetchRecentPairs();
            setRecentPairs(pairs);
        };
        loadRecentPairs();
    }, []);


    useEffect(() => {
        // Fetch market summary
        const fetchMarketData = async () => {
            try {
                setLoadingSummary(true);
                setLoadingCorrelations(true);
                setLoadingTrendChanges(true);

                // Use Promise.all to fetch data in parallel
                const [summary, correlationData, trendData] = await Promise.all([
                    cryptoService.getMarketSummary(),
                    cryptoService.getCorrelations(10),
                    cryptoService.getTrendChanges('high')
                ]);

                setMarketSummary(summary);
                setCorrelations(correlationData);
                setTrendChanges(trendData || []);
            } catch (error) {
                console.error('Error fetching market data:', error);
            } finally {
                setLoadingSummary(false);
                setLoadingCorrelations(false);
                setLoadingTrendChanges(false);
            }
        };

        fetchMarketData();
    }, [data]);

    // Calculate aggregated market stats
    const marketStats = React.useMemo(() => {
        if (!data.length) return null;

        // Get total number of pairs
        const totalPairs = data.length;

        // Calculate total 24h volume
        const totalVolume = data.reduce((sum, pair) => {
            const volume = parseFloat(pair.currentVolumeUSD || '0');
            return sum + (isNaN(volume) ? 0 : volume);
        }, 0);

        // Count positive and negative 24h changes
        const changes = data.reduce(
            (acc, pair) => {
                const change = parseFloat(pair.dailyPriceChange);
                if (isNaN(change)) return acc;
                if (change > 0) acc.positive += 1;
                if (change < 0) acc.negative += 1;
                return acc;
            },
            { positive: 0, negative: 0 }
        );

        // Calculate average RSI
        const validRsi = data
            .map(pair => parseFloat(pair.rsi))
            .filter(rsi => !isNaN(rsi));
        const avgRsi = validRsi.length
            ? validRsi.reduce((sum, rsi) => sum + rsi, 0) / validRsi.length
            : 0;

        // Get top gainers and losers
        const sortedByChange = [...data]
            .filter(pair => !isNaN(parseFloat(pair.dailyPriceChange)))
            .sort((a, b) => parseFloat(b.dailyPriceChange) - parseFloat(a.dailyPriceChange));
        
        const topGainers = sortedByChange.slice(0, 3);
        const topLosers = sortedByChange.slice(-3).reverse();

        return {
            totalPairs,
            totalVolume,
            changes,
            avgRsi,
            topGainers,
            topLosers,
        };
    }, [data]);

    if (!marketStats) return null;

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Market Overview Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Market Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Pairs</p>
                                <p className="text-2xl font-bold">{marketStats.totalPairs}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">24h Volume</p>
                                <p className="text-2xl font-bold">
                                    {marketStats.totalVolume >= 1_000_000
                                        ? `${(marketStats.totalVolume / 1_000_000).toFixed(1)}M`
                                        : `${(marketStats.totalVolume / 1_000).toFixed(1)}K`}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Gainers</p>
                                <p className={`text-2xl font-bold text-emerald-400`}>
                                    {marketStats.changes.positive}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Losers</p>
                                <p className={`text-2xl font-bold text-red-400`}>
                                    {marketStats.changes.negative}
                                </p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-muted-foreground">Market RSI</p>
                            <div className="flex items-center mt-1">
                                <div className="w-full bg-secondary/30 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${
                                            marketStats.avgRsi >= 70 ? 'bg-red-400' : 
                                            marketStats.avgRsi <= 30 ? 'bg-emerald-400' : 
                                            'bg-blue-400'
                                        }`}
                                        style={{ width: `${Math.min(100, marketStats.avgRsi)}%` }}
                                    ></div>
                                </div>
                                <span className="ml-2 text-sm">{marketStats.avgRsi.toFixed(1)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Top Gainers Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <ArrowUpIcon className="w-5 h-5 mr-2 text-emerald-400" />
                            Top Gainers (24h)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {marketStats.topGainers.map((pair, i) => (
                                <li key={pair.pair} className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                                        <span className="font-medium">{pair.pair}</span>
                                    </div>
                                    <span className="text-emerald-400 font-medium">
                                        {formatPercentage(parseFloat(pair.dailyPriceChange))}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Top Losers Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <ArrowDownIcon className="w-5 h-5 mr-2 text-red-400" />
                            Top Losers (24h)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {marketStats.topLosers.map((pair, i) => (
                                <li key={pair.pair} className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                                        <span className="font-medium">{pair.pair}</span>
                                    </div>
                                    <span className="text-red-400 font-medium">
                                        {formatPercentage(parseFloat(pair.dailyPriceChange))}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Technical Signals */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <ChartBarIcon className="w-5 h-5 mr-2 text-blue-400" />
                            Technical Signals
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            <li className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Overbought (&gt;70)</span>
                                <span className="text-red-400 font-medium">
                                    {data.filter(p => parseFloat(p.rsi) > 70).length}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Oversold (&lt;30)</span>
                                <span className="text-emerald-400 font-medium">
                                    {data.filter(p => parseFloat(p.rsi) < 30).length}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Strong Uptrend</span>
                                <span className="text-emerald-400 font-medium">
                                    {data.filter(p => p.macdTrend?.includes('Strong Up')).length}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Strong Downtrend</span>
                                <span className="text-red-400 font-medium">
                                    {data.filter(p => p.macdTrend?.includes('Strong Down')).length}
                                </span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* New Pairs Widget */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <PlusCircleIcon className="w-5 h-5 mr-2 text-blue-400" />
                            Recently Added Pairs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground mb-2">Added Today</h3>
                                {recentPairs.today.length > 0 ? (
                                    <ul className="space-y-2">
                                        {recentPairs.today.map(pair => (
                                            <li key={pair.pair} className="text-sm border-l-2 border-blue-400 pl-2">
                                                <div className="font-medium text-primary">{pair.pair}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    First seen: {new Date(pair.firstSeen).toLocaleString()}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Candles: {pair.candleCount}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No new pairs today</p>
                                )}
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground mb-2">Added Last 7 Days</h3>
                                {recentPairs.week.length > 0 ? (
                                    <ul className="space-y-2">
                                        {recentPairs.week.map(pair => (
                                            <li key={pair.pair} className="text-sm border-l-2 border-blue-400/50 pl-2">
                                                <div className="font-medium text-primary">{pair.pair}</div>
                                                {/* <div className="text-xs text-muted-foreground">
                                                    First seen: {new Date(pair.firstSeen).toLocaleString()}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Candles: {pair.candleCount}
                                                </div> */}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No new pairs in the last 30 days</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">    
                      {/* Add Market Sentiment Card */}
                {marketSummary && (
                    <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Market Sentiment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold mb-4">
                        {marketSummary.marketSentiment}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Trend Distribution</h3>
                            <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm">Strong Uptrend</span>
                                <span className="text-sm font-medium text-emerald-400">{marketSummary.trendDistribution.strongUptrend}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm">Weak Uptrend</span>
                                <span className="text-sm font-medium text-emerald-400/70">{marketSummary.trendDistribution.weakUptrend}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm">Neutral</span>
                                <span className="text-sm font-medium">{marketSummary.trendDistribution.neutral}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm">Weak Downtrend</span>
                                <span className="text-sm font-medium text-red-400/70">{marketSummary.trendDistribution.weakDowntrend}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm">Strong Downtrend</span>
                                <span className="text-sm font-medium text-red-400">{marketSummary.trendDistribution.strongDowntrend}</span>
                            </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">RSI Distribution</h3>
                            <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm">Overbought (&gt;70)</span>
                                <span className="text-sm font-medium text-red-400">{marketSummary.rsiDistribution.overbought}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm">Neutral</span>
                                <span className="text-sm font-medium">{marketSummary.rsiDistribution.neutral}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm">Oversold (&lt;30)</span>
                                <span className="text-sm font-medium text-emerald-400">{marketSummary.rsiDistribution.oversold}</span>
                            </div>
                            </div>
                            <div className="mt-4">
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Volume Change</h3>
                            <div className={cn(
                                "text-lg font-bold",
                                marketSummary.volumeChange > 0 ? "text-emerald-400" : "text-red-400"
                            )}>
                                {marketSummary.volumeChange > 0 ? '+' : ''}{marketSummary.volumeChange.toFixed(2)}%
                            </div>
                            </div>
                        </div>
                        </div>
                    </CardContent>
                    </Card>
                )}
                
                {/* Add Recent Trend Changes Card */}
                {trendChanges.length > 0 && (
                    <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Recent Significant Changes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                        {trendChanges.slice(0, 5).map((change, index) => (
                            <div key={index} className="flex justify-between items-center">
                            <div>
                                <span className="font-medium">{change.pair}</span>
                                <span className="text-sm text-muted-foreground ml-2">{change.indicator}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">{change.previousValue}</span>
                                <span className="font-bold">→</span>
                                <span className={cn(
                                "text-sm font-medium",
                                change.newValue.includes('Up') || change.newValue.includes('Oversold') ? "text-emerald-400" :
                                change.newValue.includes('Down') || change.newValue.includes('Overbought') ? "text-red-400" : ""
                                )}>
                                {change.newValue}
                                </span>
                            </div>
                            </div>
                        ))}
                        </div>
                    </CardContent>
                    </Card>
                )}
                
                {/* Add Correlations Card */}
                {correlations.length > 0 && (
                    <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Strong Market Correlations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                        {correlations.slice(0, 5).map((correlation, index) => (
                            <div key={index} className="flex justify-between items-center">
                            <div>
                                <span className="font-medium">{correlation.pair1}</span>
                                <span className="text-sm mx-2">↔</span>
                                <span className="font-medium">{correlation.pair2}</span>
                            </div>
                            <div>
                                <span className={cn(
                                "text-sm font-medium",
                                correlation.correlation > 0 ? "text-emerald-400" : "text-red-400"
                                )}>
                                {correlation.correlation.toFixed(2)}
                                </span>
                                <span className="text-xs text-muted-foreground ml-2">({correlation.strength})</span>
                            </div>
                            </div>
                        ))}
                        </div>
                    </CardContent>
                    </Card>
                )}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <PriceChangeChart data={data} />
                <MarketDistributionChart data={data} />
                <RSIDistributionChart data={data} />
            </div>

            {/* New Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <BollingerDistributionChart data={data} />
                <VolatilityRadarChart data={data} />
                <AdvancedTrendChart data={data} />
            </div>

        </div>
    );
}