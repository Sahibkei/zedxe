"use client";

import { useEffect, useMemo, useState } from "react";

import { moneyness as moneynessRatio } from "@/lib/options/bs";
import { formatNumber } from "@/lib/options/format";
import type { OptionIvSource, OptionPremiumSource, OptionSide } from "@/lib/options/types";
import { cn } from "@/lib/utils";

type ImpliedVolatilitySmileProps = {
    symbol: string;
    spot: number | null;
    expiry: string | null;
    tYears: number | null;
    r: number;
    q: number;
    ivSource: OptionIvSource;
    premiumSource: OptionPremiumSource;
    diagnosticsEnabled: boolean;
    selectedStrike: number | null;
    fetchSmile: (params: {
        symbol: string;
        expiry: string;
        r: number;
        q: number;
        ivSource: OptionIvSource;
        premiumSource: OptionPremiumSource;
        side?: "call" | "put" | "both";
        debug?: boolean;
    }) => Promise<{
        nowIso: string;
        expiryIso: string | null;
        tYears: number;
        dteDays: number;
        spotUsed: number;
        rUsed: number;
        qUsed: number;
        premiumSource: OptionPremiumSource;
        atmDiagnostics?: {
            strike: number;
            side: OptionSide;
            bid?: number | null;
            ask?: number | null;
            mid?: number | null;
            last?: number | null;
            premiumUsed?: number | null;
            iv?: number | null;
            iv_mid?: number | null;
            iv_yahoo?: number | null;
            modelPriceFromIvMid?: number | null;
            pricingErrorMid?: number | null;
        };
        points: Array<{
            strike: number;
            side: OptionSide;
            iv: number | null;
            iv_mid?: number | null;
            iv_yahoo?: number | null;
            bid?: number | null;
            ask?: number | null;
            mid?: number | null;
            last?: number | null;
            premiumUsed?: number | null;
            premiumSource?: OptionPremiumSource;
            modelPriceFromIvMid?: number | null;
            modelPriceFromIvYahoo?: number | null;
            pricingErrorMid?: number | null;
            pricingErrorYahoo?: number | null;
        }>;
    }>;
    onIvSourceChange: (value: OptionIvSource) => void;
};

type ChartPoint = {
    strike: number;
    moneyness: number;
    iv: number;
    side: OptionSide;
    bid: number | null;
    ask: number | null;
    mid: number | null;
    last?: number | null;
};

type PlotPoint = ChartPoint & { xValue: number };

const CALL_COLOR = "#2dd4bf";
const PUT_COLOR = "#fbbf24";

const X_AXIS_LABELS: Record<"strike" | "moneyness", string> = {
    strike: "Strike",
    moneyness: "Moneyness (K/S)",
};

const toPercent = (value: number) => value * 100;

function SummaryStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="font-semibold text-foreground">{value}</span>
        </div>
    );
}

export default function ImpliedVolatilitySmile({
    symbol,
    spot,
    expiry,
    tYears,
    r,
    q,
    ivSource,
    premiumSource,
    diagnosticsEnabled,
    selectedStrike,
    fetchSmile,
    onIvSourceChange,
}: ImpliedVolatilitySmileProps) {
    const [sideView, setSideView] = useState<"both" | OptionSide>("both");
    const [xAxis, setXAxis] = useState<"strike" | "moneyness">("strike");
    const [refreshTick, setRefreshTick] = useState(0);
    const [points, setPoints] = useState<ChartPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [diagnostics, setDiagnostics] = useState<{
        nowIso: string;
        expiryIso: string | null;
        tYears: number;
        dteDays: number;
        spotUsed: number;
        rUsed: number;
        qUsed: number;
        premiumSource: OptionPremiumSource;
        atmDiagnostics?: {
            strike: number;
            side: OptionSide;
            bid?: number | null;
            ask?: number | null;
            mid?: number | null;
            last?: number | null;
            premiumUsed?: number | null;
            iv?: number | null;
            iv_mid?: number | null;
            iv_yahoo?: number | null;
            modelPriceFromIvMid?: number | null;
            pricingErrorMid?: number | null;
        };
    } | null>(null);
    const [pointDiagnostics, setPointDiagnostics] = useState<
        | {
              strike: number;
              side: OptionSide;
              bid?: number | null;
              ask?: number | null;
              mid?: number | null;
              last?: number | null;
              premiumUsed?: number | null;
              iv?: number | null;
              iv_mid?: number | null;
              iv_yahoo?: number | null;
              modelPriceFromIvMid?: number | null;
              pricingErrorMid?: number | null;
          }
        | null
    >(null);

    const resolvedTime = useMemo(() => tYears ?? null, [tYears]);
    const resolvedSpot = useMemo(() => (Number.isFinite(spot ?? NaN) && (spot ?? 0) > 0 ? (spot as number) : null), [spot]);

    useEffect(() => {
        if (!expiry) {
            setPoints([]);
            setLoadError(null);
            return;
        }

        let isActive = true;
        setIsLoading(true);
        setLoadError(null);

        fetchSmile({ symbol, expiry, r, q, ivSource, premiumSource, side: sideView, debug: diagnosticsEnabled })
            .then((response) => {
                if (!isActive) return;
                setDiagnostics({
                    nowIso: response.nowIso,
                    expiryIso: response.expiryIso,
                    tYears: response.tYears,
                    dteDays: response.dteDays,
                    spotUsed: response.spotUsed,
                    rUsed: response.rUsed,
                    qUsed: response.qUsed,
                    premiumSource: response.premiumSource,
                    atmDiagnostics: response.atmDiagnostics,
                });
                const selectedPoint =
                    selectedStrike !== null
                        ? response.points.find((point) => point.strike === selectedStrike) ?? null
                        : null;
                setPointDiagnostics(
                    selectedPoint
                        ? {
                              strike: selectedPoint.strike,
                              side: selectedPoint.side,
                              bid: selectedPoint.bid ?? null,
                              ask: selectedPoint.ask ?? null,
                              mid: selectedPoint.mid ?? null,
                              last: selectedPoint.last ?? null,
                              premiumUsed: selectedPoint.premiumUsed ?? null,
                              iv: selectedPoint.iv ?? null,
                              iv_mid: selectedPoint.iv_mid ?? null,
                              iv_yahoo: selectedPoint.iv_yahoo ?? null,
                              modelPriceFromIvMid: selectedPoint.modelPriceFromIvMid ?? null,
                              pricingErrorMid: selectedPoint.pricingErrorMid ?? null,
                          }
                        : null
                );
                const nextPoints = response.points
                    .map((point) => {
                        if (!resolvedSpot) return null;
                        if (point.iv === null || !Number.isFinite(point.iv)) return null;
                        return {
                            strike: point.strike,
                            moneyness: moneynessRatio(resolvedSpot, point.strike),
                            iv: point.iv,
                            side: point.side,
                            bid: point.bid ?? null,
                            ask: point.ask ?? null,
                            mid: point.mid ?? null,
                            last: point.last ?? null,
                        } as ChartPoint;
                    })
                    .filter((point): point is ChartPoint => Boolean(point));
                setPoints(nextPoints);
            })
            .catch((error) => {
                if (!isActive) return;
                const message = error instanceof Error ? error.message : "Unable to load IV smile";
                setLoadError(message);
                setPoints([]);
                setDiagnostics(null);
                setPointDiagnostics(null);
            })
            .finally(() => {
                if (isActive) {
                    setIsLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [expiry, fetchSmile, ivSource, premiumSource, diagnosticsEnabled, q, r, refreshTick, resolvedSpot, sideView, symbol, selectedStrike]);

    const allPoints = useMemo(() => points, [points]);

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

    const plottedPoints = useMemo<PlotPoint[]>(() => {
        return allPoints
            .map((point) => {
                const xValue = xAxis === "strike" ? point.strike : point.moneyness;
                if (!Number.isFinite(xValue)) return null;
                return { ...point, xValue } as PlotPoint;
            })
            .filter((point): point is PlotPoint => Boolean(point));
    }, [allPoints, xAxis]);

    const yMax = useMemo(() => {
        if (plottedPoints.length === 0) return 1;
        const maxValue = Math.max(...plottedPoints.map((point) => toPercent(point.iv)));
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
        const path = points.map((point) => `${projectX(point.xValue)},${projectY(toPercent(point.iv))}`).join(" ");
        return <polyline fill="none" stroke={color} strokeWidth={1.5} points={path} opacity={0.6} />;
    };

    if (!expiry) {
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
                    <p className="text-sm text-muted-foreground">
                        Using {ivSource === "mid" ? "mid-derived" : "Yahoo"} implied volatility values.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">IV Source</span>
                    <select
                        className="h-9 rounded-lg border border-border/60 bg-muted/30 px-3 text-sm"
                        value={ivSource}
                        onChange={(event) => onIvSourceChange(event.target.value as OptionIvSource)}
                    >
                        <option value="mid">Mid (recommended)</option>
                        <option value="yahoo">Yahoo</option>
                    </select>
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
                <SummaryStat label="ATM IV" value={atmIv ? `${toPercent(atmIv).toFixed(2)}%` : "—"} />
                <SummaryStat label="Points Plotted" value={plottedPoints.length.toString()} />
                <SummaryStat label="Expiry" value={expiry || "—"} />
            </div>

            {diagnosticsEnabled && diagnostics && (
                <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground space-y-3">
                    <div className="grid gap-2 md:grid-cols-2">
                        <div>
                            <div className="font-semibold text-foreground">Timing</div>
                            <div>Now: {diagnostics.nowIso}</div>
                            <div>Expiry: {diagnostics.expiryIso ?? "—"}</div>
                            <div>T: {diagnostics.tYears.toFixed(6)} years</div>
                            <div>DTE: {diagnostics.dteDays} days</div>
                        </div>
                        <div>
                            <div className="font-semibold text-foreground">Inputs</div>
                            <div>Spot: {formatNumber(diagnostics.spotUsed, 4)}</div>
                            <div>r: {formatNumber(diagnostics.rUsed, 4)}</div>
                            <div>q: {formatNumber(diagnostics.qUsed, 4)}</div>
                            <div>Premium source: {diagnostics.premiumSource}</div>
                        </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                        <div>
                            <div className="font-semibold text-foreground">ATM Diagnostics</div>
                            {diagnostics.atmDiagnostics ? (
                                <div className="space-y-1">
                                    <div>
                                        Strike {formatNumber(diagnostics.atmDiagnostics.strike, 2)} •{" "}
                                        {diagnostics.atmDiagnostics.side.toUpperCase()}
                                    </div>
                                    <div>
                                        Bid/Ask: {formatNumber(diagnostics.atmDiagnostics.bid ?? null, 2)} /{" "}
                                        {formatNumber(diagnostics.atmDiagnostics.ask ?? null, 2)}
                                    </div>
                                    <div>Mid: {formatNumber(diagnostics.atmDiagnostics.mid ?? null, 2)}</div>
                                    <div>Last: {formatNumber(diagnostics.atmDiagnostics.last ?? null, 2)}</div>
                                    <div>Premium used: {formatNumber(diagnostics.atmDiagnostics.premiumUsed ?? null, 2)}</div>
                                    <div>IV (mid): {diagnostics.atmDiagnostics.iv_mid ? `${toPercent(diagnostics.atmDiagnostics.iv_mid).toFixed(2)}%` : "—"}</div>
                                    <div>IV (yahoo): {diagnostics.atmDiagnostics.iv_yahoo ? `${toPercent(diagnostics.atmDiagnostics.iv_yahoo).toFixed(2)}%` : "—"}</div>
                                    <div>Model price (IV mid): {formatNumber(diagnostics.atmDiagnostics.modelPriceFromIvMid ?? null, 4)}</div>
                                    <div>Pricing error (mid): {formatNumber(diagnostics.atmDiagnostics.pricingErrorMid ?? null, 4)}</div>
                                </div>
                            ) : (
                                <div>No ATM diagnostics available.</div>
                            )}
                        </div>
                        <div>
                            <div className="font-semibold text-foreground">Selected Strike</div>
                            {pointDiagnostics ? (
                                <div className="space-y-1">
                                    <div>
                                        Strike {formatNumber(pointDiagnostics.strike, 2)} • {pointDiagnostics.side.toUpperCase()}
                                    </div>
                                    <div>
                                        Bid/Ask: {formatNumber(pointDiagnostics.bid ?? null, 2)} /{" "}
                                        {formatNumber(pointDiagnostics.ask ?? null, 2)}
                                    </div>
                                    <div>Mid: {formatNumber(pointDiagnostics.mid ?? null, 2)}</div>
                                    <div>Last: {formatNumber(pointDiagnostics.last ?? null, 2)}</div>
                                    <div>Premium used: {formatNumber(pointDiagnostics.premiumUsed ?? null, 2)}</div>
                                    <div>IV (mid): {pointDiagnostics.iv_mid ? `${toPercent(pointDiagnostics.iv_mid).toFixed(2)}%` : "—"}</div>
                                    <div>IV (yahoo): {pointDiagnostics.iv_yahoo ? `${toPercent(pointDiagnostics.iv_yahoo).toFixed(2)}%` : "—"}</div>
                                    <div>Model price (IV mid): {formatNumber(pointDiagnostics.modelPriceFromIvMid ?? null, 4)}</div>
                                    <div>Pricing error (mid): {formatNumber(pointDiagnostics.pricingErrorMid ?? null, 4)}</div>
                                </div>
                            ) : (
                                <div>No selected strike.</div>
                            )}
                        </div>
                    </div>
                    <div className="text-[11px]">
                        Hint: If IV source = Mid, pricingErrorMid should be near 0. If not, T/premium inputs are inconsistent.
                    </div>
                </div>
            )}

            {loadError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {loadError}
                </div>
            )}

            {isLoading ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    Loading IV smile data...
                </div>
            ) : plottedPoints.length === 0 ? (
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
                                        {`${value.toFixed(0)}%`}
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
                            const cy = projectY(toPercent(point.iv));
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
                            IV (%)
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
                                <span>IV: {`${toPercent(hovered.iv).toFixed(2)}%`}</span>
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
