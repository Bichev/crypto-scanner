// src/components/advanced-charts.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { CryptoPair } from '../types/crypto';
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

interface ChartProps {
  data: CryptoPair[];
}

// Bollinger Bands Distribution Chart
export function BollingerDistributionChart({ data }: ChartProps) {
  // Prepare data for pie chart
  const chartData = React.useMemo(() => {
    const distribution = { 
      overbought: 0, 
      neutral: 0, 
      oversold: 0 
    };
    
    data.forEach(pair => {
      const percentB = parseFloat(pair.bollingerBands?.percentB || '0.5');
      if (percentB > 1) distribution.overbought++;
      else if (percentB < 0) distribution.oversold++;
      else distribution.neutral++;
    });
    
    return [
      { name: 'Overbought', value: distribution.overbought, color: '#EF4444' },
      { name: 'Neutral', value: distribution.neutral, color: '#6B7280' },
      { name: 'Oversold', value: distribution.oversold, color: '#10B981' }
    ];
  }, [data]);

  return (
    <Card className="h-80">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Bollinger Bands Distribution</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Volatility Radar Chart
export function VolatilityRadarChart({ data }: ChartProps) {
  // Prepare data for radar chart - top 8 most volatile pairs
  const chartData = React.useMemo(() => {
    return data
      .filter(pair => parseFloat(pair.atrAnalysis?.normalizedATR || '0') > 0)
      .sort((a, b) => 
        parseFloat(b.atrAnalysis?.normalizedATR || '0') - 
        parseFloat(a.atrAnalysis?.normalizedATR || '0')
      )
      .slice(0, 8)
      .map(pair => ({
        subject: pair.pair.split('-')[0],
        A: parseFloat(pair.atrAnalysis?.normalizedATR || '0'),
        B: parseFloat(pair.volatilityIndex?.value || '0')
      }));
  }, [data]);

  return (
    <Card className="h-80">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Volatility Radar</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" />
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
            <Radar name="ATR %" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
            <Radar name="Vol. Index" dataKey="B" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Advanced Trend Distribution Chart
export function AdvancedTrendChart({ data }: ChartProps) {
  // Prepare data for pie chart
  const chartData = React.useMemo(() => {
    const trendCount = {
      strongUp: 0,
      weakUp: 0,
      neutral: 0,
      weakDown: 0,
      strongDown: 0
    };
    
    data.forEach(pair => {
      const trend = pair.macdTrend || 'Neutral';
      if (trend === 'Strong Uptrend') trendCount.strongUp++;
      else if (trend === 'Weak Uptrend') trendCount.weakUp++;
      else if (trend === 'Strong Downtrend') trendCount.strongDown++;
      else if (trend === 'Weak Downtrend') trendCount.weakDown++;
      else trendCount.neutral++;
    });
    
    return [
      { name: 'Strong Uptrend', value: trendCount.strongUp, color: '#10B981' },
      { name: 'Weak Uptrend', value: trendCount.weakUp, color: '#34D399' },
      { name: 'Neutral', value: trendCount.neutral, color: '#6B7280' },
      { name: 'Weak Downtrend', value: trendCount.weakDown, color: '#F87171' },
      { name: 'Strong Downtrend', value: trendCount.strongDown, color: '#EF4444' }
    ];
  }, [data]);

  return (
    <Card className="h-80">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Advanced Trend Distribution</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}