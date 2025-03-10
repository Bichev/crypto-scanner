import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { CryptoPair } from '@/types/crypto';
import { formatPrice } from '@/lib/support-resistance-helpers';
import { cn } from '@/lib/utils';

interface BrokenLevel {
    price: number;
    strength: number;
    breakTime: number;
    priceAtBreak: number;
    volume24hAtBreak: number;
    description?: string;
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

export function BrokenResistancesCard({ pairs }: BrokenLevelsCardProps) {
    const recentBreaks = pairs
        .filter(pair => pair.brokenLevels)
        .flatMap(pair => (pair.brokenLevels?.brokenResistances || []).map(level => ({
            ...level,
            pair: pair.pair,
            type: 'resistance' as const,
            currentPrice: parseFloat(pair.currentPrice)
        })));

    const filteredBreaks = recentBreaks
        .filter(level => {
            const timeDiff = Math.floor(Date.now() / 1000) - level.breakTime;
            return timeDiff < 2 * 24 * 60 * 60; // 48 hours
        })
        .sort((a, b) => b.breakTime - a.breakTime);

    const totalBreaks = filteredBreaks.length;
    const displayBreaks = filteredBreaks.slice(0, 10); // Show top 10

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center justify-between">
                    Broken Resistances
                    <span className="text-sm text-muted-foreground">
                        ({totalBreaks})
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {displayBreaks.length > 0 ? (
                    <ul className="space-y-3">
                        {displayBreaks.map((level, i) => (
                            <li key={`${level.pair}-${level.breakTime}`} className="flex justify-between items-center">
                                <div className="flex items-center">
                                    <span className="text-muted-foreground mr-2">{i + 1}.</span>
                                    <div>
                                        <span className="font-medium">{level.pair}</span>
                                        {/* <div className="text-xs text-muted-foreground">
                                            Break: ${formatPrice(level.priceAtBreak)}
                                        </div> */}
                                    </div>
                                </div>
                                <div className="text-right">

                                    <span className="text-emerald-400 font-medium block">
                                        New:  ${formatPrice(level.price)}
                                    </span>

                                    {/* <span className="text-emerald-400 font-medium block">
                                        Vol: ${formatPrice(level.volume24hAtBreak)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Level: ${formatPrice(level.price)}
                                    </span> */}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-muted-foreground text-sm">
                        No resistance breaks detected recently
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function BrokenSupportsCard({ pairs }: BrokenLevelsCardProps) {
    const recentBreaks = pairs
        .filter(pair => pair.brokenLevels)
        .flatMap(pair => (pair.brokenLevels?.brokenSupports || []).map(level => ({
            ...level,
            pair: pair.pair,
            type: 'support' as const,
            currentPrice: parseFloat(pair.currentPrice)
        })));

    const filteredBreaks = recentBreaks
        .filter(level => {
            const timeDiff = Math.floor(Date.now() / 1000) - level.breakTime;
            return timeDiff < 2 * 24 * 60 * 60; // 48 hours
        })
        .sort((a, b) => b.breakTime - a.breakTime);

    const totalBreaks = filteredBreaks.length;
    const displayBreaks = filteredBreaks.slice(0, 10); // Show top 10

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center justify-between">
                    Broken Supports
                    <span className="text-sm text-muted-foreground">
                        ({totalBreaks})
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {displayBreaks.length > 0 ? (
                    <ul className="space-y-3">
                        {displayBreaks.map((level, i) => (
                            <li key={`${level.pair}-${level.breakTime}`} className="flex justify-between items-center">
                                <div className="flex items-center">
                                    <span className="text-muted-foreground mr-2">{i + 1}.</span>
                                    <div>
                                        <span className="font-medium">{level.pair}</span>
                                        {/* <div className="text-xs text-muted-foreground">
                                            Break: ${formatPrice(level.priceAtBreak)}
                                        </div> */}
                                    </div>
                                </div>
                                <div className="text-right">

                                    <span className="text-red-400 font-medium block">
                                        New: ${formatPrice(level.price)}
                                    </span>



                                    {/* <span className="text-red-400 font-medium block">
                                        Vol: ${formatPrice(level.volume24hAtBreak)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Level: ${formatPrice(level.price)}
                                    </span> */}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-muted-foreground text-sm">
                        No support breaks detected recently
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
