"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

import IVSurfaceChart from "./IVSurfaceChart";
import IVHeatmap from "./IVHeatmap";
import IVSmileChart from "./IVSmileChart";
import IVTermStructure from "./IVTermStructure";
import TradingViewWidget from "./TradingViewWidget";
import VolatilityControls from "./VolatilityControls";
import VolatilityHeaderMetrics from "./VolatilityHeaderMetrics";
import VolMomoDashboard from "./vol-momo/VolMomoDashboard";

type SurfaceGrid = {
    x: number[];
    y: number[];
    z: number[][];
};

type SurfaceResponse = {
    symbol: string;
    snapshot_ts: string;
    spot: number | null;
    rv: number | null;
    skew: number | null;
    kurt: number | null;
    grid: SurfaceGrid;
    points_count: number;
    debug_samples?: Array<{
        instrument_name: string;
        strike: number;
        expiry: number;
        dteDays: number;
        x: number;
        markIvPct: number;
    }>;
    grid_stats?: {
        zMin: number | null;
        zMax: number | null;
        zP5: number | null;
        zP95: number | null;
    };
    source: "deribit";
};

const DEFAULTS = {
    maxDays: 180,
    expiries: 25,
    xMin: -0.8,
    xMax: 0.8,
    refreshSeconds: 60,
    autoRefresh: true,
};

const buildQuery = (params: {
    symbol: string;
    maxDays: number;
    expiries: number;
    xMin: number;
    xMax: number;
    debug: boolean;
}) => {
    const searchParams = new URLSearchParams({
        symbol: params.symbol,
        maxDays: params.maxDays.toString(),
        expiries: params.expiries.toString(),
        xMin: params.xMin.toString(),
        xMax: params.xMax.toString(),
    });
    if (params.debug) {
        searchParams.set("debug", "1");
    }
    return `/api/models/volatility/iv-surface?${searchParams.toString()}`;
};

const isSurfaceResponse = (value: unknown): value is SurfaceResponse => {
    if (!value || typeof value !== "object") return false;
    const data = value as Record<string, unknown>;
    if (data.source !== "deribit") return false;
    if (typeof data.symbol !== "string") return false;
    if (typeof data.snapshot_ts !== "string") return false;
    if (typeof data.grid !== "object" || data.grid === null) return false;
    const grid = data.grid as Record<string, unknown>;
    if (!Array.isArray(grid.x) || !Array.isArray(grid.y) || !Array.isArray(grid.z)) {
        return false;
    }
    return true;
};

export default function VolatilityDashboard() {
    const [params, setParams] = useState(DEFAULTS);
    const [symbol, setSymbol] = useState<"BTC" | "ETH">("BTC");
    const [data, setData] = useState<SurfaceResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showPoints, setShowPoints] = useState(false);
    const [activeTab, setActiveTab] = useState("surface");
    const abortRef = useRef<AbortController | null>(null);
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const debug = searchParams.get("debug") === "1";
    const tabs = useMemo(
        () => [
            { id: "surface", label: "Surface" },
            { id: "heatmap", label: "Heatmap" },
            { id: "smile", label: "Smile" },
            { id: "term", label: "Term" },
            { id: "charts", label: "Charts" },
            { id: "vol-momo", label: "Volatility × Momentum" },
        ],
        []
    );

    const tabIds = useMemo(() => new Set(tabs.map((tab) => tab.id)), [tabs]);

    useEffect(() => {
        const tabParam = searchParams.get("tab");
        if (tabParam && tabIds.has(tabParam) && tabParam !== activeTab) {
            setActiveTab(tabParam);
        } else if (!tabParam && activeTab !== "surface") {
            setActiveTab("surface");
        }
    }, [activeTab, searchParams, tabIds]);

    const handleTabChange = (nextTab: string) => {
        setActiveTab(nextTab);
        const params = new URLSearchParams(searchParams.toString());
        if (nextTab === "surface") {
            params.delete("tab");
        } else {
            params.set("tab", nextTab);
        }
        const query = params.toString();
        router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    };

    const fetchSurface = useCallback(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(
                buildQuery({
                    maxDays: params.maxDays,
                    expiries: params.expiries,
                    xMin: params.xMin,
                    xMax: params.xMax,
                    symbol,
                    debug,
                }),
                { signal: controller.signal }
            );
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            const payload = (await response.json()) as unknown;
            if (!isSurfaceResponse(payload)) {
                throw new Error("Unexpected response shape.");
            }
            setData(payload);
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                return;
            }
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, [debug, params.expiries, params.maxDays, params.xMax, params.xMin, symbol]);

    useEffect(() => {
        fetchSurface();
        return () => {
            abortRef.current?.abort();
        };
    }, [fetchSurface]);

    useEffect(() => {
        if (!params.autoRefresh) return undefined;
        const interval = window.setInterval(() => {
            fetchSurface();
        }, params.refreshSeconds * 1000);
        return () => window.clearInterval(interval);
    }, [fetchSurface, params.autoRefresh, params.refreshSeconds]);

    const grid = data?.grid ?? null;
    const gridStats = data?.grid_stats;
    const debugSamples = data?.debug_samples;

    const stats = useMemo(
        () => ({
            spot: data?.spot ?? null,
            rv: data?.rv ?? null,
            skew: data?.skew ?? null,
            kurt: data?.kurt ?? null,
            updatedAt: data?.snapshot_ts,
        }),
        [data]
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/70">
                        Volatility Surface
                    </p>
                    <h1 className="text-3xl font-semibold text-white">
                        {symbol} Implied Volatility Analytics
                    </h1>
                    <p className="max-w-2xl text-sm text-slate-400">
                        Live Deribit implied volatility grid with fast-refresh controls and surface smoothing.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                        MVP
                    </div>
                    <Button
                        type="button"
                        onClick={fetchSurface}
                        className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                    >
                        Manual Refresh
                    </Button>
                </div>
            </div>

            <VolatilityHeaderMetrics symbol={symbol} {...stats} />

            <VolatilityControls
                maxDays={params.maxDays}
                expiries={params.expiries}
                xMin={params.xMin}
                xMax={params.xMax}
                refreshSeconds={params.refreshSeconds}
                autoRefresh={params.autoRefresh}
                onChange={setParams}
                onRefresh={fetchSurface}
            />

            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f14] p-4 text-sm text-slate-200 shadow-xl shadow-black/30">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-xs uppercase tracking-wide text-emerald-200/70">
                            Symbol
                        </span>
                        <div className="flex rounded-full border border-emerald-500/30 bg-emerald-500/10 p-1">
                            {(["BTC", "ETH"] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setSymbol(option)}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                                        symbol === option
                                            ? "bg-emerald-500/40 text-white"
                                            : "text-emerald-200/70 hover:text-emerald-100"
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleTabChange(tab.id)}
                                className={`rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                                    activeTab === tab.id
                                        ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
                                        : "border-white/10 text-slate-300 hover:border-emerald-400/40"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                    {error}
                </div>
            ) : null}

            {activeTab === "surface" ? (
                <IVSurfaceChart
                    grid={grid}
                    gridStats={gridStats}
                    debugSamples={debugSamples}
                    showPoints={showPoints}
                    loading={loading}
                />
            ) : null}
            {activeTab === "heatmap" ? (
                <IVHeatmap grid={grid} gridStats={gridStats} loading={loading} />
            ) : null}
            {activeTab === "smile" ? <IVSmileChart grid={grid} loading={loading} /> : null}
            {activeTab === "term" ? <IVTermStructure grid={grid} loading={loading} /> : null}
            {activeTab === "charts" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                    <TradingViewWidget
                        symbol="COINBASE:BTCUSD"
                        className="h-[520px] w-full"
                    />
                    <TradingViewWidget
                        symbol="COINBASE:ETHUSD"
                        className="h-[520px] w-full"
                    />
                </div>
            ) : null}
            {activeTab === "vol-momo" ? <VolMomoDashboard /> : null}

            {debug ? (
                <details className="rounded-2xl border border-white/10 bg-[#0b0f14] p-5 text-sm text-slate-200">
                    <summary className="cursor-pointer text-sm font-semibold text-emerald-200">
                        Data verification
                    </summary>
                    <div className="mt-4 space-y-4">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                            <p>Snapshot: {data?.snapshot_ts ?? "--"}</p>
                            <p>Spot: {data?.spot ?? "--"}</p>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                                type="checkbox"
                                checked={showPoints}
                                onChange={(event) => setShowPoints(event.target.checked)}
                                className="h-4 w-4 accent-emerald-400"
                            />
                            Show sample points on surface
                        </label>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs text-slate-300">
                                <thead className="text-[11px] uppercase text-emerald-200/70">
                                    <tr>
                                        <th className="py-2 pr-3">Instrument</th>
                                        <th className="py-2 pr-3">Strike</th>
                                        <th className="py-2 pr-3">DTE</th>
                                        <th className="py-2 pr-3">ln(K/S)</th>
                                        <th className="py-2 pr-3">Mark IV</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(debugSamples ?? []).map((sample) => (
                                        <tr
                                            key={`${sample.instrument_name}-${sample.strike}`}
                                            className="border-t border-white/5"
                                        >
                                            <td className="py-2 pr-3">{sample.instrument_name}</td>
                                            <td className="py-2 pr-3">{sample.strike}</td>
                                            <td className="py-2 pr-3">{sample.dteDays.toFixed(1)}</td>
                                            <td className="py-2 pr-3">{sample.x.toFixed(3)}</td>
                                            <td className="py-2 pr-3">{sample.markIvPct.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </details>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <p>
                    Source: {data?.source ?? "deribit"} · Points: {data?.points_count ?? "--"}
                </p>
                <p>Data refreshes every {params.refreshSeconds}s when auto-refresh is enabled.</p>
            </div>
        </div>
    );
}
