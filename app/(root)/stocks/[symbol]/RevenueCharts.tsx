"use client";

import { useMemo, useState } from "react";
import RevenueGrowthWC from "@/components/charts/layerchart/RevenueGrowthWC";
import ProfitabilityWC from "@/components/charts/layerchart/ProfitabilityWC";

type Frequency = "annual" | "quarter";
type RevenueView = "values" | "yoy";

const annualRevenue = [
  { date: "2019-09-28", revenue: 260_174_000_000 },
  { date: "2020-09-26", revenue: 274_515_000_000 },
  { date: "2021-09-25", revenue: 365_817_000_000 },
  { date: "2022-09-24", revenue: 394_328_000_000 },
  { date: "2023-09-30", revenue: 383_285_000_000 },
];

const quarterRevenue = [
  { date: "2023-12-30", revenue: 119_575_000_000 },
  { date: "2024-03-30", revenue: 90_753_000_000 },
  { date: "2024-06-29", revenue: 82_959_000_000 },
  { date: "2024-09-28", revenue: 83_100_000_000 },
];

const annualProfit = [
  { date: "2019-09-28", ebitda: 76_477_000_000, netIncome: 55_256_000_000 },
  { date: "2020-09-26", ebitda: 77_344_000_000, netIncome: 57_411_000_000 },
  { date: "2021-09-25", ebitda: 120_233_000_000, netIncome: 94_680_000_000 },
  { date: "2022-09-24", ebitda: 130_541_000_000, netIncome: 99_633_000_000 },
  { date: "2023-09-30", ebitda: 125_820_000_000, netIncome: 97_000_000_000 },
];

const quarterProfit = [
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

  const revenuePayload = useMemo(
    () => ({
      symbol,
      frequency,
      currency: "USD",
      view,
      series: (frequency === "annual" ? annualRevenue : quarterRevenue) as typeof annualRevenue,
    }),
    [frequency, symbol, view]
  );

  const profitPayload = useMemo(
    () => ({
      symbol,
      frequency,
      currency: "USD",
      series: (frequency === "annual" ? annualProfit : quarterProfit) as typeof annualProfit,
    }),
    [frequency, symbol]
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-xs font-semibold ${frequency === "annual" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              onClick={() => setFrequency("annual")}
            >
              FY
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-xs font-semibold ${frequency === "quarter" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              onClick={() => setFrequency("quarter")}
            >
              QTR
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-xs font-semibold ${view === "values" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              onClick={() => setView("values")}
            >
              Values
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-xs font-semibold ${view === "yoy" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              onClick={() => setView("yoy")}
            >
              YoY %
            </button>
          </div>
        </div>
        <RevenueGrowthWC data={revenuePayload} minHeight={360} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-md px-3 py-1 text-xs font-semibold ${frequency === "annual" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            onClick={() => setFrequency("annual")}
          >
            FY
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1 text-xs font-semibold ${frequency === "quarter" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            onClick={() => setFrequency("quarter")}
          >
            QTR
          </button>
        </div>
        <ProfitabilityWC data={profitPayload} minHeight={280} />
      </div>
    </div>
  );
}
