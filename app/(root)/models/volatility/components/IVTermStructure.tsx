"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

type IVTermStructureProps = {
    grid: {
        x: number[];
        y: number[];
        z: number[][];
    } | null;
    loading: boolean;
};

const findAtmIndex = (values: number[]) => {
    if (!values.length) return 0;
    return values.reduce((bestIdx, value, idx) => {
        const bestDiff = Math.abs(values[bestIdx]);
        const diff = Math.abs(value);
        return diff < bestDiff ? idx : bestIdx;
    }, 0);
};

export default function IVTermStructure({ grid, loading }: IVTermStructureProps) {
    if (loading) {
        return (
            <div className="h-[520px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
        );
    }

    if (!grid || grid.x.length === 0 || grid.y.length === 0) {
        return (
            <div className="flex h-[520px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
                No term structure data available.
            </div>
        );
    }

    const atmIndex = findAtmIndex(grid.x);
    const atmIvPct = grid.y.map((_, rowIdx) => {
        const row = grid.z[rowIdx] ?? [];
        const value = row[atmIndex];
        return value === undefined || value === null ? null : value * 100;
    });

    return (
        <div className="h-[520px] w-full rounded-2xl border border-white/10 bg-[#0b0f14] p-3 shadow-2xl shadow-black/40">
            <Plot
                data={[
                    {
                        type: "scatter",
                        mode: "lines+markers",
                        x: grid.y,
                        y: atmIvPct,
                        line: { color: "#60a5fa", width: 2 },
                        marker: { color: "#f8fafc", size: 4 },
                        hovertemplate: "DTE: %{x:.1f}d<br>ATM IV: %{y:.2f}%<extra></extra>",
                        connectgaps: false,
                    },
                ]}
                layout={{
                    autosize: true,
                    margin: { l: 40, r: 10, t: 10, b: 40 },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    xaxis: {
                        title: "Days to Expiry",
                        gridcolor: "rgba(255,255,255,0.08)",
                        zerolinecolor: "rgba(255,255,255,0.12)",
                        color: "#cbd5f5",
                    },
                    yaxis: {
                        title: "ATM IV (%)",
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
    );
}
