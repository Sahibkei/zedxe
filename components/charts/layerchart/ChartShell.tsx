"use client";

import { Loader2 } from "lucide-react";
import { useLayerChartLoader } from "./LayerChartLoader";

interface ChartShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  minHeight?: number;
}

export function ChartShell({ title, description, children, minHeight = 280 }: ChartShellProps) {
  const { ready, error, retry } = useLayerChartLoader();

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-lg backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {!ready && !error && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      <div style={{ minHeight }} className="relative">
        {error ? (
          <div className="flex h-full flex-col items-start justify-center gap-3 rounded-xl border border-dashed border-red-500/40 bg-red-500/5 p-4 text-sm text-red-300">
            <p className="font-semibold">Unable to load charts</p>
            <p className="text-xs text-red-200/80">{error}</p>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow"
              onClick={retry}
            >
              Retry
            </button>
          </div>
        ) : !ready ? (
          <div className="h-full animate-pulse rounded-xl bg-muted/30" aria-hidden />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
