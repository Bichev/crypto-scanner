import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CryptoPair } from '@/types/crypto';
import { formatNumber, formatPercentage, getTrendColor } from '@/lib/utils';
import { ArrowUpIcon, ArrowDownIcon, ChartBarIcon } from '@heroicons/react/24/solid';
import { MarketDistributionChart, RSIDistributionChart, PriceChangeChart } from '@/components/chart-coponent';

interface DashboardProps {
    data: CryptoPair[];
    lastUpdated: Date | null;
}

export function CryptoDashboard({ data, lastUpdated }: DashboardProps) {
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                <span className="text-sm text-muted-foreground">Overbought (RSI &gt; 70)</span>
                                <span className="text-red-400 font-medium">
                                    {data.filter(p => parseFloat(p.rsi) > 70).length}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Oversold (RSI &lt; 30)</span>
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
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <PriceChangeChart data={data} />
                <MarketDistributionChart data={data} />
                <RSIDistributionChart data={data} />
            </div>
        </div>
    );
}