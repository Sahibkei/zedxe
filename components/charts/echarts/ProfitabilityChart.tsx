"use client";

import EChartsBase from "./EChartsBase";

type ProfitPoint = { date: string; ebitda: number; netIncome: number };

export interface ProfitabilityChartProps {
  series?: ProfitPoint[];
  currency?: string;
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

export default function ProfitabilityChart({ series = [], currency = "USD", height = 280 }: ProfitabilityChartProps) {
  if (!series.length) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const categories = sorted.map((p) => p.date);

  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any[]) => {
        const lines = params.map((p) => `<div><span style="display:inline-block;margin-right:6px;border-radius:4px;width:8px;height:8px;background:${p.color}"></span>${p.seriesName}: ${formatNumber(p.data, currency)}</div>`).join("");
        return `<div>${params[0]?.axisValueLabel ?? ""}</div>${lines}`;
      }
    },
    legend: { textStyle: { color: "#E5E7EB" } },
    grid: { left: "3%", right: "3%", bottom: "10%", containLabel: true },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: "#9CA3AF", rotate: 0 }
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#9CA3AF", formatter: (val: number) => formatNumber(val) },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } }
    },
    series: [
      {
        name: "EBITDA",
        type: "bar",
        barGap: "20%",
        data: sorted.map((p) => p.ebitda),
        itemStyle: { color: "#38bdf8" }
      },
      {
        name: "Net Income",
        type: "bar",
        barGap: "20%",
        data: sorted.map((p) => p.netIncome),
        itemStyle: { color: "#10b981" }
      }
    ]
  };

  return <EChartsBase option={option} styleHeight={height} />;
}
