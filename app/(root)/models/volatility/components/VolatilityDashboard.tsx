"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import IVSurfaceChart from "./IVSurfaceChart";
import VolatilityControls from "./VolatilityControls";
import VolatilityHeaderMetrics from "./VolatilityHeaderMetrics";

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
    maxDays: number;
    expiries: number;
    xMin: number;
    xMax: number;
}) => {
    const searchParams = new URLSearchParams({
        symbol: "BTC",
        maxDays: params.maxDays.toString(),
        expiries: params.expiries.toString(),
        xMin: params.xMin.toString(),
        xMax: params.xMax.toString(),
    });
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
    const [data, setData] = useState<SurfaceResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    const fetchSurface = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(
                buildQuery({
                    maxDays: params.maxDays,
                    expiries: params.expiries,
                    xMin: params.xMin,
                    xMax: params.xMax,
                })
            );
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            const payload = (await response.json()) as unknown;
            if (!isSurfaceResponse(payload)) {
                throw new Error("Unexpected response shape.");
            }
            if (mountedRef.current) {
                setData(payload);
            }
        } catch (err) {
            if (mountedRef.current) {
                setError(err instanceof Error ? err.message : "Unknown error");
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [params.expiries, params.maxDays, params.xMax, params.xMin]);

    useEffect(() => {
        mountedRef.current = true;
        fetchSurface();
        return () => {
            mountedRef.current = false;
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
                        BTC Implied Volatility 3D Surface
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

            <VolatilityHeaderMetrics {...stats} />

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

            {error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                    {error}
                </div>
            ) : null}

            <IVSurfaceChart grid={grid} loading={loading} />

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <p>
                    Source: {data?.source ?? "deribit"} · Points: {data?.points_count ?? "--"}
                </p>
                <p>Data refreshes every {params.refreshSeconds}s when auto-refresh is enabled.</p>
            </div>
        </div>
    );
}
