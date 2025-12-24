"use client";

import { useMemo } from "react";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { ChartShell } from "./ChartShell";

interface HistogramWCProps {
  data?: Array<{ label: string; value: number }>;
}

export default function HistogramWC({ data }: HistogramWCProps) {
  const safeData = useMemo(() => {
    const cleaned = (data ?? []).filter((item) => typeof item?.value === "number" && typeof item?.label === "string");
    if (!cleaned.length) return null;
    return JSON.stringify(cleaned);
  }, [data]);

  return (
    <ChartShell title="Distribution" description="Histogram of recent moves">
      <ErrorBoundary componentName="HistogramWC">
        {safeData ? (
          <zedxe-histogram data={safeData} style={{ display: "block", width: "100%", minHeight: 280 }} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
            No data available
          </div>
        )}
      </ErrorBoundary>
    </ChartShell>
  );
}
