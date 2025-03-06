import React from 'react';
import { CryptoPair } from '../types/crypto';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Button } from './ui/button';
import { formatNumber, formatPercentage } from '@/lib/utils';
import { XCircleIcon } from '@heroicons/react/24/solid';

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
                  <p className={`font-medium ${
                    pair.macdTrend?.includes('Strong Up') ? 'text-emerald-400' :
                    pair.macdTrend?.includes('Weak Up') ? 'text-emerald-400/70' :
                    pair.macdTrend?.includes('Strong Down') ? 'text-red-400' :
                    pair.macdTrend?.includes('Weak Down') ? 'text-red-400/70' :
                    'text-gray-400'
                  }`}>
                    {pair.macdTrend || 'Neutral'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {pair.macdTrend?.includes('Up') ? 
                      'MACD indicates bullish momentum in the market. Uptrends suggest potential buying opportunities.' :
                      pair.macdTrend?.includes('Down') ?
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