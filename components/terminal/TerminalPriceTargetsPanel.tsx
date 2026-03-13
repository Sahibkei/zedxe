"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

type PriceTargetSummary = {
    low: number;
    average: number;
    median: number;
    high: number;
    count: number;
    updated: string | null;
    currentPrice: number | null;
    upsidePct: number | null;
};

type PriceTargetChartPoint = {
    t: number;
    close: number | null;
};

type PriceTargetRatingPoint = {
    t: number;
    date: string;
    firm: string;
    analyst: string;
    action: string;
    rating: string;
    priceTarget: number;
    previousTarget: number | null;
};

type PriceTargetsResponse = {
    updatedAt: string;
    symbol: string;
    status: "ok" | "no_data";
    sources: Array<{
        name: string;
        url: string;
        public: true;
    }>;
    summary: PriceTargetSummary | null;
    chart: PriceTargetChartPoint[];
    ratings: PriceTargetRatingPoint[];
};

type ForecastChartPoint = {
    t: number;
    close: number | null;
    forecastLow: number | null;
    forecastAverage: number | null;
    forecastHigh: number | null;
};

type TerminalPriceTargetsPanelProps = {
    symbol: string;
    theme: "dark" | "light";
    className?: string;
};

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const formatChartDate = (value: number) =>
    new Date(value).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
    });

const formatTooltipDate = (value: number) =>
    new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const formatPrice = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value)
        ? new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: value >= 100 ? 0 : 2,
          }).format(value)
        : "--";

const formatSignedPercent = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%` : "--";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const buildForecastSeries = (payload: PriceTargetsResponse | null): ForecastChartPoint[] => {
    if (!payload?.summary) return [];

    const actualPoints = payload.chart.filter((point) => typeof point.close === "number").slice(-13);
    if (!actualPoints.length) return [];

    const lastActual = actualPoints[actualPoints.length - 1];
    const futurePoint = payload.chart.find((point) => point.close == null);
    const forecastTime = futurePoint?.t ?? lastActual.t + ONE_YEAR_MS;

    const series = actualPoints.map((point, index) => {
        const isLastActual = index === actualPoints.length - 1;
        return {
            t: point.t,
            close: point.close,
            forecastLow: isLastActual ? point.close : null,
            forecastAverage: isLastActual ? point.close : null,
            forecastHigh: isLastActual ? point.close : null,
        };
    });

    series.push({
        t: forecastTime,
        close: null,
        forecastLow: payload.summary.low,
        forecastAverage: payload.summary.average,
        forecastHigh: payload.summary.high,
    });

    return series;
};

const buildDomain = (series: ForecastChartPoint[], summary: PriceTargetSummary | null) => {
    const values = [
        ...series.flatMap((point) => [point.close, point.forecastLow, point.forecastAverage, point.forecastHigh]),
        summary?.low ?? null,
        summary?.average ?? null,
        summary?.high ?? null,
    ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    if (!values.length) return [0, 100] as const;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.16, 12);
    return [Math.max(0, min - padding), max + padding] as const;
};

const CustomTooltip = ({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{
        dataKey?: string;
        value?: number | null;
    }>;
    label?: number;
}) => {
    if (!active || !payload?.length || typeof label !== "number") return null;

    const close = payload.find((entry) => entry.dataKey === "close")?.value;
    const low = payload.find((entry) => entry.dataKey === "forecastLow")?.value;
    const average = payload.find((entry) => entry.dataKey === "forecastAverage")?.value;
    const high = payload.find((entry) => entry.dataKey === "forecastHigh")?.value;

    return (
        <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-3 py-2 text-xs text-[var(--terminal-text)] shadow-xl">
            <p className="font-semibold">{formatTooltipDate(label)}</p>
            {typeof close === "number" ? <p className="mt-1 terminal-muted">Close {formatPrice(close)}</p> : null}
            {typeof average === "number" ? (
                <div className="mt-2 space-y-1">
                    <p>Average {formatPrice(average)}</p>
                    <p className="terminal-muted">High {formatPrice(typeof high === "number" ? high : null)}</p>
                    <p className="terminal-muted">Low {formatPrice(typeof low === "number" ? low : null)}</p>
                </div>
            ) : null}
        </div>
    );
};

const ForecastLabel = ({
    label,
    value,
    color,
    top,
}: {
    label: string;
    value: number;
    color: string;
    top: number;
}) => (
    <div
        className="pointer-events-none absolute right-3 flex w-[92px] flex-col rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-2 py-1 text-right shadow-lg"
        style={{ top: `${top}%` }}
    >
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
            {label}
        </p>
        <p className="text-sm font-semibold">{formatPrice(value)}</p>
    </div>
);

export default function TerminalPriceTargetsPanel({ symbol, theme, className }: TerminalPriceTargetsPanelProps) {
    const [payload, setPayload] = useState<PriceTargetsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const load = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/market/price-targets?symbol=${encodeURIComponent(symbol)}`, {
                    cache: "no-store",
                    signal: controller.signal,
                });
                const data = (await response.json()) as PriceTargetsResponse;
                if (!isMounted) return;
                setPayload(data);
            } catch (fetchError) {
                if (!isMounted || controller.signal.aborted) return;
                setError(fetchError instanceof Error ? fetchError.message : "Failed to load price targets");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        void load();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [symbol]);

    const palette = useMemo(
        () =>
            theme === "dark"
                ? {
                      grid: "rgba(134, 151, 173, 0.14)",
                      muted: "#8ea0ba",
                      close: "#0f8a6f",
                      closeDot: "#35d7aa",
                      average: "#cbd5e1",
                      high: "#10b981",
                      low: "#ef4444",
                  }
                : {
                      grid: "rgba(81, 101, 126, 0.12)",
                      muted: "#5f728a",
                      close: "#13795b",
                      closeDot: "#16a34a",
                      average: "#475569",
                      high: "#059669",
                      low: "#dc2626",
                  },
        [theme]
    );

    const hasData = payload?.status === "ok" && payload.summary && payload.chart.length > 0;
    const chartSeries = useMemo(() => buildForecastSeries(payload), [payload]);
    const latestRatings = useMemo(() => (payload?.ratings ?? []).slice(0, 8), [payload?.ratings]);
    const domain = useMemo(() => buildDomain(chartSeries, payload?.summary ?? null), [chartSeries, payload?.summary]);

    const labelPositions = useMemo(() => {
        const [min, max] = domain;
        const spread = Math.max(max - min, 1);
        const toTop = (value: number) => clamp(((max - value) / spread) * 100, 8, 88);

        if (!payload?.summary) return null;

        const high = toTop(payload.summary.high);
        const average = toTop(payload.summary.average);
        const gap = Math.max(14, average - high);
        const low = clamp(average + gap, 8, 88);

        return {
            high,
            average,
            low,
        };
    }, [domain, payload?.summary]);

    return (
        <>
            <article className={cn("terminal-widget min-h-0", className)}>
                <header className="terminal-widget-head">
                    <div>
                        <p className="text-sm font-semibold">Analyst Price Targets</p>
                        <p className="text-xs terminal-muted">12 month close history and 12 month target forecast</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        {payload?.summary?.updated ? <span className="terminal-series-chip">Updated {new Date(payload.summary.updated).toLocaleDateString("en-US")}</span> : null}
                        <button type="button" className="terminal-mini-btn" onClick={() => setDetailsOpen(true)} disabled={!payload?.summary}>
                            Target Details
                        </button>
                    </div>
                </header>

                {isLoading ? (
                    <div className="flex min-h-[260px] items-center justify-center text-sm terminal-muted">Loading public price target data...</div>
                ) : error ? (
                    <div className="flex min-h-[260px] items-center justify-center px-4 text-center text-sm terminal-down">{error}</div>
                ) : hasData && payload?.summary ? (
                    <>
                        <div className="p-3">
                            <div className="relative overflow-hidden rounded-lg border border-[var(--terminal-border)] px-3 py-3">
                                <div className="mb-2 flex items-center justify-center gap-6 text-xs font-semibold">
                                    <span>Past 12 Months</span>
                                    <span className="terminal-muted">12 Month Forecast</span>
                                </div>
                                <div className="h-[260px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartSeries} margin={{ top: 12, right: 120, bottom: 8, left: 6 }}>
                                            <CartesianGrid stroke={palette.grid} />
                                            <XAxis
                                                dataKey="t"
                                                type="number"
                                                scale="time"
                                                domain={["dataMin", "dataMax"]}
                                                tickFormatter={formatChartDate}
                                                tick={{ fill: palette.muted, fontSize: 11 }}
                                                stroke="var(--terminal-border-strong)"
                                                minTickGap={28}
                                            />
                                            <YAxis
                                                domain={domain}
                                                tickFormatter={(value) => formatPrice(Number(value))}
                                                tick={{ fill: palette.muted, fontSize: 11 }}
                                                stroke="var(--terminal-border-strong)"
                                                width={64}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Line
                                                type="monotone"
                                                dataKey="close"
                                                stroke={palette.close}
                                                strokeWidth={3}
                                                dot={{ r: 4, fill: palette.closeDot, stroke: palette.close, strokeWidth: 1.5 }}
                                                connectNulls={false}
                                                isAnimationActive={false}
                                                name="Close"
                                            />
                                            <Line type="linear" dataKey="forecastHigh" stroke={palette.high} strokeWidth={2.5} strokeDasharray="5 5" dot={false} connectNulls isAnimationActive={false} />
                                            <Line type="linear" dataKey="forecastAverage" stroke={palette.average} strokeWidth={2.5} strokeDasharray="5 5" dot={false} connectNulls isAnimationActive={false} />
                                            <Line type="linear" dataKey="forecastLow" stroke={palette.low} strokeWidth={2.5} strokeDasharray="5 5" dot={false} connectNulls isAnimationActive={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {labelPositions ? (
                                    <>
                                        <ForecastLabel label="High" value={payload.summary.high} color={palette.high} top={labelPositions.high} />
                                        <ForecastLabel label="Average" value={payload.summary.average} color={palette.average} top={labelPositions.average} />
                                        <ForecastLabel label="Low" value={payload.summary.low} color={palette.low} top={labelPositions.low} />
                                    </>
                                ) : null}
                            </div>
                        </div>

                        <div className="border-t border-[var(--terminal-border)] px-3 py-2 text-xs terminal-muted">
                            Source count {payload.summary.count} analysts | Sources:{" "}
                            {payload.sources.map((source, index) => (
                                <span key={source.url}>
                                    {index > 0 ? " | " : ""}
                                    <a href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                                        {source.name}
                                    </a>
                                </span>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex min-h-[260px] items-center justify-center px-4 text-center text-sm terminal-muted">
                        No data available from public price target sources for this company.
                    </div>
                )}
            </article>

            {detailsOpen && payload?.summary ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
                    <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] shadow-2xl">
                        <div className="flex items-center justify-between gap-3 border-b border-[var(--terminal-border)] px-4 py-3">
                            <div>
                                <p className="text-lg font-semibold">Price Target Details</p>
                                <p className="text-xs terminal-muted">Consensus summary and recent public analyst revisions</p>
                            </div>
                            <button type="button" className="terminal-mini-btn" onClick={() => setDetailsOpen(false)}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-4">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.12em] terminal-muted">Average Target</p>
                                    <p className="mt-2 text-3xl font-semibold terminal-up">{formatPrice(payload.summary.average)}</p>
                                </div>
                                <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.12em] terminal-muted">Median Target</p>
                                    <p className="mt-2 text-3xl font-semibold">{formatPrice(payload.summary.median)}</p>
                                </div>
                                <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.12em] terminal-muted">Low / High</p>
                                    <p className="mt-2 text-3xl font-semibold">{formatPrice(payload.summary.low)} - {formatPrice(payload.summary.high)}</p>
                                </div>
                                <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.12em] terminal-muted">Implied Upside</p>
                                    <p className={cn("mt-2 text-3xl font-semibold", (payload.summary.upsidePct ?? 0) >= 0 ? "terminal-up" : "terminal-down")}>{formatSignedPercent(payload.summary.upsidePct)}</p>
                                </div>
                                <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.12em] terminal-muted">Current Price</p>
                                    <p className="mt-2 text-3xl font-semibold">{formatPrice(payload.summary.currentPrice)}</p>
                                </div>
                                <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.12em] terminal-muted">Analyst Count</p>
                                    <p className="mt-2 text-3xl font-semibold">{payload.summary.count}</p>
                                </div>
                            </div>

                            <div className="mt-5 flex items-center justify-between gap-3">
                                <p className="text-lg font-semibold">Recent Target Sources</p>
                                <p className="text-xs terminal-muted">{latestRatings.length} updates</p>
                            </div>

                            <div className="mt-3 grid gap-3">
                                {latestRatings.map((rating) => (
                                    <div key={`${rating.firm}-${rating.date}-${rating.priceTarget}`} className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xl font-semibold">{rating.firm}</p>
                                                <p className="text-sm terminal-muted">{rating.analyst}</p>
                                            </div>
                                            <div className="text-right text-2xl font-semibold">{formatPrice(rating.priceTarget)}</div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-4 text-sm terminal-muted">
                                            <span>{new Date(rating.date).toLocaleDateString("en-US")}</span>
                                            <span>{rating.action}</span>
                                            <span>{rating.rating}</span>
                                            {rating.previousTarget != null ? <span>Prev {formatPrice(rating.previousTarget)}</span> : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-[var(--terminal-border)] px-4 py-3 text-xs terminal-muted">
                            {payload?.sources.map((source, index) => (
                                <span key={source.url}>
                                    {index > 0 ? " | " : ""}
                                    <a href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                                        {source.name}
                                    </a>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
