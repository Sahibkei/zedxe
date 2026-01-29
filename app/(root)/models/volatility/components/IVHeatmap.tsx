"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

type IVHeatmapProps = {
    grid: {
        x: number[];
        y: number[];
        z: number[][];
    } | null;
    gridStats?: {
        zP5: number | null;
        zP95: number | null;
    };
    loading: boolean;
};

const percentile = (values: number[], p: number) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const tooltipTemplate =
    "DTE: %{y:.0f}d<br>ln(K/S): %{x:.2f}<br>IV: %{z:.1f}%<extra></extra>";

export default function IVHeatmap({ grid, gridStats, loading }: IVHeatmapProps) {
    if (loading) {
        return (
            <div className="h-[520px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
        );
    }

    if (!grid || grid.x.length === 0 || grid.y.length === 0) {
        return (
            <div className="flex h-[520px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
                No heatmap data available.
            </div>
        );
    }

    const zPct = grid.z.map((row) => row.map((value) => value * 100));
    const flattenedPct = zPct.flat();
    const zMin =
        gridStats?.zP5 !== undefined && gridStats?.zP5 !== null
            ? gridStats.zP5 * 100
            : percentile(flattenedPct, 0.05);
    const zMax =
        gridStats?.zP95 !== undefined && gridStats?.zP95 !== null
            ? gridStats.zP95 * 100
            : percentile(flattenedPct, 0.95);

    return (
        <div className="h-[520px] w-full rounded-2xl border border-white/10 bg-[#0b0f14] p-3 shadow-2xl shadow-black/40">
            <Plot
                data={[
                    {
                        type: "heatmap",
                        x: grid.x,
                        y: grid.y,
                        z: zPct,
                        colorscale: "Viridis",
                        zmin: zMin ?? undefined,
                        zmax: zMax ?? undefined,
                        hovertemplate: tooltipTemplate,
                        colorbar: {
                            title: "Implied Vol",
                            ticksuffix: "%",
                            tickcolor: "#cbd5f5",
                            titlefont: { color: "#cbd5f5", size: 12 },
                            outlinewidth: 0,
                        },
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
                        title: "Days to Expiry",
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
