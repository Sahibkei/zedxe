"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

import {
    formatPct,
    formatRangeLabel,
    MEAN_FWD_DIVERGING_COLORSCALE,
    robustSymmetricRange,
    WIN_PROB_COLORSCALE,
} from "@/lib/viz/plotlyScales";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

type VolMomoHeatmapProps = {
    title: string;
    subtitle: string;
    xEdges: number[];
    yEdges: number[];
    gridValues: Array<Array<number | null>>;
    countGrid?: number[][];
    loading: boolean;
    kind: "win" | "mean";
    onCellClick?: (i: number, j: number) => void;
    selectedCell?: { i: number; j: number } | null;
};

/**
 * Render a volatility/momentum heatmap card powered by Plotly.
 * @param props - Heatmap configuration and interaction handlers.
 * @returns Heatmap card element.
 */
export default function VolMomoHeatmap({
    title,
    subtitle,
    xEdges,
    yEdges,
    gridValues,
    countGrid,
    loading,
    kind,
    onCellClick,
    selectedCell,
}: VolMomoHeatmapProps) {
    if (loading) {
        return (
            <div className="h-[420px] w-full animate-pulse rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent" />
        );
    }

    if (!xEdges.length || !yEdges.length || gridValues.length === 0) {
        return (
            <div className="flex h-[420px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
                No heatmap data available.
            </div>
        );
    }

    const buildLabels = (edges: number[], kind: "pct" | "bps") => {
        let decimals = 2;
        let labels = edges.slice(0, -1).map((edge, index) =>
            formatRangeLabel(edge, edges[index + 1] ?? edge, kind, decimals)
        );
        const hasDuplicates = new Set(labels).size !== labels.length;
        if (hasDuplicates) {
            decimals = 4;
            labels = edges.slice(0, -1).map((edge, index) =>
                formatRangeLabel(edge, edges[index + 1] ?? edge, kind, decimals)
            );
        }
        return labels;
    };

    const xLabels = buildLabels(xEdges, "pct");
    const maxVolAbs = Math.max(...yEdges.map((edge) => Math.abs(edge)));
    const volKind = maxVolAbs < 0.005 ? "bps" : "pct";
    const yLabels = buildLabels(yEdges, volKind);
    const flatValues = gridValues
        .flat()
        .filter((value): value is number => value !== null && Number.isFinite(value));
    const { zmin, zmax } =
        kind === "mean" ? robustSymmetricRange(flatValues, 0.98) : { zmin: 0, zmax: 1 };
    const colorscale = kind === "mean" ? MEAN_FWD_DIVERGING_COLORSCALE : WIN_PROB_COLORSCALE;
    const textValues = gridValues.map((row) =>
        row.map((value) => (value == null ? "" : formatPct(value, 2)))
    );
    const customData = gridValues.map((row, j) =>
        row.map((_, i) => [
            xLabels[i] ?? "--",
            yLabels[j] ?? "--",
            countGrid?.[j]?.[i] ?? 0,
        ])
    );
    const highlightShape =
        selectedCell && xLabels[selectedCell.i] && yLabels[selectedCell.j]
            ? [
                  {
                      type: "rect",
                      xref: "x",
                      yref: "y",
                      x0: selectedCell.i - 0.5,
                      x1: selectedCell.i + 0.5,
                      y0: selectedCell.j - 0.5,
                      y1: selectedCell.j + 0.5,
                      line: { color: "#f8fafc", width: 2 },
                      fillcolor: "rgba(0,0,0,0)",
                  },
              ]
            : [];

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
                            x: xLabels,
                            y: yLabels,
                            z: gridValues,
                            zsmooth: false,
                            colorscale,
                            zmin,
                            zmax,
                            zmid: kind === "mean" ? 0 : undefined,
                            text: textValues,
                            texttemplate: "%{text}",
                            customdata: customData,
                            hovertemplate:
                                "Momentum: %{customdata[0]}<br>Volatility: %{customdata[1]}<br>Samples: %{customdata[2]}<br>" +
                                `${title}: %{z:.2%}<extra></extra>`,
                            colorbar: {
                                tickformat: kind === "mean" ? ".2%" : ".0%",
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
                        shapes: highlightShape,
                        xaxis: {
                            type: "category",
                            title: "momentum",
                            gridcolor: "rgba(255,255,255,0.08)",
                            zerolinecolor: "rgba(255,255,255,0.12)",
                            color: "#cbd5f5",
                        },
                        yaxis: {
                            type: "category",
                            title: "volatility",
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
                        if (!point) {
                            return;
                        }
                        const xIndex = xLabels.indexOf(String(point.x));
                        const yIndex = yLabels.indexOf(String(point.y));
                        if (xIndex < 0 || yIndex < 0) return;
                        onCellClick?.(xIndex, yIndex);
                    }}
                />
            </div>
        </div>
    );
}
