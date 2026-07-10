"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

type VolMomoDistributionEChartsProps = {
    histogram: { binEdges: number[]; counts: number[] } | null;
    stats: {
        count: number;
        winRate: number | null;
        mean: number | null;
        median: number | null;
    } | null;
    loading: boolean;
    error?: string | null;
    selectedLabel?: string | null;
    hasSelection: boolean;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const buildCenters = (edges: number[]) =>
    edges.slice(0, -1).map((edge, index) => (edge + edges[index + 1]) / 2);

const histogramQuantile = (edges: number[], counts: number[], q: number) => {
    if (!edges.length || !counts.length) return null;
    const total = counts.reduce((sum, value) => sum + value, 0);
    if (total === 0) return null;
    const target = total * q;
    let cumulative = 0;
    for (let i = 0; i < counts.length; i += 1) {
        const count = counts[i];
        const start = edges[i];
        const end = edges[i + 1];
        if (start == null || end == null) continue;
        if (cumulative + count >= target) {
            const within = count ? (target - cumulative) / count : 0;
            return start + within * (end - start);
        }
        cumulative += count;
    }
    return edges[edges.length - 1] ?? null;
};

/**
 * Render forward return distribution using Plotly.
 * @param props - Histogram and stats data.
 * @returns Distribution panel element.
 */
export default function VolMomoDistributionECharts({
    histogram,
    stats,
    loading,
    error,
    selectedLabel,
    hasSelection,
}: VolMomoDistributionEChartsProps) {
    const centers = histogram ? buildCenters(histogram.binEdges) : [];
    const binPairs = histogram
        ? histogram.counts.map((_, index) => [histogram.binEdges[index], histogram.binEdges[index + 1]])
        : [];
    const p10 = histogram ? histogramQuantile(histogram.binEdges, histogram.counts, 0.1) : null;
    const p25 = histogram ? histogramQuantile(histogram.binEdges, histogram.counts, 0.25) : null;
    const p75 = histogram ? histogramQuantile(histogram.binEdges, histogram.counts, 0.75) : null;
    const p90 = histogram ? histogramQuantile(histogram.binEdges, histogram.counts, 0.9) : null;

    const showChart = histogram && histogram.counts.length > 0;
    const showPrompt = !hasSelection && !loading;

    return (
        <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f14] p-4 shadow-2xl shadow-black/40">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/60">
                        Cell Distribution
                    </p>
                    <h3 className="text-lg font-semibold text-white">Forward return distribution</h3>
                </div>
                <div className="text-xs text-slate-400">
                    {selectedLabel ?? "Click a cell to view distribution."}
                </div>
            </div>
            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
            <div className="relative h-[260px] w-full">
                {showChart ? (
                    <Plot
                        data={[
                            {
                                type: "bar",
                                x: centers,
                                y: histogram?.counts ?? [],
                                customdata: binPairs,
                                marker: {
                                    color: "#38bdf8",
                                    line: { color: "rgba(15, 23, 42, 0.7)", width: 1 },
                                },
                                hovertemplate:
                                    "Range: %{customdata[0]:.2%} → %{customdata[1]:.2%}<br>" +
                                    "Count: %{y}<extra></extra>",
                            },
                        ]}
                        layout={{
                            autosize: true,
                            margin: { l: 50, r: 10, t: 10, b: 40 },
                            paper_bgcolor: "rgba(0,0,0,0)",
                            plot_bgcolor: "rgba(0,0,0,0)",
                            xaxis: {
                                title: "Forward return",
                                tickformat: ".2%",
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
                            shapes:
                                stats?.mean != null
                                    ? [
                                          {
                                              type: "line",
                                              x0: stats.mean,
                                              x1: stats.mean,
                                              y0: 0,
                                              y1: 1,
                                              xref: "x",
                                              yref: "paper",
                                              line: { color: "#f8fafc", width: 1, dash: "dash" },
                                          },
                                      ]
                                    : [],
                        }}
                        config={{ responsive: true, displayModeBar: false }}
                        style={{ width: "100%", height: "100%" }}
                        useResizeHandler
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
                        {showPrompt ? "Click a cell to view distribution." : "No distribution data available."}
                    </div>
                )}
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#0b0f14]/80 text-sm text-slate-300">
                        Loading…
                    </div>
                ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 md:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Samples</p>
                    <p className="text-sm font-semibold text-white">{stats?.count ?? "--"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Win Rate</p>
                    <p className="text-sm font-semibold text-white">
                        {stats?.winRate != null ? formatPercent(stats.winRate) : "--"}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Mean</p>
                    <p className="text-sm font-semibold text-white">
                        {stats?.mean != null ? formatPercent(stats.mean) : "--"}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Median</p>
                    <p className="text-sm font-semibold text-white">
                        {stats?.median != null ? formatPercent(stats.median) : "--"}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">p10</p>
                    <p className="text-sm font-semibold text-white">
                        {p10 != null ? formatPercent(p10) : "--"}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">p25</p>
                    <p className="text-sm font-semibold text-white">
                        {p25 != null ? formatPercent(p25) : "--"}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">p75</p>
                    <p className="text-sm font-semibold text-white">
                        {p75 != null ? formatPercent(p75) : "--"}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">p90</p>
                    <p className="text-sm font-semibold text-white">
                        {p90 != null ? formatPercent(p90) : "--"}
                    </p>
                </div>
            </div>
        </div>
    );
}
