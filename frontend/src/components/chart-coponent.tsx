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
  Cell
} from 'recharts';

interface ChartProps {
  data: CryptoPair[];
}

export function MarketDistributionChart({ data }: ChartProps) {
  // Prepare data for pie chart
  const pieData = React.useMemo(() => {
    // Group by trend
    const trendGroups = data.reduce((acc, pair) => {
      const trend = pair.macdTrend || 'Unknown';
      if (!acc[trend]) acc[trend] = 0;
      acc[trend]++;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(trendGroups).map(([name, value]) => ({
      name,
      value
    }));
  }, [data]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <Card className="h-80">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Trend Distribution</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function RSIDistributionChart({ data }: ChartProps) {
  // Prepare data for bar chart
  const chartData = React.useMemo(() => {
    const rsiRanges = [
      { name: '0-10', range: [0, 10], count: 0 },
      { name: '10-20', range: [10, 20], count: 0 },
      { name: '20-30', range: [20, 30], count: 0 },
      { name: '30-40', range: [30, 40], count: 0 },
      { name: '40-50', range: [40, 50], count: 0 },
      { name: '50-60', range: [50, 60], count: 0 },
      { name: '60-70', range: [60, 70], count: 0 },
      { name: '70-80', range: [70, 80], count: 0 },
      { name: '80-90', range: [80, 90], count: 0 },
      { name: '90-100', range: [90, 100], count: 0 },
    ];

    data.forEach(pair => {
      const rsi = parseFloat(pair.rsi);
      if (isNaN(rsi)) return;
      
      const range = rsiRanges.find(r => rsi >= r.range[0] && rsi < r.range[1]);
      if (range) range.count++;
    });

    return rsiRanges;
  }, [data]);

  return (
    <Card className="h-80">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">RSI Distribution</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 30,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="name" angle={-45} textAnchor="end" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#8884d8" barSize={25} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function PriceChangeChart({ data }: ChartProps) {
  // Prepare data for line chart - top 5 gainers/losers
  const chartData = React.useMemo(() => {
    return data
      .filter(pair => !isNaN(parseFloat(pair.dailyPriceChange)))
      .sort((a, b) => Math.abs(parseFloat(b.dailyPriceChange)) - Math.abs(parseFloat(a.dailyPriceChange)))
      .slice(0, 10)
      .map(pair => ({
        name: pair.pair.split('-')[0],
        change: parseFloat(pair.dailyPriceChange),
      }));
  }, [data]);

  return (
    <Card className="h-80">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Significant Price Changes (24h)</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis type="number" unit="%" domain={['dataMin', 'dataMax']} />
            <YAxis type="category" dataKey="name" width={50} />
            <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Change']} />
            <Bar dataKey="change">
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.change >= 0 ? '#10B981' : '#EF4444'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}