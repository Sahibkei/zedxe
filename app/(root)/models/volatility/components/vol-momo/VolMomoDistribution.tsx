"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

type DistributionData = {
    x: number[];
    y: number[];
    stats?: {
        count: number;
        winRate: number;
        mean: number;
    };
};

type VolMomoDistributionProps = {
    title: string;
    subtitle: string;
    data: DistributionData | null;
    loading: boolean;
    selectedLabel: string | null;
};

/**
 * Render a conditional forward return distribution panel.
 * @param props - Distribution chart data and selection metadata.
 * @returns Distribution panel element.
 */
export default function VolMomoDistribution({
    title,
    subtitle,
    data,
    loading,
    selectedLabel,
}: VolMomoDistributionProps) {
    if (loading) {
        return (
            <div className="h-[380px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
        );
    }

    if (!data || data.x.length === 0 || data.y.length === 0) {
        return (
            <div className="flex h-[380px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
                No distribution data available.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f14] p-4 shadow-2xl shadow-black/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/60">
                        {subtitle}
                    </p>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                </div>
                <div className="text-xs text-slate-400">
                    {selectedLabel ?? "Click a heatmap cell to inspect distributions."}
                </div>
            </div>
            <div className="h-[260px] w-full">
                <Plot
                    data={[
                        {
                            type: "scatter",
                            mode: "lines",
                            x: data.x.map((value) => value * 100),
                            y: data.y,
                            fill: "tozeroy",
                            line: { color: "#38bdf8" },
                            hovertemplate: "Return: %{x:.2f}%<br>Freq: %{y:.0f}<extra></extra>",
                        },
                    ]}
                    layout={{
                        autosize: true,
                        margin: { l: 40, r: 10, t: 10, b: 40 },
                        paper_bgcolor: "rgba(0,0,0,0)",
                        plot_bgcolor: "rgba(0,0,0,0)",
                        xaxis: {
                            title: "Forward return (%)",
                            gridcolor: "rgba(255,255,255,0.08)",
                            zerolinecolor: "rgba(255,255,255,0.12)",
                            color: "#cbd5f5",
                        },
                        yaxis: {
                            title: "Frequency",
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
            {data.stats ? (
                <div className="grid grid-cols-3 gap-3 text-xs text-slate-300">
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Samples</p>
                        <p className="text-sm font-semibold text-white">{data.stats.count}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Win Rate</p>
                        <p className="text-sm font-semibold text-white">
                            {(data.stats.winRate * 100).toFixed(1)}%
                        </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Mean</p>
                        <p className="text-sm font-semibold text-white">
                            {(data.stats.mean * 100).toFixed(2)}%
                        </p>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
