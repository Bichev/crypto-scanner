import React from 'react';
import { CryptoPair } from '../types/crypto';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Button } from './ui/button';
import { formatNumber, formatPercentage, cn } from '@/lib/utils';
import { XCircleIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

interface DetailViewProps {
  pair: CryptoPair | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CryptoDetailView({ pair, isOpen, onClose }: DetailViewProps) {
  if (!pair) return null;

  const currentPrice = parseFloat(pair.currentPrice);
  const priceChange = parseFloat(pair.dailyPriceChange);
  const rsi = parseFloat(pair.rsi);
  const macdValue = parseFloat(pair.macd || '0');
  const signalLine = parseFloat(pair.signalLine || '0');
  const histogram = parseFloat(pair.histogram || '0');
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center">
            <div className="w-8 h-8 bg-secondary/40 rounded-full mr-2 flex items-center justify-center overflow-hidden text-lg font-bold">
              {pair.pair.split('-')[0].charAt(0)}
            </div>
            {pair.pair} Details
          </DialogTitle>
          <DialogDescription>
            Comprehensive technical analysis and market data
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Price Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Current Price:</span>
                    <span className="font-mono font-medium">
                      ${!isNaN(currentPrice) ? parseFloat(currentPrice.toFixed(8)).toLocaleString(undefined, { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: currentPrice < 0.01 ? 8 : currentPrice < 1 ? 6 : 2 
                      }) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">24h Change:</span>
                    <span className={`font-mono font-medium ${priceChange > 0 ? 'text-emerald-400' : priceChange < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {!isNaN(priceChange) ? `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">24h Volume:</span>
                    <span className="font-mono font-medium">
                      {pair.currentVolumeUSD ? `$${parseFloat(pair.currentVolumeUSD).toLocaleString()}` : '-'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">RSI Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">RSI (14):</span>
                    <span className={`font-mono font-medium ${
                      rsi > 70 ? 'text-red-400' : rsi < 30 ? 'text-emerald-400' : 'text-gray-400'
                    }`}>
                      {!isNaN(rsi) ? rsi.toFixed(2) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-muted-foreground mr-2">Status:</span>
                    <span className={`font-medium ${
                      rsi > 70 ? 'text-red-400' : rsi < 30 ? 'text-emerald-400' : 'text-gray-400'
                    }`}>
                      {rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs text-muted-foreground mb-1 flex justify-between">
                      <span>Oversold</span>
                      <span>Neutral</span>
                      <span>Overbought</span>
                    </div>
                    <div className="w-full bg-secondary/30 rounded-full h-2.5 overflow-hidden flex">
                      <div className="bg-emerald-400 h-full" style={{ width: '30%' }}></div>
                      <div className="bg-blue-400 h-full" style={{ width: '40%' }}></div>
                      <div className="bg-red-400 h-full" style={{ width: '30%' }}></div>
                    </div>
                    <div className="mt-1 relative w-full">
                      <div 
                        className="absolute w-2 h-4 bg-white rounded-full -mt-1 transform -translate-x-1/2" 
                        style={{ left: `${!isNaN(rsi) ? Math.min(100, rsi) : 50}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">MACD Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">MACD</p>
                    <p className={`font-mono font-medium ${macdValue > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {!isNaN(macdValue) ? macdValue.toFixed(6) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Signal Line</p>
                    <p className="font-mono font-medium">
                      {!isNaN(signalLine) ? signalLine.toFixed(6) : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Histogram</p>
                    <p className={`font-mono font-medium ${histogram > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {!isNaN(histogram) ? histogram.toFixed(6) : '-'}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">Trend</p>
                  <p className={cn(
                    "font-medium",
                    pair.macdTrend === 'Strong Uptrend' ? 'text-emerald-400' :
                    pair.macdTrend === 'Weak Uptrend' ? 'text-emerald-300' :
                    pair.macdTrend === 'Strong Downtrend' ? 'text-red-400' :
                    pair.macdTrend === 'Weak Downtrend' ? 'text-red-300' :
                    'text-gray-400'
                  )}>
                    {pair.macdTrend || 'Neutral'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {pair.macdTrend === 'Strong Uptrend' ? 
                      'MACD indicates bullish momentum in the market. Uptrends suggest potential buying opportunities.' :
                      pair.macdTrend === 'Strong Downtrend' ?
                      'MACD indicates bearish momentum in the market. Downtrends suggest caution or potential selling opportunities.' :
                      'MACD suggests a sideways or consolidating market. No clear trend direction.'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Moving Averages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">SMA (7):</span>
                    <span className="font-mono font-medium">
                      {pair.sma_7 ? '$' + parseFloat(pair.sma_7).toFixed(6) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">SMA (30):</span>
                    <span className="font-mono font-medium">
                      {pair.sma_30 ? '$' + parseFloat(pair.sma_30).toFixed(6) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">EMA (7):</span>
                    <span className="font-mono font-medium">
                      {pair.ema_7 ? '$' + parseFloat(pair.ema_7).toFixed(6) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">EMA (30):</span>
                    <span className="font-mono font-medium">
                      {pair.ema_30 ? '$' + parseFloat(pair.ema_30).toFixed(6) : '-'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Volume Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Volume Oscillator:</span>
                    <span className={`font-mono font-medium ${
                      parseFloat(pair.volumeOscillator || '0') > 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {pair.volumeOscillator ? `${parseFloat(pair.volumeOscillator).toFixed(2)}%` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Volume MA (7):</span>
                    <span className="font-mono font-medium">
                      {pair.vma_7 || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Volume MA (30):</span>
                    <span className="font-mono font-medium">
                      {pair.vma_30 || '-'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>


        {/* Add Bollinger Bands section */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Bollinger Bands</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Upper Band:</span>
                    <span className="font-mono font-medium">
                      ${pair.bollingerBands?.upper || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Middle Band (SMA20):</span>
                    <span className="font-mono font-medium">
                      ${pair.bollingerBands?.middle || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Lower Band:</span>
                    <span className="font-mono font-medium">
                      ${pair.bollingerBands?.lower || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">%B:</span>
                    <span className={`font-mono font-medium ${
                      parseFloat(pair.bollingerBands?.percentB || '0.5') > 1 ? 'text-red-400' : 
                      parseFloat(pair.bollingerBands?.percentB || '0.5') < 0 ? 'text-emerald-400' : 
                      'text-gray-400'
                    }`}>
                      {pair.bollingerBands?.percentB || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Bandwidth:</span>
                    <span className="font-mono font-medium">
                      {pair.bollingerBands?.bandwidth || '-'}
                    </span>
                  </div>
                  <div className="flex items-center mt-2">
                    <span className="text-muted-foreground mr-2">Signal:</span>
                    <span className={`font-medium ${
                      pair.bollingerBands?.signal === 'Overbought' ? 'text-red-400' :
                      pair.bollingerBands?.signal === 'Oversold' ? 'text-emerald-400' :
                      'text-gray-400'
                    }`}>
                      {pair.bollingerBands?.signal || 'Neutral'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Add Ichimoku Cloud section */}
          <div className="col-span-2 sm:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Ichimoku Cloud</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tenkan-sen (9):</span>
                    <span className="font-mono font-medium">
                      ${pair.ichimoku?.tenkan || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Kijun-sen (26):</span>
                    <span className="font-mono font-medium">
                      ${pair.ichimoku?.kijun || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Senkou Span A:</span>
                    <span className="font-mono font-medium">
                      ${pair.ichimoku?.senkouA || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Senkou Span B:</span>
                    <span className="font-mono font-medium">
                      ${pair.ichimoku?.senkouB || '-'}
                    </span>
                  </div>
                  <div className="flex items-center mt-2">
                    <span className="text-muted-foreground mr-2">Cloud Signal:</span>
                    <span className={`font-medium ${
                      pair.ichimoku?.cloudSignal?.includes('Strong Bull') ? 'text-emerald-400' :
                      pair.ichimoku?.cloudSignal?.includes('Bull') ? 'text-emerald-400/70' :
                      pair.ichimoku?.cloudSignal?.includes('Strong Bear') ? 'text-red-400' :
                      pair.ichimoku?.cloudSignal?.includes('Bear') ? 'text-red-400/70' :
                      'text-gray-400'
                    }`}>
                      {pair.ichimoku?.cloudSignal || 'Neutral'}
                    </span>
                  </div>
                  <div className="flex items-center mt-2">
                    <span className="text-muted-foreground mr-2">TK Cross:</span>
                    <span className={`font-medium ${
                      pair.ichimoku?.tkCross?.includes('Bullish') ? 'text-emerald-400' :
                      pair.ichimoku?.tkCross?.includes('Bearish') ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {pair.ichimoku?.tkCross || 'None'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Add Stochastic & ATR section */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Stochastic Oscillator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">%K:</span>
                    <span className="font-mono font-medium">
                      {pair.stochastic?.k || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">%D:</span>
                    <span className="font-mono font-medium">
                      {pair.stochastic?.d || '-'}
                    </span>
                  </div>
                  <div className="flex items-center mt-2">
                    <span className="text-muted-foreground mr-2">Signal:</span>
                    <span className={`font-medium ${
                      pair.stochastic?.signal === 'Overbought' ? 'text-red-400' :
                      pair.stochastic?.signal === 'Oversold' ? 'text-emerald-400' :
                      pair.stochastic?.signal?.includes('Bullish') ? 'text-emerald-400' :
                      pair.stochastic?.signal?.includes('Bearish') ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {pair.stochastic?.signal || 'Neutral'}
                    </span>
                  </div>
                  
                  {/* Stochastic visual indicator */}
                  <div className="mt-4">
                    <div className="text-xs text-muted-foreground mb-1 flex justify-between">
                      <span>Oversold</span>
                      <span>Neutral</span>
                      <span>Overbought</span>
                    </div>
                    <div className="w-full bg-secondary/30 rounded-full h-2.5 overflow-hidden flex">
                      <div className="bg-emerald-400 h-full" style={{ width: '20%' }}></div>
                      <div className="bg-blue-400 h-full" style={{ width: '60%' }}></div>
                      <div className="bg-red-400 h-full" style={{ width: '20%' }}></div>
                    </div>
                    <div className="mt-1 relative w-full">
                      <div 
                        className="absolute w-2 h-4 bg-white rounded-full -mt-1 transform -translate-x-1/2" 
                        style={{ left: `${!isNaN(parseFloat(pair.stochastic?.k || '0')) ? Math.min(100, parseFloat(pair.stochastic?.k || '50')) : 50}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Volatility Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ATR (14):</span>
                    <span className="font-mono font-medium">
                      {pair.atrAnalysis?.atr || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Normalized ATR (%):</span>
                    <span className={`font-mono font-medium ${
                      parseFloat(pair.atrAnalysis?.normalizedATR || '0') > 5 ? 'text-red-400' :
                      parseFloat(pair.atrAnalysis?.normalizedATR || '0') < 1 ? 'text-blue-400' :
                      'text-amber-400'
                    }`}>
                      {pair.atrAnalysis?.normalizedATR ? `${pair.atrAnalysis.normalizedATR}%` : '-'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-muted-foreground mr-2">Volatility Level:</span>
                    <span className="font-medium">
                      {pair.atrAnalysis?.volatility || 'Medium'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-muted-foreground">Volatility Index:</span>
                    <span className={`font-mono font-medium ${
                      parseFloat(pair.volatilityIndex?.value || '0') > 5 ? 'text-red-400' :
                      parseFloat(pair.volatilityIndex?.value || '0') > 3 ? 'text-amber-400' :
                      parseFloat(pair.volatilityIndex?.value || '0') < 1 ? 'text-blue-400' :
                      'text-gray-400'
                    }`}>
                      {pair.volatilityIndex?.value || '-'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-muted-foreground mr-2">Volatility Trend:</span>
                    <span className={`font-medium ${
                      pair.volatilityIndex?.trend?.includes('Up') ? 'text-emerald-400' :
                      pair.volatilityIndex?.trend?.includes('Down') ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {pair.volatilityIndex?.trend || 'Neutral'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Add Support/Resistance section */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Support & Resistance Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Support Levels</h3>
                  <ul className="space-y-2">
                    {pair.supportResistance?.supports?.map((level, index) => (
                      <li key={index} className="flex justify-between items-center">
                        <span className="font-mono text-emerald-400">${level.price.toFixed(8)}</span>
                        <span className="text-xs bg-secondary/50 px-2 py-1 rounded-full">
                          Strength: {level.strength}
                        </span>
                      </li>
                    )) || <li className="text-muted-foreground">No levels detected</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Resistance Levels</h3>
                  <ul className="space-y-2">
                    {pair.supportResistance?.resistances?.map((level, index) => (
                      <li key={index} className="flex justify-between items-center">
                        <span className="font-mono text-red-400">${level.price.toFixed(8)}</span>
                        <span className="text-xs bg-secondary/50 px-2 py-1 rounded-full">
                          Strength: {level.strength}
                        </span>
                      </li>
                    )) || <li className="text-muted-foreground">No levels detected</li>}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>        

        {/* Add Advanced Technical Analysis section */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Advanced Technical Analysis</CardTitle>
            </CardHeader>
            <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Advanced Trend Analysis</h3>
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center",
                    pair.advancedTrend?.includes('Strong Up') ? "bg-emerald-400/20 text-emerald-400" :
                    pair.advancedTrend?.includes('Up') ? "bg-emerald-400/10 text-emerald-400/70" :
                    pair.advancedTrend?.includes('Strong Down') ? "bg-red-400/20 text-red-400" :
                    pair.advancedTrend?.includes('Down') ? "bg-red-400/10 text-red-400/70" :
                    "bg-secondary/20 text-gray-400"
                  )}>
                    {pair.advancedTrend?.includes('Up') ? 
                      <ChevronUpIcon className="h-5 w-5" /> : 
                      pair.advancedTrend?.includes('Down') ? 
                      <ChevronDownIcon className="h-5 w-5" /> :
                      "—"
                    }
                  </div>
                  <div>
                    <p className={cn(
                      "font-medium",
                      pair.advancedTrend?.includes('Strong Up') ? "text-emerald-400" :
                      pair.advancedTrend?.includes('Up') ? "text-emerald-400/70" :
                      pair.advancedTrend?.includes('Strong Down') ? "text-red-400" :
                      pair.advancedTrend?.includes('Down') ? "text-red-400/70" :
                      "text-gray-400"
                    )}>
                      {pair.advancedTrend || 'Neutral/Sideways'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pair.advancedTrend?.includes('Up') ? 
                        'Multiple indicators suggest bullish momentum' :
                        pair.advancedTrend?.includes('Down') ?
                        'Multiple indicators suggest bearish momentum' :
                        'No clear trend direction'
                      }
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Composite Scores</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Short-Term</span>
                      <span className={cn(
                        parseFloat(pair.shortTermScore || "0.5") >= 0.7 ? "text-emerald-400" :
                        parseFloat(pair.shortTermScore || "0.5") <= 0.3 ? "text-red-400" :
                        "text-gray-400"
                      )}>{pair.shortTermScore || '-'}</span>
                    </div>
                    <div className="w-full bg-secondary/30 rounded-full h-2">
                      <div className={cn(
                        "h-full rounded-full",
                        parseFloat(pair.shortTermScore || "0.5") >= 0.7 ? "bg-emerald-400" :
                        parseFloat(pair.shortTermScore || "0.5") <= 0.3 ? "bg-red-400" :
                        "bg-blue-400"
                      )} style={{ width: `${parseFloat(pair.shortTermScore || "0.5") * 100}%` }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Long-Term</span>
                      <span className={cn(
                        parseFloat(pair.longTermScore || "0.5") >= 0.7 ? "text-emerald-400" :
                        parseFloat(pair.longTermScore || "0.5") <= 0.3 ? "text-red-400" :
                        "text-gray-400"
                      )}>{pair.longTermScore || '-'}</span>
                    </div>
                    <div className="w-full bg-secondary/30 rounded-full h-2">
                      <div className={cn(
                        "h-full rounded-full",
                        parseFloat(pair.longTermScore || "0.5") >= 0.7 ? "bg-emerald-400" :
                        parseFloat(pair.longTermScore || "0.5") <= 0.3 ? "bg-red-400" :
                        "bg-blue-400"
                      )} style={{ width: `${parseFloat(pair.longTermScore || "0.5") * 100}%` }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Enhanced Score</span>
                      <span className={cn(
                        parseFloat(pair.enhancedScore || "0.5") >= 0.7 ? "text-emerald-400" :
                        parseFloat(pair.enhancedScore || "0.5") <= 0.3 ? "text-red-400" :
                        "text-gray-400"
                      )}>{pair.enhancedScore || '-'}</span>
                    </div>
                    <div className="w-full bg-secondary/30 rounded-full h-2">
                      <div className={cn(
                        "h-full rounded-full",
                        parseFloat(pair.enhancedScore || "0.5") >= 0.7 ? "bg-emerald-400" :
                        parseFloat(pair.enhancedScore || "0.5") <= 0.3 ? "bg-red-400" :
                        "bg-blue-400"
                      )} style={{ width: `${parseFloat(pair.enhancedScore || "0.5") * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button>
            <a href={`https://exchange.coinbase.com/trade/${pair.pair}`} target="_blank" rel="noopener noreferrer">
              View on Coinbase
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}