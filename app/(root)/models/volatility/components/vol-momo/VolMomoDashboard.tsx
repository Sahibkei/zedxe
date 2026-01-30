"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import mockData from "./mock_vol_momo.json";
import VolMomoDistribution from "./VolMomoDistribution";
import VolMomoHeatmap, { type HeatmapGrid } from "./VolMomoHeatmap";
import VolMomoScatter from "./VolMomoScatter";

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
    x: number[];
    y: number[];
    stats?: {
        count: number;
        winRate: number;
        mean: number;
    };
};

type VolMomoMock = {
    controls: ControlsState;
    heatmaps: {
        winProbability: HeatmapGrid;
        meanForwardReturn: HeatmapGrid;
    };
    distribution: {
        default: DistributionEntry;
        byCell: Record<string, DistributionEntry>;
    };
    scatter: {
        x: number[];
        y: number[];
        labels?: string[];
    };
    surface3d: {
        x: number[];
        y: number[];
        z: number[][];
    };
};

type SelectedCell = {
    xIndex: number;
    yIndex: number;
    xValue: number;
    yValue: number;
};

const controlOptions = {
    symbol: ["BTC", "ETH", "SOL"],
    interval: ["15m", "1h", "4h", "1d"],
    lookback: ["90d", "180d", "365d"],
    forwardHorizon: ["3d", "5d", "10d"],
};

/**
 * Convert a decimal value to percentage units.
 * @param value - Decimal value.
 * @returns Percentage value.
 */
const toPercent = (value: number) => value * 100;

/**
 * Render the Volatility × Momentum dashboard with mock-driven visuals.
 * @returns Volatility × Momentum dashboard layout.
 */
export default function VolMomoDashboard() {
    const [data, setData] = useState<VolMomoMock | null>(null);
    const [loading, setLoading] = useState(true);
    const [controls, setControls] = useState<ControlsState>(() => mockData.controls);
    const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
    const [showSurface, setShowSurface] = useState(false);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setData(mockData as VolMomoMock);
            setLoading(false);
        }, 200);
        return () => window.clearTimeout(timeout);
    }, []);

    const distributionData = useMemo(() => {
        if (!data) return null;
        if (!selectedCell) return data.distribution.default;
        const key = `${selectedCell.xIndex}-${selectedCell.yIndex}`;
        return data.distribution.byCell[key] ?? data.distribution.default;
    }, [data, selectedCell]);

    const selectedLabel = useMemo(() => {
        if (!selectedCell) return null;
        return `Selected bin: z-momo ${selectedCell.xValue.toFixed(1)}, z-vol ${selectedCell.yValue.toFixed(1)}`;
    }, [selectedCell]);

    const handleCellClick = (xValue: number, yValue: number) => {
        if (!data) return;
        const xIndex = data.heatmaps.winProbability.x.findIndex((value) => value === xValue);
        const yIndex = data.heatmaps.winProbability.y.findIndex((value) => value === yValue);
        if (xIndex < 0 || yIndex < 0) return;
        setSelectedCell({ xIndex, yIndex, xValue, yValue });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/70">
                    Volatility × Momentum
                </p>
                <h2 className="text-2xl font-semibold text-white">Momentum-conditioned volatility regime map</h2>
                <p className="max-w-3xl text-sm text-slate-400">
                    Explore win rates and forward returns by volatility and momentum bins. Click any
                    cell to update the distribution preview.
                </p>
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
                                setControls((prev) => ({ ...prev, forwardHorizon: event.target.value }))
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
                                setControls((prev) => ({ ...prev, k: Number(event.target.value) || 0 }))
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
                <VolMomoHeatmap
                    title="Win Probability"
                    subtitle="Hit rate"
                    grid={data?.heatmaps.winProbability ?? null}
                    loading={loading}
                    colorScale="YlGnBu"
                    valueSuffix="%"
                    valueFormatter={toPercent}
                    onCellClick={handleCellClick}
                />
                <VolMomoHeatmap
                    title="Mean Forward Return"
                    subtitle="Average P&L"
                    grid={data?.heatmaps.meanForwardReturn ?? null}
                    loading={loading}
                    colorScale="RdBu"
                    valueSuffix="%"
                    valueFormatter={toPercent}
                    onCellClick={handleCellClick}
                />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <VolMomoDistribution
                    title="Forward return distribution"
                    subtitle="Conditional density"
                    data={distributionData}
                    loading={loading}
                    selectedLabel={selectedLabel}
                />
                <VolMomoScatter data={data?.scatter ?? null} loading={loading} />
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
                    {showSurface ? <VolMomoSurface3D data={data?.surface3d ?? null} /> : null}
                </div>
            </details>
        </div>
    );
}
