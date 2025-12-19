"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchExpiries, fetchOptionSurface } from "@/lib/options/client";
import { moneyness as computeMoneyness } from "@/lib/options/bs";
import { formatIV, formatNumber } from "@/lib/options/format";
import type { OptionChainQuote, OptionPriceSource, OptionSide, OptionSurfaceChain, OptionSurfacePointSource } from "@/lib/options/types";
import { daysToExpiry, timeToExpiryYears } from "@/lib/options/time";
import { cn } from "@/lib/utils";

type ExpiryMode = "single" | "multi";
type MultiWindowType = "count" | "range";
type AxisMode = "strike" | "moneyness";
type SideView = "call" | "put" | "both";

type AggregatedCell = {
    key: string;
    expiry: string;
    strike: number;
    moneyness: number;
    axisValue: number;
    iv: number;
    bid: number | null;
    ask: number | null;
    mid: number | null;
    count: number;
    side: SideView | OptionSide;
    source: OptionSurfacePointSource;
    spot: number | null;
    dte: number | null;
};

type SurfaceRow = {
    expiry: string;
    dte: number | null;
    spot: number | null;
    cells: AggregatedCell[];
    cellMap: Record<string, AggregatedCell>;
};

type SurfaceResult = {
    rows: SurfaceRow[];
    xValues: number[];
    expiriesUsed: string[];
    stats: {
        pointsPlotted: number;
        minIv: number | null;
        maxIv: number | null;
        atmIv: number | null;
    };
    spotSignature: string;
    spotValue: number | null;
    spotTimestamp?: string;
};

type IVSurfaceProps = {
    symbol: string;
    riskFreeRate: number;
    dividendYield: number;
};

const DEFAULT_MAX_SPREAD_PCT = 10;
const DEFAULT_MIN_OI = 20;
const DEFAULT_MONEYNESS_MIN = 0.8;
const DEFAULT_MONEYNESS_MAX = 1.2;
// Typical large-cap 1D IV is usually tens of %, not 200%+; treat extreme values as a units/inputs signal.
const MAX_IV_ALLOWED = 3; // 300%
const DEBUG_DIAGNOSTICS = false;
const PRICE_SOURCES: OptionPriceSource[] = ["mid", "bid", "ask", "last"];

const isFiniteNumber = (input: unknown): input is number => typeof input === "number" && Number.isFinite(input);

const colorForValue = (value: number, min: number, max: number) => {
    if (!isFiniteNumber(value) || !isFiniteNumber(min) || !isFiniteNumber(max)) return "transparent";
    const clamped = Math.min(Math.max(value, min), max);
    const range = max - min || 1;
    const ratio = (clamped - min) / range;
    const hue = 200 - ratio * 160; // teal to amber
    const lightness = 24 + ratio * 18;
    return `hsl(${hue}deg 75% ${lightness}%)`;
};

const buildCacheKey = (baseKey: string, spotSignature?: string | null) => `${baseKey}::${spotSignature ?? "pending"}`;

const describeQuote = (params: { quote?: OptionChainQuote | null; source: OptionSurfacePointSource }): {
    iv: number | null;
    bid: number | null;
    ask: number | null;
    mid: number | null;
    source: OptionSurfacePointSource;
} => {
    const { quote, source } = params;
    return {
        iv: Number.isFinite(quote?.iv ?? null) ? (quote?.iv as number) : null,
        bid: Number.isFinite(quote?.bid ?? null) ? (quote?.bid as number) : null,
        ask: Number.isFinite(quote?.ask ?? null) ? (quote?.ask as number) : null,
        mid: Number.isFinite(quote?.mid ?? null) ? (quote?.mid as number) : null,
        source,
    };
};

const averageNumber = (first: number | null | undefined, second: number | null | undefined) => {
    const left = Number.isFinite(first ?? null) ? (first as number) : null;
    const right = Number.isFinite(second ?? null) ? (second as number) : null;
    if (left === null && right === null) return null;
    if (left === null) return right;
    if (right === null) return left;
    return (left + right) / 2;
};

const buildSurface = (
    chains: OptionSurfaceChain[],
    sideView: SideView,
    axisMode: AxisMode,
    log?: (payload: Record<string, unknown>) => void
): SurfaceResult => {
    const rows: SurfaceRow[] = [];
    const xAxisValues = new Set<number>();
    const allCells: AggregatedCell[] = [];
    const spotSignature = chains
        .map((chain) => `${chain.spot}-${chain.spotTimestamp ?? chain.fetchedAt}`)
        .join("|");
    const representativeSpot = chains[0]?.spot ?? null;
    const referenceSpot = representativeSpot;
    if (DEBUG_DIAGNOSTICS && log && Number.isFinite(referenceSpot)) {
        const mismatched = chains.filter((chain) => Math.abs(chain.spot - (referenceSpot as number)) / (referenceSpot as number) > 0.1);
        if (mismatched.length > 0) {
            log({ type: "spot-mismatch", referenceSpot, mismatched: mismatched.map((entry) => ({ spot: entry.spot, expiry: entry.expiry })) });
        }
    }

    chains.forEach((chain) => {
        const spotForChain = Number.isFinite(referenceSpot) ? referenceSpot : chain.spot;
        const tYears = timeToExpiryYears(chain.expiry);
        const dte = daysToExpiry(chain.expiry);
        if (!Number.isFinite(spotForChain) || !tYears || tYears <= 0) return;

        const atmStrike = chain.rows.reduce((closest: number | null, row) => {
            if (!Number.isFinite(row.strike)) return closest;
            if (closest === null) return row.strike;
            return Math.abs(row.strike - spotForChain) < Math.abs(closest - spotForChain) ? row.strike : closest;
        }, null);

        const cellMap: Record<string, AggregatedCell> = {};

        chain.rows.forEach((row) => {
            if (!Number.isFinite(row.strike) || row.strike <= 0) return;

            const callQuote = row.call ?? null;
            const putQuote = row.put ?? null;
            const isAtm = atmStrike !== null && Math.abs(row.strike - atmStrike) < 1e-6;

            let selectedSide: OptionSide | null = null;
            let selection = { iv: null as number | null, bid: null as number | null, ask: null as number | null, mid: null as number | null, source: "otm" as OptionSurfacePointSource };
            let openInterest: number | null = null;

            if (sideView === "call") {
                selectedSide = "call";
                selection = describeQuote({ quote: callQuote, source: "call" });
                openInterest = Number.isFinite(callQuote?.openInterest ?? null) ? (callQuote?.openInterest as number) : null;
            } else if (sideView === "put") {
                selectedSide = "put";
                selection = describeQuote({ quote: putQuote, source: "put" });
                openInterest = Number.isFinite(putQuote?.openInterest ?? null) ? (putQuote?.openInterest as number) : null;
            } else if (isAtm) {
                const callIv = Number.isFinite(callQuote?.iv ?? null) ? (callQuote?.iv as number) : null;
                const putIv = Number.isFinite(putQuote?.iv ?? null) ? (putQuote?.iv as number) : null;
                if (callIv !== null && putIv !== null) {
                    selection = {
                        iv: (callIv + putIv) / 2,
                        bid: averageNumber(callQuote?.bid ?? null, putQuote?.bid ?? null),
                        ask: averageNumber(callQuote?.ask ?? null, putQuote?.ask ?? null),
                        mid: averageNumber(callQuote?.mid ?? null, putQuote?.mid ?? null),
                        source: "avg",
                    };
                    openInterest = averageNumber(callQuote?.openInterest ?? null, putQuote?.openInterest ?? null);
                } else if (callIv !== null) {
                    selectedSide = "call";
                    selection = describeQuote({ quote: callQuote, source: "call" });
                    openInterest = Number.isFinite(callQuote?.openInterest ?? null) ? (callQuote?.openInterest as number) : null;
                } else if (putIv !== null) {
                    selectedSide = "put";
                    selection = describeQuote({ quote: putQuote, source: "put" });
                    openInterest = Number.isFinite(putQuote?.openInterest ?? null) ? (putQuote?.openInterest as number) : null;
                } else {
                    return;
                }
            } else if (row.strike >= spotForChain) {
                selectedSide = "call";
                selection = describeQuote({ quote: callQuote, source: "otm" });
                openInterest = Number.isFinite(callQuote?.openInterest ?? null) ? (callQuote?.openInterest as number) : null;
            } else {
                selectedSide = "put";
                selection = describeQuote({ quote: putQuote, source: "otm" });
                openInterest = Number.isFinite(putQuote?.openInterest ?? null) ? (putQuote?.openInterest as number) : null;
            }

            const { iv, bid, ask, mid, source } = selection;
            if (iv === null || !Number.isFinite(iv) || iv <= 0 || iv > MAX_IV_ALLOWED) return;

            const spreadPct = Number.isFinite(bid) && Number.isFinite(ask)
                ? ((ask - bid) / ((ask + bid) / 2)) * 100
                : Number.POSITIVE_INFINITY;
            if (!isFiniteNumber(spreadPct) || spreadPct > DEFAULT_MAX_SPREAD_PCT) return;

            if ((openInterest ?? 0) < DEFAULT_MIN_OI) return;

            const moneyness = computeMoneyness(spotForChain, row.strike);
            if (!Number.isFinite(moneyness)) return;

            if (axisMode === "strike" && (moneyness < DEFAULT_MONEYNESS_MIN || moneyness > DEFAULT_MONEYNESS_MAX)) return;

            const axisValue = axisMode === "strike" ? row.strike : moneyness;
            if (!Number.isFinite(axisValue)) return;

            const key = axisMode === "strike" ? row.strike.toFixed(2) : axisValue.toFixed(3);
            const existing = cellMap[key];

            if (existing) {
                const nextCount = existing.count + 1;
                const aggregatedIv = (existing.iv * existing.count + iv) / nextCount;
                const aggregatedBid = bid !== null && existing.bid !== null ? (existing.bid * existing.count + bid) / nextCount : existing.bid ?? bid;
                const aggregatedAsk = ask !== null && existing.ask !== null ? (existing.ask * existing.count + ask) / nextCount : existing.ask ?? ask;
                const aggregatedMid = mid !== null && existing.mid !== null ? (existing.mid * existing.count + mid) / nextCount : existing.mid ?? mid;

                cellMap[key] = {
                    ...existing,
                    iv: aggregatedIv,
                    bid: aggregatedBid,
                    ask: aggregatedAsk,
                    mid: aggregatedMid,
                    count: nextCount,
                };
            } else {
                cellMap[key] = {
                    key,
                    expiry: chain.expiry,
                    strike: row.strike,
                    moneyness,
                    axisValue,
                    iv,
                    bid,
                    ask,
                    mid,
                    count: 1,
                    side: selectedSide ?? sideView,
                    source,
                    spot: chain.spot,
                    dte,
                };
            }
        });

        const cells = Object.values(cellMap).sort((a, b) => a.axisValue - b.axisValue);
        cells.forEach((cell) => xAxisValues.add(cell.axisValue));
        rows.push({ expiry: chain.expiry, dte, spot: chain.spot, cells, cellMap });
        allCells.push(...cells);
    });

    const xValues = Array.from(xAxisValues).sort((a, b) => a - b);
    const sortedRows = rows.sort((a, b) => (a.dte ?? 0) - (b.dte ?? 0));

    const ivValues = allCells.map((cell) => cell.iv).filter((value) => isFiniteNumber(value));
    const minIv = ivValues.length > 0 ? Math.min(...ivValues) : null;
    const maxIv = ivValues.length > 0 ? Math.max(...ivValues) : null;

    let atmIv: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    allCells.forEach((cell) => {
        if (!Number.isFinite(cell.iv)) return;
        const spotReference = cell.spot ?? null;
        const distance = axisMode === "strike" && spotReference
            ? Math.abs(cell.strike - spotReference)
            : Math.abs(cell.moneyness - 1);

        if (distance < bestDistance) {
            bestDistance = distance;
            atmIv = cell.iv;
        }
    });

    const pointsPlotted = allCells.reduce((accumulator, cell) => accumulator + cell.count, 0);

    return {
        rows: sortedRows,
        xValues,
        expiriesUsed: sortedRows.map((row) => row.expiry),
        stats: {
            pointsPlotted,
            minIv,
            maxIv,
            atmIv,
        },
        spotSignature,
        spotValue: representativeSpot,
        spotTimestamp: chains[0]?.spotTimestamp ?? chains[0]?.fetchedAt,
    };
};

export default function IVSurface({ symbol, riskFreeRate, dividendYield }: IVSurfaceProps) {
    const [expiries, setExpiries] = useState<string[]>([]);
    const [selectedExpiry, setSelectedExpiry] = useState<string>("");
    const [expiryMode, setExpiryMode] = useState<ExpiryMode>("single");
    const [windowType, setWindowType] = useState<MultiWindowType>("count");
    const [expiryCount, setExpiryCount] = useState(3);
    const [dteRange, setDteRange] = useState<{ min: number; max: number }>({ min: 0, max: 90 });
    const [sideView, setSideView] = useState<SideView>("both");
    const [axisMode, setAxisMode] = useState<AxisMode>("strike");
    const [priceSource, setPriceSource] = useState<OptionPriceSource>("mid");
    const [loadingExpiries, setLoadingExpiries] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [surface, setSurface] = useState<SurfaceResult | null>(null);
    const [, setCache] = useState<Record<string, SurfaceResult>>({});
    const diagnosticsRef = useRef<Record<string, unknown>[]>([]);

    const fetchControllerRef = useRef<AbortController | null>(null);
    const expiryControllerRef = useRef<AbortController | null>(null);
    const cacheRef = useRef<Record<string, SurfaceResult>>({});
    const cacheSpotSignatureRef = useRef<string | null>(null);
    const hasDataRef = useRef(false);

    const logDiagnostic = useCallback((payload: Record<string, unknown>) => {
        if (!DEBUG_DIAGNOSTICS) return;
        diagnosticsRef.current = [...diagnosticsRef.current.slice(-200), payload];
    }, []);

    useEffect(() => {
        setExpiries([]);
        setSelectedExpiry("");
        setSurface(null);
        setCache({});
        cacheRef.current = {};
        cacheSpotSignatureRef.current = null;
        hasDataRef.current = false;
        expiryControllerRef.current?.abort();

        const controller = new AbortController();
        expiryControllerRef.current = controller;
        setLoadingExpiries(true);
        setError(null);

        fetchExpiries(symbol, controller.signal)
            .then((response) => {
                if (controller.signal.aborted) return;
                setExpiries(response.expiries);
                if (response.expiries.length > 0) {
                    setSelectedExpiry(response.expiries[0]);
                }
            })
            .catch((reason: Error) => {
                if (controller.signal.aborted) return;
                setError(reason?.message || "Unable to load expiries");
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoadingExpiries(false);
                }
            });

        return () => {
            controller.abort();
        };
    }, [symbol]);

    useEffect(() => {
        if (expiries.length > 0 && !selectedExpiry) {
            setSelectedExpiry(expiries[0]);
        }
    }, [expiries, selectedExpiry]);

    const resolvedExpiries = useMemo(() => {
        if (expiryMode === "single") {
            return selectedExpiry ? [selectedExpiry] : [];
        }

        if (expiries.length === 0) return [];

        if (windowType === "count") {
            const safeCount = Math.max(1, Math.min(expiryCount, expiries.length));
            return expiries.slice(0, safeCount);
        }

        const normalized = { min: Math.max(0, dteRange.min), max: Math.max(dteRange.min, dteRange.max) };
        return expiries.filter((expiry) => {
            const dte = daysToExpiry(expiry);
            if (dte === null) return false;
            return dte >= normalized.min && dte <= normalized.max;
        });
    }, [expiryMode, windowType, selectedExpiry, expiries, expiryCount, dteRange]);

    const cacheKeyBase = useMemo(() => {
        const expiryKey = resolvedExpiries.join("|");
        return [symbol, expiryKey, sideView, axisMode, priceSource, riskFreeRate, dividendYield].join("::");
    }, [symbol, resolvedExpiries, sideView, axisMode, priceSource, riskFreeRate, dividendYield]);

    useEffect(() => {
        cacheSpotSignatureRef.current = null;
    }, [cacheKeyBase]);

    const loadSurface = useCallback(
        async (force = false) => {
            if (resolvedExpiries.length === 0) {
                setSurface(null);
                setError(null);
                setLoading(false);
                setIsRefreshing(false);
                cacheSpotSignatureRef.current = null;
                hasDataRef.current = false;
                return;
            }

            const cachedSurface = cacheRef.current[buildCacheKey(cacheKeyBase, cacheSpotSignatureRef.current)];
            if (!force && cachedSurface) {
                setError(null);
                setLoading(false);
                setIsRefreshing(false);
                setSurface(cachedSurface);
                hasDataRef.current = true;
                return;
            }

            fetchControllerRef.current?.abort();
            const controller = new AbortController();
            fetchControllerRef.current = controller;
            if (hasDataRef.current) {
                setIsRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            try {
                const response = await fetchOptionSurface(
                    {
                        symbol,
                        expiries: resolvedExpiries,
                        r: riskFreeRate,
                        q: dividendYield,
                        priceSource,
                    },
                    { signal: controller.signal }
                );
                if (controller.signal.aborted) return;
                const surfaceResult = buildSurface(response.chains, sideView, axisMode, logDiagnostic);
                setSurface(surfaceResult);
                cacheSpotSignatureRef.current = surfaceResult.spotSignature;
                hasDataRef.current = true;

                setCache((previous) => {
                    const cacheKey = buildCacheKey(cacheKeyBase, surfaceResult.spotSignature);
                    const nextCache = { ...previous, [cacheKey]: surfaceResult };
                    cacheRef.current = nextCache;
                    return nextCache;
                });
            } catch (reason) {
                const isAbort = controller.signal.aborted;
                if (isAbort) return;
                const message = reason instanceof Error ? reason.message : "Unable to load IV surface";
                setError(message);
                if (!hasDataRef.current) {
                    setSurface(null);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                    setIsRefreshing(false);
                }
            }
        },
        [resolvedExpiries, cacheKeyBase, sideView, axisMode, riskFreeRate, dividendYield, priceSource, symbol, logDiagnostic]
    );

    useEffect(() => {
        void loadSurface();
        return () => {
            fetchControllerRef.current?.abort();
        };
    }, [loadSurface]);

    const activeMinIv = surface?.stats.minIv ?? null;
    const activeMaxIv = surface?.stats.maxIv ?? null;

    const [hoveredCell, setHoveredCell] = useState<AggregatedCell | null>(null);

    const renderSummaryStat = (label: string, value: string) => (
        <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="font-semibold text-foreground">{value}</span>
        </div>
    );

    const tooltip = hoveredCell;
    const hasWindowExpiries = resolvedExpiries.length > 0;
    const noWindowExpiries = expiryMode === "multi" && !hasWindowExpiries && expiries.length > 0;
    const axisLabel = (value: number) => {
        if (!Number.isFinite(value)) return "--";
        return axisMode === "strike" ? formatNumber(value, 0) : value.toFixed(3);
    };

    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-lg backdrop-blur space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Volatility • {symbol}</p>
                    <h3 className="text-xl font-semibold text-foreground">IV Surface</h3>
                    <p className="text-sm text-muted-foreground">Heatmap of implied volatilities across expiries and strikes.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-xl border border-border/60 bg-muted/20 p-1">
                        {["single", "multi"].map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => setExpiryMode(mode as ExpiryMode)}
                                className={cn(
                                    "rounded-lg px-3 py-1 text-xs font-semibold transition",
                                    expiryMode === mode
                                        ? "bg-primary/20 text-foreground shadow-sm ring-1 ring-primary/50"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {mode === "single" ? "Single Expiry" : "Multi-Expiry Window"}
                            </button>
                        ))}
                    </div>
                    <select
                        className="h-9 rounded-lg border border-border/60 bg-muted/30 px-3 text-sm"
                        value={priceSource}
                        onChange={(event) => setPriceSource(event.target.value as OptionPriceSource)}
                    >
                        {PRICE_SOURCES.map((source) => (
                            <option key={source} value={source}>
                                {source.toUpperCase()}
                            </option>
                        ))}
                    </select>
                    <select
                        className="h-9 rounded-lg border border-border/60 bg-muted/30 px-3 text-sm"
                        value={sideView}
                        onChange={(event) => setSideView(event.target.value as SideView)}
                    >
                        <option value="both">Calls & Puts</option>
                        <option value="call">Calls</option>
                        <option value="put">Puts</option>
                    </select>
                    <select
                        className="h-9 rounded-lg border border-border/60 bg-muted/30 px-3 text-sm"
                        value={axisMode}
                        onChange={(event) => setAxisMode(event.target.value as AxisMode)}
                    >
                        <option value="strike">Strike</option>
                        <option value="moneyness">Moneyness (K/S)</option>
                    </select>
                    <button
                        type="button"
                        onClick={() => loadSurface(true)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/30"
                        disabled={loading}
                    >
                        Refresh
                    </button>
                    {isRefreshing && <span className="text-[11px] text-amber-300">Refreshing…</span>}
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                {renderSummaryStat("Expiries Used", surface?.expiriesUsed.length ? surface.expiriesUsed.length.toString() : "—")}
                {renderSummaryStat("Points Plotted", surface ? surface.stats.pointsPlotted.toString() : "—")}
                {renderSummaryStat("ATM IV", formatIV(surface?.stats.atmIv, 2))}
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {renderSummaryStat("Min IV", formatIV(activeMinIv, 2))}
                {renderSummaryStat("Max IV", formatIV(activeMaxIv, 2))}
                {renderSummaryStat("Side", sideView === "both" ? "Calls & Puts" : sideView === "call" ? "Calls" : "Puts")}
                {renderSummaryStat("Axis", axisMode === "strike" ? "Strike" : "Moneyness (K/S)")}
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
                {expiryMode === "single" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Expiry</span>
                            <select
                                className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm"
                                value={selectedExpiry}
                                onChange={(event) => setSelectedExpiry(event.target.value)}
                                disabled={loadingExpiries || expiries.length === 0}
                            >
                                {expiries.map((expiry) => (
                                    <option key={expiry} value={expiry}>
                                        {expiry}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground">Single expiry view anchored to a specific chain.</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Active Expiries</span>
                            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground">
                                {resolvedExpiries.join(", ") || "None selected"}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Window Type</span>
                            <select
                                className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm"
                                value={windowType}
                                onChange={(event) => setWindowType(event.target.value as MultiWindowType)}
                            >
                                <option value="count">Next N expiries</option>
                                <option value="range">DTE range</option>
                            </select>
                            <p className="text-xs text-muted-foreground">Choose how to build the surface window.</p>
                        </div>
                        {windowType === "count" ? (
                            <div className="flex flex-col gap-1">
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">Expiry Count</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={Math.max(1, expiries.length)}
                                    value={expiryCount}
                                    onChange={(event) => setExpiryCount(Number(event.target.value))}
                                    className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm"
                                />
                                <p className="text-xs text-muted-foreground">Pull the next set of expiries in order.</p>
                            </div>
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">DTE Min</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={dteRange.min}
                                        onChange={(event) => setDteRange((previous) => ({ ...previous, min: Number(event.target.value) }))}
                                        className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">DTE Max</span>
                                    <input
                                        type="number"
                                        min={dteRange.min}
                                        value={dteRange.max}
                                        onChange={(event) => setDteRange((previous) => ({ ...previous, max: Number(event.target.value) }))}
                                        className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm"
                                    />
                                </div>
                                <p className="sm:col-span-2 text-xs text-muted-foreground">Filter expiries by days-to-expiry window.</p>
                            </div>
                        )}
                        <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">Active Expiries</span>
                            <div className="min-h-[40px] rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-foreground">
                                {resolvedExpiries.join(", ") || "None within the selected window"}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {loadingExpiries && (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    Loading expiries for {symbol}...
                </div>
            )}

            {error && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => loadSurface(true)}
                        className="rounded-lg border border-destructive/40 px-3 py-1 text-xs font-semibold hover:bg-destructive/10"
                    >
                        Retry
                    </button>
                </div>
            )}

            {!loading && !surface && !error && noWindowExpiries && (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    No expiries in the selected DTE window. Adjust filters.
                </div>
            )}

            {!loading && !surface && !error && !noWindowExpiries && (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    {resolvedExpiries.length === 0
                        ? "Select at least one expiry to build the IV surface."
                        : "No valid implied volatilities could be derived from the current selection."}
                </div>
            )}

            {loading && (
                <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    Building IV surface across {resolvedExpiries.length} expiry{resolvedExpiries.length === 1 ? "" : "ies"}...
                </div>
            )}

            {surface && surface.xValues.length === 0 && !loading && (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
                    No surface points returned. Adjust filters and refresh.
                </div>
            )}

            {surface && surface.xValues.length > 0 && (
                <div className="relative">
                    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-muted/10">
                        <div className="min-w-[960px]">
                            <div
                                className="grid text-xs"
                                style={{ gridTemplateColumns: `140px repeat(${surface.xValues.length}, minmax(64px, 1fr))` }}
                            >
                                <div className="h-12 px-3 py-2 text-muted-foreground">Expiry / DTE</div>
                                {surface.xValues.map((value) => (
                                    <div
                                        key={`x-${value}`}
                                        className="flex h-12 items-center justify-center border-l border-border/40 bg-muted/10 px-2 text-muted-foreground"
                                    >
                                        {axisLabel(value)}
                                    </div>
                                ))}

                                {surface.rows.map((row) => (
                                    <Fragment key={row.expiry}>
                                        <div
                                            className="flex h-14 items-center gap-2 border-t border-border/40 bg-muted/10 px-3 text-foreground"
                                        >
                                            <div>
                                                <div className="font-semibold">{row.expiry}</div>
                                                <div className="text-muted-foreground">DTE {row.dte ?? "—"}</div>
                                            </div>
                                        </div>
                                        {surface.xValues.map((xValue) => {
                                            const key = axisMode === "strike" ? xValue.toFixed(2) : xValue.toFixed(3);
                                            const cell = row.cellMap[key];
                                            const background = cell && activeMinIv !== null && activeMaxIv !== null
                                                ? colorForValue(cell.iv, activeMinIv, activeMaxIv)
                                                : "transparent";

                                            const labelParts = [
                                                `Expiry ${row.expiry}`,
                                                axisMode === "strike"
                                                    ? `strike ${formatNumber(cell?.strike ?? null, 2)}`
                                                    : `moneyness ${Number.isFinite(cell?.moneyness ?? null) ? (cell?.moneyness as number).toFixed(3) : "--"}`,
                                            ];

                                            if (cell) {
                                                labelParts.push(`IV ${formatIV(cell.iv, 1)}`);
                                                labelParts.push(`bid ${formatNumber(cell.bid ?? null, 2)}`);
                                                labelParts.push(`ask ${formatNumber(cell.ask ?? null, 2)}`);
                                            } else {
                                                labelParts.push("IV unavailable");
                                            }

                                            return (
                                                <button
                                                    key={`${row.expiry}-${xValue}`}
                                                    type="button"
                                                    className={cn(
                                                        "relative flex h-14 items-center justify-center border-t border-l border-border/40 text-xs transition",
                                                        cell ? "text-foreground" : "text-muted-foreground"
                                                    )}
                                                    style={{ background }}
                                                    onMouseEnter={() => setHoveredCell(cell ?? null)}
                                                    onMouseLeave={() => setHoveredCell(null)}
                                                    aria-label={labelParts.join(", ")}
                                                >
                                                    {cell ? formatIV(cell.iv, 1) : "—"}
                                                </button>
                                            );
                                        })}
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    {tooltip && (
                        <div
                            className="pointer-events-none absolute right-4 top-4 z-10 w-72 rounded-xl border border-border/60 bg-card/90 p-3 text-xs shadow-xl backdrop-blur"
                            role="status"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-foreground">{tooltip.expiry}</span>
                                <span className="text-muted-foreground">DTE {tooltip.dte ?? "—"}</span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-1 text-foreground">
                                <span>{axisMode === "strike" ? "Strike" : "Moneyness"}: {axisLabel(axisMode === "strike" ? tooltip.strike : tooltip.moneyness)}</span>
                                <span>IV: {formatIV(tooltip.iv, 2)}</span>
                                <span>Bid / Ask: {formatNumber(tooltip.bid ?? null, 2)} / {formatNumber(tooltip.ask ?? null, 2)}</span>
                                <span>Mid: {formatNumber(tooltip.mid ?? null, 2)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
