"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

type IVSmileChartProps = {
    grid: {
        x: number[];
        y: number[];
        z: number[][];
    } | null;
    loading: boolean;
};

const findNearestIndex = (values: number[], target: number) => {
    if (!values.length) return 0;
    return values.reduce((bestIdx, value, idx) => {
        const bestDiff = Math.abs(values[bestIdx] - target);
        const diff = Math.abs(value - target);
        return diff < bestDiff ? idx : bestIdx;
    }, 0);
};

export default function IVSmileChart({ grid, loading }: IVSmileChartProps) {
    const [selectedIdx, setSelectedIdx] = useState(0);

    useEffect(() => {
        if (!grid || grid.y.length === 0) return;
        const idx = findNearestIndex(grid.y, 30);
        setSelectedIdx(idx);
    }, [grid]);

    const row = grid?.z[selectedIdx] ?? [];
    const x = grid?.x ?? [];
    const smilePct = useMemo(() => row.map((value) => value * 100), [row]);

    if (loading) {
        return (
            <div className="h-[520px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
        );
    }

    if (!grid || grid.x.length === 0 || grid.y.length === 0 || row.length === 0) {
        return (
            <div className="flex h-[520px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
                No smile data available.
            </div>
        );
    }

    const quickTargets = [7, 30, 90];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0f14] px-4 py-3 text-sm text-slate-200">
                <label className="text-xs uppercase tracking-wide text-emerald-200/70">
                    Expiry slice
                </label>
                <select
                    value={selectedIdx}
                    onChange={(event) => setSelectedIdx(Number(event.target.value))}
                    className="rounded-lg border border-white/10 bg-[#0f141b] px-2 py-1 text-xs text-white"
                >
                    {grid.y.map((value, idx) => (
                        <option key={value} value={idx}>
                            {value.toFixed(1)}d
                        </option>
                    ))}
                </select>
                <div className="flex flex-wrap gap-2">
                    {quickTargets.map((target) => (
                        <button
                            key={target}
                            type="button"
                            onClick={() => setSelectedIdx(findNearestIndex(grid.y, target))}
                            className="rounded-full border border-emerald-500/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400/60"
                        >
                            ~{target}d
                        </button>
                    ))}
                </div>
                <span className="text-xs text-slate-400">
                    Selected: {grid.y[selectedIdx]?.toFixed(1)}d
                </span>
            </div>
            <div className="h-[520px] w-full rounded-2xl border border-white/10 bg-[#0b0f14] p-3 shadow-2xl shadow-black/40">
                <Plot
                    data={[
                        {
                            type: "scatter",
                            mode: "lines+markers",
                            x,
                            y: smilePct,
                            line: { color: "#34d399", width: 2 },
                            marker: { color: "#f8fafc", size: 4 },
                            hovertemplate:
                                "ln(K/S): %{x:.2f}<br>IV: %{y:.2f}%<extra></extra>",
                        },
                    ]}
                    layout={{
                        autosize: true,
                        margin: { l: 40, r: 10, t: 10, b: 40 },
                        paper_bgcolor: "rgba(0,0,0,0)",
                        plot_bgcolor: "rgba(0,0,0,0)",
                        xaxis: {
                            title: "ln(K/S)",
                            gridcolor: "rgba(255,255,255,0.08)",
                            zerolinecolor: "rgba(255,255,255,0.12)",
                            color: "#cbd5f5",
                        },
                        yaxis: {
                            title: "Implied Vol (%)",
                            gridcolor: "rgba(255,255,255,0.08)",
                            zerolinecolor: "rgba(255,255,255,0.12)",
                            color: "#cbd5f5",
                        },
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    style={{ width: "100%", height: "100%" }}
                    useResizeHandler
                />
            </div>
        </div>
    );
}
