"use client";

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';

import DarkTooltip from '@/components/portfolio/RechartsTooltip';
import { Button } from '@/components/ui/button';
import type { PortfolioPerformancePoint } from '@/lib/portfolio/portfolio-service';
import { cn } from '@/lib/utils';

export type PortfolioChartRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type PortfolioPerformanceChartPoint = PortfolioPerformancePoint & {
    costBasis?: number;
};

const RANGE_OPTIONS: PortfolioChartRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];
const TINY_RANGE_RATIO = 0.005; // 0.5%
const MIN_PADDING_RATIO = 0.01; // 1%

export type PortfolioPerformanceChartProps = {
    data: PortfolioPerformanceChartPoint[];
    baseCurrency: string;
    selectedRange: PortfolioChartRange;
    onRangeChange?: (range: PortfolioChartRange) => void;
    loading?: boolean;
    error?: string;
};

function parseDateOnlyLocal(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return new Date(value);
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
}

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
    const parsed = parseDateOnlyLocal(date);
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
    const chartData = useMemo(
        () =>
            data.map((point) => ({
                ...point,
                value: Number.isFinite(point.value) ? point.value : 0,
                costBasis:
                    typeof point.costBasis === 'number' && Number.isFinite(point.costBasis)
                        ? point.costBasis
                        : undefined,
            })),
        [data]
    );

    const hasCostBasis = useMemo(
        () => chartData.some((point) => typeof point.costBasis === 'number' && Number.isFinite(point.costBasis)),
        [chartData]
    );

    const yDomain = useMemo<[number, number]>(() => {
        const values = chartData.flatMap((point) => {
            const bucket: number[] = [];
            if (Number.isFinite(point.value)) bucket.push(point.value);
            if (typeof point.costBasis === 'number' && Number.isFinite(point.costBasis)) bucket.push(point.costBasis);
            return bucket;
        });

        if (values.length === 0) return [0, 1];

        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const span = maxValue - minValue;
        const absMax = Math.max(Math.abs(maxValue), Math.abs(minValue), 1);

        const tinyRangePadding = Math.max(absMax * MIN_PADDING_RATIO, 1e-3);
        const dynamicPadding = Math.max(span * 0.12, absMax * 0.002);
        const padding = span <= absMax * TINY_RANGE_RATIO ? Math.max(tinyRangePadding, dynamicPadding) : dynamicPadding;

        const lower = minValue - padding;
        const upper = maxValue + padding;

        if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower === upper) {
            return [minValue - tinyRangePadding, maxValue + tinyRangePadding];
        }

        return [lower, upper];
    }, [chartData]);

    const showNotEnoughHistory = !loading && !error && chartData.length < 2;

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
                ) : showNotEnoughHistory ? (
                    <div className="flex h-full items-center justify-center">
                        <div className="rounded-lg border border-dashed border-border/60 bg-muted/15 px-6 py-5 text-center">
                            <p className="text-sm font-semibold text-foreground">Not enough history yet</p>
                            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                                We&apos;ll show performance once we have daily history for this range.
                            </p>
                        </div>
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
                                domain={yDomain}
                                tickFormatter={(value: number) => formatCurrency(value, baseCurrency)}
                            />
                            <Tooltip
                                content={
                                    <DarkTooltip
                                        formatLabel={(label) => {
                                            const parsed = parseDateOnlyLocal(String(label ?? ''));
                                            return Number.isNaN(parsed.getTime())
                                                ? String(label ?? '')
                                                : parsed.toLocaleDateString('en-US');
                                        }}
                                        formatValue={(value: ValueType) => {
                                            const numericValue = typeof value === 'number' ? value : Number(value);
                                            return Number.isFinite(numericValue) ? formatCurrency(numericValue, baseCurrency) : 'N/A';
                                        }}
                                    />
                                }
                                wrapperStyle={{ outline: 'none' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
                                name="Portfolio Value"
                                stroke="#78b9ff"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 3 }}
                            />
                            {hasCostBasis ? (
                                <Line
                                    type="monotone"
                                    dataKey="costBasis"
                                    name="Cost Basis"
                                    stroke="#94a3b8"
                                    strokeDasharray="5 4"
                                    strokeWidth={1.5}
                                    dot={false}
                                    activeDot={{ r: 2 }}
                                />
                            ) : null}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default PortfolioPerformanceChart;
