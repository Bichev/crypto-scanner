import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CryptoPair, AnalyzerResponse, MarketSummary } from '@/types/crypto';
import { formatNumber, formatPercentage, getTrendColor, cn } from '@/lib/utils';
import { formatPrice } from '@/lib/support-resistance-helpers';
import { ArrowUpIcon, ArrowDownIcon, ChartBarIcon, PlusCircleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/solid';
import { MarketDistributionChart, RSIDistributionChart, PriceChangeChart } from '@/components/chart-coponent';
import { cryptoService } from '@/services/cryptoService';
import { BollingerDistributionChart, VolatilityRadarChart, AdvancedTrendChart } from '@/components/advanced-charts';
import { CorrelationWidget } from '@/components/CorrelationWidget';
import { BrokenResistancesCard, BrokenSupportsCard } from '@/components/BrokenLevelsCard';
import moment from 'moment';

interface DashboardProps {
    data: AnalyzerResponse;
    lastUpdated: Date | null;
}

export function CryptoDashboard({ data, lastUpdated }: DashboardProps) {
    const [correlations, setCorrelations] = useState<any[]>([]);
    const [trendChanges, setTrendChanges] = useState<any[]>([]);
    const [loadingCorrelations, setLoadingCorrelations] = useState(true);
    const [loadingTrendChanges, setLoadingTrendChanges] = useState(true);

    // Calculate time boundaries using moment
    const now = moment();
    const todayStart = moment().startOf('day');
    const weekAgo = moment().subtract(7, 'days').startOf('day');
    const monthAgo = moment().subtract(30, 'days').startOf('day');

    // Filter pairs based on firstSeenTimestamp using moment
    const recentPairs = {
        today: data.pairs
            .filter(pair => pair.firstSeenTimestamp && moment(pair.firstSeenTimestamp).isSameOrAfter(todayStart))
            .sort((a, b) => (b.firstSeenTimestamp || 0) - (a.firstSeenTimestamp || 0)),
        week: data.pairs
            .filter(pair => pair.firstSeenTimestamp && 
                moment(pair.firstSeenTimestamp).isSameOrAfter(weekAgo) && 
                moment(pair.firstSeenTimestamp).isBefore(todayStart))
            .sort((a, b) => (b.firstSeenTimestamp || 0) - (a.firstSeenTimestamp || 0)),
        month: data.pairs
            .filter(pair => pair.firstSeenTimestamp && 
                moment(pair.firstSeenTimestamp).isSameOrAfter(monthAgo) && 
                moment(pair.firstSeenTimestamp).isBefore(weekAgo))
            .sort((a, b) => (b.firstSeenTimestamp || 0) - (a.firstSeenTimestamp || 0))
    };

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

                            {/* Broken Levels Section */}
                            <div>
                                <div className="flex items-center gap-1 mb-2">
                                    <h3 className="text-sm font-medium text-muted-foreground">Broken Levels:</h3>
                                    <div className="group relative">
                                        <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                        <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg">
                                            <p className="font-medium mb-2">Support & Resistance Level Breaks</p>
                                            <p className="text-xs mb-2">Shows the number of pairs that have broken through their support or resistance levels in the last 48 hours.</p>
                                            <ul className="space-y-2 text-xs">
                                                <li>
                                                    <span className="text-emerald-400 font-medium">Lost Resistance:</span>
                                                    <p>Price has broken above previous resistance level, indicating potential upward momentum.</p>
                                                </li>
                                                <li>
                                                    <span className="text-red-400 font-medium">Lost Support:</span>
                                                    <p>Price has broken below previous support level, indicating potential downward momentum.</p>
                                                </li>
                                            </ul>
                                            <p className="text-xs mt-2 text-muted-foreground">Breaks are confirmed using price action and volume analysis.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm">Lost Resistance</span>
                                        <span className="text-m font-medium text-emerald-400">
                                            {data.pairs.reduce((count, pair) => 
                                                count + (pair.brokenLevels?.brokenResistances?.filter(level => 
                                                    Math.floor(Date.now() / 1000) - level.breakTime < 2 * 24 * 60 * 60
                                                ).length || 0), 0
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Lost Support</span>
                                        <span className="text-m font-medium text-red-400">
                                            {data.pairs.reduce((count, pair) => 
                                                count + (pair.brokenLevels?.brokenSupports?.filter(level => 
                                                    Math.floor(Date.now() / 1000) - level.breakTime < 2 * 24 * 60 * 60
                                                ).length || 0), 0
                                            )}
                                        </span>
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
                            Buy Signals
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
                            Pairs with highest technical analysis scores
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
                            Sell Signals
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
                            Pairs with lowest technical analysis scores
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

                {/* Trend Reversal Signals Card */}
                {/* Temporarily disabled */}
                {false && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center justify-between">
                            Trend Reversal Signals
                            <div className="group relative">
                                <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg right-0">
                                    <p className="font-medium mb-2">Trend Reversal Indicators:</p>
                                    <ul className="space-y-1 text-xs">
                                        <li><span className="text-emerald-400">Bullish Reversal:</span> Potential upward trend change</li>
                                        <li><span className="text-red-400">Bearish Reversal:</span> Potential downward trend change</li>
                                        <li><span className="text-blue-400">Confirmation Needed:</span> Early reversal signs</li>
                                    </ul>
                                    <p className="text-xs mt-2 text-muted-foreground">Based on RSI divergence, MACD crossover, and price action patterns</p>
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Bullish Reversals */}
                            <div>
                                <h3 className="text-sm font-medium text-emerald-400 mb-2">Bullish Reversal Signals</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => 
                                            parseFloat(pair.rsi) < 30 && 
                                            pair.macdTrend.includes('Bullish') &&
                                            parseFloat(pair.dailyPriceChange) > -0.5
                                        )
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-muted-foreground">RSI: {parseFloat(pair.rsi).toFixed(1)}</div>
                                                    <div className="text-xs text-emerald-400">{pair.macdTrend}</div>
                                                </div>
                                            </div>
                                        ))}
                                    {data.pairs.filter(pair => 
                                        parseFloat(pair.rsi) < 30 && 
                                        pair.macdTrend.includes('Bullish') &&
                                        parseFloat(pair.dailyPriceChange) > -0.5
                                    ).length === 0 && (
                                        <div className="text-sm text-muted-foreground">No bullish reversal signals</div>
                                    )}
                                </div>
                            </div>

                            {/* Bearish Reversals */}
                            <div>
                                <h3 className="text-sm font-medium text-red-400 mb-2">Bearish Reversal Signals</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => 
                                            parseFloat(pair.rsi) > 70 && 
                                            pair.macdTrend.includes('Bearish') &&
                                            parseFloat(pair.dailyPriceChange) < 0.5
                                        )
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-muted-foreground">RSI: {parseFloat(pair.rsi).toFixed(1)}</div>
                                                    <div className="text-xs text-red-400">{pair.macdTrend}</div>
                                                </div>
                                            </div>
                                        ))}
                                    {data.pairs.filter(pair => 
                                        parseFloat(pair.rsi) > 70 && 
                                        pair.macdTrend.includes('Bearish') &&
                                        parseFloat(pair.dailyPriceChange) < 0.5
                                    ).length === 0 && (
                                        <div className="text-sm text-muted-foreground">No bearish reversal signals</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                )}

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

                {/* Volume Analysis Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center justify-between">
                            Volume Analysis
                            <div className="group relative">
                                <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg right-0">
                                    <p className="font-medium mb-2">Volume Indicators:</p>
                                    <ul className="space-y-1 text-xs">
                                        <li><span className="text-emerald-400">Volume Spike:</span> Sudden increase in trading activity</li>
                                        <li><span className="text-blue-400">Volume Trend:</span> Direction of volume movement</li>
                                        <li><span className="text-yellow-400">Volume/Price Divergence:</span> Volume not confirming price movement</li>
                                    </ul>
                                    <p className="text-xs mt-2 text-muted-foreground">Analyzing volume patterns helps confirm price movements and trend strength</p>
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* High Volume Movers */}
                            <div>
                                <h3 className="text-sm font-medium text-emerald-400 mb-2">High Volume Movers</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => parseFloat(pair.volumeOscillator) > 50)
                                        .sort((a, b) => parseFloat(b.volumeOscillator) - parseFloat(a.volumeOscillator))
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-emerald-400">
                                                        Vol: +{parseFloat(pair.volumeOscillator).toFixed(1)}%
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Price: {formatPercentage(parseFloat(pair.dailyPriceChange))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Volume/Price Divergence */}
                            <div>
                                <h3 className="text-sm font-medium text-yellow-400 mb-2">Volume/Price Divergence</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => {
                                            const priceChange = parseFloat(pair.dailyPriceChange);
                                            const volumeChange = parseFloat(pair.volumeOscillator);
                                            return (
                                                (priceChange > 2 && volumeChange < -20) || // Price up, volume down
                                                (priceChange < -2 && volumeChange < -20)    // Price down, volume down
                                            );
                                        })
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-muted-foreground">
                                                        Vol: {parseFloat(pair.volumeOscillator).toFixed(1)}%
                                                    </div>
                                                    <div className={cn(
                                                        "text-xs",
                                                        parseFloat(pair.dailyPriceChange) > 0 ? "text-emerald-400" : "text-red-400"
                                                    )}>
                                                        Price: {formatPercentage(parseFloat(pair.dailyPriceChange))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Declining Volume */}
                            <div>
                                <h3 className="text-sm font-medium text-red-400 mb-2">Declining Volume</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => parseFloat(pair.volumeOscillator) < -50)
                                        .sort((a, b) => parseFloat(a.volumeOscillator) - parseFloat(b.volumeOscillator))
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-red-400">
                                                        Vol: {parseFloat(pair.volumeOscillator).toFixed(1)}%
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Price: {formatPercentage(parseFloat(pair.dailyPriceChange))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>


                {/* Volatility Analysis Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center justify-between">
                            Volatility Analysis
                            <div className="group relative">
                                <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg right-0">
                                    <p className="font-medium mb-2">Volatility Indicators:</p>
                                    <ul className="space-y-1 text-xs">
                                        <li><span className="text-emerald-400">High Volatility:</span> Large price swings, potential for significant moves</li>
                                        <li><span className="text-blue-400">Low Volatility:</span> Price consolidation, potential for breakout</li>
                                        <li><span className="text-yellow-400">Volatility Change:</span> Comparison to historical average</li>
                                    </ul>
                                    <p className="text-xs mt-2 text-muted-foreground">Based on ATR, Bollinger Band width, and historical volatility patterns</p>
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* High Volatility */}
                            <div>
                                <h3 className="text-sm font-medium text-emerald-400 mb-2">Increasing Volatility</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => {
                                            const bbWidth = parseFloat(pair.bollingerBands?.bandwidth || '0');
                                            const atr = parseFloat(pair.atrAnalysis?.normalizedATR || '0');
                                            return bbWidth > 0.1 && atr > 0.02 && pair.volatilityIndex?.trend === 'Increasing';
                                        })
                                        .sort((a, b) => parseFloat(b.atrAnalysis?.normalizedATR || '0') - parseFloat(a.atrAnalysis?.normalizedATR || '0'))
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-emerald-400">
                                                        ATR: {(parseFloat(pair.atrAnalysis?.normalizedATR || '0') * 100).toFixed(1)}%
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        BB Width: {(parseFloat(pair.bollingerBands?.bandwidth || '0') * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Low Volatility */}
                            <div>
                                <h3 className="text-sm font-medium text-blue-400 mb-2">Decreasing Volatility (Potential Breakout)</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => {
                                            const bbWidth = parseFloat(pair.bollingerBands?.bandwidth || '0');
                                            const atr = parseFloat(pair.atrAnalysis?.normalizedATR || '0');
                                            return bbWidth < 0.05 && atr < 0.01 && pair.volatilityIndex?.trend === 'Decreasing';
                                        })
                                        .sort((a, b) => parseFloat(a.bollingerBands?.bandwidth || '0') - parseFloat(b.bollingerBands?.bandwidth || '0'))
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-blue-400">
                                                        BB Squeeze: {(parseFloat(pair.bollingerBands?.bandwidth || '0') * 100).toFixed(1)}%
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Trend: {pair.advancedTrend}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Historical Comparison */}
                            <div>
                                <h3 className="text-sm font-medium text-yellow-400 mb-2">Abnormal Volatility</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => {
                                            const volValue = parseFloat(pair.volatilityIndex?.value || '0');
                                            return volValue > 2; // More than 2x historical average
                                        })
                                        .sort((a, b) => 
                                            parseFloat(b.volatilityIndex?.value || '0') - parseFloat(a.volatilityIndex?.value || '0')
                                        )
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-yellow-400">
                                                        {parseFloat(pair.volatilityIndex?.value || '0').toFixed(1)}x avg
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {pair.volatilityIndex?.trend}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Fibonacci Retracement Levels Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center justify-between">
                            Fibonacci Retracement Levels
                            <div className="group relative">
                                <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg right-0">
                                    <p className="font-medium mb-2">Fibonacci Level Analysis:</p>
                                    <ul className="space-y-1 text-xs">
                                        <li><span className="text-emerald-400">Support Levels:</span> Key levels where price might find support during retracements</li>
                                        <li><span className="text-red-400">Resistance Levels:</span> Key levels where price might find resistance during rallies</li>
                                        <li><span className="text-yellow-400">Extension Levels:</span> Potential price targets beyond the trend</li>
                                    </ul>
                                    <p className="text-xs mt-2 text-muted-foreground">Based on recent swing high/low points and Fibonacci ratios</p>
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Retracement Levels */}
                            <div>
                                <h3 className="text-sm font-medium text-emerald-400 mb-2">At Key Retracement Levels</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => pair.fibonacciAnalysis?.currentPosition?.includes('Retracement'))
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-emerald-400">
                                                        {pair.fibonacciAnalysis?.currentPosition}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Price: ${formatPrice(parseFloat(pair.currentPrice))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    {data.pairs.filter(pair => 
                                        pair.fibonacciAnalysis?.currentPosition?.includes('Retracement')
                                    ).length === 0 && (
                                        <div className="text-sm text-muted-foreground">No pairs at key retracement levels</div>
                                    )}
                                </div>
                            </div>

                            {/* Extension Levels */}
                            <div>
                                <h3 className="text-sm font-medium text-red-400 mb-2">At Extension Levels</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => pair.fibonacciAnalysis?.currentPosition?.includes('Extension'))
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-red-400">
                                                        {pair.fibonacciAnalysis?.currentPosition}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Price: ${formatPrice(parseFloat(pair.currentPrice))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    {data.pairs.filter(pair => 
                                        pair.fibonacciAnalysis?.currentPosition?.includes('Extension')
                                    ).length === 0 && (
                                        <div className="text-sm text-muted-foreground">No pairs at extension levels</div>
                                    )}
                                </div>
                            </div>

                            {/* Recent Swing Points */}
                            <div>
                                <h3 className="text-sm font-medium text-blue-400 mb-2">Recent Swing Points</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => pair.fibonacciAnalysis?.swingPoints)
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs">
                                                        <span className="text-emerald-400">H: ${formatPrice(pair.fibonacciAnalysis?.swingPoints.high || 0)}</span>
                                                        {' • '}
                                                        <span className="text-red-400">L: ${formatPrice(pair.fibonacciAnalysis?.swingPoints.low || 0)}</span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Range: {formatPercentage((pair.fibonacciAnalysis?.swingPoints.high || 0) - 
                                                                               (pair.fibonacciAnalysis?.swingPoints.low || 0) / 
                                                                               (pair.fibonacciAnalysis?.swingPoints.low || 1) * 100)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Ichimoku Cloud Signals Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center justify-between">
                            Ichimoku Cloud Signals
                            <div className="group relative">
                                <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg right-0">
                                    <p className="font-medium mb-2">Ichimoku Cloud Components:</p>
                                    <ul className="space-y-1 text-xs">
                                        <li><span className="text-emerald-400">Strong Bullish:</span> Price above cloud, cloud green</li>
                                        <li><span className="text-red-400">Strong Bearish:</span> Price below cloud, cloud red</li>
                                        <li><span className="text-yellow-400">Potential Reversal:</span> TK Cross or price crossing cloud</li>
                                        <li><span className="text-blue-400">Cloud Thickness:</span> Indicates trend strength</li>
                                    </ul>
                                    <p className="text-xs mt-2 text-muted-foreground">Cloud thickness and color indicate trend strength and direction</p>
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Strong Bullish Trends */}
                            <div>
                                <h3 className="text-sm font-medium text-emerald-400 mb-2">Strong Bullish Trends</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => 
                                            pair.ichimoku?.cloudSignal === 'Strong Bullish' &&
                                            parseFloat(pair.enhancedScore) > 0.6
                                        )
                                        .sort((a, b) => parseFloat(b.enhancedScore) - parseFloat(a.enhancedScore))
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-emerald-400">
                                                        {pair.ichimoku?.tkCross}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Cloud: {Math.abs(parseFloat(pair.ichimoku?.senkouA || '0') - 
                                                            parseFloat(pair.ichimoku?.senkouB || '0')).toFixed(2)}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    {data.pairs.filter(pair => 
                                        pair.ichimoku?.cloudSignal === 'Strong Bullish' &&
                                        parseFloat(pair.enhancedScore) > 0.6
                                    ).length === 0 && (
                                        <div className="text-sm text-muted-foreground">No strong bullish trends</div>
                                    )}
                                </div>
                            </div>

                            {/* Strong Bearish Trends */}
                            <div>
                                <h3 className="text-sm font-medium text-red-400 mb-2">Strong Bearish Trends</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => 
                                            pair.ichimoku?.cloudSignal === 'Strong Bearish' &&
                                            parseFloat(pair.enhancedScore) < 0.4
                                        )
                                        .sort((a, b) => parseFloat(a.enhancedScore) - parseFloat(b.enhancedScore))
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-red-400">
                                                        {pair.ichimoku?.tkCross}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Cloud: {Math.abs(parseFloat(pair.ichimoku?.senkouA || '0') - 
                                                            parseFloat(pair.ichimoku?.senkouB || '0')).toFixed(2)}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    {data.pairs.filter(pair => 
                                        pair.ichimoku?.cloudSignal === 'Strong Bearish' &&
                                        parseFloat(pair.enhancedScore) < 0.4
                                    ).length === 0 && (
                                        <div className="text-sm text-muted-foreground">No strong bearish trends</div>
                                    )}
                                </div>
                            </div>

                            {/* Potential Reversals */}
                            <div>
                                <h3 className="text-sm font-medium text-yellow-400 mb-2">Potential Trend Reversals</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => {
                                            const tkCross = pair.ichimoku?.tkCross || '';
                                            return (tkCross.includes('Bullish Cross') || tkCross.includes('Bearish Cross')) &&
                                                   pair.ichimoku?.cloudSignal !== 'Strong Bullish' &&
                                                   pair.ichimoku?.cloudSignal !== 'Strong Bearish';
                                        })
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className={cn(
                                                        "text-xs",
                                                        pair.ichimoku?.tkCross?.includes('Bullish') ? "text-emerald-400" : "text-red-400"
                                                    )}>
                                                        {pair.ichimoku?.tkCross}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Signal: {pair.ichimoku?.cloudSignal}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    {data.pairs.filter(pair => {
                                        const tkCross = pair.ichimoku?.tkCross || '';
                                        return (tkCross.includes('Bullish Cross') || tkCross.includes('Bearish Cross')) &&
                                               pair.ichimoku?.cloudSignal !== 'Strong Bullish' &&
                                               pair.ichimoku?.cloudSignal !== 'Strong Bearish';
                                    }).length === 0 && (
                                        <div className="text-sm text-muted-foreground">No potential reversals detected</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Recently Added Pairs Card */}
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
                                                {/* <div className="text-xs text-muted-foreground">
                                                    First seen: {new Date(pair.firstSeenTimestamp || 0).toLocaleString()}
                                                </div> */}
                                                <div className="text-xs text-muted-foreground">
                                                    Current price: ${formatPrice(parseFloat(pair.currentPrice))}
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
                                                    First seen: {new Date(pair.firstSeenTimestamp || 0).toLocaleString()}
                                                </div> */}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No new pairs in the last 7 days</p>
                                )}
                            </div>
                            {/* <div>
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
                            </div> */}
                        </div>
                    </CardContent>
                </Card>    


                {/* Moving Average Crossovers Card */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium flex items-center justify-between">
                            Moving Average Crossovers
                            <div className="group relative">
                                <QuestionMarkCircleIcon className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary" />
                                <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg right-0">
                                    <p className="font-medium mb-2">Moving Average Signals:</p>
                                    <ul className="space-y-1 text-xs">
                                        <li><span className="text-emerald-400">Golden Cross:</span> 50MA crosses above 200MA (Strong bullish)</li>
                                        <li><span className="text-red-400">Death Cross:</span> 50MA crosses below 200MA (Strong bearish)</li>
                                        <li><span className="text-yellow-400">Approaching Cross:</span> MAs within 1% of crossing</li>
                                    </ul>
                                    <p className="text-xs mt-2 text-muted-foreground">Moving average crossovers often signal major trend changes</p>
                                </div>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* Golden Cross */}
                            <div>
                                <h3 className="text-sm font-medium text-emerald-400 mb-2">Recent Golden Cross</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => {
                                            const sma50 = parseFloat(pair.sma_50);
                                            const sma200 = parseFloat(pair.sma_200);
                                            const ema50 = parseFloat(pair.ema_50);
                                            const ema200 = parseFloat(pair.ema_200);
                                            return pair.smaTrend_50_200 === 'Golden Cross' || 
                                                   (sma50 > sma200 && 
                                                    ((sma50 - sma200) / sma200 * 100 < 1) && 
                                                    pair.longTermCrossover === 'Bullish');
                                        })
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-emerald-400">
                                                        {pair.smaTrend_50_200}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Price: {formatPercentage(parseFloat(pair.dailyPriceChange))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    {data.pairs.filter(pair => 
                                        pair.smaTrend_50_200 === 'Golden Cross' ||
                                        (parseFloat(pair.sma_50) > parseFloat(pair.sma_200) && 
                                         ((parseFloat(pair.sma_50) - parseFloat(pair.sma_200)) / parseFloat(pair.sma_200) * 100 < 1) &&
                                         pair.longTermCrossover === 'Bullish')
                                    ).length === 0 && (
                                        <div className="text-sm text-muted-foreground">No recent golden crosses</div>
                                    )}
                                </div>
                            </div>

                            {/* Death Cross */}
                            <div>
                                <h3 className="text-sm font-medium text-red-400 mb-2">Recent Death Cross</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => {
                                            const sma50 = parseFloat(pair.sma_50);
                                            const sma200 = parseFloat(pair.sma_200);
                                            const ema50 = parseFloat(pair.ema_50);
                                            const ema200 = parseFloat(pair.ema_200);
                                            return pair.smaTrend_50_200 === 'Death Cross' || 
                                                   (sma50 < sma200 && 
                                                    ((sma200 - sma50) / sma200 * 100 < 1) && 
                                                    pair.longTermCrossover === 'Bearish');
                                        })
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-red-400">
                                                        {pair.smaTrend_50_200}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Price: {formatPercentage(parseFloat(pair.dailyPriceChange))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    {data.pairs.filter(pair => 
                                        pair.smaTrend_50_200 === 'Death Cross' ||
                                        (parseFloat(pair.sma_50) < parseFloat(pair.sma_200) && 
                                         ((parseFloat(pair.sma_200) - parseFloat(pair.sma_50)) / parseFloat(pair.sma_200) * 100 < 1) &&
                                         pair.longTermCrossover === 'Bearish')
                                    ).length === 0 && (
                                        <div className="text-sm text-muted-foreground">No recent death crosses</div>
                                    )}
                                </div>
                            </div>

                            {/* Approaching Crossovers */}
                            <div>
                                <h3 className="text-sm font-medium text-yellow-400 mb-2">Approaching Crossovers</h3>
                                <div className="space-y-2">
                                    {data.pairs
                                        .filter(pair => {
                                            const sma50 = parseFloat(pair.sma_50);
                                            const sma200 = parseFloat(pair.sma_200);
                                            const percentDiff = Math.abs((sma50 - sma200) / sma200 * 100);
                                            return percentDiff < 0.5 && percentDiff > 0;
                                        })
                                        .slice(0, 3)
                                        .map((pair, index) => (
                                            <div key={pair.pair} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground">{index + 1}.</span>
                                                    <span className="font-medium">{pair.pair}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-yellow-400">
                                                        {parseFloat(pair.sma_50) > parseFloat(pair.sma_200) ? 
                                                            'Potential Death Cross' : 'Potential Golden Cross'}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Gap: {(Math.abs((parseFloat(pair.sma_50) - parseFloat(pair.sma_200)) / 
                                                               parseFloat(pair.sma_200) * 100)).toFixed(2)}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    {data.pairs.filter(pair => {
                                        const sma50 = parseFloat(pair.sma_50);
                                        const sma200 = parseFloat(pair.sma_200);
                                        const percentDiff = Math.abs((sma50 - sma200) / sma200 * 100);
                                        return percentDiff < 0.5 && percentDiff > 0;
                                    }).length === 0 && (
                                        <div className="text-sm text-muted-foreground">No approaching crossovers</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>                

                {/* Replace the BrokenLevelsCard with the two new cards */}
                <BrokenResistancesCard pairs={data.pairs} />
                <BrokenSupportsCard pairs={data.pairs} />

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">    
    
                
                {/* Add Recent Trend Changes Card */}
                {/* {trendChanges.length > 0 && (
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
                )} */}
                
                {/* Add Correlations Card */}
                {/* {correlations.length > 0 && (
                    <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium">Strong Market Correlations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                        {correlations.slice(0, 10).map((correlation, index) => (
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
                )} */}
            </div>

            {/* Charts */}
            {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <PriceChangeChart data={data.pairs} />
                <MarketDistributionChart data={data.pairs} />
                <RSIDistributionChart data={data.pairs} />
            </div> */}

            {/* New Charts Row */}
            {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <BollingerDistributionChart data={data.pairs} />
                <VolatilityRadarChart data={data.pairs} />
                <AdvancedTrendChart data={data.pairs} />
            </div> */}

            {/* Correlation Analysis */}
            {/* <div className="mt-6">
                <CorrelationWidget />
            </div> */}

        </div>
    );
}