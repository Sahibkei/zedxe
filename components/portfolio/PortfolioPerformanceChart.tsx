"use client";

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import type { PortfolioPerformancePoint, PortfolioPerformanceRange } from '@/lib/portfolio/portfolio-service';

const RANGE_OPTIONS: PortfolioPerformanceRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y', 'YTD', 'MAX'];

export type PortfolioPerformanceChartProps = {
    data: PortfolioPerformancePoint[];
    baseCurrency: string;
    selectedRange: PortfolioPerformanceRange;
    onRangeChange?: (range: PortfolioPerformanceRange) => void;
    loading?: boolean;
    error?: string;
};

const formatCurrency = (value: number, currency: string) => {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
        }).format(value || 0);
    } catch {
        return `${(value || 0).toFixed(2)} ${currency}`;
    }
};

const PortfolioPerformanceChart = ({
    data,
    baseCurrency,
    selectedRange,
    onRangeChange,
    loading = false,
    error = '',
}: PortfolioPerformanceChartProps) => {
    const chartData = useMemo(
        () => data.map((p) => ({ ...p, value: Number(p.portfolioValue ?? p.value ?? 0) })),
        [data]
    );

    const { minValue, maxValue } = useMemo(() => {
        if (!data || data.length === 0) {
            return { minValue: 0, maxValue: 0 };
        }

        const values = data
            .map((p) => Number(p.portfolioValue ?? p.value ?? 0))
            .filter((v) => Number.isFinite(v));

        if (values.length === 0) {
            return { minValue: 0, maxValue: 0 };
        }

        const min = Math.min(...values);
        const max = Math.max(...values);

        if (process.env.NODE_ENV !== 'production') {
            // Log only first few points for debugging
            // eslint-disable-next-line no-console
            console.log('[PortfolioPerformanceChart] sample data', data.slice(0, 10));
            // eslint-disable-next-line no-console
            console.log('[PortfolioPerformanceChart] min/max', { min, max });
        }

        return { minValue: min, maxValue: max };
    }, [data]);

    const yDomain = useMemo(() => {
        if (minValue === maxValue) {
            const padding = minValue === 0 ? 1 : Math.abs(minValue) * 0.01 || 1;
            return [minValue - padding, maxValue + padding];
        }

        return [minValue, maxValue];
    }, [maxValue, minValue]);

    return (
        <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-400">Performance</p>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {RANGE_OPTIONS.map((range) => {
                        const isActive = selectedRange === range;
                        return (
                            <Button
                                key={range}
                                size="sm"
                                variant={isActive ? 'default' : 'outline'}
                                className={
                                    isActive
                                        ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                                        : 'border-gray-700 text-gray-200 hover:bg-gray-800'
                                }
                                onClick={() => onRangeChange?.(range)}
                                disabled={loading || !onRangeChange}
                            >
                                {range}
                            </Button>
                        );
                    })}
                </div>
            </div>

            <div className="h-72 w-full rounded-lg border border-gray-800 bg-gray-900/60 p-4">
                {loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading performance...</div>
                ) : chartData.length < 2 ? (
                    <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
                        Not enough data to render a chart yet
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: '#1f2937' }}
                            />
                            <YAxis
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: '#1f2937' }}
                                tickFormatter={(value: number) => formatCurrency(value, baseCurrency)}
                                domain={yDomain}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0b1224', borderColor: '#1f2937', color: '#e5e7eb' }}
                                formatter={(value: number) => formatCurrency(value, baseCurrency)}
                                labelFormatter={(label) => label}
                            />
                            <Line type="monotone" dataKey="value" stroke="#facc15" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default PortfolioPerformanceChart;
