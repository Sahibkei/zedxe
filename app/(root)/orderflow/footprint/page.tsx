"use client";

// NOTE: Rewritten in Phase 4 stabilisation to avoid client-side crashes.
// Simplified footprint view (no drag pan/zoom) plus local error boundary.

import React, { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { FootprintCandleChart } from "@/app/(root)/orderflow/_components/FootprintCandleChart";
import { FootprintSideLadder } from "@/app/(root)/orderflow/_components/FootprintSideLadder";
import { buildFootprintBars, FootprintBar } from "@/app/(root)/orderflow/_utils/footprint";
import { useFootprintAggTrades } from "@/app/(root)/orderflow/_components/useFootprintAggTrades";
import { FootprintMode } from "@/app/(root)/orderflow/_components/footprint-types";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ORDERFLOW_BUCKET_PRESETS,
    ORDERFLOW_DEFAULT_SYMBOL,
    ORDERFLOW_SYMBOL_OPTIONS,
    ORDERFLOW_WINDOW_PRESETS,
} from "@/lib/constants";
import { useOrderflowStream } from "@/hooks/useOrderflowStream";
import { cn } from "@/lib/utils";

const TIMEFRAME_OPTIONS = ["5s", "15s", "30s", "1m", "5m", "15m"] as const;
const MODE_OPTIONS: FootprintMode[] = ["Bid x Ask", "Delta", "Volume"];

type TimeframeOption = (typeof TIMEFRAME_OPTIONS)[number];

const parseTimeframeSeconds = (value: TimeframeOption): number => {
    const unit = value.slice(-1);
    const numeric = Number(value.slice(0, -1));
    if (!Number.isFinite(numeric)) return 15;
    return unit === "m" ? numeric * 60 : numeric;
};

class FootprintErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("FootprintPage error", error, info);
    }

    render() {
        if (this.state.error) {
            return (
                <div className="flex h-full items-center justify-center text-sm text-red-400">
                    Footprint chart failed to render. Please reload the page or try again later.
                </div>
            );
        }

        return this.props.children;
    }
}

const FootprintPageInner = () => {
    const defaultWindowSeconds = ORDERFLOW_WINDOW_PRESETS[1]?.value ?? ORDERFLOW_WINDOW_PRESETS[0].value;
    const defaultBucketSeconds = ORDERFLOW_BUCKET_PRESETS[1]?.value ?? ORDERFLOW_BUCKET_PRESETS[0].value;
    const footprintWindowMs = 2 * 60 * 60 * 1000;

    const [selectedSymbol, setSelectedSymbol] = useState<string>(ORDERFLOW_DEFAULT_SYMBOL);
    const [windowSeconds, setWindowSeconds] = useState<number>(defaultWindowSeconds);
    const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>("15s");
    const [bucketSizeSeconds, setBucketSizeSeconds] = useState<number>(defaultBucketSeconds);
    const [mode, setMode] = useState<FootprintMode>("Bid x Ask");
    const [showNumbers, setShowNumbers] = useState(true);
    const [highlightImbalances, setHighlightImbalances] = useState(true);
    const [tickSizeOverride, setTickSizeOverride] = useState<number | null>(null);
    const [selectedFootprintTime, setSelectedFootprintTime] = useState<number | null>(null);

    const { windowedTrades } = useOrderflowStream({ symbol: selectedSymbol, windowSeconds });

    const candlestickInterval = useMemo<"1m" | "5m" | "15m">(() => {
        return selectedTimeframe === "5m" || selectedTimeframe === "15m"
            ? selectedTimeframe
            : "1m";
    }, [selectedTimeframe]);

    const { latestSummary: footprintSummary, priceStep: ladderPriceStep, getFootprintForCandle } = useFootprintAggTrades({
        symbol: selectedSymbol,
        interval: candlestickInterval,
        windowMs: footprintWindowMs,
        priceStepOverride: tickSizeOverride,
    });

    const effectiveSelectedTime = selectedFootprintTime ?? footprintSummary?.tSec ?? null;
    const selectedFootprint = effectiveSelectedTime != null ? getFootprintForCandle(effectiveSelectedTime) : null;

    useEffect(() => {
        setBucketSizeSeconds(parseTimeframeSeconds(selectedTimeframe));
    }, [selectedTimeframe]);

    const footprintBars = useMemo<FootprintBar[]>(() => {
        if (windowedTrades.length === 0) return [];
        const referenceTimestamp = Date.now();
        return buildFootprintBars(windowedTrades, {
            windowSeconds,
            bucketSizeSeconds,
            referenceTimestamp,
            priceStep: ladderPriceStep || undefined,
        });
    }, [windowedTrades, windowSeconds, bucketSizeSeconds, ladderPriceStep]);

    const maxVolume = useMemo(
        () => Math.max(...footprintBars.map((bar) => bar.totalVolume), 0),
        [footprintBars],
    );
    const maxDelta = useMemo(
        () => Math.max(...footprintBars.map((bar) => Math.abs(bar.totalDelta)), 0),
        [footprintBars],
    );

    const windowMinutes = Math.max(1, Math.round(windowSeconds / 60));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Orderflow</p>
                    <h1 className="text-2xl font-semibold text-white">Footprint Heatmap</h1>
                    <p className="text-sm text-gray-400">Live trades for {selectedSymbol.toUpperCase()} · Last {windowMinutes}m</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                    <Link href="/orderflow" className="text-emerald-400 hover:text-emerald-300">
                        Back to Orderflow dashboard
                    </Link>
                </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Symbol</p>
                    <Select value={selectedSymbol} onValueChange={(value) => setSelectedSymbol(value)}>
                        <SelectTrigger className="w-full bg-gray-900 text-white">
                            <SelectValue placeholder="Select symbol" />
                        </SelectTrigger>
                        <SelectContent>
                            {ORDERFLOW_SYMBOL_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Window</p>
                    <div className="flex flex-wrap gap-2">
                        {ORDERFLOW_WINDOW_PRESETS.map((preset) => (
                            <Button
                                key={preset.value}
                                size="sm"
                                variant={preset.value === windowSeconds ? "default" : "outline"}
                                className={cn("min-w-[3.5rem]", preset.value === windowSeconds && "bg-emerald-600")}
                                onClick={() => setWindowSeconds(preset.value)}
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Bucket size</p>
                    <div className="flex flex-wrap gap-2">
                        {TIMEFRAME_OPTIONS.map((option) => (
                            <Button
                                key={option}
                                size="sm"
                                variant={option === selectedTimeframe ? "default" : "outline"}
                                className={cn("min-w-[3.5rem]", option === selectedTimeframe && "bg-emerald-600")}
                                onClick={() => setSelectedTimeframe(option)}
                            >
                                {option}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2 lg:col-span-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Mode</p>
                    <div className="flex flex-wrap items-center gap-2">
                        {MODE_OPTIONS.map((option) => (
                            <Button
                                key={option}
                                size="sm"
                                variant={option === mode ? "default" : "outline"}
                                className={cn("min-w-[3.5rem]", option === mode && "bg-emerald-600")}
                                onClick={() => setMode(option)}
                            >
                                {option}
                            </Button>
                        ))}
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={showNumbers}
                                onChange={(event) => setShowNumbers(event.target.checked)}
                                className="h-4 w-4 rounded border-gray-700 bg-gray-900"
                            />
                            Show numbers
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={highlightImbalances}
                                onChange={(event) => setHighlightImbalances(event.target.checked)}
                                className="h-4 w-4 rounded border-gray-700 bg-gray-900"
                            />
                            Highlight imbalances
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                            Tick size (price step per row)
                            <input
                                type="number"
                                step="any"
                                min={0.00000001}
                                value={tickSizeOverride ?? ""}
                                onChange={(event) => {
                                    const value = Number(event.target.value);
                                    if (!event.target.value || Number.isNaN(value) || value <= 0) {
                                        setTickSizeOverride(null);
                                        return;
                                    }
                                    setTickSizeOverride(value);
                                }}
                                className="h-9 w-28 rounded border border-gray-700 bg-gray-900 px-2 text-sm text-gray-100"
                                placeholder="Auto"
                            />
                        </label>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
                        <div className="flex items-center justify-between pb-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500">Footprint Heatmap</p>
                                <h3 className="text-lg font-semibold text-white">
                                    {selectedSymbol.toUpperCase()} · {mode}
                                </h3>
                                <p className="text-xs text-gray-400">
                                    Footprint (live): BUY {footprintSummary?.buyTotal.toFixed(2) ?? "0.00"} / SELL
                                    {" "}
                                    {footprintSummary?.sellTotal.toFixed(2) ?? "0.00"} · levels
                                    {" "}
                                    {footprintSummary?.levelsCount ?? 0}
                                </p>
                            </div>
                            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                                {footprintBars.length} buckets · {windowSeconds}s window
                            </span>
                        </div>
                        <div className="relative h-[520px] overflow-hidden rounded-lg border border-gray-900 bg-black/20">
                            <FootprintCandleChart
                                symbol={selectedSymbol}
                                interval={candlestickInterval}
                                getFootprintForCandle={getFootprintForCandle}
                                footprintUpdateKey={footprintSummary?.updateId}
                                onSelectionChange={(payload) => {
                                    setSelectedFootprintTime((current) =>
                                        current === payload.timeSec ? current : payload.timeSec,
                                    );
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex h-full flex-col rounded-xl border border-gray-800 bg-[#0f1115] shadow-lg shadow-black/20">
                    <FootprintSideLadder
                        footprint={selectedFootprint}
                        selectedTimeSec={effectiveSelectedTime}
                        mode={mode}
                        showNumbers={showNumbers}
                        highlightImbalances={highlightImbalances}
                        imbalanceRatio={1.5}
                        priceStep={ladderPriceStep ?? null}
                        maxHeight={520}
                    />
                </div>
            </div>
        </div>
    );
};

export default function FootprintPage() {
    return (
        <FootprintErrorBoundary>
            <FootprintPageInner />
        </FootprintErrorBoundary>
    );
}

