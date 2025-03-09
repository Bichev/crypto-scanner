import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CryptoPair, AnalyzerResponse, MarketSummary } from '@/types/crypto';
import { formatNumber, formatPercentage, getTrendColor, cn } from '@/lib/utils';
import { ArrowUpIcon, ArrowDownIcon, ChartBarIcon, PlusCircleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/solid';
import { MarketDistributionChart, RSIDistributionChart, PriceChangeChart } from '@/components/chart-coponent';
import { cryptoService } from '@/services/cryptoService';
import { BollingerDistributionChart, VolatilityRadarChart, AdvancedTrendChart } from '@/components/advanced-charts';

interface DashboardProps {
    data: AnalyzerResponse;
    lastUpdated: Date | null;
}

export function CryptoDashboard({ data, lastUpdated }: DashboardProps) {
    const [correlations, setCorrelations] = useState<any[]>([]);
    const [trendChanges, setTrendChanges] = useState<any[]>([]);
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
        month: Array<{
            pair: string;
            firstSeen: string;
            lastSeen: string;
            candleCount: number;
        }>;
    }>({ today: [], week: [], month: [] });

    // Process pump/dump data directly from the main data
    const pumpDumpData = React.useMemo(() => {
        const pumpingPairs = data.pairs
            .filter(pair => pair.isPumping)
            .map(pair => ({
                pair: pair.pair,
                score: pair.pumpScore,
                volumeIncrease: pair.volumeIncrease,
                priceChange: pair.priceChange,
                intradayPriceChange: pair.intradayPriceChange,
                liquidityType: pair.liquidityType,
                volumeScore: pair.volumeScore
            }))
            .sort((a, b) => b.score - a.score);

        const dumpingPairs = data.pairs
            .filter(pair => pair.isDumping)
            .map(pair => ({
                pair: pair.pair,
                score: pair.dumpScore,
                volumeIncrease: pair.volumeIncrease,
                priceChange: pair.priceChange,
                intradayPriceChange: pair.intradayPriceChange,
                liquidityType: pair.liquidityType,
                volumeScore: pair.volumeScore
            }))
            .sort((a, b) => b.score - a.score);

        return { pumpingPairs, dumpingPairs };
    }, [data.pairs]);

    useEffect(() => {
        const loadRecentPairs = async () => {
            const pairs = await cryptoService.fetchRecentPairs();
            setRecentPairs(pairs);
        };
        loadRecentPairs();
    }, []);

    useEffect(() => {
        const fetchMarketData = async () => {
            try {
                setLoadingCorrelations(true);
                setLoadingTrendChanges(true);

                const [correlationData, trendData] = await Promise.all([
                    cryptoService.getCorrelations(10),
                    cryptoService.getTrendChanges('high')
                ]);

                setCorrelations(correlationData);
                setTrendChanges(trendData);
            } catch (error) {
                console.error('Error fetching market data:', error);
            } finally {
                setLoadingCorrelations(false);
                setLoadingTrendChanges(false);
            }
        };

        fetchMarketData();
    }, [data]);

    // Use market summary directly from the API response
    const { marketSummary } = data;

    if (!data.pairs.length) return null;

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Market Overview Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Market Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Pairs</p>
                                <p className="text-2xl font-bold">{data.pairs.length}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">24h Volume</p>
                                <p className="text-2xl font-bold">
                                    {(() => {
                                        const volume = data.marketSummary.totalVolume;
                                        if (isNaN(volume) || volume === 0) return '-';
                                        if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(0)}M`;
                                        if (volume >= 1_000) return `$${(volume / 1_000).toFixed(0)}K`;
                                        return `$${volume.toFixed(0)}`;
                                    })()}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Gainers</p>
                                <p className={`text-2xl font-bold text-emerald-400`}>
                                    {data.marketSummary.marketBreadth.advances}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Losers</p>
                                <p className={`text-2xl font-bold text-red-400`}>
                                    {data.marketSummary.marketBreadth.declines}
                                </p>
                            </div>
                        </div>
                        
                        {/* Market Sentiment */}
                        <div className="mt-4 pb-2 border-b border-border">
                            <div className="flex justify-between items-center">
                                <p className="text-sm">Sentiment</p>
                                <p className={cn(
                                    "text-xl font-medium",
                                    marketSummary?.marketSentiment?.includes('Strongly Bullish') ? "text-emerald-400" :
                                    marketSummary?.marketSentiment?.includes('Bullish') ? "text-emerald-400/70" :
                                    marketSummary?.marketSentiment?.includes('Strongly Bearish') ? "text-red-400" :
                                    marketSummary?.marketSentiment?.includes('Bearish') ? "text-red-400/70" :
                                    "text-blue-400"
                                )}>
                                    {marketSummary?.marketSentiment || 'Neutral'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-1">
                                    <p className="text-sm">Market RSI</p>
                                    <div className="group relative">
                                        <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                        <div className="invisible group-hover:visible absolute z-50 w-64 p-2 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg">
                                            <p className="font-medium mb-1">Relative Strength Index (RSI)</p>
                                            <ul className="space-y-1 text-xs">
                                                <li><span className="text-red-400">Above 70:</span> Market is overbought</li>
                                                <li><span className="text-blue-400">Between 30-70:</span> Normal market conditions</li>
                                                <li><span className="text-emerald-400">Below 30:</span> Market is oversold</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-m font-medium">
                                    {data.marketSummary.marketBreadth.averageRSI.toFixed(1)}
                                </p>
                            </div>
                            <div className="w-full bg-secondary/30 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${
                                        data.marketSummary.marketBreadth.averageRSI >= 70 ? 'bg-red-400' : 
                                        data.marketSummary.marketBreadth.averageRSI <= 30 ? 'bg-emerald-400' : 
                                        'bg-blue-400'
                                    }`}
                                    style={{ width: `${Math.min(100, data.marketSummary.marketBreadth.averageRSI)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-1">
                                    <p className="text-sm">Volume Change</p>
                                    <div className="group relative">
                                        <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                        <div className="invisible group-hover:visible absolute z-50 w-64 p-2 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg">
                                            <p className="font-medium mb-1">24h Volume Change</p>
                                            <ul className="space-y-1 text-xs">
                                                <li><span className="text-emerald-400">Positive:</span> Volume is increasing (higher market activity)</li>
                                                <li><span className="text-red-400">Negative:</span> Volume is decreasing (lower market activity)</li>
                                                <li><span className="text-blue-400">Near Zero:</span> Volume is stable</li>
                                            </ul>
                                            <p className="text-xs mt-2 text-muted-foreground">Compares current volume to 7-day average</p>
                                        </div>
                                    </div>
                                </div>
                                <p className={cn(
                                    "text-m font-medium",
                                    data.marketSummary.volumeChange > 0 ? "text-emerald-400" : 
                                    data.marketSummary.volumeChange < 0 ? "text-red-400" : 
                                    "text-muted-foreground"
                                )}>
                                    {data.marketSummary.volumeChange === 0 ? 'No change' :
                                    `${data.marketSummary.volumeChange > 0 ? '+' : ''}${data.marketSummary.volumeChange.toFixed(2)}%`}
                                </p>
                            </div>

                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-1">
                                    <p className="text-sm">Market MACD</p>
                                    <div className="group relative">
                                        <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                        <div className="invisible group-hover:visible absolute z-50 w-64 p-2 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg">
                                            <p className="font-medium mb-1">Moving Average Convergence Divergence</p>
                                            <ul className="space-y-1 text-xs">
                                                <li><span className="text-emerald-400">Positive:</span> Bullish market momentum</li>
                                                <li><span className="text-red-400">Negative:</span> Bearish market momentum</li>
                                                <li><span className="text-blue-400">Near Zero:</span> Consolidating market</li>
                                            </ul>
                                            <p className="text-xs mt-2 text-muted-foreground">Average MACD across all pairs</p>
                                        </div>
                                    </div>
                                </div>
                                <p className={cn(
                                    "text-m font-medium",
                                    (data.marketSummary.marketBreadth?.averageMACD || 0) > 0 ? "text-emerald-400" :
                                    (data.marketSummary.marketBreadth?.averageMACD || 0) < 0 ? "text-red-400" :
                                    "text-blue-400"
                                )}>
                                    {data.marketSummary.marketBreadth?.averageMACD?.toFixed(2) || '0.00'}
                                </p>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-1">
                                    <p className="text-sm">A/D Ratio</p>
                                    <div className="group relative">
                                        <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                        <div className="invisible group-hover:visible absolute z-50 w-64 p-2 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg">
                                            <p className="font-medium mb-1">Advance/Decline Ratio</p>
                                            <p className="text-xs mb-2">Measures market breadth by comparing advancing vs declining assets.</p>
                                            <ul className="space-y-1 text-xs">
                                                <li><span className="text-emerald-400">&gt; 1.5:</span> Strong bullish market breadth</li>
                                                <li><span className="text-blue-400">0.67 - 1.5:</span> Neutral market breadth</li>
                                                <li><span className="text-red-400">&lt; 0.67:</span> Strong bearish market breadth</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                <p className={cn(
                                    "text-m font-medium",
                                    (data.marketSummary.marketBreadth?.advanceDeclineRatio || 1) > 1.5 ? "text-emerald-400" :
                                    (data.marketSummary.marketBreadth?.advanceDeclineRatio || 1) < 0.67 ? "text-red-400" :
                                    "text-blue-400"
                                )}>
                                    {data.marketSummary.marketBreadth?.advanceDeclineRatio?.toFixed(2) || '-'}
                                </p>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1">
                                    <p className="text-sm">Trends</p>
                                    <div className="group relative">
                                        <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                        <div className="invisible group-hover:visible absolute z-50 w-64 p-2 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg">
                                            <p className="font-medium mb-1">Strong Trend Distribution</p>
                                            <p className="text-xs mb-2">Percentage of assets in strong uptrends vs downtrends based on multiple indicators.</p>
                                            <ul className="space-y-1 text-xs">
                                                <li><span className="text-emerald-400">↑ Uptrend:</span> Assets showing strong bullish momentum</li>
                                                <li><span className="text-red-400">↓ Downtrend:</span> Assets showing strong bearish momentum</li>
                                            </ul>
                                            <p className="text-xs mt-2 text-muted-foreground">Higher percentages indicate stronger market direction.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-m text-emerald-400">↑{data.marketSummary.marketBreadth?.percentStrongUptrend?.toFixed(1) || '0.0'}%</span>
                                    <span className="text-m text-muted-foreground">/</span>
                                    <span className="text-m text-red-400">↓{data.marketSummary.marketBreadth?.percentStrongDowntrend?.toFixed(1) || '0.0'}%</span>
                                </div>
                            </div>
                        </div>
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
                        <ul className="space-y-4">
                            {/* RSI Distribution Section */}
                            <div>
                                <div className="flex items-center gap-1 mb-2">
                                    <h3 className="text-sm font-medium text-muted-foreground">RSI Distribution:</h3>
                                    <div className="group relative">
                                        <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                        <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg">
                                            <p className="font-medium mb-2">Relative Strength Index (RSI) Distribution</p>
                                            <p className="text-xs mb-2">Shows how many pairs are in each RSI category across the market.</p>
                                            <ul className="space-y-2 text-xs">
                                                <li>
                                                    <span className="text-red-400 font-medium">Overbought (&gt;70):</span>
                                                    <p>Indicates potential price reversal or correction. High number of overbought pairs suggests market euphoria.</p>
                                                </li>
                                                <li>
                                                    <span className="text-emerald-400 font-medium">Oversold (&lt;30):</span>
                                                    <p>Indicates potential bounce or recovery. High number of oversold pairs suggests market fear.</p>
                                                </li>
                                            </ul>
                                            <p className="text-xs mt-2 text-muted-foreground">Calculation: 14-period RSI using exponential moving average of gains vs losses.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm">Overbought (&gt;70)</span>
                                        <span className="text-m font-medium text-red-400">{data.marketSummary.rsiDistribution.overbought}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Oversold (&lt;30)</span>
                                        <span className="text-m font-medium text-emerald-400">{data.marketSummary.rsiDistribution.oversold}</span>
                                    </div>
                                </div>
                            </div>

                            {/* MACD Signals Section */}
                            <div>
                                <div className="flex items-center gap-1 mb-2">
                                    <h3 className="text-sm font-medium text-muted-foreground">MACD Signals:</h3>
                                    <div className="group relative">
                                        <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                        <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg">
                                            <p className="font-medium mb-2">Moving Average Convergence Divergence (MACD)</p>
                                            <p className="text-xs mb-2">Trend-following momentum indicator showing relationship between two moving averages.</p>
                                            <ul className="space-y-2 text-xs">
                                                <li>
                                                    <span className="text-emerald-400 font-medium">Bullish Crossover:</span>
                                                    <p>MACD line crosses above signal line, indicating potential upward momentum. Count includes both strong and weak uptrends.</p>
                                                </li>
                                                <li>
                                                    <span className="text-red-400 font-medium">Bearish Crossover:</span>
                                                    <p>MACD line crosses below signal line, indicating potential downward momentum. Count includes both strong and weak downtrends.</p>
                                                </li>
                                            </ul>
                                            <p className="text-xs mt-2 text-muted-foreground">Calculation: Difference between 12-day and 26-day EMAs, with 9-day EMA signal line.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm">Bullish Crossover</span>
                                        <span className="text-m font-medium text-emerald-400">
                                            {data.marketSummary.trendDistribution.strongUptrend + data.marketSummary.trendDistribution.weakUptrend}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Bearish Crossover</span>
                                        <span className="text-m font-medium text-red-400">
                                            {data.marketSummary.trendDistribution.strongDowntrend + data.marketSummary.trendDistribution.weakDowntrend}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Trend Strength Section */}
                            <div>
                                <div className="flex items-center gap-1 mb-2">
                                    <h3 className="text-sm font-medium text-muted-foreground">Trend Strength:</h3>
                                    <div className="group relative">
                                        <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                        <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg">
                                            <p className="font-medium mb-2">Trend Strength Analysis</p>
                                            <p className="text-xs mb-2">Composite trend measurement using multiple technical indicators.</p>
                                            <ul className="space-y-2 text-xs">
                                                <li>
                                                    <span className="text-emerald-400 font-medium">Strong Uptrend:</span>
                                                    <p>Price above key MAs, positive MACD, RSI &gt; 50, and increasing volume. High confidence bullish signal.</p>
                                                </li>
                                                <li>
                                                    <span className="text-red-400 font-medium">Strong Downtrend:</span>
                                                    <p>Price below key MAs, negative MACD, RSI &lt; 50, and increasing volume. High confidence bearish signal.</p>
                                                </li>
                                                <li>
                                                    <span className="text-blue-400 font-medium">Consolidating:</span>
                                                    <p>Price moving sideways, neutral MACD, RSI between 40-60. Indicates potential trend transition or accumulation.</p>
                                                </li>
                                            </ul>
                                            <p className="text-xs mt-2 text-muted-foreground">Factors: Moving averages (7, 25, 99), MACD, RSI, Volume, and Price action patterns.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm">Strong Uptrend</span>
                                        <span className="text-m font-medium text-emerald-400">{data.marketSummary.trendDistribution.strongUptrend}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Strong Downtrend</span>
                                        <span className="text-m font-medium text-red-400">{data.marketSummary.trendDistribution.strongDowntrend}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Consolidating</span>
                                        <span className="text-m font-medium text-blue-400">{data.marketSummary.trendDistribution.neutral}</span>
                                    </div>
                                </div>
                            </div>
                        </ul>
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
                            {data.pairs
                                .filter(pair => !isNaN(parseFloat(pair.dailyPriceChange)))
                                .sort((a, b) => parseFloat(b.dailyPriceChange) - parseFloat(a.dailyPriceChange))
                                .slice(0, 10)
                                .map((pair, i) => (
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
                            {data.pairs
                                .filter(pair => !isNaN(parseFloat(pair.dailyPriceChange)))
                                .sort((a, b) => parseFloat(a.dailyPriceChange) - parseFloat(b.dailyPriceChange))
                                .slice(0, 10)
                                .map((pair, i) => (
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

                



                {/* Add Top Enhanced Score Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center justify-between">
                            Strong Buy Signals
                            <div className="group relative">
                                <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg right-0">
                                    <p className="font-medium mb-2">Enhanced Composite Score Components:</p>
                                    <ul className="space-y-1 text-xs">
                                        <li><span className="text-emerald-400">RSI (15%):</span> Relative Strength Index measures overbought/oversold conditions</li>
                                        <li><span className="text-emerald-400">MACD (20%):</span> Moving Average Convergence Divergence for trend strength</li>
                                        <li><span className="text-emerald-400">Volume (10%):</span> Volume oscillator indicates buying/selling pressure</li>
                                        <li><span className="text-emerald-400">Price Movement (15%):</span> Recent price action and momentum</li>
                                        <li><span className="text-emerald-400">Moving Averages (20%):</span> Multiple timeframe trend alignment</li>
                                        <li><span className="text-emerald-400">Volatility (10%):</span> Risk adjustment based on price stability</li>
                                        <li><span className="text-emerald-400">Support/Resistance (10%):</span> Position relative to key levels</li>
                                    </ul>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        Score ranges: <span className="text-emerald-400">&gt;70%</span> Strong Buy • 
                                        <span className="text-blue-400">30-70%</span> Neutral • 
                                        <span className="text-red-400">&lt;30%</span> Strong Sell
                                    </div>
                                </div>
                            </div>
                        </CardTitle>
                        <CardDescription>
                            Top 5 pairs by technical analysis score
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.pairs
                                .sort((a, b) => parseFloat(b.enhancedScore) - parseFloat(a.enhancedScore))
                                .slice(0, 5)
                                .map((pair, index) => (
                                    <div key={pair.pair} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">{index + 1}.</span>
                                            <span className="font-medium">{pair.pair}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-sm font-medium",
                                                    parseFloat(pair.enhancedScore) >= 0.7 ? "text-emerald-400" :
                                                    parseFloat(pair.enhancedScore) <= 0.3 ? "text-red-400" :
                                                    "text-blue-400"
                                                )}>
                                                    {(parseFloat(pair.enhancedScore) * 100).toFixed(1)}%
                                                </span>
                                                <div className="w-24 h-2 bg-secondary/30 rounded-full overflow-hidden">
                                                    <div 
                                                        className={cn(
                                                            "h-full rounded-full",
                                                            parseFloat(pair.enhancedScore) >= 0.7 ? "bg-emerald-400" :
                                                            parseFloat(pair.enhancedScore) <= 0.3 ? "bg-red-400" :
                                                            "bg-blue-400"
                                                        )}
                                                        style={{ width: `${parseFloat(pair.enhancedScore) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {pair.macdTrend} • RSI: {pair.rsi}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            {data.pairs.length === 0 && (
                                <div className="text-sm text-muted-foreground">No pairs available</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Add Bottom Enhanced Score Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center justify-between">
                            Strong Sell Signals
                            <div className="group relative">
                                <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg right-0">
                                    <p className="font-medium mb-2">Enhanced Composite Score Components:</p>
                                    <ul className="space-y-1 text-xs">
                                        <li><span className="text-emerald-400">RSI (15%):</span> Relative Strength Index measures overbought/oversold conditions</li>
                                        <li><span className="text-emerald-400">MACD (20%):</span> Moving Average Convergence Divergence for trend strength</li>
                                        <li><span className="text-emerald-400">Volume (10%):</span> Volume oscillator indicates buying/selling pressure</li>
                                        <li><span className="text-emerald-400">Price Movement (15%):</span> Recent price action and momentum</li>
                                        <li><span className="text-emerald-400">Moving Averages (20%):</span> Multiple timeframe trend alignment</li>
                                        <li><span className="text-emerald-400">Volatility (10%):</span> Risk adjustment based on price stability</li>
                                        <li><span className="text-emerald-400">Support/Resistance (10%):</span> Position relative to key levels</li>
                                    </ul>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        Score ranges: <span className="text-emerald-400">&gt;70%</span> Strong Buy • 
                                        <span className="text-blue-400">30-70%</span> Neutral • 
                                        <span className="text-red-400">&lt;30%</span> Strong Sell
                                    </div>
                                </div>
                            </div>
                        </CardTitle>
                        <CardDescription>
                            Pairs with lowest technical analysis scores (&lt;30%)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data.pairs
                                .filter(pair => parseFloat(pair.enhancedScore) <= 0.3)
                                .sort((a, b) => parseFloat(a.enhancedScore) - parseFloat(b.enhancedScore))
                                .slice(0, 5)
                                .map((pair, index) => (
                                    <div key={pair.pair} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground">{index + 1}.</span>
                                            <span className="font-medium">{pair.pair}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-red-400">
                                                    {(parseFloat(pair.enhancedScore) * 100).toFixed(1)}%
                                                </span>
                                                <div className="w-24 h-2 bg-secondary/30 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full rounded-full bg-red-400"
                                                        style={{ width: `${parseFloat(pair.enhancedScore) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                {pair.macdTrend} • RSI: {pair.rsi}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            {data.pairs.filter(pair => parseFloat(pair.enhancedScore) <= 0.3).length === 0 && (
                                <div className="text-sm text-muted-foreground">No pairs with strong sell signals currently</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                                {/* Pumping Pairs Card */}
                                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <ChartBarIcon className="w-5 h-5 mr-2 text-emerald-400" />
                            Pumping Pairs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {pumpDumpData.pumpingPairs.slice(0, 3).map((pair, i) => (
                                <li key={pair.pair} className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                                        <div>
                                            <span className="font-medium">{pair.pair}</span>
                                            <div className="group relative ml-2">
                                                <span className={cn(
                                                    "text-xs px-1.5 py-0.5 rounded cursor-help",
                                                    pair.liquidityType === 'Low' ? "bg-yellow-500/20 text-yellow-500" :
                                                    pair.liquidityType === 'High' ? "bg-emerald-500/20 text-emerald-500" :
                                                    "bg-blue-500/20 text-blue-500"
                                                )}>
                                                    {pair.liquidityType} Liquidity
                                                </span>
                                                <div className="invisible group-hover:visible absolute z-50 w-64 p-2 mt-2 text-sm bg-secondary/90 rounded-md shadow-lg">
                                                    <p className="font-medium mb-1">Understanding Liquidity:</p>
                                                    <ul className="space-y-1 text-xs">
                                                        <li><span className="text-yellow-500">Low:</span> Price moves easily with small trades. Exercise caution.</li>
                                                        <li><span className="text-blue-500">Normal:</span> Standard market depth and activity.</li>
                                                        <li><span className="text-emerald-500">High:</span> Deep market, stable price action.</li>
                                                    </ul>
                                                    <div className="mt-2">
                                                        <p className="font-medium mb-1">Volume Score:</p>
                                                        <ul className="space-y-1 text-xs">
                                                            <li><span className="text-emerald-400">High (≥15pts):</span> Strong market activity</li>
                                                            <li><span className="text-emerald-400/70">Med (≥10pts):</span> Moderate activity</li>
                                                            <li><span className="text-muted-foreground">Low (&lt;10pts):</span> Weak activity</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-emerald-400 font-medium block">
                                            {formatPercentage(pair.priceChange)}
                                            {pair.intradayPriceChange > pair.priceChange && (
                                                <span className="text-xs ml-1">
                                                    (Spike: {formatPercentage(pair.intradayPriceChange)})
                                                </span>
                                            )}
                                        </span>
                                        <span className={cn(
                                            "text-xs",
                                            pair.volumeScore >= 15 ? "text-emerald-400" :
                                            pair.volumeScore >= 10 ? "text-emerald-400/70" :
                                            "text-muted-foreground"
                                        )}>
                                            Vol: +{pair.volumeIncrease.toFixed(0)}% ({pair.volumeScore} pts)
                                        </span>
                                    </div>
                                </li>
                            ))}
                            {pumpDumpData.pumpingPairs.length === 0 && (
                                <li className="text-muted-foreground text-sm">No pumping pairs detected</li>
                            )}
                        </ul>
                    </CardContent>
                </Card>

                {/* Dumping Pairs Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <ChartBarIcon className="w-5 h-5 mr-2 text-red-400" />
                            Dumping Pairs
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {pumpDumpData.dumpingPairs.slice(0, 3).map((pair, i) => (
                                <li key={pair.pair} className="flex justify-between items-center">
                                    <div className="flex items-center">
                                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                                        <div>
                                            <span className="font-medium">{pair.pair}</span>
                                            <div className="group relative ml-2">
                                                <span className={cn(
                                                    "text-xs px-1.5 py-0.5 rounded cursor-help",
                                                    pair.liquidityType === 'Low' ? "bg-yellow-500/20 text-yellow-500" :
                                                    pair.liquidityType === 'High' ? "bg-emerald-500/20 text-emerald-500" :
                                                    "bg-blue-500/20 text-blue-500"
                                                )}>
                                                    {pair.liquidityType} Liquidity
                                                </span>
                                                <div className="invisible group-hover:visible absolute z-50 w-64 p-2 mt-2 text-sm bg-secondary/90 rounded-md shadow-lg">
                                                    <p className="font-medium mb-1">Understanding Liquidity:</p>
                                                    <ul className="space-y-1 text-xs">
                                                        <li><span className="text-yellow-500">Low:</span> Price moves easily with small trades. Exercise caution.</li>
                                                        <li><span className="text-blue-500">Normal:</span> Standard market depth and activity.</li>
                                                        <li><span className="text-emerald-500">High:</span> Deep market, stable price action.</li>
                                                    </ul>
                                                    <div className="mt-2">
                                                        <p className="font-medium mb-1">Volume Score:</p>
                                                        <ul className="space-y-1 text-xs">
                                                            <li><span className="text-emerald-400">High (≥15pts):</span> Strong market activity</li>
                                                            <li><span className="text-emerald-400/70">Med (≥10pts):</span> Moderate activity</li>
                                                            <li><span className="text-muted-foreground">Low (&lt;10pts):</span> Weak activity</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-red-400 font-medium block">
                                            {formatPercentage(pair.priceChange)}
                                            {pair.intradayPriceChange > Math.abs(pair.priceChange) && (
                                                <span className="text-xs ml-1">
                                                    (Spike: {formatPercentage(-pair.intradayPriceChange)})
                                                </span>
                                            )}
                                        </span>
                                        <span className={cn(
                                            "text-xs",
                                            pair.volumeScore >= 15 ? "text-emerald-400" :
                                            pair.volumeScore >= 10 ? "text-emerald-400/70" :
                                            "text-muted-foreground"
                                        )}>
                                            Vol: +{pair.volumeIncrease.toFixed(0)}% ({pair.volumeScore} pts)
                                        </span>
                                    </div>
                                </li>
                            ))}
                            {pumpDumpData.dumpingPairs.length === 0 && (
                                <li className="text-muted-foreground text-sm">No dumping pairs detected</li>
                            )}
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
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No new pairs in the last 7 days</p>
                                )}
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground mb-2">Added Last 30 Days</h3>
                                {recentPairs.month.length > 0 ? (
                                    <ul className="space-y-2">
                                        {recentPairs.month.map(pair => (
                                            <li key={pair.pair} className="text-sm border-l-2 border-blue-400/30 pl-2">
                                                <div className="font-medium text-primary">{pair.pair}</div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No new pairs between 7-30 days</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>            
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">    
    
                
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
                <PriceChangeChart data={data.pairs} />
                <MarketDistributionChart data={data.pairs} />
                <RSIDistributionChart data={data.pairs} />
            </div>

            {/* New Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <BollingerDistributionChart data={data.pairs} />
                <VolatilityRadarChart data={data.pairs} />
                <AdvancedTrendChart data={data.pairs} />
            </div>

        </div>
    );
}