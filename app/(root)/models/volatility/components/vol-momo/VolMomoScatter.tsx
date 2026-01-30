"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

type ScatterData = {
    x: number[];
    y: number[];
    labels?: string[];
};

type VolMomoScatterProps = {
    data: ScatterData | null;
    loading: boolean;
};

const sigmaRings = [1, 2, 3];

export default function VolMomoScatter({ data, loading }: VolMomoScatterProps) {
    if (loading) {
        return (
            <div className="h-[380px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
        );
    }

    if (!data || data.x.length === 0 || data.y.length === 0) {
        return (
            <div className="flex h-[380px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
                No scatter data available.
            </div>
        );
    }

    const ringShapes = sigmaRings.map((sigma) => ({
        type: "circle" as const,
        xref: "x",
        yref: "y",
        x0: -sigma,
        y0: -sigma,
        x1: sigma,
        y1: sigma,
        line: {
            color: "rgba(148, 163, 184, 0.35)",
            width: 1,
            dash: "dot",
        },
    }));

    return (
        <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f14] p-4 shadow-2xl shadow-black/40">
            <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/60">
                    Sigma space
                </p>
                <h3 className="text-lg font-semibold text-white">z-Momentum vs z-Volatility</h3>
            </div>
            <div className="h-[280px] w-full">
                <Plot
                    data={[
                        {
                            type: "scatter",
                            mode: "markers",
                            x: data.x,
                            y: data.y,
                            text: data.labels,
                            marker: {
                                size: 10,
                                color: "#22d3ee",
                                line: { color: "rgba(15, 23, 42, 0.9)", width: 1 },
                            },
                            hovertemplate: "z-momo: %{x:.2f}<br>z-vol: %{y:.2f}<br>%{text}<extra></extra>",
                        },
                    ]}
                    layout={{
                        autosize: true,
                        margin: { l: 40, r: 10, t: 10, b: 40 },
                        paper_bgcolor: "rgba(0,0,0,0)",
                        plot_bgcolor: "rgba(0,0,0,0)",
                        xaxis: {
                            title: "z-momentum",
                            range: [-3.5, 3.5],
                            gridcolor: "rgba(255,255,255,0.08)",
                            zerolinecolor: "rgba(255,255,255,0.12)",
                            color: "#cbd5f5",
                        },
                        yaxis: {
                            title: "z-volatility",
                            range: [-3.5, 3.5],
                            gridcolor: "rgba(255,255,255,0.08)",
                            zerolinecolor: "rgba(255,255,255,0.12)",
                            color: "#cbd5f5",
                        },
                        shapes: ringShapes,
                        showlegend: false,
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    style={{ width: "100%", height: "100%" }}
                    useResizeHandler
                />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                {sigmaRings.map((sigma) => (
                    <span key={sigma} className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
                        {sigma}σ ring
                    </span>
                ))}
            </div>
        </div>
    );
}
