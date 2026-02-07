"use client";

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';

import DarkTooltip from '@/components/portfolio/RechartsTooltip';
import { Button } from '@/components/ui/button';
import type { PortfolioPerformancePoint } from '@/lib/portfolio/portfolio-service';
import { cn } from '@/lib/utils';

export type PortfolioChartRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const RANGE_OPTIONS: PortfolioChartRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];
const TINY_RANGE_RATIO = 0.005; // 0.5%
const MIN_PADDING_RATIO = 0.01; // 1%
const NEAR_FLAT_RATIO = 0.0005; // 0.05%

type PortfolioChartPoint = PortfolioPerformancePoint & {
    costBasis?: number;
};

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
    const chartData = useMemo(
        () =>
            data.map((point) => {
                const withOptionalCostBasis = point as PortfolioChartPoint;
                const normalizedCostBasis =
                    typeof withOptionalCostBasis.costBasis === 'number' && Number.isFinite(withOptionalCostBasis.costBasis)
                        ? withOptionalCostBasis.costBasis
                        : undefined;

                return {
                    ...point,
                    value: Number(point.value || 0),
                    costBasis: normalizedCostBasis,
                };
            }),
        [data]
    );

    const hasCostBasis = useMemo(
        () => chartData.some((point) => typeof point.costBasis === 'number' && Number.isFinite(point.costBasis)),
        [chartData]
    );

    const chartStats = useMemo(() => {
        const plottedValues = chartData.flatMap((point) => {
            const values: number[] = [];
            if (Number.isFinite(point.value)) {
                values.push(point.value);
            }
            if (typeof point.costBasis === 'number' && Number.isFinite(point.costBasis)) {
                values.push(point.costBasis);
            }
            return values;
        });

        if (chartData.length < 2 || plottedValues.length < 2) {
            return {
                isNearFlat: true,
                yDomain: [0, 1] as [number, number],
            };
        }

        const minValue = Math.min(...plottedValues);
        const maxValue = Math.max(...plottedValues);
        const span = maxValue - minValue;
        const absMax = Math.max(Math.abs(maxValue), Math.abs(minValue), 1);

        const isNearFlat = span <= Math.max(absMax * NEAR_FLAT_RATIO, 1e-8);
        const isTinyRange = span <= absMax * TINY_RANGE_RATIO;
        const padding = isTinyRange
            ? Math.max(absMax * MIN_PADDING_RATIO, span * 0.2, 1e-3)
            : Math.max(span * 0.12, absMax * 0.002);

        return {
            isNearFlat,
            yDomain: [minValue - padding, maxValue + padding] as [number, number],
        };
    }, [chartData]);

    const showHistoryFallback = chartData.length < 2 || chartStats.isNearFlat;

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
                ) : showHistoryFallback ? (
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
                                domain={chartStats.yDomain}
                                tickFormatter={(value: number) => formatCurrency(value, baseCurrency)}
                            />
                            <Tooltip
                                content={
                                    <DarkTooltip
                                        formatLabel={(label) => {
                                            const date = new Date(String(label));
                                            return Number.isNaN(date.getTime()) ? String(label ?? '') : date.toLocaleDateString('en-US');
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
