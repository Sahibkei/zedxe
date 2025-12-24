"use client";

import { useMemo } from "react";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { ChartShell } from "./ChartShell";

interface GeoMapWCProps {
  data?: Array<{ region: string; value: number }>;
}

export default function GeoMapWC({ data }: GeoMapWCProps) {
  const safeData = useMemo(() => {
    const cleaned = (data ?? []).filter((item) => typeof item?.value === "number" && typeof item?.region === "string");
    if (!cleaned.length) return null;
    return JSON.stringify(cleaned);
  }, [data]);

  return (
    <ChartShell title="Revenue by Geography" description="Simplified regional mix">
      <ErrorBoundary componentName="GeoMapWC">
        {safeData ? (
          <zedxe-geo-map data={safeData} style={{ display: "block", width: "100%", minHeight: 280 }} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
            No data available
          </div>
        )}
      </ErrorBoundary>
    </ChartShell>
  );
}
