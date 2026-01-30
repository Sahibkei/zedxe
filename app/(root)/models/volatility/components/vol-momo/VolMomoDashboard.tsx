"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VolMomoResponse } from "@/lib/models/vol-momo";

import VolMomoDistributionECharts from "./VolMomoDistributionECharts";
import VolMomoHeatmapECharts from "./VolMomoHeatmapECharts";
import VolMomoScatterECharts from "./VolMomoScatterECharts";

const VolMomoSurface3D = dynamic(() => import("./VolMomoSurface3D"), {
    ssr: false,
    loading: () => (
        <div className="flex h-[380px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
            Loading 3D surface...
        </div>
    ),
});

type ControlsState = {
    symbol: string;
    interval: string;
    lookback: string;
    forwardHorizon: string;
    k: number;
    bins: number;
    minSamples: number;
    mode: "quantile" | "sigma";
};

type DistributionEntry = {
    histogram: { binEdges: number[]; counts: number[] };
    stats?: {
        count: number;
        winRate: number;
        mean: number;
    };
};

type SelectedCell = {
    i: number;
    j: number;
};

type CellDistributionResponse = {
    meta: {
        i: number;
        j: number;
        count: number;
        mean: number | null;
        median: number | null;
        p05: number | null;
        p95: number | null;
        pWin: number | null;
    };
    histogram: {
        edges: number[];
        counts: number[];
    };
};

const controlOptions = {
    symbol: ["BTC", "ETH"],
    interval: ["5m", "15m", "1h", "4h", "1d"],
    lookback: ["30d", "90d", "180d", "365d"],
    forwardHorizon: ["1d", "3d", "5d", "10d"],
};

const buildCenters = (edges: number[]) =>
    edges.slice(0, -1).map((edge, index) => (edge + edges[index + 1]) / 2);

const formatRangeLabel = (edges: number[], index: number) => {
    const start = edges[index];
    const end = edges[index + 1];
    if (start === undefined || end === undefined) return "";
    return `${start.toFixed(2)}..${end.toFixed(2)}`;
};

const formatTimestamp = (value: number) => {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toISOString().replace("T", " ").slice(0, 19);
};

const buildQueryParams = (controls: ControlsState) => {
    const lookbackDays = Number(controls.lookback.replace("d", ""));
    const params = new URLSearchParams({
        symbol: controls.symbol,
        interval: controls.interval,
        lookbackDays: Number.isFinite(lookbackDays) ? lookbackDays.toString() : "180",
        k: controls.k.toString(),
        bins: controls.bins.toString(),
        minSamples: controls.minSamples.toString(),
        mode: controls.mode,
        horizon: controls.forwardHorizon,
    });
    return params.toString();
};

/**
 * Render the Volatility × Momentum dashboard powered by live analytics.
 * @returns Volatility × Momentum dashboard layout.
 */
export default function VolMomoDashboard() {
    const [data, setData] = useState<VolMomoResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [controls, setControls] = useState<ControlsState>(() => ({
        symbol: "BTC",
        interval: "1h",
        lookback: "180d",
        forwardHorizon: "5d",
        k: 20,
        bins: 6,
        minSamples: 25,
        mode: "quantile",
    }));
    const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
    const [distributionData, setDistributionData] = useState<DistributionEntry | null>(null);
    const [distributionLoading, setDistributionLoading] = useState(false);
    const [showSurface, setShowSurface] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const cellAbortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<number | null>(null);
    const lastQueryRef = useRef<string | null>(null);

    const queryParams = useMemo(() => buildQueryParams(controls), [controls]);

    useEffect(() => {
        if (queryParams === lastQueryRef.current) return;
        lastQueryRef.current = queryParams;
        if (debounceRef.current) {
            window.clearTimeout(debounceRef.current);
        }
        setError(null);
        setUpdating(true);
        if (!data) {
            setLoading(true);
        }
        debounceRef.current = window.setTimeout(() => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            fetch(`/api/models/vol-momo?${queryParams}`, { signal: controller.signal })
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error(`API error: ${response.status}`);
                    }
                    const payload = (await response.json()) as VolMomoResponse;
                    setData(payload);
                })
                .catch((err) => {
                    if (err instanceof DOMException && err.name === "AbortError") {
                        return;
                    }
                    setError(err instanceof Error ? err.message : "Failed to load data");
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setLoading(false);
                        setUpdating(false);
                    }
                });
        }, 400);

        return () => {
            if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
            }
            abortRef.current?.abort();
        };
    }, [data, queryParams]);

    useEffect(() => {
        if (!data) return;
        setSelectedCell({ i: data.current.i, j: data.current.j });
    }, [data]);

    useEffect(() => {
        if (!data || !selectedCell) return;
        cellAbortRef.current?.abort();
        const controller = new AbortController();
        cellAbortRef.current = controller;
        setDistributionLoading(true);
        fetch(`/api/models/vol-momo/cell?${queryParams}&i=${selectedCell.i}&j=${selectedCell.j}`,
            { signal: controller.signal }
        )
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Cell API error: ${response.status}`);
                }
                const payload = (await response.json()) as CellDistributionResponse;
                const stats = payload.meta.mean === null || payload.meta.pWin === null
                    ? undefined
                    : {
                          count: payload.meta.count,
                          winRate: payload.meta.pWin,
                          mean: payload.meta.mean,
                      };
                setDistributionData({
                    histogram: {
                        binEdges: payload.histogram.edges,
                        counts: payload.histogram.counts,
                    },
                    stats,
                });
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }
                setDistributionData(null);
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setDistributionLoading(false);
                }
            });
        return () => {
            controller.abort();
        };
    }, [data, queryParams, selectedCell]);

    const xCenters = useMemo(() => (data ? buildCenters(data.axes.xEdges) : []), [data]);
    const yCenters = useMemo(() => (data ? buildCenters(data.axes.yEdges) : []), [data]);

    const surfaceData = useMemo(() => {
        if (!data) return null;
        return {
            x: xCenters,
            y: yCenters,
            z: data.grids.pWin.map((row) => row.map((value) => value ?? NaN)),
        };
    }, [data, xCenters, yCenters]);

    const scatterPoints = useMemo(() => {
        if (!data) return [];
        const fwd = data.grids.meanFwd[data.current.j]?.[data.current.i] ?? 0;
        return [{ x: data.current.zm, y: data.current.zv, fwd }];
    }, [data]);

    const distributionIsLoading = distributionLoading && !distributionData;

    const selectedLabel = useMemo(() => {
        if (!data || !selectedCell) return null;
        const xLabel = formatRangeLabel(data.axes.xEdges, selectedCell.i);
        const yLabel = formatRangeLabel(data.axes.yEdges, selectedCell.j);
        return `Selected bin: momo ${xLabel}, vol ${yLabel}`;
    }, [data, selectedCell]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/70">
                            Volatility × Momentum
                        </p>
                        <h2 className="text-2xl font-semibold text-white">
                            Momentum-conditioned volatility regime map
                        </h2>
                    </div>
                    <div className="text-xs text-slate-400">
                        {updating ? "Updating…" : data ? "Live" : ""}
                    </div>
                </div>
                <p className="max-w-3xl text-sm text-slate-400">
                    Explore win rates and forward returns by volatility and momentum bins. Click any
                    cell to update the distribution preview.
                </p>
                {error ? <p className="text-xs text-rose-300">{error}</p> : null}
                {data ? (
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                        <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
                            Bars: {data.meta.nCandles} · Samples: {data.meta.nSamples}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
                            hBars: {data.meta.hBars} · k: {data.meta.k}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
                            Start: {formatTimestamp(data.meta.startTs)} · End:{" "}
                            {formatTimestamp(data.meta.endTs)}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
                            First close: {data.meta.firstClose.toFixed(2)} · Last close:{" "}
                            {data.meta.lastClose.toFixed(2)}
                        </span>
                        {data.meta.requestsMade ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
                                Requests: {data.meta.requestsMade} · Cache:{" "}
                                {data.meta.cacheHit ? "Hit" : "Miss"}
                            </span>
                        ) : null}
                    </div>
                ) : null}
            </div>

            <div className="sticky top-4 z-20 rounded-2xl border border-white/10 bg-[#0b0f14]/90 p-4 shadow-xl shadow-black/40 backdrop-blur">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                            Symbol
                        </Label>
                        <select
                            value={controls.symbol}
                            onChange={(event) =>
                                setControls((prev) => ({ ...prev, symbol: event.target.value }))
                            }
                            className="w-full rounded-md border border-white/10 bg-[#0f141b] px-3 py-2 text-sm text-white"
                        >
                            {controlOptions.symbol.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                            Interval
                        </Label>
                        <select
                            value={controls.interval}
                            onChange={(event) =>
                                setControls((prev) => ({ ...prev, interval: event.target.value }))
                            }
                            className="w-full rounded-md border border-white/10 bg-[#0f141b] px-3 py-2 text-sm text-white"
                        >
                            {controlOptions.interval.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                            Lookback
                        </Label>
                        <select
                            value={controls.lookback}
                            onChange={(event) =>
                                setControls((prev) => ({ ...prev, lookback: event.target.value }))
                            }
                            className="w-full rounded-md border border-white/10 bg-[#0f141b] px-3 py-2 text-sm text-white"
                        >
                            {controlOptions.lookback.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                            Forward horizon
                        </Label>
                        <select
                            value={controls.forwardHorizon}
                            onChange={(event) =>
                                setControls((prev) => ({
                                    ...prev,
                                    forwardHorizon: event.target.value,
                                }))
                            }
                            className="w-full rounded-md border border-white/10 bg-[#0f141b] px-3 py-2 text-sm text-white"
                        >
                            {controlOptions.forwardHorizon.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-emerald-200/70">k</Label>
                        <Input
                            type="number"
                            value={controls.k}
                            onChange={(event) =>
                                setControls((prev) => ({
                                    ...prev,
                                    k: Number(event.target.value) || 0,
                                }))
                            }
                            className="border-white/10 bg-[#0f141b] text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                            Bins
                        </Label>
                        <Input
                            type="number"
                            value={controls.bins}
                            onChange={(event) =>
                                setControls((prev) => ({
                                    ...prev,
                                    bins: Number(event.target.value) || 0,
                                }))
                            }
                            className="border-white/10 bg-[#0f141b] text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                            Min samples
                        </Label>
                        <Input
                            type="number"
                            value={controls.minSamples}
                            onChange={(event) =>
                                setControls((prev) => ({
                                    ...prev,
                                    minSamples: Number(event.target.value) || 0,
                                }))
                            }
                            className="border-white/10 bg-[#0f141b] text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                            Mode
                        </Label>
                        <div className="flex rounded-full border border-white/10 bg-white/[0.02] p-1">
                            {(["quantile", "sigma"] as const).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setControls((prev) => ({ ...prev, mode: option }))}
                                    className={`flex-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                                        controls.mode === option
                                            ? "bg-emerald-500/40 text-white"
                                            : "text-slate-300 hover:text-emerald-100"
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {loading || !data ? (
                    <div className="h-[420px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
                ) : (
                    <VolMomoHeatmapECharts
                        title="Win Probability"
                        subtitle="Hit rate"
                        xLabels={data.axes.xTickLabels}
                        yLabels={data.axes.yTickLabels}
                        gridValues={data.grids.pWin}
                        countGrid={data.grids.count}
                        valueFormat="percent"
                        onCellClick={(i, j) => setSelectedCell({ i, j })}
                        selectedCell={selectedCell}
                        palette="win"
                    />
                )}
                {loading || !data ? (
                    <div className="h-[420px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
                ) : (
                    <VolMomoHeatmapECharts
                        title="Mean Forward Return"
                        subtitle="Average P&L"
                        xLabels={data.axes.xTickLabels}
                        yLabels={data.axes.yTickLabels}
                        gridValues={data.grids.meanFwd}
                        countGrid={data.grids.count}
                        valueFormat="percent"
                        onCellClick={(i, j) => setSelectedCell({ i, j })}
                        selectedCell={selectedCell}
                        palette="mean"
                    />
                )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {distributionIsLoading ? (
                    <div className="h-[380px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
                ) : (
                    <VolMomoDistributionECharts
                        histogram={distributionData?.histogram ?? null}
                        mean={distributionData?.stats?.mean}
                        winRate={distributionData?.stats?.winRate}
                        samples={distributionData?.stats?.count}
                        selectedLabel={selectedLabel}
                    />
                )}
                {loading ? (
                    <div className="h-[380px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
                ) : (
                    <VolMomoScatterECharts points={scatterPoints} mode="sigma" rings={[1, 2, 3]} />
                )}
            </div>

            <details
                className="rounded-2xl border border-white/10 bg-[#0b0f14] p-5 text-sm text-slate-200"
                onToggle={(event) =>
                    setShowSurface((event.target as HTMLDetailsElement).open)
                }
            >
                <summary className="cursor-pointer text-sm font-semibold text-emerald-200">
                    Explore in 3D
                </summary>
                <div className="mt-4">
                    {showSurface ? <VolMomoSurface3D data={surfaceData} /> : null}
                </div>
            </details>
        </div>
    );
}
