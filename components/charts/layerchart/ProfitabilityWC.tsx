"use client";

import ErrorBoundary from "@/components/common/ErrorBoundary";
import { ChartShell } from "./ChartShell";
import { useMemo } from "react";

type ProfitPoint = { date: string; ebitda?: number; netIncome?: number };

interface ProfitabilityWCProps {
  data?: {
    symbol?: string;
    frequency?: "annual" | "quarter";
    currency?: string;
    series?: ProfitPoint[];
  };
  minHeight?: number;
}

export default function ProfitabilityWC({ data, minHeight = 280 }: ProfitabilityWCProps) {
  const payload = useMemo(() => {
    if (!data?.series?.length) return null;
    return JSON.stringify(data);
  }, [data]);

  return (
    <ChartShell title="EBITDA & Net Income" description="Profitability overview" minHeight={minHeight}>
      <ErrorBoundary componentName="ProfitabilityWC">
        {payload ? (
          <zedxe-profitability data={payload} style={{ display: "block", width: "100%", minHeight }} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
            No data available
          </div>
        )}
      </ErrorBoundary>
    </ChartShell>
  );
}
