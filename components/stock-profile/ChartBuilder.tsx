"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
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
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    columns: StatementColumn[];
    series: ChartSeries[];
    currency?: string;
    symbol: string;
    statementLabel: string;
    periodLabel: string;
    title: string;
    onTitleChange: (title: string) => void;
    seriesColors: Record<string, string>;
    onSeriesColorChange: (seriesId: string, color: string) => void;
};

type ChartType = "bar" | "line" | "area" | "scatter";
type BarOrientation = "horizontal" | "vertical";

const DEFAULT_COLORS = ["#78b9ff", "#10b981", "#f97316", "#f87171", "#a78bfa", "#facc15", "#22c55e", "#94a3b8"];

const chartTypeOptions: Array<{ key: ChartType; label: string }> = [
    { key: "bar", label: "Bar" },
    { key: "line", label: "Line" },
    { key: "area", label: "Area" },
    { key: "scatter", label: "Scatter" },
];

const toNormalizedSeries = (values: Array<number | undefined>) => {
    const base = values.find((value) => typeof value === "number" && Number.isFinite(value) && value !== 0);
    if (typeof base !== "number") return values;
    return values.map((value) => (typeof value === "number" ? (value / base) * 100 : undefined));
};

const sanitizeFilePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function ChartBuilder({
    columns,
    series,
    currency = "USD",
    symbol,
    statementLabel,
    periodLabel,
    title,
    onTitleChange,
    seriesColors,
    onSeriesColorChange,
}: ChartBuilderProps) {
    const [chartType, setChartType] = useState<ChartType>("bar");
    const [stacked, setStacked] = useState(false);
    const [normalize, setNormalize] = useState(false);
    const [showLegend, setShowLegend] = useState(true);
    const [barOrientation, setBarOrientation] = useState<BarOrientation>("vertical");
    const [exporting, setExporting] = useState(false);
    const [exportedAt, setExportedAt] = useState<string | null>(null);

    const exportRef = useRef<HTMLDivElement | null>(null);

    const orderedColumns = useMemo(() => [...columns], [columns]);

    const resolvedSeriesColors = useMemo(() => {
        return Object.fromEntries(
            series.map((metric, index) => [metric.id, seriesColors[metric.id] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]])
        );
    }, [series, seriesColors]);

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

    const handleExport = async () => {
        if (!exportRef.current || series.length === 0) return;

        setExporting(true);
        try {
            const exportTimestamp = new Date();
            setExportedAt(exportTimestamp.toLocaleString("en-US", { hour12: false }));
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

            const dataUrl = await toPng(exportRef.current, {
                pixelRatio: 2,
                cacheBust: true,
                backgroundColor: "#0b121d",
            });

            const statementKey = sanitizeFilePart(statementLabel);
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = `zedxe_${sanitizeFilePart(symbol)}_${statementKey}_${chartType}.png`;
            link.click();
        } catch (error) {
            console.error("Chart export failed", error);
        } finally {
            setExporting(false);
        }
    };

    const renderChart = () => {
        if (series.length === 0 || chartData.length === 0) {
            return (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/10 p-6 text-sm text-muted-foreground">
                    Select metrics from the table to chart.
                </div>
            );
        }

        const tooltipFormatter = (value: number | string, dataKey: string) => {
            const numericValue = typeof value === "number" ? value : Number(value);
            if (!Number.isFinite(numericValue)) {
                return ["--", seriesMap[dataKey]?.label || dataKey];
            }
            if (normalize) {
                return [`${numericValue.toFixed(2)}%`, seriesMap[dataKey]?.label || dataKey];
            }
            return [formatCurrencyShort(numericValue, currency), seriesMap[dataKey]?.label || dataKey];
        };

        const chartCommonProps = {
            data: chartData,
            margin: { top: 10, right: 20, left: 0, bottom: 0 },
        };

        const yAxisFormatter = (value: number) => (normalize ? `${value.toFixed(0)}%` : formatNumberShort(value));
        const xAxisTick = { fill: "#94a3b8", fontSize: 11 };
        const yAxisTick = { fill: "#94a3b8", fontSize: 11 };
        const legendNode = showLegend ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null;

        if (chartType === "bar") {
            const isHorizontal = barOrientation === "horizontal";
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart {...chartCommonProps} layout={isHorizontal ? "vertical" : "horizontal"}>
                        <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                        {isHorizontal ? (
                            <>
                                <XAxis
                                    type="number"
                                    stroke="#94a3b8"
                                    tick={xAxisTick}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={yAxisFormatter}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="period"
                                    stroke="#94a3b8"
                                    tick={yAxisTick}
                                    tickLine={false}
                                    axisLine={false}
                                    width={88}
                                />
                            </>
                        ) : (
                            <>
                                <XAxis dataKey="period" stroke="#94a3b8" tick={xAxisTick} tickLine={false} axisLine={false} />
                                <YAxis
                                    stroke="#94a3b8"
                                    tick={yAxisTick}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={yAxisFormatter}
                                    width={80}
                                />
                            </>
                        )}
                        <Tooltip
                            formatter={tooltipFormatter}
                            contentStyle={{ background: "#0b111a", border: "1px solid #1f2a3a", borderRadius: 10 }}
                            labelStyle={{ color: "#d5dee9" }}
                        />
                        {legendNode}
                        {series.map((metric) => (
                            <Bar
                                key={metric.id}
                                dataKey={metric.id}
                                name={metric.label}
                                fill={resolvedSeriesColors[metric.id]}
                                radius={[4, 4, 4, 4]}
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
                        <XAxis dataKey="period" stroke="#94a3b8" tick={xAxisTick} tickLine={false} axisLine={false} />
                        <YAxis
                            stroke="#94a3b8"
                            tick={yAxisTick}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={yAxisFormatter}
                            width={80}
                        />
                        <Tooltip
                            formatter={tooltipFormatter}
                            contentStyle={{ background: "#0b111a", border: "1px solid #1f2a3a", borderRadius: 10 }}
                            labelStyle={{ color: "#d5dee9" }}
                        />
                        {legendNode}
                        {series.map((metric) => (
                            <Area
                                key={metric.id}
                                type="monotone"
                                dataKey={metric.id}
                                name={metric.label}
                                fill={resolvedSeriesColors[metric.id]}
                                stroke={resolvedSeriesColors[metric.id]}
                                fillOpacity={0.2}
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
                            tick={xAxisTick}
                            tickLine={false}
                            axisLine={false}
                            domain={[0, Math.max(orderedColumns.length - 1, 0)]}
                            ticks={orderedColumns.map((_, index) => index)}
                            tickFormatter={(value) => orderedColumns[value]?.label || ""}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            tick={yAxisTick}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={yAxisFormatter}
                            width={80}
                        />
                        <Tooltip
                            formatter={tooltipFormatter}
                            labelFormatter={(label) => orderedColumns[Number(label)]?.label || ""}
                            contentStyle={{ background: "#0b111a", border: "1px solid #1f2a3a", borderRadius: 10 }}
                            labelStyle={{ color: "#d5dee9" }}
                        />
                        {legendNode}
                        {series.map((metric) => (
                            <Scatter
                                key={metric.id}
                                data={chartData}
                                dataKey={metric.id}
                                name={metric.label}
                                fill={resolvedSeriesColors[metric.id]}
                                stroke={resolvedSeriesColors[metric.id]}
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
                    <XAxis dataKey="period" stroke="#94a3b8" tick={xAxisTick} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tick={yAxisTick} tickLine={false} axisLine={false} tickFormatter={yAxisFormatter} width={80} />
                    <Tooltip
                        formatter={tooltipFormatter}
                        contentStyle={{ background: "#0b111a", border: "1px solid #1f2a3a", borderRadius: 10 }}
                        labelStyle={{ color: "#d5dee9" }}
                    />
                    {legendNode}
                    {series.map((metric) => (
                        <Line
                            key={metric.id}
                            type="monotone"
                            dataKey={metric.id}
                            name={metric.label}
                            stroke={resolvedSeriesColors[metric.id]}
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
        <section className="space-y-3 rounded-xl border border-border/80 bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">Chart Builder</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Build and export a branded statement chart inline.</p>
                </div>
                <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-primary/25 text-foreground hover:bg-primary/35"
                    onClick={handleExport}
                    disabled={exporting || series.length === 0}
                >
                    <Download className="h-3.5 w-3.5" />
                    {exporting ? "Exporting" : "Export PNG"}
                </Button>
            </div>

            <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Chart title</span>
                <input
                    type="text"
                    value={title}
                    onChange={(event) => onTitleChange(event.target.value)}
                    className="h-9 w-full rounded-md border border-border/70 bg-muted/10 px-3 text-sm text-foreground outline-none transition focus:border-primary/50"
                />
            </label>

            <div className="flex flex-wrap items-center gap-2">
                {chartTypeOptions.map((option) => {
                    const active = chartType === option.key;
                    return (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => setChartType(option.key)}
                            className={cn(
                                "rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition",
                                active
                                    ? "bg-primary/20 text-foreground ring-1 ring-primary/40"
                                    : "border border-border/60 text-muted-foreground hover:bg-muted/20"
                            )}
                        >
                            {option.label}
                        </button>
                    );
                })}
                {chartType === "bar" ? (
                    <button
                        type="button"
                        onClick={() => setBarOrientation((prev) => (prev === "horizontal" ? "vertical" : "horizontal"))}
                        className={cn(
                            "rounded-md border border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
                            "text-muted-foreground hover:bg-muted/20"
                        )}
                    >
                        Bars: {barOrientation === "horizontal" ? "Horizontal" : "Vertical"}
                    </button>
                ) : null}
                {(chartType === "bar" || chartType === "area") && series.length > 1 ? (
                    <button
                        type="button"
                        onClick={() => setStacked((prev) => !prev)}
                        className={cn(
                            "rounded-md border border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
                            stacked ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/20"
                        )}
                    >
                        {stacked ? "Stacked: On" : "Stacked: Off"}
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={() => setNormalize((prev) => !prev)}
                    className={cn(
                        "rounded-md border border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
                        normalize ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/20"
                    )}
                >
                    {normalize ? "Normalize: On" : "Normalize: Off"}
                </button>
                <button
                    type="button"
                    onClick={() => setShowLegend((prev) => !prev)}
                    className={cn(
                        "rounded-md border border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
                        showLegend ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/20"
                    )}
                >
                    {showLegend ? "Legend: On" : "Legend: Off"}
                </button>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/15 p-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Series colors ({series.length})</p>
                {series.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">Select metrics from the table to chart.</p>
                ) : (
                    <div className="mt-2 grid gap-2">
                        {series.map((metric) => (
                            <div key={metric.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-2">
                                <span className="truncate text-sm text-foreground">{metric.label}</span>
                                <input
                                    type="color"
                                    aria-label={`${metric.label} color`}
                                    value={resolvedSeriesColors[metric.id]}
                                    onChange={(event) => onSeriesColorChange(metric.id, event.target.value)}
                                    className="h-7 w-10 cursor-pointer rounded border border-border/60 bg-transparent p-0"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="aspect-video w-full" ref={exportRef}>
                <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-[#0b121d]">
                    <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <Image src="/brand/zedxe-logo.svg" alt="ZedXe" width={94} height={28} className="h-5 w-auto" unoptimized />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                                    {symbol} | {statementLabel} | {periodLabel}
                                </p>
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{exportedAt || "Ready to export"}</p>
                    </div>
                    <div className="min-h-0 flex-1 px-3 pb-3 pt-2">{renderChart()}</div>
                </div>
            </div>
        </section>
    );
}
