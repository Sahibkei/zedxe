"use client";

import { useMemo, useState } from "react";
import RevenueGrowthChart from "@/components/charts/echarts/RevenueGrowthChart";
import ProfitabilityChart from "@/components/charts/echarts/ProfitabilityChart";

type Frequency = "annual" | "quarter";
type RevenueView = "values" | "yoy";

const annualRevenueSeries = [
  { date: "2019-09-28", revenue: 260_174_000_000 },
  { date: "2020-09-26", revenue: 274_515_000_000 },
  { date: "2021-09-25", revenue: 365_817_000_000 },
  { date: "2022-09-24", revenue: 394_328_000_000 },
  { date: "2023-09-30", revenue: 383_285_000_000 },
];

const quarterlyRevenueSeries = [
  { date: "2023-12-30", revenue: 119_575_000_000 },
  { date: "2024-03-30", revenue: 90_753_000_000 },
  { date: "2024-06-29", revenue: 82_959_000_000 },
  { date: "2024-09-28", revenue: 83_100_000_000 },
];

const annualProfitSeries = [
  { date: "2019-09-28", ebitda: 76_477_000_000, netIncome: 55_256_000_000 },
  { date: "2020-09-26", ebitda: 77_344_000_000, netIncome: 57_411_000_000 },
  { date: "2021-09-25", ebitda: 120_233_000_000, netIncome: 94_680_000_000 },
  { date: "2022-09-24", ebitda: 130_541_000_000, netIncome: 99_633_000_000 },
  { date: "2023-09-30", ebitda: 125_820_000_000, netIncome: 97_000_000_000 },
];

const quarterlyProfitSeries = [
  { date: "2023-12-30", ebitda: 38_000_000_000, netIncome: 33_000_000_000 },
  { date: "2024-03-30", ebitda: 28_500_000_000, netIncome: 24_100_000_000 },
  { date: "2024-06-29", ebitda: 27_900_000_000, netIncome: 23_500_000_000 },
  { date: "2024-09-28", ebitda: 28_400_000_000, netIncome: 22_800_000_000 },
];

interface RevenueChartsProps {
  symbol: string;
}

export default function RevenueCharts({ symbol }: RevenueChartsProps) {
  const [frequency, setFrequency] = useState<Frequency>("annual");
  const [view, setView] = useState<RevenueView>("values");

  const revenueSeries = useMemo(
    () => (frequency === "annual" ? annualRevenueSeries : quarterlyRevenueSeries),
    [frequency]
  );
  const profitSeries = useMemo(
    () => (frequency === "annual" ? annualProfitSeries : quarterlyProfitSeries),
    [frequency]
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4 rounded-2xl border border-border/60 bg-card/80 p-5 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue Growth</p>
            <h3 className="text-lg font-semibold text-foreground">{symbol} Revenue Trend</h3>
          </div>
          <div className="flex items-center gap-2">
            <ToggleButton active={frequency === "annual"} onClick={() => setFrequency("annual")} label="FY" />
            <ToggleButton active={frequency === "quarter"} onClick={() => setFrequency("quarter")} label="QTR" />
            <div className="w-px h-6 bg-border/60" />
            <ToggleButton active={view === "values"} onClick={() => setView("values")} label="Values" />
            <ToggleButton active={view === "yoy"} onClick={() => setView("yoy")} label="YoY %" />
          </div>
        </div>
        <RevenueGrowthChart series={revenueSeries} currency="USD" view={view} height={360} />
      </div>

      <div className="space-y-3 rounded-2xl border border-border/60 bg-card/80 p-5 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Profitability</p>
            <h3 className="text-lg font-semibold text-foreground">EBITDA & Net Income</h3>
          </div>
          <div className="flex items-center gap-2">
            <ToggleButton active={frequency === "annual"} onClick={() => setFrequency("annual")} label="FY" />
            <ToggleButton active={frequency === "quarter"} onClick={() => setFrequency("quarter")} label="QTR" />
          </div>
        </div>
        <ProfitabilityChart series={profitSeries} currency="USD" height={280} />
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-1 text-xs font-semibold ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
