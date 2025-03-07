import React, { useState, useMemo } from 'react';
import { CryptoDetailView } from '@/components/detail-view';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    createColumnHelper,
    flexRender,
    SortingState,
    ColumnFiltersState,
    VisibilityState,
} from '@tanstack/react-table';
import { CryptoPair } from '../types/crypto';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';
import { 
    ChevronUpIcon, 
    ChevronDownIcon, 
    FunnelIcon, 
    ArrowsUpDownIcon, 
    EyeIcon, 
    ChevronLeftIcon, 
    ChevronRightIcon 
} from '@heroicons/react/24/solid';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger, 
    DropdownMenuCheckboxItem, 
    DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

const columnHelper = createColumnHelper<CryptoPair>();

// Helper function to determine cell color based on value
const getValueColor = (value: number | string, type: 'price' | 'rsi' | 'trend' | 'score') => {
    if (type === 'price' || type === 'rsi' || type === 'score') {
        const numValue = typeof value === 'number' ? value : 0;
        if (type === 'price') {
            return numValue > 0 ? "text-emerald-400" : numValue < 0 ? "text-red-400" : "text-gray-400";
        } else if (type === 'rsi') {
            return numValue >= 70 ? "text-red-400" : numValue <= 30 ? "text-emerald-400" : "text-gray-400";
        } else {
            return numValue >= 0.7 ? "text-emerald-400" : numValue <= 0.3 ? "text-red-400" : "text-gray-400";
        }
    } else if (type === 'trend') {
        if (value === 'Strong Uptrend') return "text-emerald-400";
        if (value === 'Strong Downtrend') return "text-red-400";
        if (value === 'Weak Uptrend') return "text-emerald-400/70";
        if (value === 'Weak Downtrend') return "text-red-400/70";
        return "text-gray-400";
    }
    return "";
};

interface CryptoTableProps {
    data: CryptoPair[];
}

export function CryptoTable({ data }: CryptoTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [globalFilter, setGlobalFilter] = useState<string>('');
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);
    const [selectedPair, setSelectedPair] = useState<CryptoPair | null>(null);
    const [detailViewOpen, setDetailViewOpen] = useState<boolean>(false);

    const columns = useMemo(() => [
        columnHelper.accessor('pair', {
            header: 'Pair',
            cell: info => (
                <div className="font-semibold text-primary flex items-center">
                    <div className="w-6 h-6 bg-secondary/40 rounded-full mr-2 flex items-center justify-center overflow-hidden">
                        {info.getValue().split('-')[0].charAt(0)}
                    </div>
                    {info.getValue()}
                </div>
            ),
            filterFn: 'includesString',
        }),
        columnHelper.accessor('currentPrice', {
            header: 'Price (USD)',
            cell: info => {
                const value = parseFloat(info.getValue());
                return (
                    <div className="font-mono">
                        {isNaN(value) ? '-' : `$${parseFloat(value.toFixed(8)).toLocaleString(undefined, { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: value < 0.01 ? 8 : value < 1 ? 6 : 2 
                        })}`}
                    </div>
                );
            },
        }),
        columnHelper.accessor('dailyPriceChange', {
            header: '24h Change',
            cell: info => {
                const value = parseFloat(info.getValue());
                return (
                    <div className={cn(
                        "font-mono",
                        getValueColor(value, 'price')
                    )}>
                        {isNaN(value) ? '-' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`}
                    </div>
                );
            },
            filterFn: (row, id, filterValue) => {
                const value = parseFloat(row.getValue(id));
                if (filterValue === 'positive') return value > 0;
                if (filterValue === 'negative') return value < 0;
                return true;
            }
        }),
        columnHelper.accessor('currentVolumeUSD', {
            header: '24h Volume',
            cell: info => {
                const value = parseFloat(info.getValue());
                return (
                    <div className="font-mono">
                        {isNaN(value) ? '-' : `$${value >= 1000000 
                            ? (value / 1000000).toFixed(1) + 'M' 
                            : value >= 1000 
                                ? (value / 1000).toFixed(1) + 'K' 
                                : value.toLocaleString()}`}
                    </div>
                );
            },
        }),
        columnHelper.accessor('rsi', {
            header: () => (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">RSI</span>
                        </TooltipTrigger>
                        <TooltipContent className="w-64 p-3">
                            <p className="font-semibold">Relative Strength Index</p>
                            <p className="text-xs mt-1">Momentum oscillator measuring the speed and change of price movements. Values over 70 suggest overbought conditions, while values under 30 suggest oversold conditions.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ),
            cell: info => {
                const value = parseFloat(info.getValue());
                return (
                    <div className={cn("font-mono", getValueColor(value, 'rsi'))}>
                        {isNaN(value) ? '-' : value.toFixed(2)}
                    </div>
                );
            },
            filterFn: (row, id, filterValue) => {
                const value = parseFloat(row.getValue(id));
                if (filterValue === 'overbought') return value >= 70;
                if (filterValue === 'oversold') return value <= 30;
                if (filterValue === 'neutral') return value > 30 && value < 70;
                return true;
            }
        }),
        columnHelper.accessor('macdTrend', {
            header: () => (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">MACD Trend</span>
                        </TooltipTrigger>
                        <TooltipContent className="w-64 p-3">
                            <p className="font-semibold">Moving Average Convergence Divergence</p>
                            <p className="text-xs mt-1">Trend-following momentum indicator showing the relationship between two moving averages of a security's price.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ),
            cell: info => {
                const trend = info.getValue() || '-';
                return (
                    <div className={cn(
                        getValueColor(trend as any, 'trend' as any), 
                        "flex items-center gap-1"
                    )}>
                        {trend.includes('Strong Up') && <ChevronUpIcon className="w-4 h-4" />}
                        {trend.includes('Strong Down') && <ChevronDownIcon className="w-4 h-4" />}
                        {trend}
                    </div>
                );
            },
            filterFn: (row, id, filterValue) => {
                const value = row.getValue(id);
                if (filterValue === 'uptrend') return value?.toString().includes('Up') ?? false;
                if (filterValue === 'downtrend') return value?.toString().includes('Down') ?? false;
                if (filterValue === 'neutral') return value === 'Neutral';
                return true;
            }
        }),
        columnHelper.accessor(row => row.pricePositionAnalysis.bbPosition, {
            id: 'pricePosition',
            header: () => (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">BB Position</span>
                        </TooltipTrigger>
                        <TooltipContent className="w-64 p-3">
                            <p className="font-semibold">Bollinger Bands Position</p>
                            <p className="text-xs mt-1">Current price position relative to Bollinger Bands.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ),
            cell: info => (
                <div className="font-medium">
                    {info.getValue()}
                </div>
            ),
        }),
        columnHelper.accessor('bb_width', {
            header: () => (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">BB Width</span>
                        </TooltipTrigger>
                        <TooltipContent className="w-64 p-3">
                            <p className="font-semibold">Bollinger Bands Width</p>
                            <p className="text-xs mt-1">Width of Bollinger Bands as a percentage of the middle band. Higher values indicate higher volatility.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ),
            cell: info => (
                <div className="font-mono">
                    {info.getValue()}%
                </div>
            ),
        }),
        columnHelper.accessor('volatility', {
            header: () => (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">Volatility</span>
                        </TooltipTrigger>
                        <TooltipContent className="w-64 p-3">
                            <p className="font-semibold">Price Volatility</p>
                            <p className="text-xs mt-1">Standard deviation of price returns over the last 14 periods.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ),
            cell: info => {
                const value = parseFloat(info.getValue());
                return (
                    <div className="font-mono">
                        {isNaN(value) ? '-' : `${value.toFixed(2)}%`}
                    </div>
                );
            },
        }),
        columnHelper.accessor('shortTermScore', {
            header: () => (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">Short Term</span>
                        </TooltipTrigger>
                        <TooltipContent className="w-64 p-3">
                            <p className="font-semibold">Short Term Score</p>
                            <p className="text-xs mt-1">Composite score based on short-term technical indicators. Higher values suggest stronger bullish momentum.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ),
            cell: info => {
                const value = parseFloat(info.getValue());
                return (
                    <div className={cn(
                        "font-mono relative h-6 flex items-center",
                        getValueColor(value, 'score')
                    )}>
                        <div className="absolute left-0 top-0 bottom-0 bg-current opacity-20 rounded-sm" style={{ width: `${(value || 0) * 100}%` }}></div>
                        <span className="relative z-10 pl-1">{isNaN(value) ? '-' : value.toFixed(2)}</span>
                    </div>
                );
            },
            filterFn: (row, id, filterValue) => {
                const value = parseFloat(row.getValue(id));
                if (filterValue === 'strong') return value >= 0.7;
                if (filterValue === 'weak') return value <= 0.3;
                if (filterValue === 'neutral') return value > 0.3 && value < 0.7;
                return true;
            }
        }),
        columnHelper.accessor('longTermScore', {
            header: () => (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">Long Term</span>
                        </TooltipTrigger>
                        <TooltipContent className="w-64 p-3">
                            <p className="font-semibold">Long Term Score</p>
                            <p className="text-xs mt-1">Composite score based on long-term technical indicators and price levels.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ),
            cell: info => {
                const value = parseFloat(info.getValue());
                return (
                    <div className={cn(
                        "font-mono relative h-6 flex items-center",
                        getValueColor(value, 'score')
                    )}>
                        <div className="absolute left-0 top-0 bottom-0 bg-current opacity-20 rounded-sm" style={{ width: `${(value || 0) * 100}%` }}></div>
                        <span className="relative z-10 pl-1">{isNaN(value) ? '-' : value.toFixed(2)}</span>
                    </div>
                );
            },
            filterFn: (row, id, filterValue) => {
                const value = parseFloat(row.getValue(id));
                if (filterValue === 'strong') return value >= 0.7;
                if (filterValue === 'weak') return value <= 0.3;
                if (filterValue === 'neutral') return value > 0.3 && value < 0.7;
                return true;
            }
        }),
    ], []);

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        enableMultiSort: true,
    });

    // Set default rows per page
    React.useEffect(() => {
        table.setPageSize(rowsPerPage);
    }, [rowsPerPage, table]);

    const activeFiltersCount = columnFilters.length + (globalFilter ? 1 : 0);

    return (
        <Card className="overflow-hidden">
            <div className="table-header flex flex-col space-y-4 p-6 border-b">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">Crypto Market Scanner</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Real-time analysis of cryptocurrency pairs on Coinbase
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1">
                                    <EyeIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline">Columns</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                {table.getAllColumns().map(column => (
                                    <DropdownMenuCheckboxItem
                                        key={column.id}
                                        className="capitalize"
                                        checked={column.getIsVisible()}
                                        onCheckedChange={(value) =>
                                            column.toggleVisibility(!!value)
                                        }
                                    >
                                        {column.id === 'dailyPriceChange' ? '24h Change' : 
                                         column.id === 'currentVolumeUSD' ? '24h Volume' : 
                                         column.id === 'macdTrend' ? 'MACD Trend' : 
                                         column.id === 'shortTermScore' ? 'Short Term Score' : 
                                         column.id}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1 relative">
                                    <FunnelIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline">Filters</span>
                                    {activeFiltersCount > 0 && (
                                        <Badge className="ml-1 px-1.5 py-0.5 absolute -top-2 -right-2">
                                            {activeFiltersCount}
                                        </Badge>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <div className="p-2">
                                    <p className="text-xs font-medium mb-2">Search</p>
                                    <Input
                                        placeholder="Search all columns..."
                                        value={globalFilter ?? ''}
                                        onChange={(e) => setGlobalFilter(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <DropdownMenuSeparator />
                                <div className="p-2">
                                    <p className="text-xs font-medium mb-2">24h Change</p>
                                    <div className="flex flex-col gap-1">
                                        <Button 
                                            size="sm" 
                                            variant={table.getColumn('dailyPriceChange')?.getFilterValue() === 'positive' ? 'default' : 'outline'} 
                                            className="h-7 text-xs justify-start"
                                            onClick={() => {
                                                const col = table.getColumn('dailyPriceChange');
                                                col?.setFilterValue(col.getFilterValue() === 'positive' ? undefined : 'positive');
                                            }}
                                        >
                                            Positive
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant={table.getColumn('dailyPriceChange')?.getFilterValue() === 'negative' ? 'default' : 'outline'} 
                                            className="h-7 text-xs justify-start"
                                            onClick={() => {
                                                const col = table.getColumn('dailyPriceChange');
                                                col?.setFilterValue(col.getFilterValue() === 'negative' ? undefined : 'negative');
                                            }}
                                        >
                                            Negative
                                        </Button>
                                    </div>
                                </div>
                                <DropdownMenuSeparator />
                                <div className="p-2">
                                    <p className="text-xs font-medium mb-2">RSI</p>
                                    <div className="flex flex-col gap-1">
                                        <Button 
                                            size="sm" 
                                            variant={table.getColumn('rsi')?.getFilterValue() === 'overbought' ? 'default' : 'outline'} 
                                            className="h-7 text-xs justify-start"
                                            onClick={() => {
                                                const col = table.getColumn('rsi');
                                                col?.setFilterValue(col.getFilterValue() === 'overbought' ? undefined : 'overbought');
                                            }}
                                        >
                                            Overbought (&gt;70)
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant={table.getColumn('rsi')?.getFilterValue() === 'oversold' ? 'default' : 'outline'} 
                                            className="h-7 text-xs justify-start"
                                            onClick={() => {
                                                const col = table.getColumn('rsi');
                                                col?.setFilterValue(col.getFilterValue() === 'oversold' ? undefined : 'oversold');
                                            }}
                                        >
                                            Oversold (&lt;30)
                                        </Button>
                                    </div>
                                </div>
                                <DropdownMenuSeparator />
                                <div className="p-2">
                                    <p className="text-xs font-medium mb-2">MACD Trend</p>
                                    <div className="flex flex-col gap-1">
                                        <Button 
                                            size="sm" 
                                            variant={table.getColumn('macdTrend')?.getFilterValue() === 'uptrend' ? 'default' : 'outline'} 
                                            className="h-7 text-xs justify-start"
                                            onClick={() => {
                                                const col = table.getColumn('macdTrend');
                                                col?.setFilterValue(col.getFilterValue() === 'uptrend' ? undefined : 'uptrend');
                                            }}
                                        >
                                            Uptrend
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant={table.getColumn('macdTrend')?.getFilterValue() === 'downtrend' ? 'default' : 'outline'} 
                                            className="h-7 text-xs justify-start"
                                            onClick={() => {
                                                const col = table.getColumn('macdTrend');
                                                col?.setFilterValue(col.getFilterValue() === 'downtrend' ? undefined : 'downtrend');
                                            }}
                                        >
                                            Downtrend
                                        </Button>
                                    </div>
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    className="text-xs justify-center font-medium"
                                    onClick={() => {
                                        setColumnFilters([]);
                                        setGlobalFilter('');
                                    }}
                                >
                                    Reset All Filters
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1">
                                    <ArrowsUpDownIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline">Sort</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                {table.getAllColumns()
                                    .filter(column => column.getCanSort())
                                    .map(column => (
                                        <DropdownMenuItem
                                            key={column.id}
                                            onClick={() => column.toggleSorting(false)}
                                            className="flex justify-between items-center"
                                        >
                                            <span className="capitalize">
                                                {column.id === 'dailyPriceChange' ? '24h Change' : 
                                                 column.id === 'currentVolumeUSD' ? '24h Volume' : 
                                                 column.id === 'macdTrend' ? 'MACD Trend' : 
                                                 column.id === 'shortTermScore' ? 'Short Term Score' : 
                                                 column.id}
                                            </span>
                                            {column.getIsSorted() === 'asc' && <ChevronUpIcon className="w-4 h-4" />}
                                            {column.getIsSorted() === 'desc' && <ChevronDownIcon className="w-4 h-4" />}
                                        </DropdownMenuItem>
                                    ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    className="text-xs justify-center font-medium"
                                    onClick={() => setSorting([])}
                                >
                                    Reset Sorting
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                {activeFiltersCount > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {table.getState().columnFilters.map(filter => (
                            <Badge key={filter.id} variant="secondary" className="px-2 py-1 gap-1">
                                <span className="capitalize">{filter.id === 'dailyPriceChange' ? '24h Change' : filter.id}</span>: {filter.value as string}
                                <button 
                                    className="ml-1 hover:text-destructive" 
                                    onClick={() => {
                                        const col = table.getColumn(filter.id);
                                        col?.setFilterValue(undefined);
                                    }}
                                >
                                    ×
                                </button>
                            </Badge>
                        ))}
                        {globalFilter && (
                            <Badge variant="secondary" className="px-2 py-1 gap-1">
                                Search: {globalFilter}
                                <button 
                                    className="ml-1 hover:text-destructive" 
                                    onClick={() => setGlobalFilter('')}
                                >
                                    ×
                                </button>
                            </Badge>
                        )}
                    </div>
                )}
            </div>
            
            <div className="overflow-x-auto">
                <table className="crypto-table">
                    <thead>
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th
                                        key={header.id}
                                        onClick={header.column.getToggleSortingHandler()}
                                        className={cn(
                                            header.column.getCanSort() ? "cursor-pointer select-none" : "",
                                            "group hover:bg-secondary/70 transition-colors"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-1 px-6 py-4 text-left text-xs font-semibold text-primary uppercase tracking-wider">
                                            <div className="flex items-center">
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                            </div>
                                            <div className="flex items-center opacity-60 group-hover:opacity-100">
                                                {{
                                                    asc: <ChevronUpIcon className="w-4 h-4" />,
                                                    desc: <ChevronDownIcon className="w-4 h-4" />,
                                                }[header.column.getIsSorted() as string] ?? 
                                                (header.column.getCanSort() ? <ArrowsUpDownIcon className="w-4 h-4 opacity-0 group-hover:opacity-70" /> : null)}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.length > 0 ? (
                            table.getRowModel().rows.map(row => (
                            <tr
                                key={row.id}
                                    className="group cursor-pointer"
                                    onClick={() => {
                                        setSelectedPair(row.original);
                                        setDetailViewOpen(true);
                                    }}
                            >
                                {row.getVisibleCells().map(cell => (
                                    <td
                                        key={cell.id}
                                            className="px-6 py-4 text-sm whitespace-nowrap border-b border-border/50 group-hover:bg-accent/30 transition-colors"
                                    >
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                        )}
                                    </td>
                                ))}
                            </tr>
                            ))
                        ) : (
                            <tr>
                                <td 
                                    colSpan={table.getVisibleLeafColumns().length}
                                    className="px-6 py-12 text-center text-muted-foreground"
                                >
                                    No results found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="table-footer flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Rows per page:</span>
                    <select
                        value={rowsPerPage}
                        onChange={e => setRowsPerPage(Number(e.target.value))}
                        className="bg-secondary text-primary rounded px-2 py-1 border border-border"
                    >
                        {[5, 10, 20, 50, 100].map(pageSize => (
                            <option key={pageSize} value={pageSize}>
                                {pageSize}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">
                        Page {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount()}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="h-8 w-8 p-0"
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="h-8 w-8 p-0"
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                    Showing {table.getFilteredRowModel().rows.length} entries
                </div>
            </div>
            
            {/* Detail View Dialog */}
            <CryptoDetailView
                pair={selectedPair}
                isOpen={detailViewOpen}
                onClose={() => setDetailViewOpen(false)}
            />
        </Card>
    );
}