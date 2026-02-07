"use client";

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import type { PortfolioPerformancePoint } from '@/lib/portfolio/portfolio-service';
import { cn } from '@/lib/utils';

export type PortfolioChartRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const RANGE_OPTIONS: PortfolioChartRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

export type PortfolioPerformanceChartProps = {
    data: PortfolioPerformancePoint[];
    baseCurrency: string;
    selectedRange: PortfolioChartRange;
    onRangeChange?: (range: PortfolioChartRange) => void;
    loading?: boolean;
    error?: string;
};

const formatCurrency = (value: number, currency: string) => {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(value || 0);
    } catch {
        return `${(value || 0).toFixed(0)} ${currency}`;
    }
};

const formatDateTick = (date: string) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const PortfolioPerformanceChart = ({
    data,
    baseCurrency,
    selectedRange,
    onRangeChange,
    loading = false,
    error = '',
}: PortfolioPerformanceChartProps) => {
    const chartData = useMemo(() => data.map((point) => ({ ...point, value: Number(point.value || 0) })), [data]);

    return (
        <div className="rounded-xl border border-border/80 bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Portfolio Growth</h3>
                    {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
                </div>
                <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
                    {RANGE_OPTIONS.map((range) => {
                        const isActive = selectedRange === range;
                        return (
                            <Button
                                key={range}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    'h-7 rounded-md px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                                    isActive
                                        ? 'bg-primary/20 text-foreground hover:bg-primary/20'
                                        : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                                )}
                                onClick={() => onRangeChange?.(range)}
                                disabled={loading || !onRangeChange}
                            >
                                {range}
                            </Button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-4 h-[300px] overflow-hidden rounded-xl border border-border/70 bg-[#0b121d] p-3">
                {loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading performance...</div>
                ) : chartData.length < 2 ? (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                        Not enough historical points to render growth for this range.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 2, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2a3a" />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                tickFormatter={formatDateTick}
                                tickLine={false}
                                axisLine={{ stroke: '#1f2a3a' }}
                                minTickGap={24}
                            />
                            <YAxis
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                tickLine={false}
                                axisLine={{ stroke: '#1f2a3a' }}
                                width={84}
                                tickFormatter={(value: number) => formatCurrency(value, baseCurrency)}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#0b111a',
                                    borderColor: '#1f2a3a',
                                    borderRadius: '0.5rem',
                                    color: '#d5dee9',
                                }}
                                formatter={(value: number) => formatCurrency(value, baseCurrency)}
                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-US')}
                            />
                            <Line type="monotone" dataKey="value" stroke="#78b9ff" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default PortfolioPerformanceChart;
