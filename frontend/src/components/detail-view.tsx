import React from 'react';
import { CryptoPair } from '../types/crypto';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Button } from './ui/button';
import { formatNumber, formatPercentage, cn } from '@/lib/utils';
import { XCircleIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { 
  formatPrice, 
  isSameLevel, 
  getFallbackSupport, 
  getFallbackResistance,
  getPriceChannelWidth,
  hasOverlappingLevels
} from '../lib/support-resistance-helpers';

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
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
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
        
        {/* Top row of cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <Card className="h-full">
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
                      {pair.currentVolumeUSD ? `$${parseFloat(pair.currentVolumeUSD).toFixed(0).toLocaleString()}` : '-'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <Card className="h-full">
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
      
          <div className="col-span-2 sm:col-span-1">
            <Card className="h-full">
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
                      {parseFloat(pair.vma_7).toFixed(0) || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Volume MA (30):</span>
                    <span className="font-mono font-medium">
                      {parseFloat(pair.vma_30).toFixed(0) || '-'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Second row of cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <Card className="h-full">
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
                    <span className="font-medium text-right">
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

          <div className="col-span-2 sm:col-span-1">
            <Card className="h-full">
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
          
        </div>

        {/* Support & Resistance card */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Support & Resistance Levels
                <div className="relative group">
                  <button className="text-muted-foreground hover:text-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.06-1.06 2.75 2.75 0 013.82 0 .75.75 0 01-1.06 1.06 1.25 1.25 0 00-1.7 0zM12 10a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="absolute left-full top-0 ml-2 w-[400px] hidden group-hover:block z-50">
                    <div className="bg-black/95 backdrop-blur-sm border border-border/50 text-white px-4 py-3 rounded-lg shadow-xl text-sm max-h-[calc(100vh-4rem)] overflow-y-auto">
                      <h4 className="font-semibold mb-3 text-base border-b border-border/50 pb-2">How Support & Resistance Levels Work</h4>
                      <div className="space-y-3">
                        <div className="bg-white/5 rounded-md p-3">
                          <p className="mb-2"><span className="font-medium text-primary">Detection Method:</span> Levels are identified using price action, volume, and historical touches. Each level's strength is calculated based on:</p>
                          <ul className="list-disc pl-4 space-y-1 text-gray-300">
                            <li>Volume at the level (25%)</li>
                            <li>Number of touches (20%)</li>
                            <li>Recency of touches (20%)</li>
                            <li>Rejection strength (25%)</li>
                            <li>Psychological level bonus (10%)</li>
                          </ul>
                        </div>
                        
                        <div className="bg-white/5 rounded-md p-3">
                          <p className="mb-2"><span className="font-medium text-primary">Level Classification:</span></p>
                          <ul className="list-disc pl-4 space-y-1 text-gray-300">
                            <li>Support levels can be up to 5% above current price</li>
                            <li>Historical levels remain valid if price returns to that area</li>
                            <li className="text-emerald-400">Strength ≥ 75%: Strong level with multiple confirmations</li>
                            <li className="text-emerald-400/80">Strength 50-74%: Moderate level with some confirmations</li>
                            <li className="text-emerald-400/60">Strength &lt; 50%: Weak level needing more confirmation</li>
                          </ul>
                        </div>
                        
                        <div className="bg-white/5 rounded-md p-3">
                          <p className="mb-2"><span className="font-medium text-primary">Important Notes:</span></p>
                          <ul className="list-disc pl-4 space-y-1 text-gray-300">
                            <li>ATR (Average True Range) is used for adaptive thresholds</li>
                            <li>Higher timeframe levels (180 days) are considered for major pairs</li>
                            <li>Volume profile helps confirm level significance</li>
                            <li>Levels are dynamically updated as new price action develops</li>
                            <li>Overlapping levels can occur in tightly-trading pairs</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Support Levels</h3>
                  {pair.supports && pair.supports.length > 0 ? (
                    <ul className="space-y-3">
                      {pair.supports
                        .sort((a, b) => b.strength - a.strength)
                        .slice(0, 3)
                        .map((level, index) => (
                        <li key={index} className="flex flex-col space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-emerald-400">
                              ${formatPrice(level.price)}
                            </span>
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              level.strength >= 75 ? "bg-emerald-400/20 text-emerald-400" :
                              level.strength >= 50 ? "bg-emerald-400/15 text-emerald-400/90" :
                              "bg-emerald-400/10 text-emerald-400/80"
                            )}>
                              Strength: {level.strength.toFixed(2)}%
                            </span>
                          </div>
                          <div className="w-full bg-secondary/30 rounded-full h-1">
                            <div 
                              className="bg-emerald-400/50 h-full rounded-full" 
                              style={{ width: `${Math.max(15, level.strength)}%` }}
                            />
                          </div>
                          {level.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{level.description}</div>
                          )}
                          {isSameLevel(level.price, parseFloat(pair.currentPrice), 0.5) && (
                            <div className="text-xs text-amber-400 mt-0.5 flex items-center">
                              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"></span>
                              Current price level
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-3 border border-dashed border-secondary rounded-md bg-secondary/10">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-emerald-400/80">
                          ${formatPrice(getFallbackSupport(pair).price)}
                        </span>
                        <span className="bg-emerald-400/10 text-emerald-400/70 text-xs px-2 py-0.5 rounded-full">
                          Estimated
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {getFallbackSupport(pair).description}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Resistance Levels</h3>
                  {pair.resistances && pair.resistances.length > 0 ? (
                    <ul className="space-y-3">
                      {pair.resistances
                        .sort((a, b) => b.strength - a.strength)
                        .slice(0, 3)
                        .map((level, index) => (
                        <li key={index} className="flex flex-col space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-red-400">
                              ${formatPrice(level.price)}
                            </span>
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              level.strength >= 75 ? "bg-red-400/20 text-red-400" :
                              level.strength >= 50 ? "bg-red-400/15 text-red-400/90" :
                              "bg-red-400/10 text-red-400/80"
                            )}>
                              Strength: {level.strength.toFixed(2)}%
                            </span>
                          </div>
                          <div className="w-full bg-secondary/30 rounded-full h-1">
                            <div 
                              className="bg-red-400/50 h-full rounded-full" 
                              style={{ width: `${Math.max(15, level.strength)}%` }}
                            />
                          </div>
                          {level.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{level.description}</div>
                          )}
                          {isSameLevel(level.price, parseFloat(pair.currentPrice), 0.5) && (
                            <div className="text-xs text-amber-400 mt-0.5 flex items-center">
                              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"></span>
                              Current price level
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-3 border border-dashed border-secondary rounded-md bg-secondary/10">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-red-400/80">
                          ${formatPrice(getFallbackResistance(pair).price)}
                        </span>
                        <span className="bg-red-400/10 text-red-400/70 text-xs px-2 py-0.5 rounded-full">
                          Estimated
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {getFallbackResistance(pair).description}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Channel Width Indicator */}
              {(getPriceChannelWidth(pair) > 0) && (
                <div className="mt-4 pt-3 border-t border-secondary/30">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Price Channel Width:</span>
                    <span className={cn(
                      "font-mono",
                      getPriceChannelWidth(pair) < 1 ? "text-blue-400" :
                      getPriceChannelWidth(pair) > 10 ? "text-red-400" :
                      "text-amber-400"
                    )}>
                      {getPriceChannelWidth(pair).toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-2 relative">
                    <div className="w-full bg-secondary/30 rounded-full h-1">
                      <div 
                        className={cn(
                          "h-full rounded-full",
                          getPriceChannelWidth(pair) < 1 ? "bg-blue-400/50" :
                          getPriceChannelWidth(pair) > 10 ? "bg-red-400/50" :
                          "bg-amber-400/50"
                        )}
                        style={{ 
                          width: `${Math.min(100, Math.max(15, getPriceChannelWidth(pair) * 5))}%` 
                        }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground text-center">
                      {getPriceChannelWidth(pair) < 1 ? "Very tight range" :
                      getPriceChannelWidth(pair) < 3 ? "Tight range" :
                      getPriceChannelWidth(pair) < 7 ? "Normal range" :
                      getPriceChannelWidth(pair) < 15 ? "Wide range" :
                      "Very wide range"}
                    </div>
                  </div>
                </div>
              )}

              {/* Overlapping Levels Warning - Show when levels overlap */}
              {hasOverlappingLevels(pair) && (
                <div className="mt-4 pt-3 border-t border-secondary/30">
                  <div className="flex items-center gap-2 text-amber-400/90 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <span>Some support/resistance levels overlap due to tight trading range. It means the historical levels are still valid. Pay attention to the price action and volume at the levels.</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fibonacci Analysis card */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Fibonacci Analysis
                <div className="relative group">
                  <button className="text-muted-foreground hover:text-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.06-1.06 2.75 2.75 0 013.82 0 .75.75 0 01-1.06 1.06 1.25 1.25 0 00-1.7 0zM12 10a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="absolute left-full top-0 ml-2 w-[400px] hidden group-hover:block z-50">
                    <div className="bg-black/95 backdrop-blur-sm border border-border/50 text-white px-4 py-3 rounded-lg shadow-xl text-sm">
                      <h4 className="font-semibold mb-3 text-base border-b border-border/50 pb-2">Understanding Fibonacci Analysis</h4>
                      <div className="space-y-3">
                        <div className="bg-white/5 rounded-md p-3">
                          <p className="mb-2"><span className="font-medium text-primary">Fibonacci Levels:</span></p>
                          <ul className="list-disc pl-4 space-y-1 text-gray-300">
                            <li>0.236 - Weak retracement level</li>
                            <li>0.382 - Moderate retracement level</li>
                            <li>0.500 - Mid-point retracement</li>
                            <li>0.618 - Golden ratio, strong level</li>
                            <li>0.786 - Deep retracement level</li>
                          </ul>
                        </div>
                        <div className="bg-white/5 rounded-md p-3">
                          <p className="mb-2"><span className="font-medium text-primary">Extensions:</span></p>
                          <ul className="list-disc pl-4 space-y-1 text-gray-300">
                            <li>1.272 - First extension target</li>
                            <li>1.618 - Golden ratio extension</li>
                            <li>2.618 - Major extension level</li>
                          </ul>
                        </div>
                        <div className="bg-white/5 rounded-md p-3">
                          <p className="text-xs text-gray-300">Fibonacci levels are calculated based on significant price swings (high and low points). They often act as support/resistance levels and potential reversal zones.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Fibonacci Levels</h3>
                  {pair.fibonacciAnalysis?.levels && pair.fibonacciAnalysis.levels.length > 0 ? (
                    <ul className="space-y-2">
                      {pair.fibonacciAnalysis.levels.map((level, index) => (
                        <li key={index} className="flex flex-col space-y-1">
                          <div className="flex justify-between items-center">
                            <span className={cn(
                              "font-mono",
                              level.level < 1 ? "text-emerald-400" : "text-amber-400"
                            )}>
                              {(level.level * 100).toFixed(1)}% - ${formatPrice(level.price)}
                            </span>
                            {isSameLevel(level.price, parseFloat(pair.currentPrice), 0.1) && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20">Current</span>
                            )}
                          </div>
                          <div className="w-full bg-secondary/30 rounded-full h-1">
                            <div 
                              className={cn(
                                "h-full rounded-full",
                                level.level < 1 ? "bg-emerald-400/50" : "bg-amber-400/50"
                              )}
                              style={{ width: `${Math.min(100, level.level * 100)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-3 border border-dashed border-secondary rounded-md bg-secondary/10">
                      <p className="text-sm text-muted-foreground">No Fibonacci levels calculated</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Swing Points</h3>
                  {pair.fibonacciAnalysis?.swingPoints ? (
                    <div className="space-y-4">
                      <div className="p-3 border border-secondary/20 rounded-md bg-secondary/10">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-muted-foreground">Swing High:</span>
                          <span className="font-mono text-red-400">
                            ${formatPrice(pair.fibonacciAnalysis.swingPoints.high)}
                          </span>
                        </div>
                        {pair.fibonacciAnalysis.swingPoints.highTime && (
                          <div className="text-xs text-muted-foreground">
                            {new Date(pair.fibonacciAnalysis.swingPoints.highTime).toLocaleString()}
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 border border-secondary/20 rounded-md bg-secondary/10">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-muted-foreground">Swing Low:</span>
                          <span className="font-mono text-emerald-400">
                            ${formatPrice(pair.fibonacciAnalysis.swingPoints.low)}
                          </span>
                        </div>
                        {pair.fibonacciAnalysis.swingPoints.lowTime && (
                          <div className="text-xs text-muted-foreground">
                            {new Date(pair.fibonacciAnalysis.swingPoints.lowTime).toLocaleString()}
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 border border-secondary/20 rounded-md bg-secondary/10">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Current Position:</span>
                          <span className={cn(
                            "font-medium",
                            pair.fibonacciAnalysis.currentPosition?.includes('Retracement') ? "text-emerald-400" :
                            pair.fibonacciAnalysis.currentPosition?.includes('Extension') ? "text-amber-400" :
                            "text-blue-400"
                          )}>
                            {pair.fibonacciAnalysis.currentPosition || 'Between Levels'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border border-dashed border-secondary rounded-md bg-secondary/10">
                      <p className="text-sm text-muted-foreground">No swing points detected</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MACD and Moving Averages row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2">
            <Card className="h-full">
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
                      'MACD indicates bullish momentum. Uptrends suggest potential buying opportunities.' :
                      pair.macdTrend === 'Strong Downtrend' ?
                      'MACD indicates bearish momentum. Downtrends suggest caution or potential selling opportunities.' :
                      'MACD suggests a sideways or consolidating market. No clear trend direction.'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Card className="h-full">
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
        </div>

        {/* Bollinger Bands row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <Card className="h-full">
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
                    <span className={cn(
                      "font-medium",
                      pair.bollingerBands?.signal === 'Strong Overbought' || pair.bollingerBands?.signal === 'Overbought' ? "text-red-400" :
                      pair.bollingerBands?.signal === 'Strong Oversold' || pair.bollingerBands?.signal === 'Oversold' ? "text-emerald-400" :
                      pair.bollingerBands?.signal?.includes('Above Middle Band') ? "text-emerald-400/70" :
                      pair.bollingerBands?.signal?.includes('Below Middle Band') ? "text-red-400/70" :
                      "text-gray-400"
                    )}>
                      {pair.bollingerBands?.signal || 'Neutral'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Ichimoku Cloud</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tenkan (9):</span>
                    <span className="font-mono font-medium">
                      ${pair.ichimoku?.tenkan || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Kijun (26):</span>
                    <span className="font-mono font-medium">
                      ${pair.ichimoku?.kijun || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Senkou A:</span>
                    <span className="font-mono font-medium">
                      ${pair.ichimoku?.senkouA || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Senkou B:</span>
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
        
        {/* Add Advanced Technical Analysis section */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Card className="h-full">
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