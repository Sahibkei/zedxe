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
    symbol: string;
    statementLabel: string;
    periodLabel: string;
};

type ChartType = "bar" | "line" | "area" | "scatter";
type BarOrientation = "horizontal" | "vertical";

const COLORS = ["#78b9ff", "#10b981", "#f97316", "#f87171", "#a78bfa", "#facc15", "#22c55e", "#94a3b8"];

const chartTypeOptions: Array<{ key: ChartType; label: string }> = [
    { key: "bar", label: "Bar" },
    { key: "line", label: "Line" },
    { key: "area", label: "Area" },
    { key: "scatter", label: "Scatter" },
];

const getOrderedColumns = (columns: StatementColumn[]) => {
    return [...columns];
};

const toNormalizedSeries = (values: Array<number | undefined>) => {
    const base = values.find((value) => typeof value === "number" && Number.isFinite(value) && value !== 0);
    if (typeof base !== "number") return values;
    return values.map((value) => (typeof value === "number" ? (value / base) * 100 : undefined));
};

const sanitizeFilePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function ChartBuilder({
    open,
    onOpenChange,
    columns,
    series,
    currency = "USD",
    symbol,
    statementLabel,
    periodLabel,
}: ChartBuilderProps) {
    const [chartType, setChartType] = useState<ChartType>("bar");
    const [stacked, setStacked] = useState(false);
    const [normalize, setNormalize] = useState(false);
    const [showLegend, setShowLegend] = useState(true);
    const [barOrientation, setBarOrientation] = useState<BarOrientation>("horizontal");
    const [exporting, setExporting] = useState(false);

    const exportRef = useRef<HTMLDivElement | null>(null);

    const orderedColumns = useMemo(() => getOrderedColumns(columns), [columns]);
    const exportedAt = useMemo(() => new Date().toLocaleString("en-US", { hour12: false }), []);

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

    const onExport = async () => {
        if (!exportRef.current) return;

        setExporting(true);
        try {
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
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={yAxisFormatter}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="period"
                                    stroke="#94a3b8"
                                    tickLine={false}
                                    axisLine={false}
                                    width={88}
                                />
                            </>
                        ) : (
                            <>
                                <XAxis dataKey="period" stroke="#94a3b8" tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={yAxisFormatter} width={80} />
                            </>
                        )}
                        <Tooltip
                            formatter={tooltipFormatter}
                            contentStyle={{ background: "#0b111a", border: "1px solid #1f2a3a", borderRadius: 10 }}
                            labelStyle={{ color: "#d5dee9" }}
                        />
                        {legendNode}
                        {series.map((metric, index) => (
                            <Bar
                                key={metric.id}
                                dataKey={metric.id}
                                name={metric.label}
                                fill={COLORS[index % COLORS.length]}
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
                        <XAxis dataKey="period" stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={yAxisFormatter} width={80} />
                        <Tooltip
                            formatter={tooltipFormatter}
                            contentStyle={{ background: "#0b111a", border: "1px solid #1f2a3a", borderRadius: 10 }}
                            labelStyle={{ color: "#d5dee9" }}
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
                            contentStyle={{ background: "#0b111a", border: "1px solid #1f2a3a", borderRadius: 10 }}
                            labelStyle={{ color: "#d5dee9" }}
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
                        contentStyle={{ background: "#0b111a", border: "1px solid #1f2a3a", borderRadius: 10 }}
                        labelStyle={{ color: "#d5dee9" }}
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
            <DialogContent className="w-[min(1280px,96vw)] max-w-[1280px] border-border/80 bg-[#09111d] p-0 text-foreground">
                <DialogHeader className="border-b border-border/70 px-5 py-4">
                    <DialogTitle className="text-lg">Chart Builder</DialogTitle>
                    <DialogDescription>
                        Wide export layout with ZedXe branding. Keep metric selection under 8 for readability.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 px-5 py-4">
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
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            {chartType === "bar" ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={cn("h-8 border-border/70 text-xs", barOrientation === "horizontal" && "bg-primary/15")}
                                    onClick={() => setBarOrientation((prev) => (prev === "horizontal" ? "vertical" : "horizontal"))}
                                >
                                    Bars: {barOrientation === "horizontal" ? "Horizontal" : "Vertical"}
                                </Button>
                            ) : null}

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
                            <Button
                                type="button"
                                size="sm"
                                className="h-8 bg-primary/25 text-foreground hover:bg-primary/35"
                                onClick={onExport}
                                disabled={exporting || series.length === 0}
                            >
                                <Download className="h-3.5 w-3.5" />
                                {exporting ? "Exporting" : "Export"}
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-muted/15 p-3">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Selected metrics ({series.length})</p>
                        {series.length === 0 ? (
                            <p className="mt-1 text-sm text-muted-foreground">Select metrics from the table to chart.</p>
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

                    <div className="w-full aspect-video" ref={exportRef}>
                        <div className="flex h-full flex-col rounded-xl border border-border/70 bg-[#0b121d]">
                            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Image src="/brand/zedxe-logo.svg" alt="ZedXe" width={94} height={28} className="h-5 w-auto" unoptimized />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                            {symbol} - {statementLabel} - Selected Metrics
                                        </p>
                                        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{periodLabel}</p>
                                    </div>
                                </div>
                                <p className="text-[11px] text-muted-foreground">{exportedAt}</p>
                            </div>
                            <div className="min-h-0 flex-1 px-3 pb-3 pt-2">{renderChart()}</div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}