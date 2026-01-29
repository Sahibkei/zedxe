"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

type IVSurfaceChartProps = {
    grid: {
        x: number[];
        y: number[];
        z: number[][];
    } | null;
    gridStats?: {
        zP5: number | null;
        zP95: number | null;
    };
    debugSamples?: Array<{
        x: number;
        dteDays: number;
        markIvPct: number;
    }>;
    showPoints?: boolean;
    loading: boolean;
};

const tooltipTemplate =
    "DTE: %{y:.0f}d<br>ln(K/S): %{x:.2f}<br>IV: %{z:.1f}%<extra></extra>";

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

export default function IVSurfaceChart({
    grid,
    gridStats,
    debugSamples,
    showPoints,
    loading,
}: IVSurfaceChartProps) {
    if (loading) {
        return (
            <div className="h-[520px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
        );
    }

    if (!grid || grid.x.length === 0 || grid.y.length === 0) {
        return (
            <div className="flex h-[520px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
                No surface data available.
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
    const scatterTrace =
        showPoints && debugSamples?.length
            ? [
                  {
                      type: "scatter3d" as const,
                      mode: "markers",
                      x: debugSamples.map((point) => point.x),
                      y: debugSamples.map((point) => point.dteDays),
                      z: debugSamples.map((point) => point.markIvPct),
                      marker: {
                          size: 3,
                          color: "#f8fafc",
                          opacity: 0.8,
                      },
                        hovertemplate:
                            "DTE: %{y:.0f}d<br>ln(K/S): %{x:.2f}<br>IV: %{z:.1f}%<extra></extra>",
                  },
              ]
            : [];

    return (
        <div className="h-[520px] w-full rounded-2xl border border-white/10 bg-[#0b0f14] p-3 shadow-2xl shadow-black/40">
            <Plot
                data={[
                    {
                        type: "surface",
                        x: grid.x,
                        y: grid.y,
                        z: zPct,
                        surfacecolor: zPct,
                        colorscale: "Viridis",
                        cmin: zMin ?? undefined,
                        cmax: zMax ?? undefined,
                        hovertemplate: tooltipTemplate,
                        showscale: true,
                        colorbar: {
                            title: "Implied Vol",
                            ticksuffix: "%",
                            tickcolor: "#cbd5f5",
                            titlefont: { color: "#cbd5f5", size: 12 },
                            outlinewidth: 0,
                        },
                        opacity: 0.95,
                        lighting: {
                            ambient: 0.4,
                            diffuse: 0.6,
                            specular: 0.4,
                            roughness: 0.6,
                        },
                        contours: {
                            x: { show: false },
                            y: { show: false },
                            z: { show: false },
                        },
                    },
                    ...scatterTrace,
                ]}
                layout={{
                    autosize: true,
                    margin: { l: 0, r: 0, t: 0, b: 0 },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    scene: {
                        bgcolor: "rgba(0,0,0,0)",
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
                        zaxis: {
                            title: "Mark IV",
                            gridcolor: "rgba(255,255,255,0.08)",
                            zerolinecolor: "rgba(255,255,255,0.12)",
                            color: "#cbd5f5",
                            ticksuffix: "%",
                        },
                        camera: {
                            eye: { x: 1.2, y: 1.2, z: 0.9 },
                        },
                    },
                }}
                config={{
                    responsive: true,
                    displayModeBar: false,
                }}
                style={{ width: "100%", height: "100%" }}
                useResizeHandler
            />
        </div>
    );
}
