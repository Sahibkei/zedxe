"use client";

import { useMemo } from "react";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { ChartShell } from "./ChartShell";

interface SankeyWCProps {
  data?: Array<{ source: string; target: string; value: number }>;
}

export default function SankeyWC({ data }: SankeyWCProps) {
  const safeData = useMemo(() => {
    const cleaned = (data ?? []).filter(
      (item) => typeof item?.value === "number" && typeof item?.source === "string" && typeof item?.target === "string"
    );
    if (!cleaned.length) return null;
    return JSON.stringify(cleaned);
  }, [data]);

  return (
    <ChartShell title="Revenue Flow" description="High-level segment flows">
      <ErrorBoundary componentName="SankeyWC">
        {safeData ? (
          <zedxe-sankey data={safeData} style={{ display: "block", width: "100%", minHeight: 280 }} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
            No data available
          </div>
        )}
      </ErrorBoundary>
    </ChartShell>
  );
}
