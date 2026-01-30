"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

export type HeatmapGrid = {
    x: number[];
    y: number[];
    z: Array<Array<number | null>>;
};

type VolMomoHeatmapProps = {
    title: string;
    subtitle: string;
    grid: HeatmapGrid | null;
    loading: boolean;
    colorScale: string;
    valueSuffix: string;
    valueFormatter: (value: number) => number;
    onCellClick?: (x: number, y: number) => void;
    xLabel?: string;
    yLabel?: string;
};

/**
 * Render a volatility/momentum heatmap card powered by Plotly.
 * @param props - Heatmap configuration and interaction handlers.
 * @returns Heatmap card element.
 */
export default function VolMomoHeatmap({
    title,
    subtitle,
    grid,
    loading,
    colorScale,
    valueSuffix,
    valueFormatter,
    onCellClick,
    xLabel,
    yLabel,
}: VolMomoHeatmapProps) {
    if (loading) {
        return (
            <div className="h-[420px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
        );
    }

    if (!grid || grid.x.length === 0 || grid.y.length === 0) {
        return (
            <div className="flex h-[420px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
                No heatmap data available.
            </div>
        );
    }

    const formattedZ = grid.z.map((row) =>
        row.map((value) => (value === null ? null : valueFormatter(value)))
    );

    const xTitle = xLabel ?? "z-momentum";
    const yTitle = yLabel ?? "z-volatility";
    const xHover = xLabel ?? "z-momo";
    const yHover = yLabel ?? "z-vol";

    return (
        <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f14] p-4 shadow-2xl shadow-black/40">
            <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/60">
                    {subtitle}
                </p>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
            </div>
            <div className="h-[320px] w-full">
                <Plot
                    data={[
                        {
                            type: "heatmap",
                            x: grid.x,
                            y: grid.y,
                            z: formattedZ,
                            colorscale: colorScale,
                            hovertemplate: `${yHover}: %{y:.2f}<br>${xHover}: %{x:.2f}<br>${title}: %{z:.2f}${valueSuffix}<extra></extra>`,
                            colorbar: {
                                ticksuffix: valueSuffix,
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
                            title: xTitle,
                            gridcolor: "rgba(255,255,255,0.08)",
                            zerolinecolor: "rgba(255,255,255,0.12)",
                            color: "#cbd5f5",
                        },
                        yaxis: {
                            title: yTitle,
                            gridcolor: "rgba(255,255,255,0.08)",
                            zerolinecolor: "rgba(255,255,255,0.12)",
                            color: "#cbd5f5",
                        },
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    style={{ width: "100%", height: "100%" }}
                    useResizeHandler
                    onClick={(event) => {
                        const point = event?.points?.[0];
                        if (!point || typeof point.x !== "number" || typeof point.y !== "number") {
                            return;
                        }
                        onCellClick?.(point.x, point.y);
                    }}
                />
            </div>
        </div>
    );
}
