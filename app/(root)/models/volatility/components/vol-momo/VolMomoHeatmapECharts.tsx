"use client";

import { useMemo } from "react";

import EChart from "@/components/charts/EChart";
import { baseAxis, baseGrid, baseTextStyle, baseTooltip } from "@/lib/charts/zedxeEchartsTheme";

export type VolMomoHeatmapEChartsProps = {
    title: string;
    subtitle: string;
    xLabels: string[];
    yLabels: string[];
    gridValues: Array<Array<number | null>>;
    countGrid?: number[][];
    valueFormat: "percent" | "bp" | "float";
    onCellClick?: (i: number, j: number) => void;
    selectedCell?: { i: number; j: number } | null;
    palette: "win" | "mean";
};

const formatValue = (value: number, format: "percent" | "bp" | "float") => {
    switch (format) {
        case "bp":
            return `${(value * 10000).toFixed(1)} bp`;
        case "percent":
            return `${(value * 100).toFixed(2)}%`;
        default:
            return value.toFixed(4);
    }
};

const computeStats = (gridValues: Array<Array<number | null>>) => {
    const values = gridValues.flat().filter((value): value is number => value !== null);
    if (!values.length) return { min: 0, max: 1, maxAbs: 1 };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const maxAbs = Math.max(Math.abs(min), Math.abs(max));
    return { min, max, maxAbs };
};

/**
 * Render a Vol-Momo heatmap using ECharts.
 * @param props - Heatmap configuration and data.
 * @returns Heatmap card element.
 */
export default function VolMomoHeatmapECharts({
    title,
    subtitle,
    xLabels,
    yLabels,
    gridValues,
    countGrid,
    valueFormat,
    onCellClick,
    selectedCell,
    palette,
}: VolMomoHeatmapEChartsProps) {
    const { min, max, maxAbs } = useMemo(() => computeStats(gridValues), [gridValues]);
    const { data, missing } = useMemo(() => {
        const dataPoints: Array<[number, number, number, number]> = [];
        const missingPoints: Array<[number, number, number, number]> = [];
        gridValues.forEach((row, j) => {
            row.forEach((value, i) => {
                const count = countGrid?.[j]?.[i] ?? 0;
                if (value === null || Number.isNaN(value)) {
                    missingPoints.push([i, j, 0, count]);
                } else {
                    dataPoints.push([i, j, value, count]);
                }
            });
        });
        return { data: dataPoints, missing: missingPoints };
    }, [gridValues, countGrid]);

    const selectedOverlay = useMemo(() => {
        if (!selectedCell) return [];
        return [[selectedCell.i, selectedCell.j, 0, 0]] as Array<[number, number, number, number]>;
    }, [selectedCell]);

    const visualMap = palette === "win"
        ? {
              min: 0,
              max: 1,
              inRange: {
                  color: ["#0f172a", "#0ea5e9", "#22c55e"],
              },
          }
        : {
              min: -maxAbs,
              max: maxAbs,
              inRange: {
                  color: ["#ef4444", "#f8fafc", "#22c55e"],
              },
          };

    const option = useMemo(
        () => ({
            backgroundColor: "transparent",
            textStyle: baseTextStyle,
            grid: { ...baseGrid, bottom: 60 },
            xAxis: {
                type: "category",
                data: xLabels,
                ...baseAxis,
                axisLabel: {
                    ...(baseAxis.axisLabel ?? {}),
                    rotate: 0,
                    interval: 0,
                },
            },
            yAxis: {
                type: "category",
                data: yLabels,
                ...baseAxis,
            },
            tooltip: {
                ...baseTooltip,
                formatter: (params: { data: [number, number, number, number] }) => {
                    const [xIndex, yIndex, value, count] = params.data;
                    const xLabel = xLabels[xIndex] ?? "--";
                    const yLabel = yLabels[yIndex] ?? "--";
                    if (gridValues[yIndex]?.[xIndex] == null) {
                        return `${title}<br/>Momentum: ${xLabel}<br/>Volatility: ${yLabel}<br/>Masked`;
                    }
                    return `${title}<br/>Momentum: ${xLabel}<br/>Volatility: ${yLabel}<br/>Value: ${formatValue(
                        value,
                        valueFormat
                    )}<br/>Samples: ${count}`;
                },
            },
            visualMap: {
                show: true,
                type: "continuous",
                calculable: false,
                seriesIndex: 0,
                right: 10,
                top: 40,
                textStyle: { color: "#cbd5f5", fontSize: 10 },
                ...visualMap,
            },
            series: [
                {
                    type: "heatmap",
                    data,
                    label: {
                        show: true,
                        formatter: (params: { value: [number, number, number] }) =>
                            formatValue(params.value[2], valueFormat),
                        color: "#e2e8f0",
                        fontSize: 10,
                    },
                    itemStyle: {
                        borderColor: "rgba(148,163,184,0.2)",
                        borderWidth: 1,
                    },
                    emphasis: {
                        itemStyle: {
                            borderColor: "#f8fafc",
                            borderWidth: 2,
                        },
                    },
                },
                {
                    type: "heatmap",
                    data: missing,
                    silent: true,
                    itemStyle: {
                        color: "rgba(148,163,184,0.15)",
                        borderColor: "rgba(148,163,184,0.2)",
                        borderWidth: 1,
                    },
                    label: { show: false },
                },
                {
                    type: "heatmap",
                    data: selectedOverlay,
                    silent: true,
                    itemStyle: {
                        color: "rgba(0,0,0,0)",
                        borderColor: "#f8fafc",
                        borderWidth: 2,
                    },
                },
            ],
        }),
        [
            baseAxis,
            baseGrid,
            baseTextStyle,
            baseTooltip,
            data,
            gridValues,
            missing,
            palette,
            selectedOverlay,
            title,
            valueFormat,
            visualMap,
            xLabels,
            yLabels,
        ]
    );

    return (
        <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f14] p-4 shadow-2xl shadow-black/40">
            <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/60">{subtitle}</p>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
            </div>
            <div className="h-[320px] w-full">
                <EChart
                    option={option}
                    style={{ width: "100%", height: "100%" }}
                    onEvents={
                        onCellClick
                            ? {
                                  click: (params: { data: [number, number] }) => {
                                      const [xIndex, yIndex] = params.data;
                                      onCellClick(xIndex, yIndex);
                                  },
                              }
                            : undefined
                    }
                />
            </div>
        </div>
    );
}
