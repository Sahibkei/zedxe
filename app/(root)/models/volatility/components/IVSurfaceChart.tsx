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
    loading: boolean;
};

const tooltipTemplate =
    "DTE: %{y:.0f}d<br>ln(K/S): %{x:.2f}<br>IV: %{z:.2%}<extra></extra>";

export default function IVSurfaceChart({ grid, loading }: IVSurfaceChartProps) {
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

    return (
        <div className="h-[520px] w-full rounded-2xl border border-white/10 bg-[#0b0f14] p-3 shadow-2xl shadow-black/40">
            <Plot
                data={[
                    {
                        type: "surface",
                        x: grid.x,
                        y: grid.y,
                        z: grid.z,
                        colorscale: [
                            [0, "#0b1b2c"],
                            [0.3, "#1b3b5a"],
                            [0.6, "#2f6b7c"],
                            [1, "#5fd3a6"],
                        ],
                        hovertemplate: tooltipTemplate,
                        showscale: false,
                        opacity: 0.95,
                        contours: {
                            x: { show: false },
                            y: { show: false },
                            z: { show: false },
                        },
                    },
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
                            tickformat: ".0%",
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
