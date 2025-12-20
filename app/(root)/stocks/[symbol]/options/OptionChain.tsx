"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { fetchExpiries, fetchOptionChainV2 } from "@/lib/options/client";
import { formatIV, formatNumber } from "@/lib/options/format";
import type { OptionChainResponse, OptionIvSource, OptionPriceSource } from "@/lib/options/types";
import { cn } from "@/lib/utils";

type OptionChainProps = {
    symbol: string;
    ivSource: OptionIvSource;
};

const DEFAULT_POLL_SECONDS = 5;
const DEFAULT_BAND_PCT = 20;

export default function OptionChain({ symbol, ivSource }: OptionChainProps) {
    const [expiries, setExpiries] = useState<string[]>([]);
    const [selectedExpiry, setSelectedExpiry] = useState("");
    const [loadingExpiries, setLoadingExpiries] = useState(false);
    const [chain, setChain] = useState<OptionChainResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingInitial, setIsLoadingInitial] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [priceSource, setPriceSource] = useState<OptionPriceSource>("mid");
    const [isLive, setIsLive] = useState(true);
    const [pollSeconds, setPollSeconds] = useState(DEFAULT_POLL_SECONDS);
    const [bandPct, setBandPct] = useState(DEFAULT_BAND_PCT);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const fetchControllerRef = useRef<AbortController | null>(null);
    const inFlightRef = useRef(false);
    const hasDataRef = useRef(false);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const pendingScrollTop = useRef<number | null>(null);

    useEffect(() => {
        setExpiries([]);
        setSelectedExpiry("");
        setChain(null);
        setError(null);
        setLastUpdated(null);
        hasDataRef.current = false;

        fetchControllerRef.current?.abort();
        const controller = new AbortController();
        setLoadingExpiries(true);

        fetchExpiries(symbol, controller.signal)
            .then((response) => {
                if (controller.signal.aborted) return;
                setExpiries(response.expiries);
                if (response.expiries.length > 0) {
                    setSelectedExpiry(response.expiries[0]);
                }
            })
            .catch((fetchError) => {
                if (controller.signal.aborted) return;
                const message = fetchError instanceof Error ? fetchError.message : "Unable to fetch expiries";
                setError(message);
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoadingExpiries(false);
                }
            });

        return () => {
            controller.abort();
            fetchControllerRef.current?.abort();
        };
    }, [symbol]);

    const loadChain = useCallback(
        async (options?: { mode?: "poll" | "manual" | "change" }) => {
            if (!selectedExpiry) return;

            const mode = options?.mode ?? "manual";
            if (mode === "poll" && inFlightRef.current) return;

            fetchControllerRef.current?.abort();
            const controller = new AbortController();
            fetchControllerRef.current = controller;
            pendingScrollTop.current = scrollRef.current?.scrollTop ?? null;
            inFlightRef.current = true;

            if (hasDataRef.current && mode !== "change") {
                setIsRefreshing(true);
            } else {
                setIsLoadingInitial(true);
            }
            setError(null);

            try {
                const response = await fetchOptionChainV2(
                    {
                        symbol,
                        expiry: selectedExpiry,
                        priceSource,
                        bandPct: bandPct / 100,
                        ivSource,
                    },
                    { signal: controller.signal }
                );
                if (controller.signal.aborted) return;
                setChain(response);
                setLastUpdated(response.updatedAt);
                hasDataRef.current = true;
            } catch (fetchError) {
                const isAbort = controller.signal.aborted || (fetchError instanceof DOMException && fetchError.name === "AbortError");
                if (isAbort) return;
                const message = fetchError instanceof Error ? fetchError.message : "Unable to load option chain";
                setError(message);
                if (!hasDataRef.current || mode === "change") {
                    setChain(null);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoadingInitial(false);
                    setIsRefreshing(false);
                    inFlightRef.current = false;
                }
            }
        },
        [bandPct, ivSource, priceSource, selectedExpiry, symbol]
    );

    useEffect(() => {
        if (!selectedExpiry) return;
        setChain(null);
        setLastUpdated(null);
        hasDataRef.current = false;
        loadChain({ mode: "change" });
    }, [loadChain, selectedExpiry]);

    useEffect(() => {
        if (!isLive || !selectedExpiry) return;

        let timer: ReturnType<typeof setTimeout>;
        let cancelled = false;
        const intervalMs = Math.max(1, pollSeconds) * 1000;

        const schedule = () => {
            if (cancelled) return;
            timer = setTimeout(async () => {
                await loadChain({ mode: "poll" });
                schedule();
            }, intervalMs);
        };

        schedule();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [isLive, loadChain, pollSeconds, selectedExpiry]);

    useLayoutEffect(() => {
        if (pendingScrollTop.current === null || !scrollRef.current) return;
        scrollRef.current.scrollTop = pendingScrollTop.current;
        pendingScrollTop.current = null;
    }, [chain]);

    const rows = chain?.rows ?? [];
    const spot = chain?.spot ?? null;
    const atmStrike = useMemo(() => {
        if (!rows.length || spot === null) return null;
        return rows.reduce((closest, row) => {
            if (closest === null) return row.strike;
            return Math.abs(row.strike - spot) < Math.abs(closest - spot) ? row.strike : closest;
        }, null as number | null);
    }, [rows, spot]);

    const lastUpdatedLabel = lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "--";
    const expiryStatus = loadingExpiries ? "Loading expiries..." : expiries.length === 0 ? "No expiries available." : "";
    const showEmptyState = !isLoadingInitial && !error && rows.length === 0;

    const [maxCallVol, maxPutVol] = useMemo(() => {
        let callMax = 0;
        let putMax = 0;
        rows.forEach((row) => {
            callMax = Math.max(callMax, row.call?.volume ?? 0);
            putMax = Math.max(putMax, row.put?.volume ?? 0);
        });
        return [callMax, putMax];
    }, [rows]);

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-lg backdrop-blur space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-foreground">Option Chain Ladder</h3>
                        <p className="text-sm text-muted-foreground">
                            Browse the live-ish option chain for a selected expiry and filter strikes around the spot price.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-semibold text-muted-foreground">
                        <span>Last updated: {lastUpdatedLabel}</span>
                        {isRefreshing && <span className="text-[11px] text-amber-300">Updating…</span>}
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expiry</span>
                        <select
                            className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                            value={selectedExpiry}
                            onChange={(event) => setSelectedExpiry(event.target.value)}
                            disabled={loadingExpiries || expiries.length === 0}
                        >
                            {expiries.length === 0 && <option value="">{expiryStatus || "Loading expiries..."}</option>}
                            {expiries.map((expiry) => (
                                <option key={expiry} value={expiry}>
                                    {expiry}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground">{expiryStatus || "Select an expiration to load contracts."}</p>
                    </div>

                    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Price Source</span>
                        <select
                            className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                            value={priceSource}
                            onChange={(event) => setPriceSource(event.target.value as OptionPriceSource)}
                        >
                            <option value="mid">MID</option>
                            <option value="bid">BID</option>
                            <option value="ask">ASK</option>
                            <option value="last">LAST</option>
                        </select>
                        <p className="text-xs text-muted-foreground">Choose which quote to derive IV and greeks.</p>
                    </div>

                    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strike Range</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={5}
                                max={100}
                                step={1}
                                value={bandPct}
                                onChange={(event) => {
                                    const value = Number(event.target.value);
                                    setBandPct(Number.isFinite(value) ? value : DEFAULT_BAND_PCT);
                                }}
                                className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                            />
                            <span className="text-xs font-semibold text-muted-foreground">%</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Show strikes within ±{bandPct}% of spot.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <input
                            type="checkbox"
                            checked={isLive}
                            onChange={(event) => setIsLive(event.target.checked)}
                            className="h-4 w-4 accent-primary"
                        />
                        Live updates
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Interval</span>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            value={pollSeconds}
                            onChange={(event) => {
                                const value = Number(event.target.value);
                                setPollSeconds(Number.isFinite(value) && value > 0 ? value : DEFAULT_POLL_SECONDS);
                            }}
                            className="h-9 w-20 rounded-lg border border-border/60 bg-background px-2 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">sec</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => loadChain({ mode: "manual" })}
                        disabled={isLoadingInitial || !selectedExpiry}
                        className={cn(
                            "rounded-lg border border-border/60 px-3 py-2 text-xs font-semibold transition-colors",
                            isLoadingInitial || !selectedExpiry ? "cursor-not-allowed opacity-60" : "hover:bg-muted/40"
                        )}
                    >
                        Refresh
                    </button>
                    <span className="ml-auto text-xs text-muted-foreground">Quotes may be delayed.</span>
                </div>

                {error && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-lg backdrop-blur space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <div>
                        {spot !== null ? (
                            <>
                                Spot: <span className="font-semibold text-foreground">{formatNumber(spot, 2)}</span> • Expiry{" "}
                                <span className="font-semibold text-foreground">{selectedExpiry || "--"}</span>
                            </>
                        ) : (
                            "Awaiting spot and chain data."
                        )}
                    </div>
                    <div>{rows.length ? `Loaded ${rows.length} strikes` : "No strikes loaded yet."}</div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border/60">
                    <div className="max-h-[560px] overflow-auto" ref={scrollRef}>
                        <table className="min-w-full text-xs tabular-nums">
                            <thead className="sticky top-0 z-10 bg-muted/80 text-muted-foreground backdrop-blur">
                                <tr>
                                    <th className="px-2 py-2 text-center font-semibold uppercase tracking-wide" colSpan={7}>
                                        Calls
                                    </th>
                                    <th className="px-2 py-2 text-center font-semibold uppercase tracking-wide bg-muted/70 border-x border-border/60">
                                        Strike
                                    </th>
                                    <th className="px-2 py-2 text-center font-semibold uppercase tracking-wide" colSpan={7}>
                                        Puts
                                    </th>
                                </tr>
                                <tr className="bg-muted/60 text-muted-foreground">
                                    <th className="px-2 py-2 text-right font-semibold">Vol</th>
                                    <th className="px-2 py-2 text-right font-semibold">OI</th>
                                    <th className="px-2 py-2 text-right font-semibold">Bid</th>
                                    <th className="px-2 py-2 text-right font-semibold">Ask</th>
                                    <th className="px-2 py-2 text-right font-semibold">Mid</th>
                                    <th className="px-2 py-2 text-right font-semibold">IV</th>
                                    <th className="px-2 py-2 text-right font-semibold">Δ</th>
                                    <th className="px-2 py-2 text-center font-semibold bg-muted/70 border-x border-border/60">Strike</th>
                                    <th className="px-2 py-2 text-right font-semibold">Δ</th>
                                    <th className="px-2 py-2 text-right font-semibold">IV</th>
                                    <th className="px-2 py-2 text-right font-semibold">Mid</th>
                                    <th className="px-2 py-2 text-right font-semibold">Ask</th>
                                    <th className="px-2 py-2 text-right font-semibold">Bid</th>
                                    <th className="px-2 py-2 text-right font-semibold">OI</th>
                                    <th className="px-2 py-2 text-right font-semibold">Vol</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {showEmptyState && (
                                    <tr>
                                        <td colSpan={15} className="px-3 py-6 text-center text-muted-foreground">
                                            No option contracts found for this expiry and strike range.
                                        </td>
                                    </tr>
                                )}
                                {isLoadingInitial && (
                                    <tr>
                                        <td colSpan={15} className="px-3 py-6 text-center text-muted-foreground">
                                            Loading option chain...
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row) => {
                                    const call = row.call;
                                    const put = row.put;
                                    const isAtm = atmStrike !== null && Math.abs(row.strike - atmStrike) < 1e-6;
                                    const callVolWidth = maxCallVol > 0 ? Math.min(100, ((call?.volume ?? 0) / maxCallVol) * 100) : 0;
                                    const putVolWidth = maxPutVol > 0 ? Math.min(100, ((put?.volume ?? 0) / maxPutVol) * 100) : 0;
                                    return (
                                        <tr
                                            key={row.strike}
                                            className={cn(
                                                "transition-colors hover:bg-muted/30",
                                                isAtm && "bg-primary/15 text-foreground"
                                            )}
                                        >
                                            <td className="px-2 py-2 text-right">
                                                <div className="relative">
                                                    <div
                                                        className="absolute inset-y-0 left-0 rounded-sm bg-primary/20"
                                                        style={{ width: `${callVolWidth}%` }}
                                                    />
                                                    <span className="relative">{formatNumber(call?.volume ?? null, 0)}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-right">{formatNumber(call?.openInterest ?? null, 0)}</td>
                                            <td className="px-2 py-2 text-right">{formatNumber(call?.bid ?? null, 2)}</td>
                                            <td className="px-2 py-2 text-right">{formatNumber(call?.ask ?? null, 2)}</td>
                                            <td className="px-2 py-2 text-right">{formatNumber(call?.mid ?? null, 2)}</td>
                                            <td className="px-2 py-2 text-right">{formatIV(call?.iv ?? null, 2)}</td>
                                            <td className="px-2 py-2 text-right">{formatNumber(call?.delta ?? null, 3)}</td>
                                            <td className="px-2 py-2 text-center font-semibold bg-muted/40 border-x border-border/60">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span>{formatNumber(row.strike, 2)}</span>
                                                    {isAtm && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px]">Spot</span>}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-right">{formatNumber(put?.delta ?? null, 3)}</td>
                                            <td className="px-2 py-2 text-right">{formatIV(put?.iv ?? null, 2)}</td>
                                            <td className="px-2 py-2 text-right">{formatNumber(put?.mid ?? null, 2)}</td>
                                            <td className="px-2 py-2 text-right">{formatNumber(put?.ask ?? null, 2)}</td>
                                            <td className="px-2 py-2 text-right">{formatNumber(put?.bid ?? null, 2)}</td>
                                            <td className="px-2 py-2 text-right">{formatNumber(put?.openInterest ?? null, 0)}</td>
                                            <td className="px-2 py-2 text-right">
                                                <div className="relative">
                                                    <div
                                                        className="absolute inset-y-0 left-0 rounded-sm bg-primary/20"
                                                        style={{ width: `${putVolWidth}%` }}
                                                    />
                                                    <span className="relative">{formatNumber(put?.volume ?? null, 0)}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
