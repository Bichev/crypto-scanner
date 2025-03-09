import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cryptoService } from '@/services/cryptoService';
import { cn } from '@/lib/utils';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/solid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

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
  significance: 'High' | 'Medium' | 'Low';
  averageDailyVolume: number;
  volatility: number;
  selectedTimeframe: string;
}

interface MatrixCell {
  pair1: string;
  pair2: string;
  value: number;
  significance: 'High' | 'Medium' | 'Low';
}

interface CandleData {
  pair: string;
  close: number;
  volume: number;
  timestamp: number;
}

export function CorrelationWidget() {
  const [correlations, setCorrelations] = useState<CorrelationData[]>([]);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');
  const [view, setView] = useState<'list' | 'matrix' | 'trends'>('list');
  const [isLoading, setIsLoading] = useState(true);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [matrixData, setMatrixData] = useState<MatrixCell[][]>([]);
  const [uniquePairs, setUniquePairs] = useState<string[]>([]);

  useEffect(() => {
    fetchCorrelations();
  }, [timeframe]);

  const fetchCorrelations = async () => {
    setIsLoading(true);
    try {
      const data = await cryptoService.getCorrelations(20);
      const typedData = data as CorrelationData[];
      setCorrelations(typedData);
      
      // Process data for matrix view
      const pairs = Array.from(
        new Set(
          typedData.flatMap((c: CorrelationData) => [c.pair1, c.pair2])
        )
      ).sort();
      setUniquePairs(pairs);
      
      const matrix: MatrixCell[][] = pairs.map(p1 => 
        pairs.map(p2 => {
          if (p1 === p2) return { pair1: p1, pair2: p2, value: 1, significance: 'High' as const };
          const corr = typedData.find(c => 
            (c.pair1 === p1 && c.pair2 === p2) || (c.pair1 === p2 && c.pair2 === p1)
          );
          return corr ? {
            pair1: p1,
            pair2: p2,
            value: corr.correlation,
            significance: corr.significance
          } : { pair1: p1, pair2: p2, value: 0, significance: 'Low' as const };
        })
      );
      setMatrixData(matrix);
    } catch (error) {
      console.error('Error fetching correlations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCorrelationColor = (value: number, significance: 'High' | 'Medium' | 'Low') => {
    const absValue = Math.abs(value);
    const alpha = significance === 'High' ? 1 : significance === 'Medium' ? 0.7 : 0.4;
    if (value > 0) {
      return absValue > 0.7 ? `rgba(52, 211, 153, ${alpha})` : 
             absValue > 0.5 ? `rgba(52, 211, 153, ${alpha * 0.7})` : 
             absValue > 0.3 ? `rgba(52, 211, 153, ${alpha * 0.5})` : 
             `rgba(148, 163, 184, ${alpha * 0.3})`;
    } else {
      return absValue > 0.7 ? `rgba(239, 68, 68, ${alpha})` : 
             absValue > 0.5 ? `rgba(239, 68, 68, ${alpha * 0.7})` : 
             absValue > 0.3 ? `rgba(239, 68, 68, ${alpha * 0.5})` : 
             `rgba(148, 163, 184, ${alpha * 0.3})`;
    }
  };

  const renderListView = () => (
    <div className="space-y-3">
      {correlations.slice(0, 10).map((correlation, index) => (
        <div key={index} className="flex justify-between items-center group hover:bg-accent/30 p-2 rounded-lg transition-colors">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{correlation.pair1}</span>
              <span className="text-sm mx-2">↔</span>
              <span className="font-medium">{correlation.pair2}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Vol: ${(correlation.averageDailyVolume / 1000).toFixed(1)}K | σ: {correlation.volatility.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className={cn(
              "text-sm font-medium",
              correlation.correlation > 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {correlation.correlation.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              p: {correlation.pValue.toFixed(3)} ({correlation.significance})
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderMatrixView = () => (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="grid grid-cols-[auto_repeat(auto-fill,minmax(60px,1fr))]">
          {/* Header row */}
          <div className="h-6"></div>
          {uniquePairs.map(pair => (
            <div key={pair} className="text-xs font-medium transform -rotate-45 origin-left pl-2">
              {pair.split('-')[0]}
            </div>
          ))}
          
          {/* Matrix rows */}
          {matrixData.map((row, i) => (
            <React.Fragment key={i}>
              <div className="text-xs font-medium py-1">{uniquePairs[i].split('-')[0]}</div>
              {row.map((cell, j) => (
                <div
                  key={`${i}-${j}`}
                  className="w-[60px] h-[24px] flex items-center justify-center text-xs"
                  style={{ backgroundColor: getCorrelationColor(cell.value, cell.significance) }}
                  title={`${cell.pair1} vs ${cell.pair2}: ${cell.value.toFixed(2)}`}
                >
                  {cell.value.toFixed(2)}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTrendsView = () => (
    <div className="space-y-4">
      {correlations.slice(0, 5).map((correlation, index) => (
        <div key={index} className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="font-medium">
              {correlation.pair1} ↔ {correlation.pair2}
            </div>
            <div className="text-sm text-muted-foreground">
              Significance: {correlation.significance}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {Object.entries(correlation.timeframes).map(([period, value]) => (
              <div key={period} className="text-center">
                <div className="text-xs text-muted-foreground">{period}</div>
                <div className={cn(
                  "text-sm font-medium",
                  value > 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {value.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          <div className="h-2 bg-secondary/30 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                correlation.correlation > 0 ? "bg-emerald-400" : "bg-red-400"
              )}
              style={{
                width: `${Math.abs(correlation.correlation) * 100}%`,
                opacity: correlation.significance === 'High' ? 1 : 
                        correlation.significance === 'Medium' ? 0.7 : 0.4
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-medium">Market Correlations</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setHelpDialogOpen(true)}
            >
              <QuestionMarkCircleIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeframe} onValueChange={(value: '7d' | '30d' | '90d') => setTimeframe(value)}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="30d">30 Days</SelectItem>
                <SelectItem value="90d">90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs 
          value={view} 
          onValueChange={(v: string) => setView(v as 'list' | 'matrix' | 'trends')} 
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="matrix">Matrix View</TabsTrigger>
            <TabsTrigger value="trends">Trends View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="list" className="mt-0">
            {renderListView()}
          </TabsContent>
          
          <TabsContent value="matrix" className="mt-0">
            {renderMatrixView()}
          </TabsContent>
          
          <TabsContent value="trends" className="mt-0">
            {renderTrendsView()}
          </TabsContent>
        </Tabs>

        <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Understanding Correlations</DialogTitle>
              <DialogDescription className="space-y-4">
                <p>
                  Correlation values range from -1 to +1:
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    <li>+1: Perfect positive correlation</li>
                    <li>0: No correlation</li>
                    <li>-1: Perfect negative correlation</li>
                  </ul>
                </p>
                <p>
                  <strong>Significance Levels:</strong>
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    <li>High: 99% confidence (p &lt; 0.01)</li>
                    <li>Medium: 95% confidence (p &lt; 0.05)</li>
                    <li>Low: 90% confidence (p &lt; 0.1)</li>
                  </ul>
                </p>
                <p>
                  <strong>Views:</strong>
                  <ul className="list-disc pl-4 mt-2 space-y-1">
                    <li>List: Detailed correlation information</li>
                    <li>Matrix: Visual correlation heatmap</li>
                    <li>Trends: Correlation changes over time</li>
                  </ul>
                </p>
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
} 