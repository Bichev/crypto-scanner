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
    // Get recent breaks (last 24h)
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
        ])
        .filter(level => (Date.now() - level.breakTime) < 24 * 60 * 60 * 1000)
        .sort((a, b) => b.breakTime - a.breakTime);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    Broken Levels (24h)
                    <div className="text-xs font-normal text-muted-foreground">
                        Significant support/resistance breaks
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Broken Resistances */}
                    <div>
                        <h3 className="text-sm font-medium mb-2 text-emerald-400">
                            Broken Resistances
                        </h3>
                        <div className="space-y-2">
                            {recentBreaks
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
                                        <div className="text-sm text-emerald-400">
                                            +{((level.currentPrice - level.price) / level.price * 100).toFixed(2)}%
                                        </div>
                                    </div>
                                ))}
                            {recentBreaks.filter(level => level.type === 'resistance').length === 0 && (
                                <div className="text-sm text-muted-foreground text-center py-2">
                                    No resistance breaks detected in the last 24h
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Broken Supports */}
                    <div>
                        <h3 className="text-sm font-medium mb-2 text-red-400">
                            Broken Supports
                        </h3>
                        <div className="space-y-2">
                            {recentBreaks
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
                                        <div className="text-sm text-red-400">
                                            {((level.currentPrice - level.price) / level.price * 100).toFixed(2)}%
                                        </div>
                                    </div>
                                ))}
                            {recentBreaks.filter(level => level.type === 'support').length === 0 && (
                                <div className="text-sm text-muted-foreground text-center py-2">
                                    No support breaks detected in the last 24h
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
