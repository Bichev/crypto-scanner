import React, { useState } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    createColumnHelper,
    flexRender,
    SortingState,
} from '@tanstack/react-table';
import { CryptoPair } from '../types/crypto';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

const columnHelper = createColumnHelper<CryptoPair>();

const columns = [
    columnHelper.accessor('pair', {
        header: 'Pair',
        cell: info => (
            <div className="font-semibold text-primary">
                {info.getValue()}
            </div>
        ),
    }),
    columnHelper.accessor('currentPrice', {
        header: 'Price (USD)',
        cell: info => {
            const value = parseFloat(info.getValue());
            return (
                <div className="font-mono">
                    {isNaN(value) ? '-' : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`}
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
                    value > 0 ? "crypto-value-up" : value < 0 ? "crypto-value-down" : "crypto-value-neutral"
                )}>
                    {isNaN(value) ? '-' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`}
                </div>
            );
        },
    }),
    columnHelper.accessor('currentVolumeUSD', {
        header: '24h Volume (USD)',
        cell: info => {
            const value = parseFloat(info.getValue());
            return (
                <div className="font-mono">
                    {isNaN(value) ? '-' : `$${value.toLocaleString()}`}
                </div>
            );
        },
    }),
    columnHelper.accessor('rsi', {
        header: 'RSI',
        cell: info => {
            const value = parseFloat(info.getValue());
            let colorClass = 'crypto-value-neutral';
            if (!isNaN(value)) {
                if (value >= 70) colorClass = 'crypto-value-down';
                if (value <= 30) colorClass = 'crypto-value-up';
            }
            return (
                <div className={cn("font-mono", colorClass)}>
                    {isNaN(value) ? '-' : value.toFixed(2)}
                </div>
            );
        },
    }),
    columnHelper.accessor('macdTrend', {
        header: 'MACD Trend',
        cell: info => {
            const trend = info.getValue() || '-';
            let colorClass = 'crypto-value-neutral';
            if (trend.includes('Strong Up')) colorClass = 'crypto-value-up';
            if (trend.includes('Strong Down')) colorClass = 'crypto-value-down';
            if (trend.includes('Weak Up')) colorClass = 'crypto-value-up/70';
            if (trend.includes('Weak Down')) colorClass = 'crypto-value-down/70';
            return (
                <div className={colorClass}>
                    {trend}
                </div>
            );
        },
    }),
    columnHelper.accessor('shortTermScore', {
        header: 'Short Term Score',
        cell: info => {
            const value = parseFloat(info.getValue());
            let colorClass = 'crypto-value-neutral';
            if (!isNaN(value)) {
                if (value >= 0.7) colorClass = 'crypto-value-up';
                if (value <= 0.3) colorClass = 'crypto-value-down';
            }
            return (
                <div className={cn("font-mono", colorClass)}>
                    {isNaN(value) ? '-' : value.toFixed(2)}
                </div>
            );
        },
    }),
];

interface CryptoTableProps {
    data: CryptoPair[];
}

export function CryptoTable({ data }: CryptoTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    return (
        <Card className="overflow-hidden">
            <div className="table-header">
                <div>
                    <h2 className="text-xl font-semibold text-foreground">Crypto Market Scanner</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Real-time analysis of cryptocurrency pairs on Coinbase
                    </p>
                </div>
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
                                    >
                                        <button className="sort-button">
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                            <span className="text-primary/50">
                                                {{
                                                    asc: <ChevronUpIcon className="w-4 h-4" />,
                                                    desc: <ChevronDownIcon className="w-4 h-4" />,
                                                }[header.column.getIsSorted() as string] ?? null}
                                            </span>
                                        </button>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map(row => (
                            <tr key={row.id}>
                                {row.getVisibleCells().map(cell => (
                                    <td key={cell.id}>
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext()
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="table-footer">
                <span className="text-sm text-muted-foreground">
                    Showing {table.getRowModel().rows.length} pairs
                </span>
                <button
                    onClick={() => table.resetSorting()}
                    className="reset-button"
                >
                    Reset Sorting
                </button>
            </div>
        </Card>
    );
}