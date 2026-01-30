"use client";

import { useMemo } from "react";

import EChart from "@/components/charts/EChart";
import { baseAxis, baseGrid, baseTextStyle, baseTooltip } from "@/lib/charts/zedxeEchartsTheme";

export type VolMomoScatterPoint = {
    x: number;
    y: number;
    fwd: number;
};

type VolMomoScatterEChartsProps = {
    points: VolMomoScatterPoint[];
    mode: "sigma" | "raw";
    rings?: number[];
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const buildRingPoints = (radius: number, steps = 120) =>
    Array.from({ length: steps + 1 }, (_, i) => {
        const theta = (Math.PI * 2 * i) / steps;
        return [radius * Math.cos(theta), radius * Math.sin(theta)];
    });

/**
 * Render the Vol-Momo scatter panel using ECharts.
 * @param props - Scatter chart inputs.
 * @returns Scatter chart card element.
 */
export default function VolMomoScatterECharts({
    points,
    mode,
    rings = [1, 2, 3],
}: VolMomoScatterEChartsProps) {
    const values = points.map((point) => point.fwd);
    const maxAbs = values.length ? Math.max(...values.map((value) => Math.abs(value))) : 0.01;

    const ringSeries = mode === "sigma"
        ? rings.map((radius) => ({
              type: "line" as const,
              data: buildRingPoints(radius),
              lineStyle: { color: "rgba(148,163,184,0.35)", type: "dashed" },
              symbol: "none",
              silent: true,
          }))
        : [];

    const option = useMemo(
        () => ({
            backgroundColor: "transparent",
            textStyle: baseTextStyle,
            grid: { ...baseGrid, bottom: 50 },
            xAxis: {
                type: "value",
                name: mode === "sigma" ? "z-momentum" : "momentum",
                ...baseAxis,
            },
            yAxis: {
                type: "value",
                name: mode === "sigma" ? "z-volatility" : "volatility",
                ...baseAxis,
            },
            tooltip: {
                ...baseTooltip,
                formatter: (params: { data: [number, number, number] }) => {
                    const [x, y, fwd] = params.data;
                    return `x: ${x.toFixed(2)}<br/>y: ${y.toFixed(2)}<br/>Fwd: ${formatPercent(
                        fwd
                    )}`;
                },
            },
            visualMap: {
                show: false,
                min: -maxAbs,
                max: maxAbs,
                inRange: { color: ["#ef4444", "#f8fafc", "#22c55e"] },
            },
            series: [
                {
                    type: "scatter",
                    data: points.map((point) => [point.x, point.y, point.fwd]),
                    symbolSize: 10,
                    itemStyle: {
                        borderColor: "rgba(15,23,42,0.7)",
                        borderWidth: 1,
                    },
                },
                ...ringSeries,
            ],
        }),
        [mode, maxAbs, points, ringSeries]
    );

    if (!points.length) {
        return (
            <div className="flex h-[380px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-sm text-slate-400">
                No scatter data available.
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f14] p-4 shadow-2xl shadow-black/40">
            <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/60">Sigma space</p>
                <h3 className="text-lg font-semibold text-white">Momentum vs Volatility</h3>
            </div>
            <div className="h-[280px] w-full">
                <EChart option={option} style={{ width: "100%", height: "100%" }} />
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
