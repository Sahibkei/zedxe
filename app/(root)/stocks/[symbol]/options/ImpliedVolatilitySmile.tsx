"use client";

import { useMemo, useState } from "react";

import { impliedVolBisection, moneyness as moneynessRatio } from "@/lib/options/bs";
import { formatNumber, formatPercent } from "@/lib/options/format";
import type { OptionContract, OptionSide } from "@/lib/options/types";
import { cn } from "@/lib/utils";

type ImpliedVolatilitySmileProps = {
    symbol: string;
    spot: number | null;
    expiry: string | null;
    tYears: number | null;
    r: number;
    q: number;
    contracts: OptionContract[];
};

type ChartPoint = {
    strike: number;
    moneyness: number;
    iv: number;
    side: OptionSide;
    bid: number;
    ask: number;
    mid: number;
    last?: number | null;
};

type PlotPoint = ChartPoint & { xValue: number };

const CALL_COLOR = "#2dd4bf";
const PUT_COLOR = "#fbbf24";

const X_AXIS_LABELS: Record<"strike" | "moneyness", string> = {
    strike: "Strike",
    moneyness: "Moneyness (K/S)",
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function computeTimeToExpiryYears(expiry: string | null): number | null {
    if (!expiry) return null;
    const today = new Date();
    const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const expiryDate = new Date(`${expiry}T00:00:00Z`);
    const diff = expiryDate.getTime() - startOfToday;
    const days = diff / MS_PER_DAY;
    if (!Number.isFinite(days) || days <= 0) return null;
    return Number((days / 365).toFixed(6));
}

function getMidPrice(contract: OptionContract): number | null {
    const hasBidAsk = Number.isFinite(contract.bid) && Number.isFinite(contract.ask);
    if (hasBidAsk) {
        const mid = (contract.bid + contract.ask) / 2;
        return Number.isFinite(mid) ? mid : null;
    }

    if (Number.isFinite(contract.last ?? NaN)) {
        return contract.last ?? null;
    }

    return null;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="font-semibold text-foreground">{value}</span>
        </div>
    );
}

export default function ImpliedVolatilitySmile({ symbol, spot, expiry, tYears, r, q, contracts }: ImpliedVolatilitySmileProps) {
    const [sideView, setSideView] = useState<"both" | OptionSide>("both");
    const [xAxis, setXAxis] = useState<"strike" | "moneyness">("strike");
    const [refreshTick, setRefreshTick] = useState(0);

    const resolvedTime = useMemo(() => tYears ?? computeTimeToExpiryYears(expiry), [expiry, tYears]);
    const resolvedSpot = useMemo(() => (Number.isFinite(spot ?? NaN) && (spot ?? 0) > 0 ? (spot as number) : null), [spot]);

    const derived = useMemo(() => {
        if (!contracts?.length) return { calls: [] as ChartPoint[], puts: [] as ChartPoint[] };
        if (!resolvedSpot || !resolvedTime || resolvedTime <= 0) return { calls: [] as ChartPoint[], puts: [] as ChartPoint[] };

        const calls: ChartPoint[] = [];
        const puts: ChartPoint[] = [];

        contracts.forEach((contract) => {
            const mid = getMidPrice(contract);
            if (mid === null || mid <= 0) return;

            const iv = impliedVolBisection({
                side: contract.side,
                S: resolvedSpot,
                K: contract.strike,
                r,
                q,
                t: resolvedTime,
                price: mid,
            });

            if (iv === null || !Number.isFinite(iv)) return;

            const point: ChartPoint = {
                strike: contract.strike,
                moneyness: moneynessRatio(resolvedSpot, contract.strike),
                iv,
                side: contract.side,
                bid: contract.bid,
                ask: contract.ask,
                mid,
                last: contract.last ?? null,
            };

            if (contract.side === "call") {
                calls.push(point);
            } else {
                puts.push(point);
            }
        });

        return { calls, puts };
    }, [contracts, resolvedSpot, resolvedTime, r, q, refreshTick]);

    const allPoints = useMemo(() => [...derived.calls, ...derived.puts], [derived.calls, derived.puts]);

    const atmIv = useMemo(() => {
        if (!resolvedSpot || allPoints.length === 0) return null;
        let closest: ChartPoint | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        allPoints.forEach((point) => {
            const distance = Math.abs(point.strike - resolvedSpot);
            if (
                distance < bestDistance ||
                (distance === bestDistance && closest && closest.side === "put" && point.side === "call")
            ) {
                closest = point;
                bestDistance = distance;
            }
        });

        return closest?.iv ?? null;
    }, [allPoints, resolvedSpot]);

    const filteredPoints = useMemo(() => {
        if (sideView === "both") return allPoints;
        return allPoints.filter((point) => point.side === sideView);
    }, [allPoints, sideView]);

    const plottedPoints: PlotPoint[] = useMemo(() => {
        return filteredPoints
            .map((point) => {
                const xValue = xAxis === "strike" ? point.strike : point.moneyness;
                if (!Number.isFinite(xValue)) return null;
                return { ...point, xValue } as PlotPoint;
            })
            .filter((point): point is PlotPoint => Boolean(point));
    }, [filteredPoints, xAxis]);

    const yMax = useMemo(() => {
        if (plottedPoints.length === 0) return 1;
        const maxValue = Math.max(...plottedPoints.map((point) => point.iv));
        const padded = maxValue > 0 ? maxValue * 1.15 : 1;
        return Number.isFinite(padded) ? padded : 1;
    }, [plottedPoints]);

    const xDomain = useMemo(() => {
        if (plottedPoints.length === 0) return { min: 0, max: 1 };
        const values = plottedPoints.map((point) => point.xValue);
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (min === max) {
            return { min: min - 0.5, max: max + 0.5 };
        }
        return { min, max };
    }, [plottedPoints]);

    const callLine = useMemo(() => plottedPoints.filter((point) => point.side === "call").sort((a, b) => a.xValue - b.xValue), [plottedPoints]);
    const putLine = useMemo(() => plottedPoints.filter((point) => point.side === "put").sort((a, b) => a.xValue - b.xValue), [plottedPoints]);

    const [hovered, setHovered] = useState<PlotPoint | null>(null);

    const yTicks = 5;
    const xTicks = 5;

    const width = 960;
    const height = 420;
    const padding = 56;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const projectX = (value: number) => padding + ((value - xDomain.min) / (xDomain.max - xDomain.min || 1)) * chartWidth;
    const projectY = (value: number) => padding + chartHeight - (value / yMax) * chartHeight;

    const renderPolyline = (points: PlotPoint[], color: string) => {
        if (points.length === 0) return null;
        const path = points.map((point) => `${projectX(point.xValue)},${projectY(point.iv)}`).join(" ");
        return <polyline fill="none" stroke={color} strokeWidth={1.5} points={path} opacity={0.6} />;
    };

    if (!contracts || contracts.length === 0) {
        return (
            <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-lg backdrop-blur">
                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">Implied Volatility Smile</h3>
                    <p className="text-sm text-muted-foreground">
                        Run Fetch Data in Model Setup to load an option chain.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-lg backdrop-blur space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Volatility • {symbol}</p>
                    <h3 className="text-xl font-semibold text-foreground">Implied Volatility Smile</h3>
                    <p className="text-sm text-muted-foreground">Computed from mid prices via Black–Scholes–Merton.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <select
                        className="h-9 rounded-lg border border-border/60 bg-muted/30 px-3 text-sm"
                        value={sideView}
                        onChange={(event) => setSideView(event.target.value as "both" | OptionSide)}
                    >
                        <option value="both">Both</option>
                        <option value="call">Calls</option>
                        <option value="put">Puts</option>
                    </select>
                    <select
                        className="h-9 rounded-lg border border-border/60 bg-muted/30 px-3 text-sm"
                        value={xAxis}
                        onChange={(event) => setXAxis(event.target.value as "strike" | "moneyness")}
                    >
                        <option value="strike">Strike</option>
                        <option value="moneyness">Moneyness</option>
                    </select>
                    <button
                        type="button"
                        onClick={() => setRefreshTick((value) => value + 1)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/30"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <SummaryStat label="ATM IV" value={atmIv ? formatPercent(atmIv, 2) : "—"} />
                <SummaryStat label="Points Plotted" value={plottedPoints.length.toString()} />
                <SummaryStat label="Expiry" value={expiry || "—"} />
            </div>

            {plottedPoints.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    {resolvedSpot && resolvedTime
                        ? "No implied volatilities could be derived from the current option chain."
                        : "Waiting for spot and time-to-expiry inputs to compute implied volatilities."}
                </div>
            ) : (
                <div className="relative rounded-2xl border border-border/60 bg-muted/10 p-4">
                    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Implied volatility smile chart">
                        <rect x={padding} y={padding} width={chartWidth} height={chartHeight} fill="url(#gridGradient)" opacity={0.02} />

                        {[...Array(yTicks + 1)].map((_, index) => {
                            const value = (yMax / yTicks) * index;
                            const y = projectY(value);
                            return (
                                <g key={`y-${value}`}>
                                    <line x1={padding} x2={padding + chartWidth} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} />
                                    <text
                                        x={padding - 10}
                                        y={y + 4}
                                        className="text-[10px] fill-muted-foreground"
                                        textAnchor="end"
                                    >
                                        {formatPercent(value, 0)}
                                    </text>
                                </g>
                            );
                        })}

                        {[...Array(xTicks + 1)].map((_, index) => {
                            const value = xDomain.min + ((xDomain.max - xDomain.min) / xTicks) * index;
                            const x = projectX(value);
                            return (
                                <g key={`x-${value}`}>
                                    <line x1={x} x2={x} y1={padding} y2={padding + chartHeight} stroke="currentColor" strokeOpacity={0.06} />
                                    <text
                                        x={x}
                                        y={padding + chartHeight + 16}
                                        className="text-[10px] fill-muted-foreground"
                                        textAnchor="middle"
                                    >
                                        {xAxis === "strike" ? formatNumber(value, 0) : value.toFixed(2)}
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

                        {renderPolyline(callLine, CALL_COLOR)}
                        {renderPolyline(putLine, PUT_COLOR)}

                        {plottedPoints.map((point, index) => {
                            const cx = projectX(point.xValue);
                            const cy = projectY(point.iv);
                            const color = point.side === "call" ? CALL_COLOR : PUT_COLOR;
                            return (
                                <circle
                                    key={`${point.side}-${point.strike}-${index}`}
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={color}
                                    fillOpacity={0.9}
                                    stroke="black"
                                    strokeOpacity={0.15}
                                    onMouseEnter={() => setHovered(point)}
                                    onMouseLeave={() => setHovered(null)}
                                />
                            );
                        })}

                        <text
                            x={padding + chartWidth / 2}
                            y={height - 8}
                            className="text-xs fill-muted-foreground"
                            textAnchor="middle"
                        >
                            {X_AXIS_LABELS[xAxis]}
                        </text>
                        <text x={16} y={padding - 20} className="text-xs fill-muted-foreground" textAnchor="start">
                            IV (σ)
                        </text>
                    </svg>

                    {hovered && (
                        <div
                            className={cn(
                                "pointer-events-none absolute z-10 w-64 rounded-xl border border-border/60 bg-card/90 p-3 text-xs shadow-xl backdrop-blur",
                                "left-1/2 -translate-x-1/2 md:left-auto md:right-4 md:translate-x-0"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-foreground capitalize">{hovered.side}</span>
                                <span className="text-muted-foreground">Strike {formatNumber(hovered.strike, 2)}</span>
                            </div>
                            <div className="mt-1 grid grid-cols-2 gap-1 text-foreground">
                                <span>IV: {formatPercent(hovered.iv, 2)}</span>
                                <span>Mid: {formatNumber(hovered.mid, 2)}</span>
                                <span>Bid/Ask: {formatNumber(hovered.bid, 2)} / {formatNumber(hovered.ask, 2)}</span>
                                <span>Last: {formatNumber(hovered.last ?? null, 2)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
