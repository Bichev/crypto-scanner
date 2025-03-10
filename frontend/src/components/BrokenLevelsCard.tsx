import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";

interface BrokenLevel {
    price: number;
    strength: number;
    breakTime: number;
    priceAtBreak: number;
    volume24hAtBreak: number;
    description?: string;
}

interface CryptoPair {
    pair: string;
    currentPrice: string;
    brokenLevels?: {
        brokenSupports: BrokenLevel[];
        brokenResistances: BrokenLevel[];
    };
}

interface BrokenLevelsCardProps {
    pairs: CryptoPair[];
}

export function BrokenLevelsCard({ pairs }: BrokenLevelsCardProps) {
    // Add initial data logging
    console.log('BrokenLevelsCard received pairs:', {
        receivedPairs: pairs?.length || 0,
        firstPair: pairs?.[0],
        sampleBrokenLevels: pairs?.[0]?.brokenLevels
    });

    // Get recent breaks (last 24h)
    const pairsWithLevels = pairs.filter(pair => pair.brokenLevels);
    console.log('Pairs with broken levels:', {
        count: pairsWithLevels.length,
        pairs: pairsWithLevels.map(p => ({
            pair: p.pair,
            supportsCount: p.brokenLevels?.brokenSupports?.length || 0,
            resistancesCount: p.brokenLevels?.brokenResistances?.length || 0
        }))
    });

    const recentBreaks = pairs
        .filter(pair => pair.brokenLevels)
        .flatMap(pair => [
            ...(pair.brokenLevels?.brokenSupports || []).map(level => ({
                ...level,
                pair: pair.pair,
                type: 'support' as const,
                currentPrice: parseFloat(pair.currentPrice)
            })),
            ...(pair.brokenLevels?.brokenResistances || []).map(level => ({
                ...level,
                pair: pair.pair,
                type: 'resistance' as const,
                currentPrice: parseFloat(pair.currentPrice)
            }))
        ]);

    console.log('All breaks before filtering:', {
        totalBreaks: recentBreaks.length,
        breaks: recentBreaks.slice(0, 3)
    });

    const filteredBreaks = recentBreaks
        .filter(level => {
            const timeDiff = Math.floor(Date.now() / 1000) - level.breakTime;
            const isRecent = timeDiff < 2 * 24 * 60 * 60;
            console.log('Filtering break:', {
                pair: level.pair,
                breakTime: level.breakTime,
                currentTime: Math.floor(Date.now() / 1000),
                timeDiff,
                isRecent
            });
            return isRecent;
        })
        .sort((a, b) => b.breakTime - a.breakTime);

    // Final data logging
    console.log('Final broken levels data:', {
        totalPairs: pairs.length,
        pairsWithBrokenLevels: pairsWithLevels.length,
        totalBreaksBeforeFiltering: recentBreaks.length,
        totalBreaksAfterFiltering: filteredBreaks.length,
        currentTime: Math.floor(Date.now() / 1000),
        currentDate: new Date().toISOString().split('T')[0],
        sampleBreak: filteredBreaks[0],
        filteredBreaks: filteredBreaks.slice(0, 5)
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    Broken Levels
                    <div className="text-xs font-normal text-muted-foreground">
                        Recent support/resistance breaks
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Broken Resistances */}
                    <div>
                        <h3 className="text-sm font-medium mb-2 text-emerald-400">
                            Broken Resistances ({filteredBreaks.filter(level => level.type === 'resistance').length})
                        </h3>
                        <div className="space-y-2">
                            {filteredBreaks
                                .filter(level => level.type === 'resistance')
                                .slice(0, 5)
                                .map(level => (
                                    <div key={`${level.pair}-${level.price}`} 
                                         className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{level.pair}</span>
                                            <span className="text-xs text-muted-foreground">
                                                ${level.price.toFixed(6)}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-emerald-400">
                                                +{((level.currentPrice - level.price) / level.price * 100).toFixed(2)}%
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Vol: ${(level.volume24hAtBreak || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            {filteredBreaks.filter(level => level.type === 'resistance').length === 0 && (
                                <div className="text-sm text-muted-foreground text-center py-2">
                                    No resistance breaks detected recently
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Broken Supports */}
                    <div>
                        <h3 className="text-sm font-medium mb-2 text-red-400">
                            Broken Supports ({filteredBreaks.filter(level => level.type === 'support').length})
                        </h3>
                        <div className="space-y-2">
                            {filteredBreaks
                                .filter(level => level.type === 'support')
                                .slice(0, 5)
                                .map(level => (
                                    <div key={`${level.pair}-${level.price}`} 
                                         className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{level.pair}</span>
                                            <span className="text-xs text-muted-foreground">
                                                ${level.price.toFixed(6)}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-red-400">
                                                {((level.currentPrice - level.price) / level.price * 100).toFixed(2)}%
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Vol: ${(level.volume24hAtBreak || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            {filteredBreaks.filter(level => level.type === 'support').length === 0 && (
                                <div className="text-sm text-muted-foreground text-center py-2">
                                    No support breaks detected recently
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
