"use client";

// NOTE: Rewritten in Phase 4 stabilisation to avoid client-side crashes.
// Simplified footprint view (no drag pan/zoom) plus local error boundary.

import React, { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import VolumeProfile, { VolumeProfileLevel } from "@/app/(root)/orderflow/_components/volume-profile";
import { FootprintCandleChart } from "@/app/(root)/orderflow/_components/FootprintCandleChart";
import { buildFootprintBars, FootprintBar, inferPriceStepFromTrades } from "@/app/(root)/orderflow/_utils/footprint";
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
import { NormalizedTrade, useOrderflowStream } from "@/hooks/useOrderflowStream";
import { cn } from "@/lib/utils";

const TIMEFRAME_OPTIONS = ["5s", "15s", "30s", "1m", "5m", "15m"] as const;
const MODE_OPTIONS = ["Bid x Ask", "Delta", "Volume"] as const;
type FootprintMode = (typeof MODE_OPTIONS)[number];

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

const buildVolumeProfileLevels = (
    trades: NormalizedTrade[],
    priceStep: number,
): { levels: VolumeProfileLevel[]; referencePrice: number | null } => {
    if (!trades.length) return { levels: [], referencePrice: null };

    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const referencePrice = sortedTrades[sortedTrades.length - 1]?.price ?? null;
    if (!referencePrice) return { levels: [], referencePrice: null };

    const step = priceStep > 0 ? priceStep : Math.max(referencePrice * 0.0005, 0.01);
    const levelsPerSide = 6;
    const centerIndex = Math.max(Math.round(referencePrice / step), 1);
    const startIndex = Math.max(centerIndex - levelsPerSide, 1);
    const endIndex = centerIndex + levelsPerSide;

    const aggregation = new Map<number, { buyVolume: number; sellVolume: number }>();

    sortedTrades.forEach((trade) => {
        const levelIndex = Math.round(trade.price / step);
        if (levelIndex < startIndex - 1 || levelIndex > endIndex + 1) return;
        const levelPrice = levelIndex * step;
        const existing = aggregation.get(levelPrice) ?? { buyVolume: 0, sellVolume: 0 };
        if (trade.side === "buy") {
            existing.buyVolume += trade.quantity;
        } else {
            existing.sellVolume += trade.quantity;
        }
        aggregation.set(levelPrice, existing);
    });

    const levels: VolumeProfileLevel[] = [];
    for (let index = startIndex; index <= endIndex; index += 1) {
        const price = index * step;
        const volume = aggregation.get(price) ?? { buyVolume: 0, sellVolume: 0 };
        const totalVolume = volume.buyVolume + volume.sellVolume;
        const imbalancePercent = totalVolume > 0 ? (Math.abs(volume.buyVolume - volume.sellVolume) / totalVolume) * 100 : 0;
        const dominantSide = totalVolume === 0 ? null : volume.buyVolume >= volume.sellVolume ? "buy" : "sell";

        levels.push({
            price,
            buyVolume: volume.buyVolume,
            sellVolume: volume.sellVolume,
            totalVolume,
            imbalancePercent,
            dominantSide,
        });
    }

    return { levels, referencePrice };
};

const FootprintPageInner = () => {
    const defaultWindowSeconds = ORDERFLOW_WINDOW_PRESETS[1]?.value ?? ORDERFLOW_WINDOW_PRESETS[0].value;
    const defaultBucketSeconds = ORDERFLOW_BUCKET_PRESETS[1]?.value ?? ORDERFLOW_BUCKET_PRESETS[0].value;

    const [selectedSymbol, setSelectedSymbol] = useState<string>(ORDERFLOW_DEFAULT_SYMBOL);
    const [windowSeconds, setWindowSeconds] = useState<number>(defaultWindowSeconds);
    const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>("15s");
    const [bucketSizeSeconds, setBucketSizeSeconds] = useState<number>(defaultBucketSeconds);
    const [mode, setMode] = useState<FootprintMode>("Bid x Ask");
    const [showNumbers, setShowNumbers] = useState(true);
    const [highlightImbalances, setHighlightImbalances] = useState(true);

    const { windowedTrades } = useOrderflowStream({ symbol: selectedSymbol, windowSeconds });

    const candlestickInterval = useMemo<"1m" | "5m" | "15m">(() => {
        return selectedTimeframe === "5m" || selectedTimeframe === "15m"
            ? selectedTimeframe
            : "1m";
    }, [selectedTimeframe]);

    useEffect(() => {
        setBucketSizeSeconds(parseTimeframeSeconds(selectedTimeframe));
    }, [selectedTimeframe]);

    const priceStep = useMemo(() => {
        if (windowedTrades.length === 0) return 0;
        const inferred = inferPriceStepFromTrades(windowedTrades);
        const referencePrice = windowedTrades[windowedTrades.length - 1]?.price ?? 0;
        const fallback = referencePrice > 0 ? Math.max(referencePrice * 0.0005, 0.01) : 0;
        return inferred > 0 ? inferred : fallback;
    }, [windowedTrades]);

    const footprintBars = useMemo<FootprintBar[]>(() => {
        if (windowedTrades.length === 0) return [];
        const referenceTimestamp = Date.now();
        return buildFootprintBars(windowedTrades, {
            windowSeconds,
            bucketSizeSeconds,
            referenceTimestamp,
            priceStep: priceStep || undefined,
        });
    }, [windowedTrades, windowSeconds, bucketSizeSeconds, priceStep]);

    const { levels: profileLevels, referencePrice } = useMemo(
        () => buildVolumeProfileLevels(windowedTrades, priceStep),
        [windowedTrades, priceStep],
    );

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
                            </div>
                            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                                {footprintBars.length} buckets · {windowSeconds}s window
                            </span>
                        </div>
                        <div className="relative h-[520px] overflow-hidden rounded-lg border border-gray-900 bg-black/20">
                            <FootprintCandleChart symbol={selectedSymbol} interval={candlestickInterval} />
                        </div>
                    </div>
                </div>

                <VolumeProfile levels={profileLevels} priceStep={priceStep} referencePrice={referencePrice} />
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

