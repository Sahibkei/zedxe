"use client";

import { useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { StatementColumn, StatementValueType } from "@/lib/stocks/stockProfileV2.types";
import { formatCurrencyShort, formatNumberShort } from "@/components/stock-profile/formatters";

type ChartSeries = {
    id: string;
    label: string;
    valueType?: StatementValueType;
    valuesByColumnKey: Record<string, number | undefined>;
};

type ChartBuilderProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    columns: StatementColumn[];
    series: ChartSeries[];
    currency?: string;
};

type ChartType = "bar" | "line" | "area" | "scatter";

const COLORS = ["#58a6ff", "#00d395", "#f97316", "#ff6b6b", "#8b949e", "#facc15", "#22c55e", "#60a5fa"];

const chartTypeOptions: Array<{ key: ChartType; label: string }> = [
    { key: "bar", label: "Bar" },
    { key: "line", label: "Line" },
    { key: "area", label: "Area" },
    { key: "scatter", label: "Scatter" },
];

const getOrderedColumns = (columns: StatementColumn[]) => {
    const ttm = columns.find((column) => column.key === "ttm");
    const rest = columns.filter((column) => column.key !== "ttm").slice().reverse();
    return ttm ? [...rest, ttm] : rest;
};

const toNormalizedSeries = (values: Array<number | undefined>) => {
    const base = values.find((value) => typeof value === "number" && Number.isFinite(value) && value !== 0);
    if (typeof base !== "number") return values;
    return values.map((value) => (typeof value === "number" ? (value / base) * 100 : undefined));
};

export default function ChartBuilder({ open, onOpenChange, columns, series, currency = "USD" }: ChartBuilderProps) {
    const [chartType, setChartType] = useState<ChartType>("line");
    const [stacked, setStacked] = useState(false);
    const [normalize, setNormalize] = useState(false);
    const [showLegend, setShowLegend] = useState(true);

    const orderedColumns = useMemo(() => getOrderedColumns(columns), [columns]);

    const chartData = useMemo(() => {
        if (orderedColumns.length === 0 || series.length === 0) return [];

        const transformedSeries = series.map((metric) => {
            const values = orderedColumns.map((column) => metric.valuesByColumnKey[column.key]);
            return {
                ...metric,
                values: normalize ? toNormalizedSeries(values) : values,
            };
        });

        return orderedColumns.map((column, index) => {
            const point: Record<string, string | number | null> = {
                period: column.label,
                xIndex: index,
            };

            transformedSeries.forEach((metric) => {
                const value = metric.values[index];
                point[metric.id] = typeof value === "number" ? value : null;
            });

            return point;
        });
    }, [normalize, orderedColumns, series]);

    const seriesMap = useMemo(() => {
        return Object.fromEntries(series.map((metric) => [metric.id, metric]));
    }, [series]);

    const renderChart = () => {
        if (series.length === 0 || chartData.length === 0) {
            return (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/10 p-6 text-sm text-muted-foreground">
                    Select metrics from the table to chart.
                </div>
            );
        }

        const tooltipFormatter = (value: number, dataKey: string) => {
            if (normalize) {
                return [`${value.toFixed(2)}%`, seriesMap[dataKey]?.label || dataKey];
            }
            return [formatCurrencyShort(value, currency), seriesMap[dataKey]?.label || dataKey];
        };

        const chartCommonProps = {
            data: chartData,
            margin: { top: 10, right: 20, left: 0, bottom: 0 },
        };

        const yAxisFormatter = (value: number) => (normalize ? `${value.toFixed(0)}%` : formatNumberShort(value));

        const legendNode = showLegend ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null;

        if (chartType === "bar") {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart {...chartCommonProps}>
                        <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                        <XAxis dataKey="period" stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={yAxisFormatter} width={80} />
                        <Tooltip
                            formatter={tooltipFormatter}
                            contentStyle={{ background: "#0b111a", border: "1px solid #1c2432", borderRadius: 10 }}
                            labelStyle={{ color: "#c9d1d9" }}
                        />
                        {legendNode}
                        {series.map((metric, index) => (
                            <Bar
                                key={metric.id}
                                dataKey={metric.id}
                                name={metric.label}
                                fill={COLORS[index % COLORS.length]}
                                radius={[4, 4, 0, 0]}
                                stackId={stacked ? "stack" : undefined}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        if (chartType === "area") {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart {...chartCommonProps}>
                        <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                        <XAxis dataKey="period" stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={yAxisFormatter} width={80} />
                        <Tooltip
                            formatter={tooltipFormatter}
                            contentStyle={{ background: "#0b111a", border: "1px solid #1c2432", borderRadius: 10 }}
                            labelStyle={{ color: "#c9d1d9" }}
                        />
                        {legendNode}
                        {series.map((metric, index) => (
                            <Area
                                key={metric.id}
                                type="monotone"
                                dataKey={metric.id}
                                name={metric.label}
                                fill={COLORS[index % COLORS.length]}
                                stroke={COLORS[index % COLORS.length]}
                                fillOpacity={0.22}
                                strokeWidth={2}
                                stackId={stacked ? "stack" : undefined}
                                connectNulls
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            );
        }

        if (chartType === "scatter") {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                        <XAxis
                            dataKey="xIndex"
                            type="number"
                            stroke="#94a3b8"
                            tickLine={false}
                            axisLine={false}
                            domain={[0, Math.max(orderedColumns.length - 1, 0)]}
                            ticks={orderedColumns.map((_, index) => index)}
                            tickFormatter={(value) => orderedColumns[value]?.label || ""}
                        />
                        <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={yAxisFormatter} width={80} />
                        <Tooltip
                            formatter={tooltipFormatter}
                            labelFormatter={(label) => orderedColumns[Number(label)]?.label || ""}
                            contentStyle={{ background: "#0b111a", border: "1px solid #1c2432", borderRadius: 10 }}
                            labelStyle={{ color: "#c9d1d9" }}
                        />
                        {legendNode}
                        {series.map((metric, index) => (
                            <Scatter
                                key={metric.id}
                                data={chartData}
                                dataKey={metric.id}
                                name={metric.label}
                                fill={COLORS[index % COLORS.length]}
                            />
                        ))}
                    </ScatterChart>
                </ResponsiveContainer>
            );
        }

        return (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart {...chartCommonProps}>
                    <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                    <XAxis dataKey="period" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={yAxisFormatter} width={80} />
                    <Tooltip
                        formatter={tooltipFormatter}
                        contentStyle={{ background: "#0b111a", border: "1px solid #1c2432", borderRadius: 10 }}
                        labelStyle={{ color: "#c9d1d9" }}
                    />
                    {legendNode}
                    {series.map((metric, index) => (
                        <Line
                            key={metric.id}
                            type="monotone"
                            dataKey={metric.id}
                            name={metric.label}
                            stroke={COLORS[index % COLORS.length]}
                            dot={false}
                            strokeWidth={2}
                            connectNulls
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[min(1080px,96vw)] max-w-[1080px] border-border/80 bg-[#08101a] p-0 text-foreground">
                <DialogHeader className="border-b border-border/60 px-5 py-4">
                    <DialogTitle className="text-lg">Chart Builder</DialogTitle>
                    <DialogDescription>
                        Build a visual from selected statement metrics. For readability, keep selection under 8 series.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {chartTypeOptions.map((option) => {
                                const active = chartType === option.key;
                                return (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setChartType(option.key)}
                                        className={cn(
                                            "rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
                                            active
                                                ? "bg-primary/20 text-foreground ring-1 ring-primary/40"
                                                : "border border-border/60 text-muted-foreground hover:bg-muted/20"
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            {(chartType === "bar" || chartType === "area") && series.length > 1 ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={cn("h-8 border-border/70 text-xs", stacked && "bg-primary/15")}
                                    onClick={() => setStacked((prev) => !prev)}
                                >
                                    {stacked ? "Stacked: On" : "Stacked: Off"}
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn("h-8 border-border/70 text-xs", normalize && "bg-primary/15")}
                                onClick={() => setNormalize((prev) => !prev)}
                            >
                                {normalize ? "Normalize: On" : "Normalize: Off"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn("h-8 border-border/70 text-xs", showLegend && "bg-primary/15")}
                                onClick={() => setShowLegend((prev) => !prev)}
                            >
                                {showLegend ? "Legend: On" : "Legend: Off"}
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-[#0b111a] p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected metrics ({series.length})</p>
                        {series.length === 0 ? (
                            <p className="mt-2 text-sm text-muted-foreground">Select metrics from the table to chart.</p>
                        ) : (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {series.map((metric, index) => (
                                    <span
                                        key={metric.id}
                                        className="inline-flex items-center rounded-full border border-border/70 px-2 py-0.5 text-xs text-foreground"
                                        style={{ borderColor: COLORS[index % COLORS.length] }}
                                    >
                                        {metric.label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="h-[440px] rounded-xl border border-border/60 bg-[#050b13] p-3">{renderChart()}</div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
