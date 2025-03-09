import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/solid';
import { cn } from '@/lib/utils';

interface CorrelationData {
  pair1: string;
  pair2: string;
  correlation: number;
  pValue: number;
  volumeScore: number;
  volatilityAdjustedCorr: number;
  timeframes: {
    '7d': number;
    '30d': number;
    '90d': number;
  };
  strength: string;
  significance: string;
  averageDailyVolume: number;
  volatility: number;
}

interface MatrixCell {
  pair1: string;
  pair2: string;
  value: number;
  significance: 'High' | 'Medium' | 'Low';
}

interface Props {
  data: CorrelationData[];
  loading: boolean;
}

export function CorrelationMatrix({ data, loading }: Props) {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');
  const [view, setView] = useState<'matrix' | 'list' | 'trends'>('matrix');
  const [matrixData, setMatrixData] = useState<MatrixCell[][]>([]);
  const [uniquePairs, setUniquePairs] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'correlation' | 'volume' | 'volatility'>('correlation');
  const [filterSignificance, setFilterSignificance] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Add helper function to format pair names
  const formatPairName = (pair: string) => pair.replace('-USD', '');

  useEffect(() => {
    if (!data.length) return;

    // Extract unique pairs (keep original names for data matching)
    const pairs = Array.from(new Set(data.flatMap(c => [c.pair1, c.pair2]))).sort();
    setUniquePairs(pairs);

    // Create matrix data (same logic, just display is changed)
    const matrix: MatrixCell[][] = pairs.map(pair1 => 
      pairs.map(pair2 => {
        if (pair1 === pair2) {
          return { pair1, pair2, value: 1, significance: 'High' };
        }
        const correlation = data.find(
          c => (c.pair1 === pair1 && c.pair2 === pair2) || (c.pair1 === pair2 && c.pair2 === pair1)
        );
        return {
          pair1,
          pair2,
          value: correlation ? correlation.timeframes[timeframe] : 0,
          significance: correlation ? correlation.significance as 'High' | 'Medium' | 'Low' : 'Low'
        };
      })
    );
    setMatrixData(matrix);
  }, [data, timeframe]);

  const getCorrelationColor = (value: number, significance: string) => {
    const alpha = significance === 'High' ? 0.9 : significance === 'Medium' ? 0.6 : 0.3;
    if (value > 0) {
      return `rgba(52, 211, 153, ${alpha})`; // Green for positive
    } else if (value < 0) {
      return `rgba(239, 68, 68, ${alpha})`; // Red for negative
    }
    return `rgba(148, 163, 184, ${alpha})`; // Gray for neutral
  };

  const filteredData = data.filter(c => 
    filterSignificance === 'all' || c.significance.toLowerCase() === filterSignificance
  ).sort((a, b) => {
    if (sortBy === 'correlation') return Math.abs(b.correlation) - Math.abs(a.correlation);
    if (sortBy === 'volume') return b.averageDailyVolume - a.averageDailyVolume;
    return b.volatility - a.volatility;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as '7d' | '30d' | '90d')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSignificance} onValueChange={(v) => setFilterSignificance(v as 'all' | 'high' | 'medium' | 'low')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Significance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Correlations</SelectItem>
              <SelectItem value="high">High Significance</SelectItem>
              <SelectItem value="medium">Medium Significance</SelectItem>
              <SelectItem value="low">Low Significance</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'correlation' | 'volume' | 'volatility')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="correlation">By Correlation</SelectItem>
              <SelectItem value="volume">By Volume</SelectItem>
              <SelectItem value="volatility">By Volatility</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="group relative">
          <QuestionMarkCircleIcon className="h-5 w-5 text-muted-foreground cursor-help hover:text-primary" />
          <div className="invisible group-hover:visible absolute z-50 w-72 p-3 mt-1 text-sm bg-secondary/90 rounded-md shadow-lg right-0">
            <p className="font-medium mb-2">Understanding Correlations</p>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="text-emerald-400 font-medium">Positive Correlation (Green):</span>
                <p>Assets move in the same direction</p>
              </li>
              <li>
                <span className="text-red-400 font-medium">Negative Correlation (Red):</span>
                <p>Assets move in opposite directions</p>
              </li>
              <li>
                <span className="text-muted-foreground font-medium">Color Intensity:</span>
                <p>Darker colors indicate higher statistical significance</p>
              </li>
            </ul>
            <div className="mt-2 text-xs text-muted-foreground">
              Significance levels based on p-value and volume thresholds
            </div>
          </div>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as 'matrix' | 'list' | 'trends')}>
        <TabsList>
          <TabsTrigger value="matrix">Matrix View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
          <TabsTrigger value="trends">Trends View</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Correlation Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="min-h-[400px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading correlations...</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="grid" style={{ 
                      gridTemplateColumns: `80px repeat(${uniquePairs.length}, minmax(50px, 1fr))`,
                    }}>
                      {/* Header row */}
                      <div className="sticky top-0 left-0 z-20 bg-background"></div>
                      {uniquePairs.map(pair => (
                        <div key={pair} className="p-2 text-xs font-medium text-muted-foreground rotate-45 whitespace-nowrap">
                          {formatPairName(pair)}
                        </div>
                      ))}

                      {/* Matrix cells */}
                      {matrixData.map((row, i) => (
                        <React.Fragment key={i}>
                          <div className="sticky left-0 z-10 bg-background p-2 text-xs font-medium border-r">
                            {formatPairName(uniquePairs[i])}
                          </div>
                          {row.map((cell, j) => (
                            <div
                              key={`${i}-${j}`}
                              className="p-2 text-xs font-medium text-center group relative"
                              style={{
                                backgroundColor: getCorrelationColor(cell.value, cell.significance)
                              }}
                            >
                              {cell.value.toFixed(2)}
                              <div className="invisible group-hover:visible absolute z-30 w-48 p-2 text-xs bg-secondary/90 rounded-md shadow-lg -translate-x-1/2 left-1/2 top-full">
                                <p className="font-medium">{formatPairName(cell.pair1)} ↔ {formatPairName(cell.pair2)}</p>
                                <p>Correlation: {cell.value.toFixed(3)}</p>
                                <p>Significance: {cell.significance}</p>
                              </div>
                            </div>
                          ))}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Correlation List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredData.map((correlation, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{formatPairName(correlation.pair1)}</span>
                      <span className="text-sm mx-2">↔</span>
                      <span className="font-medium">{formatPairName(correlation.pair2)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={cn(
                          "text-sm font-medium",
                          correlation.correlation > 0 ? "text-emerald-400" : "text-red-400"
                        )}>
                          {correlation.correlation.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">({correlation.significance})</span>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>Vol: ${(correlation.averageDailyVolume / 1000000).toFixed(1)}M</div>
                        <div>Vol: {correlation.volatility.toFixed(2)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">Correlation Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredData.map((correlation, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{formatPairName(correlation.pair1)}</span>
                        <span className="text-sm mx-2">↔</span>
                        <span className="font-medium">{formatPairName(correlation.pair2)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{correlation.significance} Significance</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['7d', '30d', '90d'] as const).map(period => (
                        <div key={period} className="space-y-1">
                          <div className="text-xs text-muted-foreground">{period}</div>
                          <div className="h-2 bg-secondary/30 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                correlation.timeframes[period] > 0 ? "bg-emerald-400" : "bg-red-400"
                              )}
                              style={{
                                width: `${Math.abs(correlation.timeframes[period] * 100)}%`,
                                opacity: period === timeframe ? 1 : 0.5
                              }}
                            />
                          </div>
                          <div className="text-xs font-medium">
                            {correlation.timeframes[period].toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 