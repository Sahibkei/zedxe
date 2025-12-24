"use client";

import ReactECharts from "echarts-for-react";
import { Loader2 } from "lucide-react";

interface EChartsBaseProps {
  option: any;
  styleHeight?: number;
  loading?: boolean;
  error?: string | null;
}

export default function EChartsBase({ option, styleHeight = 320, loading, error }: EChartsBaseProps) {
  if (loading) {
    return (
      <div className="relative h-full min-h-[200px] w-full rounded-2xl border border-border/60 bg-card/70 p-4">
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[200px] flex-col justify-center gap-2 rounded-2xl border border-dashed border-red-500/40 bg-red-500/5 p-4 text-sm text-red-200">
        <p className="font-semibold text-red-300">Chart unavailable</p>
        <p className="text-xs text-red-200/80">{error}</p>
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: styleHeight, width: "100%" }}
      notMerge
      lazyUpdate
      theme="dark"
    />
  );
}
