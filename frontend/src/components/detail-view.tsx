import React from 'react';
import { CryptoPair } from '../types/crypto';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Button } from './ui/button';
import { formatNumber, formatPercentage, cn } from '@/lib/utils';
import { XCircleIcon, ChevronUpIcon, ChevronDownIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import {
  formatPrice,
  isSameLevel,
  getFallbackSupport,
  getFallbackResistance,
  getPriceChannelWidth,
  hasOverlappingLevels
} from '../lib/support-resistance-helpers';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { formatLargeNumber } from "@/lib/utils";

interface DetailViewProps {
  pair: CryptoPair | null;
  isOpen: boolean;
  onClose: () => void;
}

const MarketStructureTooltip = (
  <TooltipContent className="w-[450px] p-5 space-y-4 bg-card/95 backdrop-blur-sm border-border shadow-xl">
    <div className="border-l-4 border-primary pl-3">
      <p className="font-semibold text-base mb-1 text-primary">Market Structure Analysis</p>
      <p className="text-sm text-muted-foreground">Comprehensive analysis of price action patterns and market behavior.</p>
    </div>

    <div className="bg-accent/30 rounded-lg p-3">
      <p className="font-semibold mb-2 text-primary flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
        Market Phases
      </p>
      <ul className="text-xs space-y-2 ml-2">
        <li className="flex items-start gap-2">
          <span className="font-medium text-emerald-400 min-w-[90px]">Accumulation:</span>
          <span className="text-muted-foreground">Sideways movement after downtrend; institutional buyers accumulate positions while retail sells.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-medium text-emerald-400 min-w-[90px]">Mark-Up:</span>
          <span className="text-muted-foreground">Upward price movement with higher highs and higher lows; strong buying pressure.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-medium text-red-400 min-w-[90px]">Distribution:</span>
          <span className="text-muted-foreground">Sideways movement after uptrend; institutional sellers distribute positions to retail buyers.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-medium text-red-400 min-w-[90px]">Mark-Down:</span>
          <span className="text-muted-foreground">Downward price movement with lower highs and lower lows; strong selling pressure.</span>
        </li>
      </ul>
    </div>

    <div className="bg-accent/30 rounded-lg p-3">
      <p className="font-semibold mb-2 text-primary flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
        Structure Components
      </p>
      <ul className="text-xs space-y-2 ml-2">
        <li className="flex items-start gap-2">
          <span className="font-medium text-emerald-400 min-w-[110px]">Higher Highs/Lows:</span>
          <span className="text-muted-foreground">Each peak/trough higher than previous; indicates uptrend strength.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-medium text-red-400 min-w-[110px]">Lower Highs/Lows:</span>
          <span className="text-muted-foreground">Each peak/trough lower than previous; indicates downtrend strength.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-medium text-blue-400 min-w-[110px]">Swing Points:</span>
          <span className="text-muted-foreground">Key reversal points in price action; significance based on surrounding price movement.</span>
        </li>
      </ul>
    </div>

    <div className="bg-accent/30 rounded-lg p-3">
      <p className="font-semibold mb-2 text-primary flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
        Pivot Levels
      </p>
      <ul className="text-xs space-y-2 ml-2">
        <li className="flex items-start gap-2">
          <span className="font-medium text-emerald-400 min-w-[90px]">Support:</span>
          <span className="text-muted-foreground">Price levels where downward movement tends to pause/reverse; buying pressure exceeds selling.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-medium text-red-400 min-w-[90px]">Resistance:</span>
          <span className="text-muted-foreground">Price levels where upward movement tends to pause/reverse; selling pressure exceeds buying.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="font-medium text-blue-400 min-w-[90px]">Strength:</span>
          <span className="text-muted-foreground">Indicates level significance based on historical touches, volume, and rejection strength.</span>
        </li>
      </ul>
    </div>

    <div className="border-l-4 border-primary/50 pl-3 mt-2">
      <p className="font-semibold mb-1 text-primary">Interpretation</p>
      <p className="text-xs text-muted-foreground">Use this analysis to identify current market phase, trend strength, and key price levels for potential entries/exits. Higher confidence levels and longer durations suggest more reliable signals.</p>
    </div>
  </TooltipContent>
);

export function CryptoDetailView({ pair, isOpen, onClose }: DetailViewProps) {
  if (!pair) return null;

  const currentPrice = parseFloat(pair.currentPrice);
  const priceChange = parseFloat(pair.dailyPriceChange);
  const rsi = parseFloat(pair.rsi);
  const macdValue = parseFloat(pair.macd || '0');
  const signalLine = parseFloat(pair.signalLine || '0');
  const histogram = parseFloat(pair.histogram || '0');
  const rsi_30 = parseFloat(pair.rsi_30 || '0');
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
                      {pair.currentVolumeUSD ? `$${formatLargeNumber(parseFloat(pair.currentVolumeUSD))}` : '-'}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Advanced Score</span>
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
              </CardContent>
            </Card>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  RSI Analysis
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InformationCircleIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="w-[450px] p-5 space-y-4 bg-card/95 backdrop-blur-sm border-border shadow-xl">
                        <div className="border-l-4 border-primary pl-3">
                          <p className="font-semibold text-base mb-1 text-primary">Relative Strength Index (RSI)</p>
                          <p className="text-sm text-muted-foreground">Momentum oscillator measuring the speed and magnitude of price movements on a scale of 0 to 100.</p>
                        </div>

                        <div className="bg-accent/30 rounded-lg p-3">
                          <p className="font-semibold mb-2 text-primary flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                            Signal Zones
                          </p>
                          <ul className="text-xs space-y-2 ml-2">
                            <li className="flex items-start gap-2">
                              <span className="font-medium text-red-400 min-w-[90px]">Overbought (70+):</span>
                              <span className="text-muted-foreground">Price may be overextended. Potential reversal or pullback signal.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-medium text-emerald-400 min-w-[90px]">Oversold (30-):</span>
                              <span className="text-muted-foreground">Price may be undervalued. Potential bounce or reversal signal.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-medium text-blue-400 min-w-[90px]">Neutral (30-70):</span>
                              <span className="text-muted-foreground">Price in equilibrium. No extreme conditions present.</span>
                            </li>
                          </ul>
                        </div>

                        <div className="bg-accent/30 rounded-lg p-3">
                          <p className="font-semibold mb-2 text-primary flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                            Trading Signals
                          </p>
                          <ul className="text-xs space-y-1 text-muted-foreground">
                            <li><span className="text-emerald-400">Bullish Divergence:</span> Price makes lower lows while RSI makes higher lows</li>
                            <li><span className="text-red-400">Bearish Divergence:</span> Price makes higher highs while RSI makes lower highs</li>
                            <li><span className="text-amber-400">Centerline Cross:</span> RSI crossing above/below 50 indicates shift in momentum</li>
                          </ul>
                        </div>

                        <div className="border-l-4 border-primary/50 pl-3 mt-2">
                          <p className="font-semibold mb-1 text-primary">Interpretation Tips</p>
                          <ul className="text-xs space-y-1 text-muted-foreground">
                            <li>• Strong trends can maintain overbought/oversold conditions</li>
                            <li>• Look for divergences at extreme levels for reversal signals</li>
                            <li>• Use in conjunction with other indicators for confirmation</li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">RSI (14):</span>
                    <span className={`font-mono font-medium ${rsi > 70 ? 'text-red-400' : rsi < 30 ? 'text-emerald-400' : 'text-gray-400'
                      }`}>
                      {!isNaN(rsi) && rsi !== 0 ? rsi.toFixed(2) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">RSI (30):</span>
                    <span className={`font-mono font-medium ${rsi_30 > 70 ? 'text-red-400' : rsi_30 < 30 && rsi_30 !== 0 ? 'text-emerald-400' : 'text-gray-400'
                      }`}>
                      {!isNaN(rsi_30) && rsi_30 !== 0 ? rsi_30.toFixed(2) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-muted-foreground mr-2">Status:</span>
                    <span className={`font-medium ${rsi > 70 ? 'text-red-400' : rsi < 30 && rsi !== 0 ? 'text-emerald-400' : 'text-gray-400'
                      }`}>
                      {rsi > 70 ? 'Overbought' : rsi < 30 && rsi !== 0 ? 'Oversold' : 'Neutral'}
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
                <CardTitle className="text-lg flex items-center gap-2">
                  Stochastic Oscillator
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InformationCircleIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="w-[450px] p-5 space-y-4 bg-card/95 backdrop-blur-sm border-border shadow-xl">
                        <div className="border-l-4 border-primary pl-3">
                          <p className="font-semibold text-base mb-1 text-primary">Stochastic Oscillator</p>
                          <p className="text-sm text-muted-foreground">Momentum indicator comparing a closing price to its price range over time. Shows where price is relative to its recent range.</p>
                        </div>

                        <div className="bg-accent/30 rounded-lg p-3">
                          <p className="font-semibold mb-2 text-primary flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                            Components
                          </p>
                          <ul className="text-xs space-y-2 ml-2">
                            <li className="flex items-start gap-2">
                              <span className="font-medium text-blue-400 min-w-[90px]">%K Line:</span>
                              <span className="text-muted-foreground">Fast stochastic, more sensitive to price changes. Main signal line.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-medium text-amber-400 min-w-[90px]">%D Line:</span>
                              <span className="text-muted-foreground">Slow stochastic, smoothed average of %K. Used for signal confirmation.</span>
                            </li>
                          </ul>
                        </div>

                        <div className="bg-accent/30 rounded-lg p-3">
                          <p className="font-semibold mb-2 text-primary flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                            Signal Zones
                          </p>
                          <ul className="text-xs space-y-1 text-muted-foreground">
                            <li><span className="text-red-400">Overbought (80+):</span> Price near recent high, potential reversal down</li>
                            <li><span className="text-emerald-400">Oversold (20-):</span> Price near recent low, potential reversal up</li>
                            <li><span className="text-blue-400">Neutral (20-80):</span> Price within normal trading range</li>
                          </ul>
                        </div>

                        <div className="border-l-4 border-primary/50 pl-3 mt-2">
                          <p className="font-semibold mb-1 text-primary">Trading Signals</p>
                          <ul className="text-xs space-y-1 text-muted-foreground">
                            <li><span className="text-emerald-400">Bullish:</span> %K crosses above %D in oversold zone</li>
                            <li><span className="text-red-400">Bearish:</span> %K crosses below %D in overbought zone</li>
                            <li><span className="text-amber-400">Divergence:</span> Price/oscillator moving in opposite directions</li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
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
                    <span className={`font-medium ${pair.stochastic?.signal === 'Overbought' ? 'text-red-400' :
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

        {/* Second row of cards */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2 sm:col-span-1">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Volatility Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ATR (14):</span>
                    <span className="font-mono font-medium text-right min-w-[100px]">
                      {pair.atrAnalysis?.atr || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Norm. ATR (%):</span>
                    <span className={cn(
                      "font-mono font-medium text-right min-w-[100px]",
                      parseFloat(pair.atrAnalysis?.normalizedATR || '0') > 5 ? 'text-red-400' :
                        parseFloat(pair.atrAnalysis?.normalizedATR || '0') < 1 ? 'text-blue-400' :
                          'text-amber-400'
                    )}>
                      {pair.atrAnalysis?.normalizedATR ? `${pair.atrAnalysis.normalizedATR}%` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Volatility Level:</span>
                    <span className={cn(
                      "font-medium text-right min-w-[100px]",
                      pair.atrAnalysis?.volatility?.includes('High') ? 'text-red-400' :
                        pair.atrAnalysis?.volatility?.includes('Low') ? 'text-blue-400' :
                          'text-amber-400'
                    )}>
                      {pair.atrAnalysis?.volatility || 'Medium'}
                    </span>
                  </div>

                  {/* <div className="h-px bg-border/50 my-2"></div> */}

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Volatility Index:</span>
                    <span className={cn(
                      "font-mono font-medium text-right min-w-[100px]",
                      parseFloat(pair.volatilityIndex?.value || '0') > 5 ? 'text-red-400' :
                        parseFloat(pair.volatilityIndex?.value || '0') > 3 ? 'text-amber-400' :
                          parseFloat(pair.volatilityIndex?.value || '0') < 1 ? 'text-blue-400' :
                            'text-gray-400'
                    )}>
                      {pair.volatilityIndex?.value || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Trend:</span>
                    <span className={cn(
                      "font-medium text-right min-w-[100px]",
                      pair.volatilityIndex?.trend?.includes('Up') ? 'text-emerald-400' :
                        pair.volatilityIndex?.trend?.includes('Down') ? 'text-red-400' :
                          'text-gray-400'
                    )}>
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
                <CardTitle className="text-lg flex items-center gap-2">
                  Volume Analysis
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InformationCircleIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="w-[450px] p-5 space-y-4 bg-card/95 backdrop-blur-sm border-border shadow-xl">
                        <div className="border-l-4 border-primary pl-3">
                          <p className="font-semibold text-base mb-1 text-primary">Volume Analysis</p>
                          <p className="text-sm text-muted-foreground">Volume indicators help confirm price movements and identify potential trend reversals.</p>
                        </div>

                        <div className="bg-accent/30 rounded-lg p-3">
                          <p className="font-semibold mb-2 text-primary flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                            Volume Oscillator
                          </p>
                          <p className="text-xs text-muted-foreground mb-2">
                            Compares fast and slow volume moving averages to identify volume trends.
                          </p>
                          <ul className="text-xs space-y-1 ml-2">
                            <li><span className="text-emerald-400">Positive Values:</span> Volume trending higher, indicating strong buying pressure</li>
                            <li><span className="text-red-400">Negative Values:</span> Volume trending lower, suggesting weakening momentum</li>
                          </ul>
                        </div>

                        <div className="bg-accent/30 rounded-lg p-3">
                          <p className="font-semibold mb-2 text-primary flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                            Volume Moving Averages (USD)
                          </p>
                          <ul className="text-xs space-y-2 ml-2">
                            <li className="flex items-start gap-2">
                              <span className="font-medium text-blue-400 min-w-[90px]">VMA (7):</span>
                              <span className="text-muted-foreground">Short-term volume trend in USD. Reacts quickly to volume changes.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-medium text-blue-400 min-w-[90px]">VMA (30):</span>
                              <span className="text-muted-foreground">Long-term volume baseline in USD. Shows sustained volume trends.</span>
                            </li>
                          </ul>
                        </div>

                        <div className="border-l-4 border-primary/50 pl-3 mt-2">
                          <p className="font-semibold mb-1 text-primary">Volume-Price Analysis</p>
                          <ul className="text-xs space-y-1 text-muted-foreground">
                            <li><span className="text-emerald-400">Strong Bullish:</span> High volume + price increase, strong buying</li>
                            <li><span className="text-emerald-400/70">Bullish:</span> Moderate volume + price increase</li>
                            <li><span className="text-red-400">Strong Bearish:</span> High volume + price decrease, strong selling</li>
                            <li><span className="text-red-400/70">Bearish:</span> Moderate volume + price decrease</li>
                            <li><span className="text-amber-400">Neutral:</span> Low volume or mixed signals</li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Volume Oscillator:</span>
                    <span className={cn(
                      "font-mono font-medium",
                      (pair.volumeAnalysis?.volumeOscillator || 0) > 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {pair.volumeAnalysis?.volumeOscillator ? `${pair.volumeAnalysis.volumeOscillator.toFixed(2)}%` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Volume MA (7):</span>
                    <span className={cn(
                      "font-mono font-medium",
                      (pair.volumeAnalysis?.vma_7 || 0) > (pair.volumeAnalysis?.vma_30 || 0) ? "text-emerald-400" : "text-red-400"
                    )}>
                      {pair.volumeAnalysis?.vma_7 ? `$${formatLargeNumber(pair.volumeAnalysis.vma_7)}` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Volume MA (30):</span>
                    <span className="font-mono font-medium">
                      {pair.volumeAnalysis?.vma_30 ? `$${formatLargeNumber(pair.volumeAnalysis.vma_30)}` : '-'}
                    </span>
                  </div>

                  <div className="h-px bg-border/50 my-2"></div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-muted-foreground mr-2">Trend:</span>
                        <span className={cn(
                          "font-medium",
                          pair.volumeAnalysis?.trend === 'Strong Bullish' ? "text-emerald-400" :
                            pair.volumeAnalysis?.trend === 'Bullish' ? "text-emerald-400/70" :
                              pair.volumeAnalysis?.trend === 'Strong Bearish' ? "text-red-400" :
                                pair.volumeAnalysis?.trend === 'Bearish' ? "text-red-400/70" :
                                  "text-amber-400"
                        )}>
                          {pair.volumeAnalysis?.trend || 'Neutral'}
                        </span>
                      </div>
                      {/* <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Strength:</span>
                        <span className={cn(
                          "text-xs font-medium",
                          (pair.volumeAnalysis?.trendStrength || 0) > 0.7 ? "text-emerald-400" :
                          (pair.volumeAnalysis?.trendStrength || 0) > 0.3 ? "text-amber-400" :
                          "text-red-400"
                        )}>
                          {pair.volumeAnalysis?.trendStrength 
                            ? `${(pair.volumeAnalysis.trendStrength * 100).toFixed(0)}%` 
                            : '-'}
                        </span>
                      </div> */}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Price-Volume Correlation:</span>
                      <span className={cn(
                        "text-xs font-medium",
                        (pair.volumeAnalysis?.priceVolumeCorrelation || 0) > 0.5 ? "text-emerald-400" :
                          (pair.volumeAnalysis?.priceVolumeCorrelation || 0) > 0 ? "text-emerald-400/70" :
                            (pair.volumeAnalysis?.priceVolumeCorrelation || 0) < -0.5 ? "text-red-400" :
                              (pair.volumeAnalysis?.priceVolumeCorrelation || 0) < 0 ? "text-red-400/70" :
                                "text-amber-400"
                      )}>
                        {pair.volumeAnalysis?.priceVolumeCorrelation
                          ? `${(pair.volumeAnalysis.priceVolumeCorrelation * 100).toFixed(0)}%`
                          : '-'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pair.volumeAnalysis?.signal || 'Volume analysis not available.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>


          <div className="col-span-1">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">MACD Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-muted-foreground">MACD:</span>
                    <span className={cn(
                      "font-mono font-medium text-right",
                      macdValue > 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {macdValue.toFixed(6)}
                    </span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-muted-foreground">Signal Line:</span>
                    <span className="font-mono font-medium text-right">
                      {signalLine.toFixed(6)}
                    </span>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-2">
                    <span className="text-muted-foreground">Histogram:</span>
                    <span className={cn(
                      "font-mono font-medium text-right",
                      histogram > 0 ? "text-emerald-400" : "text-red-400"
                    )}>
                      {histogram.toFixed(6)}
                    </span>
                  </div>

                  <div className="h-px bg-border/50 my-2"></div>

                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-2">Trend:</span>
                      <span className={cn(
                        "font-medium",
                        pair.macdTrend?.includes('Up') ? "text-emerald-400" :
                          pair.macdTrend?.includes('Down') ? "text-red-400" :
                            "text-gray-400"
                      )}>
                        {pair.macdTrend || 'Neutral'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {pair.macdTrend?.includes('Strong Up') ?
                        'Uptrends suggest potential buying opportunities.' :
                        pair.macdTrend?.includes('Strong Down') ?
                          'Downtrends suggest caution or potential selling opportunities.' :
                          pair.macdTrend?.includes('Up') ?
                            'Watch for strengthening signals.' :
                            pair.macdTrend?.includes('Down') ?
                              'Watch for potential trend reversal.' :
                              'Sideways or consolidating market. No clear trend direction.'
                      }
                    </p>
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
                    <span className={`font-mono font-medium ${parseFloat(pair.bollingerBands?.percentB || '0.5') > 1 ? 'text-red-400' :
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
                    <span className="text-muted-foreground mr-2">TK Cross:</span>
                    <span className={`font-medium ${pair.ichimoku?.tkCross?.includes('Bullish') ? 'text-emerald-400' :
                      pair.ichimoku?.tkCross?.includes('Bearish') ? 'text-red-400' :
                        'text-gray-400'
                      }`}>
                      {pair.ichimoku?.tkCross || 'None'}
                    </span>
                  </div>
                  <div className="flex items-center mt-2">
                    <span className="text-muted-foreground mr-2">Signal:</span>
                    <span className={`font-medium ${pair.ichimoku?.cloudSignal?.includes('Strong Bull') ? 'text-emerald-400' :
                      pair.ichimoku?.cloudSignal?.includes('Bull') ? 'text-emerald-400/70' :
                        pair.ichimoku?.cloudSignal?.includes('Strong Bear') ? 'text-red-400' :
                          pair.ichimoku?.cloudSignal?.includes('Bear') ? 'text-red-400/70' :
                            'text-gray-400'
                      }`}>
                      {pair.ichimoku?.cloudSignal || 'Neutral'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  Moving Averages
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InformationCircleIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="w-[450px] p-5 space-y-4 bg-card/95 backdrop-blur-sm border-border shadow-xl">
                        <div className="border-l-4 border-primary pl-3">
                          <p className="font-semibold text-base mb-1 text-primary">Moving Averages Analysis</p>
                          <p className="text-sm text-muted-foreground">Trend following indicators that smooth price action over different time periods.</p>
                        </div>

                        <div className="bg-accent/30 rounded-lg p-3">
                          <p className="font-semibold mb-2 text-primary flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                            Simple Moving Average (SMA)
                          </p>
                          <ul className="text-xs space-y-2 ml-2">
                            <li className="flex items-start gap-2">
                              <span className="font-medium text-blue-400 min-w-[90px]">SMA (7):</span>
                              <span className="text-muted-foreground">Quick trend indicator. Faster to react but more noise. Good for short-term trading.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-medium text-blue-400 min-w-[90px]">SMA (30):</span>
                              <span className="text-muted-foreground">Medium-term trend. More stable, less false signals. Key support/resistance level.</span>
                            </li>
                          </ul>
                        </div>

                        <div className="bg-accent/30 rounded-lg p-3">
                          <p className="font-semibold mb-2 text-primary flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                            Exponential Moving Average (EMA)
                          </p>
                          <ul className="text-xs space-y-2 ml-2">
                            <li className="flex items-start gap-2">
                              <span className="font-medium text-emerald-400 min-w-[90px]">EMA (7):</span>
                              <span className="text-muted-foreground">Emphasizes recent price action. Earlier signals than SMA. Good for momentum trading.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="font-medium text-emerald-400 min-w-[90px]">EMA (30):</span>
                              <span className="text-muted-foreground">Dynamic support/resistance. Smoother than short EMA but more responsive than SMA.</span>
                            </li>
                          </ul>
                        </div>

                        <div className="border-l-4 border-primary/50 pl-3 mt-2">
                          <p className="font-semibold mb-1 text-primary">Signal Interpretation</p>
                          <ul className="text-xs space-y-1 text-muted-foreground">
                            <li><span className="text-emerald-400">Strong Uptrend:</span> Price above all MAs, shorter MAs above longer MAs</li>
                            <li><span className="text-red-400">Strong Downtrend:</span> Price below all MAs, shorter MAs below longer MAs</li>
                            <li><span className="text-amber-400">Consolidation:</span> MAs tightly grouped, price crossing between them</li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">SMA (7):</span>
                    <span className={cn(
                      "font-mono font-medium",
                      parseFloat(pair.sma_7 || '0') > parseFloat(pair.sma_30 || '0') ? "text-emerald-400" : "text-red-400"
                    )}>
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
                    <span className={cn(
                      "font-mono font-medium",
                      parseFloat(pair.ema_7 || '0') > parseFloat(pair.ema_30 || '0') ? "text-emerald-400" : "text-red-400"
                    )}>
                      {pair.ema_7 ? '$' + parseFloat(pair.ema_7).toFixed(6) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">EMA (30):</span>
                    <span className="font-mono font-medium">
                      {pair.ema_30 ? '$' + parseFloat(pair.ema_30).toFixed(6) : '-'}
                    </span>
                  </div>

                  <div className="h-px bg-border/50 my-2"></div>

                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-2">Signal:</span>
                      <span className={cn(
                        "font-medium",
                        parseFloat(pair.sma_7 || '0') > parseFloat(pair.sma_30 || '0') &&
                          parseFloat(pair.ema_7 || '0') > parseFloat(pair.ema_30 || '0')
                          ? "text-emerald-400"
                          : parseFloat(pair.sma_7 || '0') < parseFloat(pair.sma_30 || '0') &&
                            parseFloat(pair.ema_7 || '0') < parseFloat(pair.ema_30 || '0')
                            ? "text-red-400"
                            : "text-amber-400"
                      )}>
                        {parseFloat(pair.sma_7 || '0') > parseFloat(pair.sma_30 || '0') &&
                          parseFloat(pair.ema_7 || '0') > parseFloat(pair.ema_30 || '0')
                          ? "Strong Uptrend"
                          : parseFloat(pair.sma_7 || '0') < parseFloat(pair.sma_30 || '0') &&
                            parseFloat(pair.ema_7 || '0') < parseFloat(pair.ema_30 || '0')
                            ? "Strong Downtrend"
                            : "Mixed Signals"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {parseFloat(pair.sma_7 || '0') > parseFloat(pair.sma_30 || '0') &&
                        parseFloat(pair.ema_7 || '0') > parseFloat(pair.ema_30 || '0')
                        ? "All moving averages aligned bullish. Strong buying pressure."
                        : parseFloat(pair.sma_7 || '0') < parseFloat(pair.sma_30 || '0') &&
                          parseFloat(pair.ema_7 || '0') < parseFloat(pair.ema_30 || '0')
                          ? "All moving averages aligned bearish. Strong selling pressure."
                          : "Moving averages showing conflicting signals. Market may be consolidating."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Risk Analysis Card */}
        <div className="grid grid-cols-1 gap-4 mb-4">



          {/* Risk Analysis & Opportunities Card */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Risk Analysis & Opportunities
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InformationCircleIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="w-[450px] p-5 space-y-4 bg-card/95 backdrop-blur-sm border-border shadow-xl">
                      <div className="border-l-4 border-primary pl-3">
                        <p className="font-semibold text-base mb-1 text-primary">Risk Analysis</p>
                        <p className="text-sm text-muted-foreground">Comprehensive assessment of market conditions, volatility, and position sizing to manage trading risk effectively.</p>
                      </div>

                      <div className="bg-accent/30 rounded-lg p-3">
                        <p className="font-semibold mb-2 text-primary flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                          Risk Metrics
                        </p>
                        <ul className="text-xs space-y-2 ml-2">
                          <li className="flex items-start gap-2">
                            <span className="font-medium text-blue-400 min-w-[110px]">Risk Score:</span>
                            <span className="text-muted-foreground">Overall risk assessment based on multiple factors including volatility, liquidity, and technical indicators.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-medium text-blue-400 min-w-[110px]">Risk/Reward Ratio:</span>
                            <span className="text-muted-foreground">Comparison of potential profit to potential loss. Higher values indicate more favorable trading conditions.</span>
                          </li>
                        </ul>
                      </div>

                      <div className="bg-accent/30 rounded-lg p-3">
                        <p className="font-semibold mb-2 text-primary flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                          Opportunity Analysis
                        </p>
                        <ul className="text-xs space-y-2 ml-2">
                          <li className="flex items-start gap-2">
                            <span className="font-medium text-emerald-400 min-w-[110px]">Entry Points:</span>
                            <span className="text-muted-foreground">Suggested price levels for opening positions based on technical analysis.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-medium text-red-400 min-w-[110px]">Stop Loss:</span>
                            <span className="text-muted-foreground">Recommended exit points to limit potential losses, calculated using ATR and support/resistance levels.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-medium text-emerald-400 min-w-[110px]">Targets:</span>
                            <span className="text-muted-foreground">Potential price targets based on Fibonacci levels, historical resistance, and volatility.</span>
                          </li>
                        </ul>
                      </div>

                      <div className="border-l-4 border-primary/50 pl-3 mt-2">
                        <p className="font-semibold mb-1 text-primary">Position Sizing</p>
                        <p className="text-xs text-muted-foreground">Recommendations based on volatility and account risk management principles. Adjust position size based on your risk tolerance and market conditions.</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <CardDescription>Risk metrics and trading opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* Left column - Risk Analysis */}
                <div className="space-y-4">
                  {/* Risk Score */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">Risk Score</h3>
                      <span className={cn(
                        "font-medium",
                        parseFloat(pair.riskAdjustedScore) >= 0.7 ? "text-emerald-400" :
                          parseFloat(pair.riskAdjustedScore) <= 0.3 ? "text-red-400" :
                            "text-amber-400"
                      )}>
                        {(parseFloat(pair.riskAdjustedScore) * 100).toFixed(1)}%
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        pair.riskAnalysis?.riskLevel === 'Low' ? "bg-emerald-400/20 text-emerald-400" :
                          pair.riskAnalysis?.riskLevel === 'High' ? "bg-red-400/20 text-red-400" :
                            "bg-amber-400/20 text-amber-400"
                      )}>
                        {pair.riskAnalysis?.riskLevel || 'Medium'} Risk
                      </span>
                    </div>
                    <div className="w-full bg-secondary/30 rounded-full h-2">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          pair.riskAnalysis?.riskLevel === 'Low' ? "bg-emerald-400" :
                            pair.riskAnalysis?.riskLevel === 'High' ? "bg-red-400" :
                              "bg-amber-400"
                        )}
                        style={{ width: `${(pair.riskAnalysis?.riskScore || parseFloat(pair.riskAdjustedScore) * 100 || 50)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Risk/Reward Analysis */}
                  <div className="p-3 border rounded-lg bg-card/50">
                    <h3 className="text-sm font-medium mb-2">Risk/Reward Analysis</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Composite Score:</span>
                        <span className={cn(
                          "font-medium",
                          parseFloat(pair.enhancedScore) >= 0.7 ? "text-emerald-400" :
                            parseFloat(pair.enhancedScore) <= 0.3 ? "text-red-400" :
                              "text-amber-400"
                        )}>
                          {parseFloat(pair.enhancedScore).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Short-term:</span>
                        <span className={cn(
                          "font-medium",
                          parseFloat(pair.shortTermScore) >= 0.7 ? "text-emerald-400" :
                            parseFloat(pair.shortTermScore) <= 0.3 ? "text-red-400" :
                              "text-amber-400"
                        )}>
                          {parseFloat(pair.shortTermScore).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Long-term:</span>
                        <span className={cn(
                          "font-medium",
                          parseFloat(pair.longTermScore) >= 0.7 ? "text-emerald-400" :
                            parseFloat(pair.longTermScore) <= 0.3 ? "text-red-400" :
                              "text-amber-400"
                        )}>
                          {parseFloat(pair.longTermScore).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Risk-adjusted:</span>
                        <span className={cn(
                          "font-medium",
                          parseFloat(pair.riskAdjustedScore) >= 0.7 ? "text-emerald-400" :
                            parseFloat(pair.riskAdjustedScore) <= 0.3 ? "text-red-400" :
                              "text-amber-400"
                        )}>
                          {parseFloat(pair.riskAdjustedScore).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Volatility Metrics */}
                  <div className="p-3 border rounded-lg bg-card/50">
                    <h3 className="text-sm font-medium mb-2">Volatility Metrics</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Volatility Level:</span>
                        <span className={cn(
                          "font-medium",
                          pair.atrAnalysis?.volatility?.includes('High') ? "text-red-400" :
                            pair.atrAnalysis?.volatility?.includes('Low') ? "text-emerald-400" :
                              "text-amber-400"
                        )}>
                          {pair.atrAnalysis?.volatility || 'Medium'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Normalized ATR:</span>
                        <span className={cn(
                          "font-medium",
                          parseFloat(pair.atrAnalysis?.normalizedATR || '0') > 5 ? "text-red-400" :
                            parseFloat(pair.atrAnalysis?.normalizedATR || '0') < 1 ? "text-emerald-400" :
                              "text-amber-400"
                        )}>
                          {pair.atrAnalysis?.normalizedATR ? `${pair.atrAnalysis.normalizedATR}%` : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">ATR (14):</span>
                        <span className="font-mono text-xs">
                          {pair.atrAnalysis?.atr || pair.atr || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">BB Width:</span>
                        <span className="font-mono text-xs">
                          {pair.bb_width || '-'}
                        </span>
                      </div>
                    </div>
                  </div>


                  {/* Volume Analysis */}
                  <div className="p-3 border rounded-lg bg-card/50">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium mb-2">Volume Analysis</h3>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Volume Trend:</span>
                        <span className={cn(
                          "font-medium",
                          pair.volumeAnalysis?.trend === 'Strong Bullish' ? "text-emerald-400" :
                            pair.volumeAnalysis?.trend === 'Bullish' ? "text-emerald-400/70" :
                              pair.volumeAnalysis?.trend === 'Strong Bearish' ? "text-red-400" :
                                pair.volumeAnalysis?.trend === 'Bearish' ? "text-red-400/70" :
                                  "text-amber-400"
                        )}>
                          {pair.volumeAnalysis?.trend || 'Neutral'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Volume Score:</span>
                        <span className="font-medium">
                          {pair.volumeScore?.toFixed(1) || '-'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Liquidity:</span>
                        <span className={cn(
                          "font-medium",
                          pair.liquidityType === 'High' ? "text-emerald-400" :
                            pair.liquidityType === 'Low' ? "text-red-400" :
                              "text-amber-400"
                        )}>
                          {pair.liquidityType || 'Normal'}
                        </span>
                      </div>
                      {pair.volumeAnalysis?.signal && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {pair.volumeAnalysis.signal}
                        </div>
                      )}
                    </div>
                  </div>
                </div>



                {/* Right column - Opportunities & Position Sizing */}
                <div className="space-y-4">
                  {/* Trading Opportunity */}
                  <div className="p-3 border rounded-lg bg-card/50">


                    {/* Opportunity Type Section */}

                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium">Opportunity Type</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        // Bullish trend styles
                        (pair.opportunityMetrics?.type === 'Trend' && pair.opportunityMetrics?.direction === 'long') ?
                          "bg-blue-400/20 text-blue-400" :
                          // Bearish trend styles
                          (pair.opportunityMetrics?.type === 'Trend' && pair.opportunityMetrics?.direction === 'short') ?
                            "bg-red-400/20 text-red-400" :
                            // Other opportunity types
                            pair.opportunityMetrics?.type === 'Reversal' ? "bg-purple-400/20 text-purple-400" :
                              pair.opportunityMetrics?.type === 'Breakout' ? "bg-amber-400/20 text-amber-400" :
                                "bg-gray-400/20 text-gray-400"
                      )}>
                        {/* Enhanced display that includes direction */}
                        {(pair.opportunityMetrics?.type === 'Trend' && pair.opportunityMetrics?.direction === 'long') ?
                          "Bullish Trend" :
                          (pair.opportunityMetrics?.type === 'Trend' && pair.opportunityMetrics?.direction === 'short') ?
                            "Bearish Trend" :
                            (pair.opportunityMetrics?.type === 'Reversal' && pair.opportunityMetrics?.direction === 'long') ?
                              "Bullish Reversal" :
                              (pair.opportunityMetrics?.type === 'Reversal' && pair.opportunityMetrics?.direction === 'short') ?
                                "Bearish Reversal" :
                                (pair.opportunityMetrics?.type === 'Breakout' && pair.opportunityMetrics?.direction === 'long') ?
                                  "Bullish Breakout" :
                                  (pair.opportunityMetrics?.type === 'Breakout' && pair.opportunityMetrics?.direction === 'short') ?
                                    "Bearish Breakout" :
                                    pair.opportunityMetrics?.type || 'None'} ({pair.opportunityMetrics?.timeframe || 'Medium'})
                      </span>
                    </div>

                    {/* Confidence level - only show if not None */}
                    {pair.opportunityMetrics?.type !== 'None' && (
                      <div className="text-sm mb-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-muted-foreground">Confidence:</span>
                          <span className="font-medium">
                            {pair.opportunityMetrics?.confidence ? `${pair.opportunityMetrics.confidence.toFixed(0)}%` : '-'}
                          </span>
                        </div>
                        <div className="w-full bg-secondary/30 rounded-full h-1.5">
                          <div
                            className="bg-blue-400 h-full rounded-full"
                            style={{ width: `${pair.opportunityMetrics?.confidence || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Key levels - only show if not None */}
                    {pair.opportunityMetrics?.type !== 'None' && pair.opportunityMetrics?.keyLevels && (
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Entry:</span>
                          <span className="font-mono">${formatPrice(pair.opportunityMetrics?.keyLevels.entry ?? 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Target{pair.opportunityMetrics?.direction ? ` (${pair.opportunityMetrics.direction === 'long' ? 'Long' : 'Short'})` : ''}:
                          </span>
                          <span className="font-mono text-emerald-400">${formatPrice(pair.opportunityMetrics?.keyLevels.target ?? 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Stop:</span>
                          <span className="font-mono text-red-400">${formatPrice(pair.opportunityMetrics?.keyLevels.stop ?? 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">R/R:</span>
                          <span className="font-medium">{pair.opportunityMetrics?.keyLevels.riskRewardRatio?.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Trade opportunity explanation - only show if not None */}
                    {pair.opportunityMetrics?.type !== 'None' && pair.opportunityMetrics?.direction === 'short' && (
                      <div className="mt-3 p-1.5 text-xs border border-dashed border-blue-400/30 rounded bg-blue-400/5">
                        <div className="font-medium text-blue-400 mb-0.5">📉 Short Trade Opportunity</div>
                        <div className="text-muted-foreground">
                          This setup suggests a potential short position with entry at ${formatPrice(pair.opportunityMetrics?.keyLevels.entry ?? 0)} and
                          target at ${formatPrice(pair.opportunityMetrics?.keyLevels.target ?? 0)}. Place a stop-loss at ${formatPrice(pair.opportunityMetrics?.keyLevels.stop ?? 0)}.
                        </div>
                      </div>
                    )}

                    {pair.opportunityMetrics?.type !== 'None' && pair.opportunityMetrics?.direction === 'long' && (
                      <div className="mt-3 p-1.5 text-xs border border-dashed border-green-400/30 rounded bg-green-400/5">
                        <div className="font-medium text-green-400 mb-0.5">📈 Long Trade Opportunity</div>
                        <div className="text-muted-foreground">
                          This setup suggests a potential long position with entry at ${formatPrice(pair.opportunityMetrics?.keyLevels.entry ?? 0)} and
                          target at ${formatPrice(pair.opportunityMetrics?.keyLevels.target ?? 0)}. Place a stop-loss at ${formatPrice(pair.opportunityMetrics?.keyLevels.stop ?? 0)}.
                        </div>
                      </div>
                    )}

                    {/* No opportunity message */}
                    {(pair.opportunityMetrics?.type === 'None' || !pair.opportunityMetrics?.type) && (
                      <div className="mt-1 p-1.5 text-xs border border-dashed border-gray-400/30 rounded bg-gray-400/5">
                        <div className="text-muted-foreground">
                          No significant trading opportunity detected at this time. Watch for changes in market conditions.
                        </div>
                      </div>
                    )}





                  </div>

                  {/* Stop Loss Suggestions */}
                  <div className="p-3 border rounded-lg bg-card/50">
                    <h3 className="text-sm font-medium mb-2">Stop Loss Suggestions</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">ATR-based:</span>
                        <span className="font-mono text-red-400">
                          ${formatPrice(pair.riskAnalysis?.stopLoss?.atrBased ||
                            (parseFloat(pair.currentPrice) - parseFloat(pair.atrAnalysis?.atr || pair.atr || '0')) || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Support-based:</span>
                        <span className="font-mono text-red-400">
                          ${formatPrice(pair.riskAnalysis?.stopLoss?.supportBased ||
                            (pair.supports && pair.supports.length > 0 ? pair.supports[0].price : 0))}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Suggested:</span>
                        <span className="font-mono font-medium text-red-400">
                          {pair.riskAnalysis?.stopLoss?.suggestion || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Position Sizing */}
                  <div className="p-3 border rounded-lg bg-card/50">
                    <h3 className="text-sm font-medium mb-2">Position Sizing</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Suggested Size:</span>
                        <span className="font-mono font-medium">
                          {pair.riskAnalysis?.positionSizing?.suggested ?
                            `${pair.riskAnalysis.positionSizing.suggested.toFixed(2)}` : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Max Size:</span>
                        <span className="font-mono">
                          {pair.riskAnalysis?.positionSizing?.maxSize ?
                            `${pair.riskAnalysis.positionSizing.maxSize.toFixed(2)}` : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Risk %:</span>
                        <span className="font-mono">
                          {pair.riskAnalysis?.positionSizing?.riskPercentage ?
                            `${pair.riskAnalysis.positionSizing.riskPercentage.toFixed(2)}%` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Risk Factors / Warnings */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium mb-2">Risk Factors</h3>
                    <div className={cn(
                      "p-2 rounded-md border",
                      pair.isPumping ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400" :
                        pair.isDumping ? "bg-red-400/10 border-red-400/30 text-red-400" :
                          "bg-amber-400/10 border-amber-400/30 text-amber-400"
                    )}>
                      {pair.isPumping && (
                        <div className="text-xs font-medium mb-1 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                          Potential Pump Detected
                        </div>
                      )}
                      {pair.isDumping && (
                        <div className="text-xs font-medium mb-1 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400"></span>
                          Potential Dump Detected
                        </div>
                      )}
                      {!pair.isPumping && !pair.isDumping && (
                        <div className="text-xs font-medium mb-1 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                          Risk Assessment
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {pair.isPumping ? (
                          <>
                            Pump Score: <span className="font-medium text-emerald-400">{pair.pumpScore?.toFixed(1)}</span> |
                            Price Change: <span className="font-medium text-emerald-400">{pair.priceChange?.toFixed(2)}%</span> |
                            Vol Increase: <span className="font-medium">{pair.volumeIncrease?.toFixed(0)}%</span>
                          </>
                        ) : pair.isDumping ? (
                          <>
                            Dump Score: <span className="font-medium text-red-400">{pair.dumpScore?.toFixed(1)}</span> |
                            Price Change: <span className="font-medium text-red-400">{pair.priceChange?.toFixed(2)}%</span> |
                            Vol Increase: <span className="font-medium">{pair.volumeIncrease?.toFixed(0)}%</span>
                          </>
                        ) : (
                          <>
                            Movement Type: <span className="font-medium">{pair.movementType || 'Normal'}</span> |
                            Vol/Price Corr: <span className="font-medium">{pair.volumeAnalysis?.priceVolumeCorrelation?.toFixed(2) || 'N/A'}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pair.isPumping ? (
                        "Exercise caution - high volatility detected. Consider reduced position size."
                      ) : pair.isDumping ? (
                        "Exercise caution - significant selling pressure detected."
                      ) : (
                        pair.atrAnalysis?.volatility?.includes('High') ?
                          "Higher than normal volatility. Consider adjusting position size." :
                          "Normal market conditions. Standard risk management advised."
                      )}
                    </div>
                  </div>

                </div>




              </div>

            </CardContent>
          </Card>


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
                        .slice(0, 5)
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
                        .slice(0, 5)
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

        {/* Volume Profile Card */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Volume Profile
                <div className="relative group">
                  <button className="text-muted-foreground hover:text-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.06-1.06 2.75 2.75 0 013.82 0 .75.75 0 01-1.06 1.06 1.25 1.25 0 00-1.7 0zM12 10a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="absolute left-full top-0 ml-2 w-[400px] hidden group-hover:block z-50">
                    <div className="bg-black/95 backdrop-blur-sm border border-border/50 text-white px-4 py-3 rounded-lg shadow-xl text-sm">
                      <h4 className="font-semibold mb-3 text-base border-b border-border/50 pb-2">Understanding Volume Profile</h4>
                      <div className="space-y-3">
                        <div className="bg-white/5 rounded-md p-3">
                          <p className="mb-2"><span className="font-medium text-primary">Volume Nodes:</span></p>
                          <ul className="list-disc pl-4 space-y-1 text-gray-300">
                            <li>High Volume Node (HVN): Areas of significant trading activity</li>
                            <li>Low Volume Node (LVN): Areas of low trading interest</li>
                            <li>Point of Control (POC): Price level with highest trading volume</li>
                          </ul>
                        </div>
                        <div className="bg-white/5 rounded-md p-3">
                          <p className="text-xs text-gray-300">Volume profile helps identify support/resistance levels based on historical trading activity. High volume nodes often act as strong support/resistance levels.</p>
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
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Volume Distribution</h3>
                  <div className="space-y-2">
                    {/* Point of Control */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Point of Control:</span>
                      <span className="font-mono font-medium text-amber-400">
                        ${formatPrice(pair.volumeProfile?.poc || 0)}
                      </span>
                    </div>

                    {/* Value Area */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Value Area (70%):</span>
                      <div className="text-right">
                        <div className="font-mono text-xs text-red-400">High: ${formatPrice(pair.volumeProfile?.valueAreaHigh || 0)}</div>
                        <div className="font-mono text-xs text-emerald-400">Low: ${formatPrice(pair.volumeProfile?.valueAreaLow || 0)}</div>
                      </div>
                    </div>

                    {/* Volume Nodes */}
                    <div className="mt-4">
                      <div className="text-sm text-muted-foreground mb-2">High Volume Nodes:</div>
                      <div className="space-y-2">
                        {(pair.volumeProfile?.hvnodes || []).map((node: any, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-full bg-secondary/30 rounded-full h-2">
                              <div
                                className="bg-blue-400/50 h-full rounded-full"
                                style={{ width: `${Math.max(15, (node.volume / (pair.volumeProfile?.maxVolume || 0)) * 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs min-w-[100px] text-right">
                              ${formatPrice(node.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Volume Analysis</h3>
                  <div className="space-y-4">
                    {/* Volume Trend */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Volume Trend:</span>
                        <span className={cn(
                          "font-medium",
                          pair.volumeAnalysis?.trend === 'Strong Bullish' ? "text-emerald-400" :
                            pair.volumeAnalysis?.trend === 'Bullish' ? "text-emerald-400/70" :
                              pair.volumeAnalysis?.trend === 'Strong Bearish' ? "text-red-400" :
                                pair.volumeAnalysis?.trend === 'Bearish' ? "text-red-400/70" :
                                  "text-amber-400"
                        )}>
                          {pair.volumeAnalysis?.trend || 'Neutral'}
                        </span>
                      </div>
                      <div className="w-full bg-secondary/30 rounded-full h-2">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            pair.volumeAnalysis?.trend === 'Strong Bullish' ? "bg-emerald-400/50" :
                              pair.volumeAnalysis?.trend === 'Bullish' ? "bg-emerald-400/30" :
                                pair.volumeAnalysis?.trend === 'Strong Bearish' ? "bg-red-400/50" :
                                  pair.volumeAnalysis?.trend === 'Bearish' ? "bg-red-400/30" :
                                    "bg-amber-400/30"
                          )}
                          style={{
                            width: `${Math.min(100, Math.max(15, (pair.volumeAnalysis?.trendStrength || 0) * 100))}%`
                          }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {pair.volumeAnalysis?.signal || 'Volume analysis not available'}
                      </div>
                    </div>

                    {/* Volume Spikes */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Recent Volume Spikes:</div>
                      <div className="space-y-2">
                        {(pair.volumeProfile?.spikes || []).map((spike: any, index: number) => (
                          <div key={index} className="p-2 border border-border/50 rounded-md bg-secondary/10">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                {new Date(spike.timestamp).toLocaleString()}
                              </span>
                              <span className={cn(
                                "text-xs font-medium",
                                spike.type === 'buy' ? "text-emerald-400" : "text-red-400"
                              )}>
                                {spike.type === 'buy' ? 'Buying' : 'Selling'} Pressure
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-xs text-muted-foreground">Volume:</span>
                              <span className="font-mono text-xs">
                                {spike.volume >= 1000000
                                  ? `${(spike.volume / 1000000).toFixed(1)}M`
                                  : spike.volume >= 1000
                                    ? `${(spike.volume / 1000).toFixed(1)}K`
                                    : spike.volume}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Volume-Based Support/Resistance */}
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Volume-Based Levels:</div>
                      <div className="space-y-2">
                        {(pair.volumeProfile?.levels || []).slice(0, 3).map((level: any, index: number) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                level.type === 'support' ? "bg-emerald-400" : "bg-red-400"
                              )} />
                              <span className="text-xs text-muted-foreground">
                                {level.type === 'support' ? 'Support' : 'Resistance'}
                              </span>
                            </div>
                            <span className="font-mono text-xs">
                              ${formatPrice(level.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Market Structure Card */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                Market Structure
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InformationCircleIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    {MarketStructureTooltip}
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Trend Structure</h3>
                  <div className="space-y-4">
                    <div className="p-3 border border-border rounded-lg bg-card/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Current Trend</span>
                        <span className={cn(
                          "font-medium",
                          pair.marketStructure?.trend === 'Uptrend' ? "text-emerald-400" :
                            pair.marketStructure?.trend === 'Downtrend' ? "text-red-400" :
                              pair.marketStructure?.trend === 'Accumulation' ? "text-blue-400" :
                                pair.marketStructure?.trend === 'Distribution' ? "text-amber-400" :
                                  "text-muted-foreground"
                        )}>
                          {pair.marketStructure?.trend || 'Unknown'}
                        </span>
                      </div>
                      <div className="w-full bg-secondary/30 rounded-full h-2">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pair.marketStructure?.trend === 'Uptrend' ? "bg-emerald-400" :
                              pair.marketStructure?.trend === 'Downtrend' ? "bg-red-400" :
                                pair.marketStructure?.trend === 'Accumulation' ? "bg-blue-400" :
                                  pair.marketStructure?.trend === 'Distribution' ? "bg-amber-400" :
                                    "bg-muted"
                          )}
                          style={{ width: `${pair.marketStructure?.strength || 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          pair.marketStructure?.structure.higherHighs ? "bg-emerald-400" : "bg-muted"
                        )} />
                        <span className="text-sm">Higher Highs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          pair.marketStructure?.structure.higherLows ? "bg-emerald-400" : "bg-muted"
                        )} />
                        <span className="text-sm">Higher Lows</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          pair.marketStructure?.structure.lowerHighs ? "bg-red-400" : "bg-muted"
                        )} />
                        <span className="text-sm">Lower Highs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          pair.marketStructure?.structure.lowerLows ? "bg-red-400" : "bg-muted"
                        )} />
                        <span className="text-sm">Lower Lows</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Market Phase</h3>
                  <div className="space-y-4">
                    <div className="p-3 border border-border rounded-lg bg-card/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Current Phase</span>
                        <span className={cn(
                          "font-medium",
                          pair.marketStructure?.phase.current === 'Mark-Up' ? "text-emerald-400" :
                            pair.marketStructure?.phase.current === 'Mark-Down' ? "text-red-400" :
                              pair.marketStructure?.phase.current === 'Accumulation' ? "text-blue-400" :
                                pair.marketStructure?.phase.current === 'Distribution' ? "text-amber-400" :
                                  "text-muted-foreground"
                        )}>
                          {pair.marketStructure?.phase.current || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Duration: {pair.marketStructure?.phase.duration || 0} candles</span>
                        <span>Confidence: {pair.marketStructure?.phase.confidence || 0}%</span>
                      </div>
                      {pair.marketStructure?.phase.description && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {pair.marketStructure.phase.description}
                        </p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Key Swing Points</h4>
                      <div className="space-y-2">
                        {pair.marketStructure?.swingPoints?.slice(0, 3).map((point, index) => (
                          <div key={index} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                point.type === 'High' ? "bg-red-400" : "bg-emerald-400"
                              )} />
                              <span>{point.type}</span>
                            </div>
                            <span className="font-mono">${formatPrice(point.price)}</span>
                            <span className="text-muted-foreground">
                              {new Date(point.timestamp).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {pair.marketStructure?.pivotLevels && pair.marketStructure.pivotLevels.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Pivot Levels</h4>
                        <div className="space-y-2">
                          {pair.marketStructure.pivotLevels.slice(0, 3).map((level, index) => (
                            <div key={index} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  level.type === 'Resistance' ? "bg-red-400" : "bg-emerald-400"
                                )} />
                                <span>{level.type}</span>
                              </div>
                              <span className="font-mono">${formatPrice(level.price)}</span>
                              <span className="text-muted-foreground">
                                Strength: {level.strength.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fibonacci Analysis card */}
        <div className="grid grid-cols-1 gap-4 mb-4">





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