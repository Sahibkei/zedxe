"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import TerminalPriceTargetsPanel from "@/components/terminal/TerminalPriceTargetsPanel";
import { cn } from "@/lib/utils";

type MetricPoint = {
    t: number;
    close: number;
    drawdown: number;
    vol20: number | null;
    vol60: number | null;
    vol120: number | null;
    sharpe20: number | null;
    sharpe60: number | null;
    sharpe120: number | null;
    sortino20: number | null;
    sortino60: number | null;
    sortino120: number | null;
};

type BenchmarkSensitivityPoint = {
    t: number;
    beta20: number | null;
    beta60: number | null;
    beta120: number | null;
    corr20: number | null;
    corr60: number | null;
    corr120: number | null;
};

type PerformanceSummary = {
    totalReturnPct: number;
    annualizedReturnPct: number | null;
    years: number;
    startClose: number;
    endClose: number;
};

type BenchmarkComparisonPoint = {
    symbol: string;
    name: string;
    returnPct: number;
    annualizedReturnPct: number | null;
    relativeReturnPct: number | null;
    beta120: number | null;
    correlation120: number | null;
};

type SectorCorrelationPoint = {
    symbol: string;
    label: string;
    returnPct: number;
    annualizedReturnPct: number | null;
    correlation1Y: number | null;
};

type RiskAdjustedSummary = {
    totalReturnPct: number;
    annualizedReturnPct: number | null;
    annualizedVolatilityPct: number | null;
    maxDrawdownPct: number | null;
    sharpeRatio: number | null;
    sortinoRatio: number | null;
    calmarRatio: number | null;
    returnPerVolatility: number | null;
    trailingBeta: number | null;
    marketCorrelation: number | null;
};

type AssetMetricsResponse = {
    updatedAt: string;
    source: "yahoo";
    symbol: string;
    name: string;
    summary: PerformanceSummary | null;
    metrics: MetricPoint[];
    benchmarkSensitivity: {
        benchmarkSymbol: string;
        benchmarkName: string;
        points: BenchmarkSensitivityPoint[];
    } | null;
    riskAdjustedSummary: RiskAdjustedSummary | null;
    benchmarkComparisons: BenchmarkComparisonPoint[];
    sectorCorrelations: SectorCorrelationPoint[];
};

type TerminalAssetMetricsPanelProps = {
    symbol: string;
    theme: "dark" | "light";
};

const CORRELATION_LABEL_ALIAS: Record<string, string> = {
    Communication: "Comm",
    "Consumer Disc.": "Cons Disc",
    "Consumer Staples": "Staples",
    Energy: "Energy",
    Financials: "Fin",
    "Health Care": "Health",
    Industrials: "Ind",
    Technology: "Tech",
    Materials: "Mat",
    "Real Estate": "REIT",
    Utilities: "Util",
    GSPC: "SPX",
    NDX: "NDX",
    DJI: "DJI",
    RUT: "RUT",
};

const formatDateTick = (unixSeconds: number) =>
    new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
    });

const formatDateTooltip = (unixSeconds: number) =>
    new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const formatNullable = (value: number | null | undefined, digits = 2, suffix = "") =>
    typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : "--";

const formatSignedPercent = (value: number | null | undefined, digits = 2) =>
    typeof value === "number" && Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%` : "--";

const formatCompact = (value: number | null | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "--";
    return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 2,
    }).format(value);
};

const asNullableNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const formatPerformanceLabel = (summary: PerformanceSummary | null) => {
    if (!summary) return "--";
    const yearsLabel = summary.years >= 1 ? `${summary.years.toFixed(1)}Y` : "YTD";
    return `${yearsLabel} CAGR ${formatSignedPercent(summary.annualizedReturnPct)}`;
};

const getCorrelationBackground = (value: number, theme: "dark" | "light") => {
    const clamped = Math.max(-1, Math.min(1, value));
    const opacity = Math.abs(clamped);
    if (clamped >= 0) {
        return theme === "dark"
            ? `rgba(120, 188, 255, ${0.10 + opacity * 0.42})`
            : `rgba(11, 116, 222, ${0.08 + opacity * 0.34})`;
    }
    return theme === "dark"
        ? `rgba(239, 83, 80, ${0.12 + opacity * 0.3})`
        : `rgba(208, 74, 60, ${0.10 + opacity * 0.26})`;
};

const MetricCard = ({
    title,
    subtitle,
    children,
    footer,
    className,
    action,
}: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
    action?: ReactNode;
}) => (
    <article className={cn("terminal-widget min-h-0", className)}>
        <header className="terminal-widget-head">
            <div>
                <p className="text-sm font-semibold">{title}</p>
                {subtitle ? <p className="text-xs terminal-muted">{subtitle}</p> : null}
            </div>
            {action}
        </header>
        <div className="min-h-0 flex-1 p-3">{children}</div>
        {footer ? <div className="border-t border-[var(--terminal-border)] px-3 py-2 text-xs terminal-muted">{footer}</div> : null}
    </article>
);

const SummaryMetricTile = ({
    label,
    value,
}: {
    label: string;
    value: string;
}) => (
    <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
        <p className="text-[11px] uppercase tracking-[0.12em] terminal-muted">{label}</p>
        <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
);

const ComparisonTile = ({ item }: { item: BenchmarkComparisonPoint }) => (
    <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-sm font-semibold">{CORRELATION_LABEL_ALIAS[item.symbol.replace("^", "")] ?? item.name}</p>
                <p className="text-[11px] terminal-muted">{item.symbol}</p>
            </div>
            <div className={cn("text-right text-sm font-semibold", (item.relativeReturnPct ?? 0) >= 0 ? "terminal-up" : "terminal-down")}>
                {formatSignedPercent(item.relativeReturnPct, 1)}
            </div>
        </div>
        <div className="mt-3 grid gap-1 text-[11px] terminal-muted">
            <span>Index Return {formatSignedPercent(item.returnPct, 1)}</span>
            <span>Index CAGR {formatNullable(item.annualizedReturnPct, 1, "%")}</span>
            <span>Beta {formatNullable(item.beta120, 2)}</span>
            <span>Corr {formatNullable(item.correlation120, 2)}</span>
        </div>
    </div>
);

const CorrelationBar = ({
    label,
    symbol,
    correlation,
    returnPct,
    annualizedReturnPct,
    theme,
}: {
    label: string;
    symbol: string;
    correlation: number | null;
    returnPct: number;
    annualizedReturnPct: number | null;
    theme: "dark" | "light";
}) => {
    const normalized = correlation == null ? 0 : Math.max(-1, Math.min(1, correlation));
    const width = `${Math.abs(normalized) * 100}%`;

    return (
        <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-[11px] terminal-muted">{symbol}</p>
                </div>
                <div className="text-right text-sm font-semibold">{formatNullable(correlation, 2)}</div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--terminal-border)]">
                <div className="h-full rounded-full" style={{ width, background: getCorrelationBackground(normalized, theme) }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] terminal-muted">
                <span>1Y Return {formatSignedPercent(returnPct, 1)}</span>
                <span>1Y CAGR {formatNullable(annualizedReturnPct, 1, "%")}</span>
            </div>
        </div>
    );
};

export default function TerminalAssetMetricsPanel({ symbol, theme }: TerminalAssetMetricsPanelProps) {
    const [payload, setPayload] = useState<AssetMetricsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const load = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/market/asset-metrics?symbol=${encodeURIComponent(symbol)}`, {
                    cache: "no-store",
                    signal: controller.signal,
                });
                const data = (await response.json()) as AssetMetricsResponse;
                if (!isMounted) return;
                setPayload(data);
            } catch (fetchError) {
                if (!isMounted || controller.signal.aborted) return;
                setError(fetchError instanceof Error ? fetchError.message : "Failed to load asset metrics");
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
                      vol20: "#7cc6ff",
                      vol60: "#2dd4bf",
                      vol120: "#f59e0b",
                      drawdown: "#ef5350",
                      sharpe20: "#a78bfa",
                      sharpe60: "#38bdf8",
                      sharpe120: "#22c55e",
                      sortino20: "#c084fc",
                      sortino60: "#60a5fa",
                      sortino120: "#34d399",
                  }
                : {
                      grid: "rgba(81, 101, 126, 0.12)",
                      muted: "#5f728a",
                      vol20: "#0b74de",
                      vol60: "#0d9488",
                      vol120: "#d97706",
                      drawdown: "#d04a3c",
                      sharpe20: "#7c3aed",
                      sharpe60: "#0284c7",
                      sharpe120: "#16a34a",
                      sortino20: "#9333ea",
                      sortino60: "#2563eb",
                      sortino120: "#059669",
                  },
        [theme]
    );

    const metrics = payload?.metrics ?? [];
    const latest = metrics[metrics.length - 1];
    const maxDrawdown = metrics.reduce((lowest, point) => Math.min(lowest, point.drawdown), 0);

    const latestSensitivityPoint = useMemo(() => {
        const points = payload?.benchmarkSensitivity?.points ?? [];
        return points[points.length - 1];
    }, [payload?.benchmarkSensitivity?.points]);
    const sectorCorrelations = useMemo(
        () => [...(payload?.sectorCorrelations ?? [])].sort((left, right) => Math.abs(right.correlation1Y ?? 0) - Math.abs(left.correlation1Y ?? 0)),
        [payload?.sectorCorrelations]
    );

    const tooltipStyle = useMemo(
        () => ({
            background: "var(--terminal-panel)",
            border: "1px solid var(--terminal-border)",
            borderRadius: 8,
            color: "var(--terminal-text)",
        }),
        []
    );

    if (isLoading) {
        return (
            <article className="terminal-widget">
                <header className="terminal-widget-head">
                    <p className="text-sm font-semibold">Asset Metrics</p>
                </header>
                <div className="flex min-h-[320px] items-center justify-center text-sm terminal-muted">Loading asset metrics...</div>
            </article>
        );
    }

    if (error || metrics.length < 2) {
        return (
            <article className="terminal-widget">
                <header className="terminal-widget-head">
                    <p className="text-sm font-semibold">Asset Metrics</p>
                </header>
                <div className="flex min-h-[320px] items-center justify-center px-4 text-center text-sm terminal-down">
                    {error ?? "Not enough history to calculate asset metrics."}
                </div>
            </article>
        );
    }

    return (
        <article className="terminal-widget">
            <header className="terminal-widget-head">
                <div>
                    <p className="text-sm font-semibold">Asset Metrics</p>
                    <p className="text-xs terminal-muted">
                        Rolling risk analytics for {payload?.name ?? symbol}
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                    <span className="terminal-series-chip">{payload?.summary ? `Return ${formatSignedPercent(payload.summary.totalReturnPct, 1)}` : "Return --"}</span>
                    <span className="terminal-series-chip">{formatPerformanceLabel(payload?.summary ?? null)}</span>
                    <span className="terminal-series-chip">{payload?.updatedAt ? `Updated ${new Date(payload.updatedAt).toLocaleTimeString()}` : "--"}</span>
                </div>
            </header>

            <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-2">
                <MetricCard
                    title="Volatility"
                    subtitle="20D, 60D, 120D annualized realized volatility"
                    footer={
                        <div className="flex flex-wrap items-center gap-3">
                            <span>20D {formatNullable(latest?.vol20, 1, "%")}</span>
                            <span>60D {formatNullable(latest?.vol60, 1, "%")}</span>
                            <span>120D {formatNullable(latest?.vol120, 1, "%")}</span>
                            <span>{formatPerformanceLabel(payload?.summary ?? null)}</span>
                        </div>
                    }
                >
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metrics} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                                <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                                <XAxis dataKey="t" tickFormatter={formatDateTick} tick={{ fill: palette.muted, fontSize: 11 }} stroke="var(--terminal-border-strong)" minTickGap={24} />
                                <YAxis tickFormatter={(value) => `${Number(value).toFixed(0)}%`} tick={{ fill: palette.muted, fontSize: 11 }} stroke="var(--terminal-border-strong)" width={42} />
                                <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => formatDateTooltip(Number(value))} formatter={(value, name) => [formatNullable(asNullableNumber(value), 2, "%"), String(name).toUpperCase()]} />
                                <Line type="monotone" dataKey="vol20" stroke={palette.vol20} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="20D" />
                                <Line type="monotone" dataKey="vol60" stroke={palette.vol60} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="60D" />
                                <Line type="monotone" dataKey="vol120" stroke={palette.vol120} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="120D" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </MetricCard>

                <MetricCard
                    title="Drawdown"
                    subtitle="Historical peak-to-trough loss"
                    footer={
                        <div className="flex flex-wrap items-center gap-3">
                            <span>Current {formatNullable(latest?.drawdown, 1, "%")}</span>
                            <span>Max {formatNullable(maxDrawdown, 1, "%")}</span>
                            <span>Close {formatCompact(latest?.close)}</span>
                            <span>{payload?.summary ? `CAGR ${formatSignedPercent(payload.summary.annualizedReturnPct, 1)}` : "CAGR --"}</span>
                        </div>
                    }
                >
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                                <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                                <XAxis dataKey="t" tickFormatter={formatDateTick} tick={{ fill: palette.muted, fontSize: 11 }} stroke="var(--terminal-border-strong)" minTickGap={24} />
                                <YAxis tickFormatter={(value) => `${Number(value).toFixed(0)}%`} tick={{ fill: palette.muted, fontSize: 11 }} stroke="var(--terminal-border-strong)" width={48} />
                                <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => formatDateTooltip(Number(value))} formatter={(value) => [formatNullable(asNullableNumber(value), 2, "%"), "Drawdown"]} />
                                <Area type="monotone" dataKey="drawdown" stroke={palette.drawdown} fill={palette.drawdown} fillOpacity={0.18} strokeWidth={2} dot={false} isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </MetricCard>

                <MetricCard
                    title="Sharpe Ratio"
                    subtitle="Rolling annualized Sharpe using daily returns"
                    footer={
                        <div className="flex flex-wrap items-center gap-3">
                            <span>20D {formatNullable(latest?.sharpe20)}</span>
                            <span>60D {formatNullable(latest?.sharpe60)}</span>
                            <span>120D {formatNullable(latest?.sharpe120)}</span>
                        </div>
                    }
                >
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metrics} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                                <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                                <XAxis dataKey="t" tickFormatter={formatDateTick} tick={{ fill: palette.muted, fontSize: 11 }} stroke="var(--terminal-border-strong)" minTickGap={24} />
                                <YAxis tick={{ fill: palette.muted, fontSize: 11 }} stroke="var(--terminal-border-strong)" width={42} />
                                <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => formatDateTooltip(Number(value))} formatter={(value, name) => [formatNullable(asNullableNumber(value)), String(name).toUpperCase()]} />
                                <Line type="monotone" dataKey="sharpe20" stroke={palette.sharpe20} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="20D" />
                                <Line type="monotone" dataKey="sharpe60" stroke={palette.sharpe60} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="60D" />
                                <Line type="monotone" dataKey="sharpe120" stroke={palette.sharpe120} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="120D" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </MetricCard>

                <MetricCard
                    title="Sortino Ratio"
                    subtitle="Rolling annualized Sortino using downside deviation"
                    footer={
                        <div className="flex flex-wrap items-center gap-3">
                            <span>20D {formatNullable(latest?.sortino20)}</span>
                            <span>60D {formatNullable(latest?.sortino60)}</span>
                            <span>120D {formatNullable(latest?.sortino120)}</span>
                        </div>
                    }
                >
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metrics} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                                <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                                <XAxis dataKey="t" tickFormatter={formatDateTick} tick={{ fill: palette.muted, fontSize: 11 }} stroke="var(--terminal-border-strong)" minTickGap={24} />
                                <YAxis tick={{ fill: palette.muted, fontSize: 11 }} stroke="var(--terminal-border-strong)" width={42} />
                                <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => formatDateTooltip(Number(value))} formatter={(value, name) => [formatNullable(asNullableNumber(value)), String(name).toUpperCase()]} />
                                <Line type="monotone" dataKey="sortino20" stroke={palette.sortino20} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="20D" />
                                <Line type="monotone" dataKey="sortino60" stroke={palette.sortino60} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="60D" />
                                <Line type="monotone" dataKey="sortino120" stroke={palette.sortino120} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="120D" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </MetricCard>

                <MetricCard
                    title="Trailing Beta & Correlation"
                    subtitle={
                        payload?.benchmarkSensitivity
                            ? `20D, 60D and 120D rolling beta and correlation vs ${payload.benchmarkSensitivity.benchmarkName}`
                            : "Rolling beta and correlation vs benchmark"
                    }
                    footer={
                        payload?.benchmarkSensitivity ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <span>20D Beta {formatNullable(latestSensitivityPoint?.beta20)}</span>
                                <span>60D Beta {formatNullable(latestSensitivityPoint?.beta60)}</span>
                                <span>120D Beta {formatNullable(latestSensitivityPoint?.beta120)}</span>
                                <span>20D Corr {formatNullable(latestSensitivityPoint?.corr20)}</span>
                                <span>60D Corr {formatNullable(latestSensitivityPoint?.corr60)}</span>
                                <span>120D Corr {formatNullable(latestSensitivityPoint?.corr120)}</span>
                            </div>
                        ) : (
                            "Benchmark sensitivity needs enough overlapping daily history to calculate 20D, 60D and 120D windows."
                        )
                    }
                >
                    {payload?.benchmarkSensitivity?.points.length ? (
                        <div className="h-[260px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={payload.benchmarkSensitivity.points} margin={{ top: 8, right: 14, bottom: 0, left: 0 }}>
                                    <CartesianGrid stroke={palette.grid} strokeDasharray="3 3" />
                                    <XAxis dataKey="t" tickFormatter={formatDateTick} tick={{ fill: palette.muted, fontSize: 11 }} stroke="var(--terminal-border-strong)" minTickGap={24} />
                                    <YAxis
                                        yAxisId="beta"
                                        tick={{ fill: palette.muted, fontSize: 11 }}
                                        stroke="var(--terminal-border-strong)"
                                        width={42}
                                        domain={["auto", "auto"]}
                                    />
                                    <YAxis
                                        yAxisId="corr"
                                        orientation="right"
                                        domain={[-1, 1]}
                                        tick={{ fill: palette.muted, fontSize: 11 }}
                                        stroke="var(--terminal-border-strong)"
                                        width={42}
                                    />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        labelFormatter={(value) => formatDateTooltip(Number(value))}
                                        formatter={(value, name) => [formatNullable(asNullableNumber(value)), String(name)]}
                                    />
                                    <Line yAxisId="beta" type="monotone" dataKey="beta20" stroke="#93c5fd" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="20D Beta" />
                                    <Line yAxisId="beta" type="monotone" dataKey="beta60" stroke="#7c8cff" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="60D Beta" />
                                    <Line yAxisId="beta" type="monotone" dataKey="beta120" stroke="#38d39f" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="120D Beta" />
                                    <Line yAxisId="corr" type="monotone" dataKey="corr20" stroke="#fbbf24" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="20D Corr" />
                                    <Line yAxisId="corr" type="monotone" dataKey="corr60" stroke="#6bc7ff" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="60D Corr" />
                                    <Line yAxisId="corr" type="monotone" dataKey="corr120" stroke="#ffca3a" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="120D Corr" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex min-h-[260px] items-center justify-center text-center text-sm terminal-muted">
                            Benchmark sensitivity is unavailable for this instrument.
                        </div>
                    )}
                </MetricCard>

                <TerminalPriceTargetsPanel symbol={symbol} theme={theme} />

                <MetricCard
                    title="Risk-Adjusted Return Metrics"
                    subtitle="Snapshot of return, downside and benchmark-relative efficiency"
                    className="lg:col-span-2"
                    footer={
                        payload?.riskAdjustedSummary ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <span>Total Return {formatSignedPercent(payload.riskAdjustedSummary.totalReturnPct, 1)}</span>
                                <span>Volatility {formatNullable(payload.riskAdjustedSummary.annualizedVolatilityPct, 1, "%")}</span>
                                <span>Max Drawdown {formatNullable(payload.riskAdjustedSummary.maxDrawdownPct, 1, "%")}</span>
                                <span>Market Corr {formatNullable(payload.riskAdjustedSummary.marketCorrelation, 2)}</span>
                            </div>
                        ) : (
                            "Risk-adjusted metrics need enough daily history to estimate 120D volatility, beta and downside statistics."
                        )
                    }
                >
                    {payload?.riskAdjustedSummary ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <SummaryMetricTile label="Total Return" value={formatSignedPercent(payload.riskAdjustedSummary.totalReturnPct, 1)} />
                            <SummaryMetricTile label="CAGR" value={formatSignedPercent(payload.riskAdjustedSummary.annualizedReturnPct, 1)} />
                            <SummaryMetricTile label="Ann. Volatility" value={formatNullable(payload.riskAdjustedSummary.annualizedVolatilityPct, 1, "%")} />
                            <SummaryMetricTile label="Sharpe Ratio" value={formatNullable(payload.riskAdjustedSummary.sharpeRatio, 2)} />
                            <SummaryMetricTile label="Sortino Ratio" value={formatNullable(payload.riskAdjustedSummary.sortinoRatio, 2)} />
                            <SummaryMetricTile label="Calmar Ratio" value={formatNullable(payload.riskAdjustedSummary.calmarRatio, 2)} />
                            <SummaryMetricTile label="Return / Volatility" value={formatNullable(payload.riskAdjustedSummary.returnPerVolatility, 2)} />
                            <SummaryMetricTile label="Trailing Beta" value={formatNullable(payload.riskAdjustedSummary.trailingBeta, 2)} />
                            <SummaryMetricTile label="Market Correlation" value={formatNullable(payload.riskAdjustedSummary.marketCorrelation, 2)} />
                        </div>
                    ) : (
                        <div className="flex min-h-[220px] items-center justify-center text-center text-sm terminal-muted">
                            Risk-adjusted metrics are unavailable for this instrument.
                        </div>
                    )}
                </MetricCard>

                <MetricCard
                    title="Return vs Major Indexes"
                    subtitle="Relative performance versus the major U.S. benchmarks"
                    className="lg:col-span-2"
                    footer={
                        <div className="flex flex-wrap items-center gap-3">
                            <span>Benchmarks {payload?.benchmarkComparisons.length ?? 0}</span>
                            <span>Relative return compares the stock total return against each index</span>
                        </div>
                    }
                >
                    {payload?.benchmarkComparisons.length ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {payload.benchmarkComparisons.map((item) => (
                                <ComparisonTile key={item.symbol} item={item} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex min-h-[220px] items-center justify-center text-center text-sm terminal-muted">
                            Benchmark-relative return metrics are unavailable for this instrument.
                        </div>
                    )}
                </MetricCard>

                <MetricCard
                    title="Market & Sector Correlations"
                    subtitle="Rolling market sensitivity and one-year sector correlation snapshot"
                    className="lg:col-span-2"
                    footer={
                        <div className="flex flex-wrap items-center gap-3">
                            <span>Market comparisons {payload?.benchmarkComparisons.length ?? 0}</span>
                            <span>Sectors {sectorCorrelations.length}</span>
                        </div>
                    }
                >
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <div className="grid gap-3 sm:grid-cols-2">
                            {(payload?.benchmarkComparisons ?? []).map((item) => (
                                <div key={`market-${item.symbol}`} className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold">{CORRELATION_LABEL_ALIAS[item.symbol.replace("^", "")] ?? item.name}</p>
                                            <p className="text-[11px] terminal-muted">{item.symbol}</p>
                                        </div>
                                        <div className={cn("text-right text-sm font-semibold", (item.correlation120 ?? 0) >= 0 ? "terminal-up" : "terminal-down")}>
                                            {formatNullable(item.correlation120, 2)}
                                        </div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-3 text-[11px] terminal-muted">
                                        <span>Beta {formatNullable(item.beta120, 2)}</span>
                                        <span>Rel Return {formatSignedPercent(item.relativeReturnPct, 1)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            {sectorCorrelations.map((sector) => (
                                <CorrelationBar
                                    key={sector.symbol}
                                    label={sector.label}
                                    symbol={sector.symbol}
                                    correlation={sector.correlation1Y}
                                    returnPct={sector.returnPct}
                                    annualizedReturnPct={sector.annualizedReturnPct}
                                    theme={theme}
                                />
                            ))}
                        </div>
                    </div>
                </MetricCard>
            </div>
        </article>
    );
}
