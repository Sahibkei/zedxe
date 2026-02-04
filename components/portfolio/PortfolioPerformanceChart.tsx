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
    const chartData = useMemo(() => data.map((p) => ({ ...p, value: Number(p.value || 0) })), [data]);

    return (
        <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-slate-400">Performance</p>
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
                                        ? 'bg-slate-100 text-slate-900 hover:bg-white'
                                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
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

            <div className="h-72 w-full rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                {loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading performance...</div>
                ) : chartData.length < 2 ? (
                    <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
                        Not enough data to render a chart yet
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
                            />
                            <YAxis
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
                                tickFormatter={(value: number) => formatCurrency(value, baseCurrency)}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#0b1220',
                                    borderColor: 'rgba(255, 255, 255, 0.1)',
                                    color: '#e2e8f0',
                                }}
                                formatter={(value: number) => formatCurrency(value, baseCurrency)}
                                labelFormatter={(label) => label}
                            />
                            <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default PortfolioPerformanceChart;
