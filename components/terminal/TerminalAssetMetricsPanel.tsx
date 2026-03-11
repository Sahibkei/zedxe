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
import { cn } from "@/lib/utils";

type PricePoint = {
    t: number;
    close: number;
};

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
};

type BenchmarkSensitivityPoint = {
    t: number;
    beta60: number | null;
    beta120: number | null;
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

type SectorRiskPoint = {
    symbol: string;
    label: string;
    returnPct: number;
    correlationToBenchmark: number | null;
};

type CorrelationMatrix = {
    labels: string[];
    values: number[][];
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
    riskMatrix: {
        benchmarkSymbol: string;
        benchmarkName: string;
        benchmarkSummary: PerformanceSummary | null;
        sectors: SectorRiskPoint[];
        sectorSeries: Array<{
            symbol: string;
            label: string;
            points: PricePoint[];
        }>;
        correlations: CorrelationMatrix;
    } | null;
};

type TerminalAssetMetricsPanelProps = {
    symbol: string;
    theme: "dark" | "light";
};

type RiskRangeKey = "1D" | "1W" | "1M" | "1Y" | "5Y";

const RISK_RANGE_OPTIONS: Array<{ key: RiskRangeKey; label: string; tradingDays: number }> = [
    { key: "1D", label: "1D", tradingDays: 1 },
    { key: "1W", label: "1W", tradingDays: 5 },
    { key: "1M", label: "1M", tradingDays: 21 },
    { key: "1Y", label: "1Y", tradingDays: 252 },
    { key: "5Y", label: "5Y", tradingDays: 1260 },
];

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

const getPerformanceSummary = (points: PricePoint[], tradingDays: number): PerformanceSummary | null => {
    if (points.length < 2) return null;

    const end = points[points.length - 1];
    const startIndex = Math.max(0, points.length - 1 - tradingDays);
    const start = points[startIndex];
    if (!start || start.close <= 0 || end.close <= 0) return null;

    const years = Math.max((end.t - start.t) / (365.25 * 24 * 60 * 60), 0);
    const totalReturnPct = ((end.close / start.close) - 1) * 100;
    const annualizedReturnPct =
        years >= 1 ? (Math.pow(end.close / start.close, 1 / years) - 1) * 100 : null;

    return {
        totalReturnPct,
        annualizedReturnPct,
        years,
        startClose: start.close,
        endClose: end.close,
    };
};

const getHeatmapBackground = (value: number, theme: "dark" | "light") => {
    const intensity = Math.min(Math.abs(value) / 40, 1);
    if (value >= 0) {
        return theme === "dark"
            ? `rgba(34, 197, 94, ${0.12 + intensity * 0.45})`
            : `rgba(15, 159, 99, ${0.10 + intensity * 0.38})`;
    }
    return theme === "dark"
        ? `rgba(239, 83, 80, ${0.14 + intensity * 0.42})`
        : `rgba(208, 74, 60, ${0.12 + intensity * 0.36})`;
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

const HeatmapTile = ({
    label,
    symbol,
    returnPct,
    annualizedReturnPct,
    correlationToBenchmark,
    theme,
}: {
    label: string;
    symbol: string;
    returnPct: number;
    annualizedReturnPct: number | null;
    correlationToBenchmark: number | null;
    theme: "dark" | "light";
}) => (
    <div
        className="rounded-lg border border-[var(--terminal-border)] p-3"
        style={{ background: getHeatmapBackground(returnPct, theme) }}
    >
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-[11px] terminal-muted">{symbol}</p>
            </div>
            <div className={cn("text-right text-sm font-semibold", returnPct >= 0 ? "terminal-up" : "terminal-down")}>
                {formatSignedPercent(returnPct, 1)}
            </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] terminal-muted">
            <span>CAGR {formatNullable(annualizedReturnPct, 1, "%")}</span>
            <span>Corr {formatNullable(correlationToBenchmark, 2)}</span>
        </div>
    </div>
);

export default function TerminalAssetMetricsPanel({ symbol, theme }: TerminalAssetMetricsPanelProps) {
    const [payload, setPayload] = useState<AssetMetricsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [riskRangeKey, setRiskRangeKey] = useState<RiskRangeKey>("1Y");

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
                  },
        [theme]
    );

    const metrics = payload?.metrics ?? [];
    const latest = metrics[metrics.length - 1];
    const maxDrawdown = metrics.reduce((lowest, point) => Math.min(lowest, point.drawdown), 0);

    const riskRange = useMemo(
        () => RISK_RANGE_OPTIONS.find((option) => option.key === riskRangeKey) ?? RISK_RANGE_OPTIONS[3],
        [riskRangeKey]
    );
    const riskMatrix = payload?.riskMatrix;

    const sectorHeatmapData = useMemo(() => {
        const sectorSeries = riskMatrix?.sectorSeries ?? [];
        const correlationMap = new Map(
            (riskMatrix?.sectors ?? []).map((sector) => [sector.symbol, sector.correlationToBenchmark])
        );

        return sectorSeries
            .map((sector) => {
                const summary = getPerformanceSummary(sector.points, riskRange.tradingDays);
                return {
                    symbol: sector.symbol,
                    label: sector.label,
                    returnPct: summary?.totalReturnPct ?? 0,
                    annualizedReturnPct: summary?.annualizedReturnPct ?? null,
                    correlationToBenchmark: correlationMap.get(sector.symbol) ?? null,
                };
            })
            .sort((left, right) => right.returnPct - left.returnPct);
    }, [riskMatrix?.sectorSeries, riskMatrix?.sectors, riskRange.tradingDays]);

    const latestSensitivityPoint = useMemo(() => {
        const points = payload?.benchmarkSensitivity?.points ?? [];
        return points[points.length - 1];
    }, [payload?.benchmarkSensitivity?.points]);

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
                    title="Benchmark Sensitivity"
                    subtitle={
                        payload?.benchmarkSensitivity
                            ? `60D and 120D rolling beta and correlation vs ${payload.benchmarkSensitivity.benchmarkName}`
                            : "Rolling beta and correlation vs benchmark"
                    }
                    footer={
                        payload?.benchmarkSensitivity ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <span>60D Beta {formatNullable(latestSensitivityPoint?.beta60)}</span>
                                <span>120D Beta {formatNullable(latestSensitivityPoint?.beta120)}</span>
                                <span>60D Corr {formatNullable(latestSensitivityPoint?.corr60)}</span>
                                <span>120D Corr {formatNullable(latestSensitivityPoint?.corr120)}</span>
                            </div>
                        ) : (
                            "Benchmark sensitivity needs enough overlapping daily history to calculate 60D and 120D windows."
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
                                    <Line yAxisId="beta" type="monotone" dataKey="beta60" stroke="#7c8cff" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="60D Beta" />
                                    <Line yAxisId="beta" type="monotone" dataKey="beta120" stroke="#38d39f" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} name="120D Beta" />
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

                <MetricCard
                    title="Index Sector Risk Matrix"
                    subtitle={
                        riskMatrix
                            ? `${riskRange.label} sector heatmap and 1Y correlation matrix vs ${riskMatrix.benchmarkName}`
                            : "Available for major U.S. equity indices"
                    }
                    className="lg:col-span-2"
                    action={
                        riskMatrix ? (
                            <div className="flex flex-wrap items-center gap-1">
                                {RISK_RANGE_OPTIONS.map((option) => (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setRiskRangeKey(option.key)}
                                        className={cn("terminal-mini-btn", riskRangeKey === option.key && "terminal-mini-btn-active")}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        ) : null
                    }
                    footer={
                        riskMatrix ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <span>Benchmark {riskMatrix.benchmarkSymbol}</span>
                                <span>Sectors {riskMatrix.sectorSeries.length}</span>
                                <span>Heatmap {riskRange.label}</span>
                                <span>{riskMatrix.benchmarkSummary ? `Benchmark CAGR ${formatSignedPercent(riskMatrix.benchmarkSummary.annualizedReturnPct, 1)}` : "Benchmark CAGR --"}</span>
                            </div>
                        ) : (
                            "Sector risk view is currently limited to ^GSPC, ^NDX, ^DJI, and ^RUT."
                        )
                    }
                >
                    {riskMatrix ? (
                        <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                            <div className="grid min-h-0 gap-3">
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {sectorHeatmapData.map((sector) => (
                                        <HeatmapTile
                                            key={sector.symbol}
                                            label={sector.label}
                                            symbol={sector.symbol}
                                            returnPct={sector.returnPct}
                                            annualizedReturnPct={sector.annualizedReturnPct}
                                            correlationToBenchmark={sector.correlationToBenchmark}
                                            theme={theme}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="min-w-0 rounded-lg border border-[var(--terminal-border)] p-3">
                                <div
                                    className="grid gap-1"
                                    style={{
                                        gridTemplateColumns: `72px repeat(${riskMatrix.correlations.labels.length}, minmax(40px, 1fr))`,
                                    }}
                                >
                                    <div />
                                    {riskMatrix.correlations.labels.map((label) => (
                                        <div key={`header-${label}`} className="px-0.5 text-center text-[10px] font-semibold terminal-muted">
                                            {CORRELATION_LABEL_ALIAS[label] ?? label}
                                        </div>
                                    ))}
                                    {riskMatrix.correlations.values.map((row, rowIndex) => (
                                        <div key={`row-${riskMatrix.correlations.labels[rowIndex]}`} className="contents">
                                            <div className="flex items-center text-[10px] font-semibold terminal-muted">
                                                {CORRELATION_LABEL_ALIAS[riskMatrix.correlations.labels[rowIndex]] ??
                                                    riskMatrix.correlations.labels[rowIndex]}
                                            </div>
                                            {row.map((value, columnIndex) => (
                                                <div
                                                    key={`${rowIndex}-${columnIndex}`}
                                                    className="flex min-h-9 items-center justify-center rounded-md border border-[var(--terminal-border)] text-[10px] font-semibold"
                                                    style={{ background: getCorrelationBackground(value, theme) }}
                                                    title={`${riskMatrix.correlations.labels[rowIndex]} / ${riskMatrix.correlations.labels[columnIndex]}: ${value.toFixed(2)}`}
                                                >
                                                    {value.toFixed(2)}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-h-[260px] items-center justify-center text-center text-sm terminal-muted">
                            Sector return and correlation analytics are shown for major U.S. equity indices only.
                        </div>
                    )}
                </MetricCard>
            </div>
        </article>
    );
}
