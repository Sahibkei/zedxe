"use client";

import ErrorBoundary from "@/components/common/ErrorBoundary";
import { ChartShell } from "./ChartShell";
import { useMemo } from "react";

type RevenuePoint = { date: string; revenue: number };

interface RevenueGrowthWCProps {
  data?: {
    symbol?: string;
    frequency?: "annual" | "quarter";
    currency?: string;
    view?: "values" | "yoy";
    series?: RevenuePoint[];
  };
  minHeight?: number;
}

export default function RevenueGrowthWC({ data, minHeight = 340 }: RevenueGrowthWCProps) {
  const payload = useMemo(() => {
    if (!data?.series?.length) return null;
    return JSON.stringify(data);
  }, [data]);

  return (
    <ChartShell title="Revenue Growth" description="Revenue trend with YoY change" minHeight={minHeight}>
      <ErrorBoundary componentName="RevenueGrowthWC">
        {payload ? (
          <zedxe-revenue-growth data={payload} style={{ display: "block", width: "100%", minHeight }} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
            No data available
          </div>
        )}
      </ErrorBoundary>
    </ChartShell>
  );
}
