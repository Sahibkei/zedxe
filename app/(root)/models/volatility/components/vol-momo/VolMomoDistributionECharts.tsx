"use client";

import { useMemo } from "react";

import EChart from "@/components/charts/EChart";
import { baseAxis, baseGrid, baseTextStyle, baseTooltip } from "@/lib/charts/zedxeEchartsTheme";

type VolMomoDistributionEChartsProps = {
    histogram: { binEdges: number[]; counts: number[] } | null;
    mean?: number | null;
    winRate?: number | null;
    samples?: number | null;
    selectedLabel?: string | null;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const buildCenters = (edges: number[]) =>
    edges.slice(0, -1).map((edge, index) => (edge + edges[index + 1]) / 2);

const findNearestIndex = (values: number[], target: number) => {
    if (!values.length) return -1;
    let bestIndex = 0;
    let bestDiff = Math.abs(values[0] - target);
    for (let i = 1; i < values.length; i += 1) {
        const diff = Math.abs(values[i] - target);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestIndex = i;
        }
    }
    return bestIndex;
};

/**
 * Render forward return distribution using ECharts.
 * @param props - Histogram and stats data.
 * @returns Distribution panel element.
 */
export default function VolMomoDistributionECharts({
    histogram,
    mean,
    winRate,
    samples,
    selectedLabel,
}: VolMomoDistributionEChartsProps) {
    const centers = useMemo(
        () => (histogram ? buildCenters(histogram.binEdges) : []),
        [histogram]
    );
    const categories = useMemo(
        () => centers.map((center) => formatPercent(center)),
        [centers]
    );

    const meanIndex = mean != null ? findNearestIndex(centers, mean) : -1;

    const option = useMemo(
        () => ({
            backgroundColor: "transparent",
            textStyle: baseTextStyle,
            grid: { ...baseGrid, bottom: 55 },
            xAxis: {
                type: "category",
                data: categories,
                ...baseAxis,
                axisLabel: {
                    ...(baseAxis.axisLabel ?? {}),
                    rotate: 0,
                    interval: Math.max(1, Math.floor(categories.length / 6)),
                },
            },
            yAxis: {
                type: "value",
                name: "Frequency",
                ...baseAxis,
            },
            tooltip: {
                ...baseTooltip,
                formatter: (params: { data: number; dataIndex: number }) => {
                    const idx = params.dataIndex;
                    const start = histogram?.binEdges[idx];
                    const end = histogram?.binEdges[idx + 1];
                    const range =
                        start != null && end != null
                            ? `${formatPercent(start)} → ${formatPercent(end)}`
                            : "--";
                    return `Range: ${range}<br/>Count: ${params.data}`;
                },
            },
            series: [
                {
                    type: "bar",
                    data: histogram?.counts ?? [],
                    itemStyle: {
                        color: "#38bdf8",
                        borderRadius: [4, 4, 0, 0],
                    },
                    markLine: meanIndex >= 0 ? {
                        symbol: ["none", "none"],
                        label: {
                            formatter: `Mean ${mean ? formatPercent(mean) : "--"}`,
                            color: "#e2e8f0",
                        },
                        lineStyle: { color: "#f8fafc", type: "dashed" },
                        data: [{ xAxis: categories[meanIndex] }],
                    } : undefined,
                },
            ],
        }),
        [categories, histogram, mean, meanIndex]
    );

    if (!histogram || histogram.counts.length === 0) {
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
                        Conditional density
                    </p>
                    <h3 className="text-lg font-semibold text-white">Forward return distribution</h3>
                </div>
                <div className="text-xs text-slate-400">
                    {selectedLabel ?? "Click a heatmap cell to inspect distributions."}
                </div>
            </div>
            <div className="h-[260px] w-full">
                <EChart option={option} style={{ width: "100%", height: "100%" }} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs text-slate-300">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Samples</p>
                    <p className="text-sm font-semibold text-white">{samples ?? "--"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Win Rate</p>
                    <p className="text-sm font-semibold text-white">
                        {winRate != null ? formatPercent(winRate) : "--"}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Mean</p>
                    <p className="text-sm font-semibold text-white">
                        {mean != null ? formatPercent(mean) : "--"}
                    </p>
                </div>
            </div>
        </div>
    );
}
