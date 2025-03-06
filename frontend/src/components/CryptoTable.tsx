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
import { CryptoPair, INDICATOR_DESCRIPTIONS } from '../types/crypto';
import { Card, Title, Text } from '@tremor/react';

const columnHelper = createColumnHelper<CryptoPair>();

const columns = [
    columnHelper.accessor('pair', {
        header: 'Pair',
        cell: info => (
            <div className="font-semibold text-blue-600">
                {info.getValue()}
            </div>
        ),
    }),
    columnHelper.accessor('currentPrice', {
        header: 'Price (USD)',
        cell: info => (
            <div className="font-mono">
                ${parseFloat(info.getValue()).toLocaleString()}
            </div>
        ),
    }),
    columnHelper.accessor('dailyPriceChange', {
        header: '24h Change',
        cell: info => {
            const value = parseFloat(info.getValue());
            return (
                <div className={`font-mono ${value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {value >= 0 ? '+' : ''}{value.toFixed(2)}%
                </div>
            );
        },
    }),
    columnHelper.accessor('currentVolumeUSD', {
        header: '24h Volume (USD)',
        cell: info => (
            <div className="font-mono">
                ${parseFloat(info.getValue()).toLocaleString()}
            </div>
        ),
    }),
    columnHelper.accessor('rsi', {
        header: 'RSI',
        cell: info => {
            const value = parseFloat(info.getValue());
            let color = 'text-gray-600';
            if (value >= 70) color = 'text-red-600';
            if (value <= 30) color = 'text-green-600';
            return (
                <div className={`font-mono ${color}`}>
                    {value.toFixed(2)}
                </div>
            );
        },
    }),
    columnHelper.accessor('macdTrend', {
        header: 'MACD Trend',
        cell: info => {
            const trend = info.getValue() || 'Neutral';
            let color = 'text-gray-600';
            if (trend?.includes('Strong Up')) color = 'text-green-600';
            if (trend?.includes('Strong Down')) color = 'text-red-600';
            return (
                <div className={`${color}`}>
                    {trend}
                </div>
            );
        },
    }),
    columnHelper.accessor('shortTermScore', {
        header: 'Short Term Score',
        cell: info => {
            const value = parseFloat(info.getValue());
            let color = 'text-gray-600';
            if (value >= 0.7) color = 'text-green-600';
            if (value <= 0.3) color = 'text-red-600';
            return (
                <div className={`font-mono ${color}`}>
                    {value.toFixed(2)}
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
        <Card className="mt-4">
            <Title>Crypto Market Scanner</Title>
            <Text>Real-time analysis of cryptocurrency pairs on Coinbase</Text>
            
            <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th
                                        key={header.id}
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                        {{
                                            asc: ' 🔼',
                                            desc: ' 🔽',
                                        }[header.column.getIsSorted() as string] ?? null}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {table.getRowModel().rows.map(row => (
                            <tr
                                key={row.id}
                                className="hover:bg-gray-50 transition-colors"
                            >
                                {row.getVisibleCells().map(cell => (
                                    <td
                                        key={cell.id}
                                        className="px-6 py-4 whitespace-nowrap"
                                    >
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
        </Card>
    );
}