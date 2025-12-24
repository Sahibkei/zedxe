"use client";

import EChartsBase from "./EChartsBase";

type RevenuePoint = { date: string; revenue: number };

export interface RevenueGrowthChartProps {
  series?: RevenuePoint[];
  currency?: string;
  view?: "values" | "yoy";
  height?: number;
}

function formatNumber(value: number, currency?: string) {
  if (Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const formatted =
    abs >= 1_000_000_000 ? `${(value / 1_000_000_000).toFixed(1)}B` :
    abs >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` :
    abs >= 1_000 ? `${(value / 1_000).toFixed(1)}K` :
    value.toLocaleString();
  return currency ? `${currency} ${formatted}` : formatted;
}

function toYoY(series: RevenuePoint[]) {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((point, idx) => {
    if (idx === 0) return { ...point, change: 0 };
    const prev = sorted[idx - 1];
    const change = prev.revenue ? ((point.revenue - prev.revenue) / prev.revenue) * 100 : 0;
    return { ...point, change };
  });
}

export default function RevenueGrowthChart({ series = [], currency = "USD", view = "values", height = 360 }: RevenueGrowthChartProps) {
  if (!series.length) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const categories = sorted.map((p) => p.date);
  const yoy = toYoY(sorted);

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any) => {
        const item = params[0];
        if (!item) return "";
        const date = item.axisValueLabel;
        if (view === "yoy") {
          const point = yoy[item.dataIndex];
          return `<div>${date}</div><div style="margin-top:4px;font-weight:600;">${(point?.change ?? 0).toFixed(2)}% YoY</div>`;
        }
        const point = sorted[item.dataIndex];
        return `<div>${date}</div><div style="margin-top:4px;font-weight:600;">${formatNumber(point?.revenue ?? 0, currency)}</div>`;
      }
    },
    legend: { show: true },
    grid: { left: "3%", right: "3%", bottom: "14%", containLabel: true },
    dataZoom: [
      { type: "inside", throttle: 50 },
      { type: "slider", height: 18, bottom: 0 }
    ],
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: "#9CA3AF", rotate: 0 }
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#9CA3AF",
        formatter: (val: number) => (view === "yoy" ? `${val}%` : formatNumber(val))
      },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      min: view === "yoy" ? (Math.min(...yoy.map((p) => p.change)) < 0 ? Math.min(...yoy.map((p) => p.change)) : 0) : undefined
    },
    series:
      view === "yoy"
        ? [
            {
              name: "YoY %",
              type: "line",
              smooth: true,
              data: yoy.map((p) => Number.isFinite(p.change) ? Number(p.change.toFixed(2)) : 0),
              lineStyle: { width: 2 },
              areaStyle: { opacity: 0.1 },
            },
          ]
        : [
            {
              name: "Revenue",
              type: "bar",
              barWidth: "60%",
              data: sorted.map((p) => p.revenue),
              itemStyle: {
                color: {
                  type: "linear",
                  x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: "rgba(56,189,248,0.8)" },
                    { offset: 1, color: "rgba(56,189,248,0.3)" }
                  ]
                }
              }
            },
          ],
  };

  return <EChartsBase option={option} styleHeight={height} />;
}
