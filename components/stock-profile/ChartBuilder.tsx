"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";
import type { NameType, Payload, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Download, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StatementColumn, StatementValueType } from "@/lib/stocks/stockProfileV2.types";
import { calculateCagr, formatCurrency, formatInteger, formatNumber, formatPercent } from "@/components/stock-profile/formatters";

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
    theme?: "dark" | "light";
    title: string;
    onTitleChange: (title: string) => void;
    seriesColors: Record<string, string>;
    onSeriesColorChange: (seriesId: string, color: string) => void;
};

type ChartType = "bar" | "line" | "area";
type Resolution = 1 | 2 | 3;
type ChartDatum = Record<string, number | string | null> & {
    period: string;
    periodFull: string;
};
type SeriesSummary = {
    id: string;
    color: string;
    label: string;
    change?: number;
    cagr?: number;
};
type DisplayScale = {
    divisor: number;
    suffix?: string;
};

const COLORS = ["#84cc16", "#78b9ff", "#f97316", "#f87171", "#a78bfa", "#facc15"];
const PRESETS = [
    { label: "1200x627", width: 1200, height: 627 },
    { label: "1280x720", width: 1280, height: 720 },
    { label: "1080x1080", width: 1080, height: 1080 },
] as const;

const getThemeTokens = (theme: "dark" | "light") => ({
    pageBg: theme === "dark" ? "#20222d" : "#eef2f7",
    panelBg: theme === "dark" ? "#1a1d27" : "#ffffff",
    chartBg: theme === "dark" ? "#2c2f39" : "#f8fafc",
    border: theme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(15, 23, 42, 0.12)",
    borderStrong: theme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(15, 23, 42, 0.20)",
    grid: theme === "dark" ? "rgba(255,255,255,0.14)" : "rgba(15, 23, 42, 0.14)",
    axis: theme === "dark" ? "#eef2f7" : "#0f172a",
    axisMuted: theme === "dark" ? "#cbd5e1" : "#475569",
    tooltipBg: theme === "dark" ? "#181b24" : "#ffffff",
    tooltipBorder: theme === "dark" ? "rgba(255,255,255,0.14)" : "rgba(15, 23, 42, 0.12)",
    hoverCursor: theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15, 23, 42, 0.05)",
    exportTitle: theme === "dark" ? "#f8fafc" : "#0f172a",
    exportText: theme === "dark" ? "#e5e7eb" : "#0f172a",
    exportMuted: theme === "dark" ? "#cbd5e1" : "#475569",
});

const formatPeriodTick = (column: StatementColumn) => {
    if (!column.date) return column.label;
    const parsed = Date.parse(column.date);
    if (!Number.isFinite(parsed)) return column.label;
    const date = new Date(parsed);
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const year = date.toLocaleDateString("en-US", { year: "2-digit" });
    return `${month} '${year}`;
};

const formatPlotValue = (value: number, valueType?: StatementValueType, normalize = false) => {
    if (!Number.isFinite(value)) return "--";
    if (normalize) return `${value.toFixed(0)}%`;
    if (valueType === "perShare") return formatNumber(value);
    if (Math.abs(value) >= 1) return formatInteger(value);
    return formatNumber(value);
};

const formatTooltipValue = (value: number, valueType: StatementValueType | undefined, currency: string, normalize: boolean, scaleDivisor = 1) => {
    if (!Number.isFinite(value)) return "--";
    if (normalize) return `${value.toFixed(2)}%`;
    if (valueType === "currency") return formatCurrency(value * scaleDivisor, currency);
    if (valueType === "count") return formatInteger(value);
    if (valueType === "perShare") return `${formatCurrency(value * scaleDivisor, currency)} /sh`;
    return formatNumber(value);
};

const getNumericValues = (values: Array<number | undefined>) => values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));

const getYearSpan = (columns: StatementColumn[]) => {
    const dated = columns.map((column) => (column.date ? Date.parse(column.date) : Number.NaN)).filter((value) => Number.isFinite(value));
    if (dated.length >= 2) {
        const spanYears = (dated[dated.length - 1] - dated[0]) / (1000 * 60 * 60 * 24 * 365.25);
        if (spanYears > 0) return spanYears;
    }
    return Math.max(columns.length - 1, 1);
};

const getDisplayScale = (series: ChartSeries[], values: number[], normalize: boolean): DisplayScale => {
    if (normalize || !values.length) return { divisor: 1 };
    const currencyOnly = series.every((item) => item.valueType === "currency");
    if (!currencyOnly) return { divisor: 1 };

    const maxAbs = Math.max(...values.map((value) => Math.abs(value)));
    if (maxAbs >= 1e9) return { divisor: 1e6, suffix: "Millions" };
    if (maxAbs >= 1e6) return { divisor: 1e3, suffix: "Thousands" };
    return { divisor: 1 };
};

export default function ChartBuilder({
    columns,
    series,
    currency = "USD",
    symbol,
    statementLabel,
    periodLabel,
    theme = "dark",
    title,
    onTitleChange,
    seriesColors,
}: ChartBuilderProps) {
    const [chartType, setChartType] = useState<ChartType>("bar");
    const [normalize, setNormalize] = useState(false);
    const [showLegend, setShowLegend] = useState(true);
    const [showTitle, setShowTitle] = useState(true);
    const [resolution, setResolution] = useState<Resolution>(2);
    const [exportWidth, setExportWidth] = useState(1200);
    const [exportHeight, setExportHeight] = useState(627);
    const [exporting, setExporting] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);

    const exportRef = useRef<HTMLDivElement | null>(null);
    const tokens = useMemo(() => getThemeTokens(theme), [theme]);

    const orderedColumns = useMemo(() => {
        const dated = columns.filter((column) => column.type !== "ttm" && column.date);
        return [...dated].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    }, [columns]);

    const palette = useMemo(
        () => Object.fromEntries(series.map((metric, index) => [metric.id, seriesColors[metric.id] || COLORS[index % COLORS.length]])),
        [series, seriesColors]
    );
    const seriesById = useMemo(() => Object.fromEntries(series.map((item) => [item.id, item])), [series]);
    const displayScale = useMemo(() => {
        const rawValues = series.flatMap((item) => getNumericValues(orderedColumns.map((column) => item.valuesByColumnKey[column.key])));
        return getDisplayScale(series, rawValues, normalize);
    }, [normalize, orderedColumns, series]);

    const data = useMemo<ChartDatum[]>(() => {
        const normalizeSeries = (values: Array<number | undefined>) => {
            const base = values.find((value) => typeof value === "number" && value !== 0);
            if (typeof base !== "number") return values;
            return values.map((value) => (typeof value === "number" ? (value / base) * 100 : undefined));
        };

        return orderedColumns.map((column, index) => {
            const point: ChartDatum = { period: formatPeriodTick(column), periodFull: column.label };
            series.forEach((metric) => {
                const seriesValues = orderedColumns.map((item) => metric.valuesByColumnKey[item.key]);
                const values = normalize ? normalizeSeries(seriesValues) : seriesValues;
                point[metric.id] = typeof values[index] === "number" ? values[index] / displayScale.divisor : null;
            });
            return point;
        });
    }, [displayScale.divisor, normalize, orderedColumns, series]);

    const domain = useMemo<[number, number]>(() => {
        const values = data.flatMap((point) =>
            series.map((item) => point[item.id]).filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        );
        if (!values.length) return [0, 100];

        const min = Math.min(...values);
        const max = Math.max(...values);
        if (min === max) {
            const pad = Math.max(Math.abs(max) * 0.25, 1);
            return [Math.min(0, min - pad), max + pad];
        }
        if (min >= 0) return [0, max * 1.15];
        if (max <= 0) return [min * 1.15, 0];

        const pad = Math.max((max - min) * 0.12, 1);
        return [min - pad, max + pad];
    }, [data, series]);

    const seriesSummaries = useMemo<SeriesSummary[]>(() => {
        const yearSpan = getYearSpan(orderedColumns);

        return series.map((item) => {
            const values = getNumericValues(orderedColumns.map((column) => item.valuesByColumnKey[column.key]));
            const first = values[0];
            const last = values[values.length - 1];
            const change =
                typeof first === "number" && typeof last === "number" && first !== 0 ? ((last - first) / Math.abs(first)) * 100 : undefined;

            return {
                id: item.id,
                color: palette[item.id],
                label: item.label,
                change,
                cagr: calculateCagr(last, first, yearSpan),
            };
        });
    }, [orderedColumns, palette, series]);

    const showDataLabels = series.length <= 2 && data.length <= 12;

    const exportChart = async () => {
        if (!exportRef.current || series.length === 0) return;
        setExporting(true);
        try {
            const dataUrl = await toPng(exportRef.current, { pixelRatio: resolution, cacheBust: true, backgroundColor: tokens.pageBg });
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = `${symbol.toLowerCase()}-${statementLabel.toLowerCase().replace(/\s+/g, "-")}-${chartType}.png`;
            link.click();
        } finally {
            setExporting(false);
        }
    };

    const renderChart = () => {
        if (!series.length || !data.length) {
            return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select metrics from the table to chart.</div>;
        }

        const chartMargins = { top: 24, right: 118, left: 24, bottom: 42 };
        const yTickCount = 8;
        const common = {
            data,
            margin: chartMargins,
        };
        const yTicks = Array.from({ length: yTickCount }, (_, index) => {
            const ratio = (yTickCount - 1 - index) / Math.max(yTickCount - 1, 1);
            return domain[0] + (domain[1] - domain[0]) * ratio;
        });

        const renderTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
            if (!active || !payload?.length) return null;

            const rows = payload.filter(
                (entry): entry is Payload<ValueType, NameType> & { value: number } =>
                    typeof entry?.value === "number" && Number.isFinite(entry.value)
            );

            if (!rows.length) return null;

            return (
                <div
                    className="min-w-[180px] rounded-xl border px-3 py-2 shadow-2xl"
                    style={{ backgroundColor: tokens.tooltipBg, borderColor: tokens.tooltipBorder, color: tokens.axis }}
                >
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: tokens.axisMuted }}>
                        {typeof rows[0]?.payload?.periodFull === "string" ? rows[0].payload.periodFull : label ? String(label) : ""}
                    </p>
                    <div className="space-y-1.5">
                        {rows.map((entry) => {
                            const seriesMeta = seriesById[String(entry.dataKey || entry.name || "")];
                            return (
                                <div key={`${entry.dataKey}-${entry.name}`} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2 text-xs">
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color || palette[seriesMeta?.id || ""] || COLORS[0] }} />
                                    <span className="truncate" style={{ color: tokens.axisMuted }}>
                                        {seriesMeta?.label || String(entry.name || "Value")}
                                    </span>
                                    <span className="font-semibold" style={{ color: tokens.axis }}>
                                        {formatTooltipValue(entry.value, seriesMeta?.valueType, currency, normalize, displayScale.divisor)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        };

        const renderValueLabel = (
            props: {
                x?: number | string;
                y?: number | string;
                width?: number | string;
                value?: ValueType;
            },
            valueType?: StatementValueType
        ) => {
            const x = Number(props.x ?? 0);
            const y = Number(props.y ?? 0);
            const width = Number(props.width ?? 0);
            const { value } = props;
            if (typeof value !== "number" || !Number.isFinite(value)) return null;

            return (
                <text x={x + width / 2} y={y - 10} fill={tokens.exportText} fontSize={12} fontWeight={600} textAnchor="middle">
                    {formatPlotValue(value, valueType, normalize)}
                </text>
            );
        };

        const shared = (
            <>
                <CartesianGrid hide />
                <XAxis dataKey="period" hide padding={{ left: 8, right: 8 }} interval={0} minTickGap={12} />
                <YAxis hide domain={domain} />
                <Tooltip
                    content={renderTooltip}
                    cursor={{ fill: tokens.hoverCursor, fillOpacity: 1 }}
                    wrapperStyle={{ zIndex: 40, outline: "none", pointerEvents: "none" }}
                    allowEscapeViewBox={{ x: true, y: true }}
                />
            </>
        );

        const chartNode =
            chartType === "line" ? (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart {...common}>
                        {shared}
                        {series.map((item) => (
                            <Line
                                key={item.id}
                                type="monotone"
                                dataKey={item.id}
                                name={item.label}
                                stroke={palette[item.id]}
                                strokeWidth={2.5}
                                dot={{ r: 3.5, fill: palette[item.id], strokeWidth: 0 }}
                                activeDot={{ r: 6, stroke: tokens.chartBg, strokeWidth: 2 }}
                                connectNulls
                                isAnimationActive={false}
                            >
                                {showDataLabels ? <LabelList content={(props) => renderValueLabel(props, item.valueType)} /> : null}
                            </Line>
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            ) : chartType === "area" ? (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart {...common}>
                        {shared}
                        {series.map((item) => (
                            <Area
                                key={item.id}
                                type="monotone"
                                dataKey={item.id}
                                name={item.label}
                                stroke={palette[item.id]}
                                fill={palette[item.id]}
                                fillOpacity={theme === "dark" ? 0.24 : 0.18}
                                strokeWidth={2.5}
                                activeDot={{ r: 6, stroke: tokens.chartBg, strokeWidth: 2 }}
                                connectNulls
                                isAnimationActive={false}
                            >
                                {showDataLabels ? <LabelList content={(props) => renderValueLabel(props, item.valueType)} /> : null}
                            </Area>
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart {...common} barCategoryGap={data.length > 8 ? 18 : 28}>
                        {shared}
                        {series.map((item) => (
                            <Bar
                                key={item.id}
                                dataKey={item.id}
                                name={item.label}
                                fill={palette[item.id]}
                                radius={[2, 2, 0, 0]}
                                maxBarSize={72}
                                isAnimationActive={false}
                                activeBar={{
                                    fill: palette[item.id],
                                    opacity: 0.92,
                                    stroke: theme === "dark" ? "#f8fafc" : "#0f172a",
                                    strokeWidth: 1.25,
                                }}
                            >
                                {showDataLabels ? <LabelList content={(props) => renderValueLabel(props, item.valueType)} /> : null}
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            );

        return (
            <div className="relative h-full w-full">
                <div
                    className="pointer-events-none absolute"
                    style={{
                        top: chartMargins.top,
                        right: chartMargins.right,
                        bottom: chartMargins.bottom,
                        left: chartMargins.left,
                        borderLeft: `1px solid ${tokens.borderStrong}`,
                        borderBottom: `1px solid ${tokens.borderStrong}`,
                        backgroundImage: `linear-gradient(to bottom, ${tokens.grid} 1px, transparent 1px), linear-gradient(to right, ${tokens.grid} 1px, transparent 1px)`,
                        backgroundSize: `100% calc(100% / ${Math.max(yTickCount - 1, 1)}), calc(100% / ${Math.max(data.length - 1, 1)}) 100%`,
                        backgroundPosition: "top left",
                        backgroundRepeat: "repeat",
                        zIndex: 1,
                    }}
                />
                <div
                    className="pointer-events-none absolute"
                    style={{
                        top: chartMargins.top,
                        right: 8,
                        bottom: chartMargins.bottom,
                        width: chartMargins.right - 16,
                        zIndex: 2,
                    }}
                >
                    <div className="flex h-full flex-col justify-between">
                        {yTicks.map((tick, index) => (
                            <span key={`y-tick-${index}`} className="text-right text-[12px]" style={{ color: tokens.axis }}>
                                {formatPlotValue(tick, series[0]?.valueType, normalize)}
                            </span>
                        ))}
                    </div>
                </div>
                <div
                    className="pointer-events-none absolute"
                    style={{
                        left: chartMargins.left,
                        right: chartMargins.right,
                        bottom: 6,
                        height: chartMargins.bottom - 6,
                        zIndex: 2,
                    }}
                >
                    <div className="grid h-full items-end" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
                        {data.map((point, index) => (
                            <span key={`x-tick-${index}`} className="text-center text-[11px]" style={{ color: tokens.axisMuted }}>
                                {point.period}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="relative z-[3] h-full w-full">{chartNode}</div>
            </div>
        );
    };

    const renderSummary = (compact: boolean) => (
        <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", compact ? "text-[11px]" : "text-sm")}>
            {seriesSummaries.map((item) => (
                <div key={item.id} className="flex items-center gap-2" style={{ color: tokens.exportText }}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-medium">
                        {item.label}{displayScale.suffix ? ` (${displayScale.suffix})` : ""}
                        {typeof item.change === "number" ? ` (Total Change: ${formatPercent(item.change)})` : ""}
                        {typeof item.cagr === "number" ? ` (CAGR: ${formatPercent(item.cagr)})` : ""}
                    </span>
                </div>
            ))}
        </div>
    );

    const renderWatermark = (alignRight: boolean) => (
        <div className={cn("flex items-center gap-2 text-xs", alignRight ? "justify-end text-right" : "")} style={{ color: tokens.exportMuted }}>
            <span>Powered by</span>
            <Image src="/brand/zedxe-logo.svg" alt="ZedXe" width={76} height={20} className="h-4 w-auto opacity-90" unoptimized />
        </div>
    );

    const preview = (mode: "live" | "export") => (
        <div
            ref={mode === "export" ? exportRef : undefined}
            className={cn("w-full", mode === "live" && "h-[560px]")}
            style={mode === "export" ? { aspectRatio: `${exportWidth} / ${exportHeight}` } : undefined}
        >
            <div
                className={cn("flex h-full flex-col rounded-[28px]", mode === "live" ? "border shadow-[0_20px_60px_rgba(2,6,23,0.24)]" : "overflow-hidden")}
                style={{ backgroundColor: mode === "live" ? tokens.panelBg : tokens.pageBg, borderColor: mode === "live" ? tokens.border : "transparent" }}
            >
                {mode === "live" ? (
                    <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <Image src="/brand/zedxe-logo.svg" alt="ZedXe" width={94} height={28} className="h-5 w-auto" unoptimized />
                            <div className="min-w-0">
                                {showTitle ? <p className="truncate text-sm font-semibold text-foreground">{title}</p> : null}
                                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{symbol} | {statementLabel} | {periodLabel}</p>
                            </div>
                        </div>
                        <Button type="button" size="sm" className="h-9 bg-primary/25 px-4 text-foreground hover:bg-primary/35" onClick={() => setShowExportDialog(true)} disabled={!series.length}>
                            <Download className="h-3.5 w-3.5" />
                            Download
                        </Button>
                    </div>
                ) : (
                    <div className="px-8 pb-3 pt-6">
                        {showTitle ? (
                            <div className="text-center">
                                <p className="text-[18px] font-semibold leading-tight" style={{ color: tokens.exportTitle }}>
                                    {title}
                                </p>
                                <p className="mt-2 text-[12px] uppercase tracking-[0.18em]" style={{ color: tokens.exportMuted }}>
                                    {symbol} | {statementLabel} | {periodLabel}
                                </p>
                            </div>
                        ) : null}
                    </div>
                )}
                <div className={cn("min-h-0 flex-1", mode === "live" ? "px-3 pb-2 pt-2" : "px-4 pb-2")}>
                    <div className={cn("h-full overflow-visible rounded-[24px] border", mode === "live" ? "p-2" : "px-2 pb-2 pt-1")} style={{ backgroundColor: tokens.chartBg, borderColor: tokens.border }}>
                        {renderChart()}
                    </div>
                </div>
                <div className={cn("flex flex-wrap items-center justify-between gap-3", mode === "live" ? "border-t border-border/70 px-4 py-3" : "px-8 pb-6 pt-3")}>
                    <div className="min-w-0 flex-1">{showLegend ? renderSummary(mode === "live") : renderWatermark(false)}</div>
                    {mode === "live" ? (
                        <div className="flex flex-wrap items-center gap-2">
                            {(["bar", "line", "area"] as ChartType[]).map((type) => (
                                <button key={type} type="button" onClick={() => setChartType(type)} className={cn("rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]", chartType === type ? "border-primary/50 bg-primary/20 text-foreground" : "border-border/60 text-muted-foreground hover:bg-muted/20")}>
                                    {type}
                                </button>
                            ))}
                            <button type="button" onClick={() => setNormalize((prev) => !prev)} className={cn("rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]", normalize ? "border-primary/50 bg-primary/20 text-foreground" : "border-border/60 text-muted-foreground hover:bg-muted/20")}>
                                {normalize ? "Normalized" : "As Reported"}
                            </button>
                        </div>
                    ) : renderWatermark(true)}
                </div>
                {mode === "live" && showLegend ? <div className="border-t border-border/50 px-4 py-2">{renderWatermark(false)}</div> : null}
            </div>
        </div>
    );

    return (
        <>
            {preview("live")}

            {showExportDialog ? (
                <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm">
                    <div className="flex h-full w-full items-center justify-center p-4">
                        <div className="grid h-[min(92vh,920px)] w-full max-w-[1500px] gap-4 rounded-3xl border p-4 xl:grid-cols-[320px_minmax(0,1fr)]" style={{ backgroundColor: tokens.pageBg, borderColor: tokens.border }}>
                            <div className="min-h-0 overflow-y-auto rounded-2xl border p-4" style={{ backgroundColor: tokens.panelBg, borderColor: tokens.border }}>
                                <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
                                    <h3 className="text-lg font-semibold text-foreground">Export Chart</h3>
                                    <button type="button" onClick={() => setShowExportDialog(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-muted/20">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <label className="space-y-1.5">
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Image title</span>
                                        <input type="text" value={title} onChange={(event) => onTitleChange(event.target.value)} className="h-10 w-full rounded-lg border border-border/70 bg-muted/10 px-3 text-sm text-foreground outline-none transition focus:border-primary/50" />
                                    </label>

                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" onClick={() => setShowTitle((prev) => !prev)} className={cn("rounded-md border border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]", showTitle ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/20")}>{showTitle ? "Show Title" : "Hide Title"}</button>
                                        <button type="button" onClick={() => setShowLegend((prev) => !prev)} className={cn("rounded-md border border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]", showLegend ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/20")}>{showLegend ? "Show Legend" : "Hide Legend"}</button>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Dimensions</p>
                                        <div className="grid gap-2">
                                            {PRESETS.map((preset) => (
                                                <button key={preset.label} type="button" onClick={() => { setExportWidth(preset.width); setExportHeight(preset.height); }} className={cn("rounded-xl border px-3 py-2 text-left transition", exportWidth === preset.width && exportHeight === preset.height ? "border-primary/50 bg-primary/15 text-foreground" : "border-border/60 bg-muted/10 text-muted-foreground hover:bg-muted/20")}>
                                                    <p className="text-sm font-semibold">{preset.label}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <input type="number" min={640} step={10} value={exportWidth} onChange={(event) => setExportWidth(Math.max(640, Number(event.target.value) || 640))} className="h-10 rounded-lg border border-border/70 bg-muted/10 px-3 text-sm text-foreground outline-none transition focus:border-primary/50" />
                                        <input type="number" min={360} step={10} value={exportHeight} onChange={(event) => setExportHeight(Math.max(360, Number(event.target.value) || 360))} className="h-10 rounded-lg border border-border/70 bg-muted/10 px-3 text-sm text-foreground outline-none transition focus:border-primary/50" />
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {[1, 2, 3].map((value) => (
                                            <button key={value} type="button" onClick={() => setResolution(value as Resolution)} className={cn("rounded-md border border-border/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]", resolution === value ? "bg-primary/20 text-foreground ring-1 ring-primary/40" : "text-muted-foreground hover:bg-muted/20")}>
                                                {value}x
                                            </button>
                                        ))}
                                    </div>

                                    <Button type="button" size="sm" className="h-10 bg-primary/25 px-4 text-foreground hover:bg-primary/35" onClick={exportChart} disabled={exporting || !series.length}>
                                        <Download className="h-3.5 w-3.5" />
                                        {exporting ? "Exporting" : "Export PNG"}
                                    </Button>
                                </div>
                            </div>

                            <div className="min-w-0 overflow-auto rounded-2xl border p-4" style={{ backgroundColor: tokens.pageBg, borderColor: tokens.border }}>
                                {preview("export")}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
