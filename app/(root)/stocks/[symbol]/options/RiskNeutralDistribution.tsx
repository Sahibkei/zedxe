"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";

import { fetchRiskNeutralDistribution } from "@/lib/options/client";
import { formatIV, formatNumber, formatPercent } from "@/lib/options/format";
import type { RiskNeutralDistributionResponse } from "@/lib/options/types";
import { cn } from "@/lib/utils";

type RiskNeutralDistributionProps = {
    symbol: string;
    expiries: string[];
    selectedExpiry: string;
    setSelectedExpiry: (value: string) => void;
    r: number;
    setR: (value: number) => void;
    q: number;
    setQ: (value: number) => void;
    loadingExpiries: boolean;
};

type ChartSeries = {
    x: number[];
    y: number[];
};

const chartDimensions = {
    width: 960,
    height: 360,
    padding: 56,
};

const formatProbability = (value?: number | null) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return "--";
    return formatPercent(value * 100, 2);
};

const formatExpectedMove = (value?: number | null) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return "--";
    return `±${formatNumber(value, 2)}`;
};

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold text-foreground">{value}</p>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
    );
}

function ChartCard({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-lg backdrop-blur space-y-3">
            <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {children}
        </div>
    );
}

function ChartSkeleton() {
    return (
        <div className="h-64 w-full animate-pulse rounded-xl border border-border/60 bg-muted/30" role="status">
            <div className="h-full w-full rounded-xl bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20" />
        </div>
    );
}

function LineChart({
    series,
    color,
    yMaxOverride,
    spot,
    ariaLabel,
}: {
    series: ChartSeries;
    color: string;
    yMaxOverride?: number;
    spot?: number | null;
    ariaLabel: string;
}) {
    const { width, height, padding } = chartDimensions;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const xValues = series.x;
    const yValues = series.y;
    const xMin = xValues.length > 0 ? Math.min(...xValues) : 0;
    const xMax = xValues.length > 0 ? Math.max(...xValues) : 1;
    const yMaxBase = yValues.length > 0 ? Math.max(...yValues) : 1;
    const yMax = Math.max(yMaxOverride ?? yMaxBase * 1.1, 1e-6);

    const projectX = (value: number) => padding + ((value - xMin) / (xMax - xMin || 1)) * chartWidth;
    const projectY = (value: number) => padding + chartHeight - (value / yMax) * chartHeight;

    const path = xValues
        .map((value, index) => {
            const x = projectX(value);
            const y = projectY(yValues[index] ?? 0);
            return `${index === 0 ? "M" : "L"}${x} ${y}`;
        })
        .join(" ");

    const xTicks = 5;
    const yTicks = 4;

    const renderSpotLine = () => {
        if (!Number.isFinite(spot ?? NaN)) return null;
        const x = projectX(spot as number);
        return (
            <>
                <line x1={x} x2={x} y1={padding} y2={padding + chartHeight} stroke="currentColor" strokeOpacity={0.2} />
                <text x={x + 6} y={padding + 12} fontSize={10} fill="currentColor" opacity={0.6}>
                    Spot
                </text>
            </>
        );
    };

    return (
        <div className="h-64 w-full">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label={ariaLabel}>
                <rect x={padding} y={padding} width={chartWidth} height={chartHeight} fill="url(#rndChartGrid)" opacity={0.02} />
                <defs>
                    <linearGradient id="rndChartGrid" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="currentColor" stopOpacity={0.04} />
                        <stop offset="100%" stopColor="currentColor" stopOpacity={0.12} />
                    </linearGradient>
                </defs>
                {[...Array(yTicks)].map((_, index) => {
                    const ratio = index / (yTicks - 1 || 1);
                    const y = padding + chartHeight - ratio * chartHeight;
                    const value = yMax * ratio;
                    return (
                        <g key={`y-${index}`}>
                            <line x1={padding} x2={padding + chartWidth} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} />
                            <text x={padding - 12} y={y + 4} fontSize={10} fill="currentColor" opacity={0.6} textAnchor="end">
                                {value.toFixed(3)}
                            </text>
                        </g>
                    );
                })}
                {[...Array(xTicks)].map((_, index) => {
                    const ratio = index / (xTicks - 1 || 1);
                    const x = padding + ratio * chartWidth;
                    const value = xMin + ratio * (xMax - xMin);
                    return (
                        <g key={`x-${index}`}>
                            <line x1={x} x2={x} y1={padding} y2={padding + chartHeight} stroke="currentColor" strokeOpacity={0.05} />
                            <text x={x} y={padding + chartHeight + 18} fontSize={10} fill="currentColor" opacity={0.6} textAnchor="middle">
                                {formatNumber(value, 0)}
                            </text>
                        </g>
                    );
                })}
                <line
                    x1={padding}
                    x2={padding + chartWidth}
                    y1={padding + chartHeight}
                    y2={padding + chartHeight}
                    stroke="currentColor"
                    strokeOpacity={0.25}
                />
                <line x1={padding} x2={padding} y1={padding} y2={padding + chartHeight} stroke="currentColor" strokeOpacity={0.25} />
                {renderSpotLine()}
                <path d={path} fill="none" stroke={color} strokeWidth={2} opacity={0.9} />
            </svg>
        </div>
    );
}

/**
 * Render the risk-neutral distribution tab UI and charts.
 */
export default function RiskNeutralDistribution({
    symbol,
    expiries,
    selectedExpiry,
    setSelectedExpiry,
    r,
    setR,
    q,
    setQ,
    loadingExpiries,
}: RiskNeutralDistributionProps) {
    const [distribution, setDistribution] = useState<RiskNeutralDistributionResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const abortRef = useRef<AbortController | null>(null);

    const handleCompute = async () => {
        if (!selectedExpiry) {
            setError("Select an expiry to compute the distribution.");
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);

        try {
            const response = await fetchRiskNeutralDistribution(symbol, selectedExpiry, r, q, controller.signal);
            if (controller.signal.aborted) return;
            setDistribution(response);
            setWarnings(response.warnings ?? []);
        } catch (fetchError) {
            if (controller.signal.aborted) return;
            const message = fetchError instanceof Error ? fetchError.message : "Unable to fetch distribution data.";
            setError(message);
            setDistribution(null);
            setWarnings([]);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    };

    const pdfSeries = useMemo<ChartSeries>(() => {
        if (!distribution) return { x: [], y: [] };
        return { x: distribution.grid.x, y: distribution.grid.pdf };
    }, [distribution]);

    const cdfSeries = useMemo<ChartSeries>(() => {
        if (!distribution) return { x: [], y: [] };
        return { x: distribution.grid.x, y: distribution.grid.cdf };
    }, [distribution]);

    const summary = useMemo(() => {
        if (!distribution) {
            return {
                spot: "--",
                forward: "--",
                sigma: "--",
                expectedMove: "--",
                pAbove: "--",
                pBelow: "--",
            };
        }

        return {
            spot: formatNumber(distribution.spot, 2),
            forward: formatNumber(distribution.forward, 2),
            sigma: formatIV(distribution.sigma, 2),
            expectedMove: formatExpectedMove(distribution.stats.expectedMove),
            pAbove: formatProbability(distribution.stats.probabilityAboveSpot),
            pBelow: formatProbability(distribution.stats.probabilityBelowSpot),
        };
    }, [distribution]);

    const isComputeDisabled = loading || loadingExpiries || !selectedExpiry;

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-lg backdrop-blur space-y-5">
                <div className="space-y-1">
                    <h3 className="text-xl font-semibold text-foreground">Risk-Neutral Distribution</h3>
                    <p className="text-sm text-muted-foreground">
                        Estimate the terminal distribution using a lognormal model calibrated to the ATM implied volatility.
                    </p>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1.4fr_1.2fr_1fr_1fr_auto]">
                    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Symbol</span>
                        <input
                            value={symbol}
                            readOnly
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        />
                        <span className="text-xs text-muted-foreground">Read-only from the route.</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Expiry</span>
                        <select
                            className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                            value={selectedExpiry}
                            onChange={(event) => setSelectedExpiry(event.target.value)}
                            disabled={loadingExpiries || expiries.length === 0}
                        >
                            <option value="">Select expiry</option>
                            {expiries.map((expiry) => (
                                <option key={expiry} value={expiry}>
                                    {expiry}
                                </option>
                            ))}
                        </select>
                        <span className="text-xs text-muted-foreground">
                            {loadingExpiries ? "Loading expiries..." : "Choose the expiration date."}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Rate (r)</span>
                        <input
                            type="number"
                            step="0.001"
                            value={r}
                            onChange={(event) => setR(Number(event.target.value))}
                            className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">Annualized risk-free rate.</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Dividend yield (q)</span>
                        <input
                            type="number"
                            step="0.001"
                            value={q}
                            onChange={(event) => setQ(Number(event.target.value))}
                            className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">Annualized dividend yield.</span>
                    </div>
                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={handleCompute}
                            disabled={isComputeDisabled}
                            className={cn(
                                "h-11 w-full rounded-xl px-4 text-sm font-semibold shadow-sm transition",
                                isComputeDisabled
                                    ? "cursor-not-allowed bg-muted/30 text-muted-foreground"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                            )}
                        >
                            {distribution ? "Refresh" : "Compute"}
                        </button>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span>{error}</span>
                            <button
                                type="button"
                                onClick={handleCompute}
                                className="rounded-lg border border-destructive/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-destructive hover:bg-destructive/10"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                ) : null}

                {warnings.length > 0 ? (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                        <p className="text-xs uppercase tracking-wide text-amber-200/80">Warnings</p>
                        <ul className="list-disc space-y-1 pl-4 text-sm">
                            {warnings.map((warning, index) => (
                                <li key={`warn-${index}`}>{warning}</li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <SummaryCard label="Spot" value={summary.spot} />
                    <SummaryCard label="Forward" value={summary.forward} hint="S·exp((r-q)T)" />
                    <SummaryCard label="ATM IV Used" value={summary.sigma} />
                    <SummaryCard label="Expected Move (±1σ)" value={summary.expectedMove} />
                    <SummaryCard label="P(Sᵀ > Spot)" value={summary.pAbove} />
                    <SummaryCard label="P(Sᵀ < Spot)" value={summary.pBelow} />
                </div>
            </div>

            <ChartCard title="Probability Density (PDF)" description="Risk-neutral density across the terminal price grid.">
                {loading ? (
                    <ChartSkeleton />
                ) : distribution ? (
                    <LineChart series={pdfSeries} color="#38bdf8" spot={distribution.spot} ariaLabel="Risk-neutral PDF chart" />
                ) : (
                    <p className="text-sm text-muted-foreground">Run Compute to render the PDF.</p>
                )}
            </ChartCard>

            <ChartCard title="Cumulative Distribution (CDF)" description="Probability the terminal price is less than or equal to a level.">
                {loading ? (
                    <ChartSkeleton />
                ) : distribution ? (
                    <LineChart
                        series={cdfSeries}
                        color="#fbbf24"
                        yMaxOverride={1}
                        spot={distribution.spot}
                        ariaLabel="Risk-neutral CDF chart"
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">Run Compute to render the CDF.</p>
                )}
            </ChartCard>

            <p className="text-xs text-muted-foreground">
                Risk-neutral distribution is model-based; values may differ across vendors.
            </p>
        </div>
    );
}
