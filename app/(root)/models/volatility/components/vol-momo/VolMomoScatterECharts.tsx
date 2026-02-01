"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

export type VolMomoScatterPoint = {
    x: number;
    y: number;
    fwd: number;
};

type VolMomoScatterEChartsProps = {
    points: VolMomoScatterPoint[];
    mode: "sigma" | "raw";
    currentRegime?: {
        x: number;
        y: number;
        momLo: number;
        momHi: number;
        volLo: number;
        volHi: number;
        winProb: number | null;
        meanFwd: number | null;
        count: number | null;
    } | null;
    rings?: number[];
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const formatAxisValue = (value: number, mode: "sigma" | "raw") =>
    mode === "sigma" ? value.toFixed(2) : formatPercent(value);

/**
 * Render the Vol-Momo scatter panel using Plotly.
 * @param props - Scatter chart inputs.
 * @returns Scatter chart card element.
 */
export default function VolMomoScatterECharts({
    points,
    mode,
    currentRegime,
    rings = [1, 2, 3],
}: VolMomoScatterEChartsProps) {
    const values = points.map((point) => point.fwd);
    const maxAbs = values.length ? Math.max(...values.map((value) => Math.abs(value))) : 0.01;
    const ringShapes = mode === "sigma"
        ? rings.map((radius) => ({
              type: "circle" as const,
              xref: "x",
              yref: "y",
              x0: -radius,
              y0: -radius,
              x1: radius,
              y1: radius,
              line: { color: "rgba(148,163,184,0.35)", width: 1, dash: "dot" },
          }))
        : [];
    const crosshairShapes = [
        {
            type: "line" as const,
            x0: 0,
            x1: 0,
            y0: -4,
            y1: 4,
            xref: "x",
            yref: "y",
            line: { color: "rgba(148,163,184,0.35)", width: 1 },
        },
        {
            type: "line" as const,
            x0: -4,
            x1: 4,
            y0: 0,
            y1: 0,
            xref: "x",
            yref: "y",
            line: { color: "rgba(148,163,184,0.35)", width: 1 },
        },
    ];

    return (
        <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f14] p-4 shadow-2xl shadow-black/40">
            <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/60">Sigma space</p>
                <h3 className="text-lg font-semibold text-white">Momentum vs Volatility</h3>
            </div>
            <div className="h-[280px] w-full">
                <Plot
                    data={[
                        {
                            type: "scattergl",
                            mode: "markers",
                            x: points.map((point) => point.x),
                            y: points.map((point) => point.y),
                            marker: {
                                size: 8,
                                color: points.map((point) => point.fwd),
                                colorscale: [
                                    [0, "#2563eb"],
                                    [0.5, "#f8fafc"],
                                    [1, "#ef4444"],
                                ],
                                cmin: -maxAbs,
                                cmax: maxAbs,
                                cmid: 0,
                                line: { color: "rgba(15, 23, 42, 0.7)", width: 1 },
                            },
                            hovertemplate:
                                "x: %{x:.2f}<br>y: %{y:.2f}<br>Fwd: %{marker.color:.2%}<extra></extra>",
                        },
                        ...(currentRegime
                            ? [
                                  {
                                      type: "scattergl" as const,
                                      mode: "markers",
                                      x: [currentRegime.x],
                                      y: [currentRegime.y],
                                      marker: {
                                          size: 12,
                                          color: "#f8fafc",
                                          line: { color: "#fbbf24", width: 2 },
                                      },
                                      hovertemplate:
                                          "Current regime<br>" +
                                          "mom: %{x:.2f} (" +
                                          `${formatAxisValue(currentRegime.momLo, mode)}..${formatAxisValue(
                                              currentRegime.momHi,
                                              mode
                                          )}` +
                                          ")<br>" +
                                          "vol: %{y:.2f} (" +
                                          `${formatAxisValue(currentRegime.volLo, mode)}..${formatAxisValue(
                                              currentRegime.volHi,
                                              mode
                                          )}` +
                                          ")<br>" +
                                          `Win prob: ${
                                              currentRegime.winProb != null
                                                  ? formatPercent(currentRegime.winProb)
                                                  : "--"
                                          }<br>` +
                                          `Mean fwd: ${
                                              currentRegime.meanFwd != null
                                                  ? formatPercent(currentRegime.meanFwd)
                                                  : "--"
                                          }<br>` +
                                          `Samples: ${currentRegime.count ?? "--"}<extra></extra>`,
                                  },
                              ]
                            : []),
                    ]}
                    layout={{
                        autosize: true,
                        margin: { l: 45, r: 10, t: 10, b: 40 },
                        paper_bgcolor: "rgba(0,0,0,0)",
                        plot_bgcolor: "rgba(0,0,0,0)",
                        xaxis: {
                            title: mode === "sigma" ? "z-momentum" : "momentum",
                            zeroline: false,
                            gridcolor: "rgba(255,255,255,0.08)",
                            color: "#cbd5f5",
                        },
                        yaxis: {
                            title: mode === "sigma" ? "z-volatility" : "volatility",
                            zeroline: false,
                            gridcolor: "rgba(255,255,255,0.08)",
                            color: "#cbd5f5",
                        },
                        shapes: [...ringShapes, ...crosshairShapes],
                        showlegend: false,
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    style={{ width: "100%", height: "100%" }}
                    useResizeHandler
                />
            </div>
            {mode === "sigma" ? (
                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                    {rings.map((sigma) => (
                        <span key={sigma} className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1">
                            {sigma}σ ring
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
