"use client";

// NOTE: Rewritten in Phase 4 stabilisation to avoid client-side crashes.
// Simplified footprint view (no drag pan/zoom) with scoped render error handling.

import React, { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import type { VolumeProfileLevel } from "@/app/(root)/orderflow/_components/volume-profile";
import { buildFootprintBars, FootprintBar, inferPriceStepFromTrades } from "@/app/(root)/orderflow/_utils/footprint";
import FootprintLightweightChart, { FootprintLightweightChartProps } from "@/components/orderflow/FootprintLightweightChart";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ORDERFLOW_DEFAULT_SYMBOL, ORDERFLOW_SYMBOL_OPTIONS } from "@/lib/constants";
import { fetchHistoricalTrades } from "@/lib/orderflow/fetchHistoricalTrades";
import { combineOrderbookDepth, mapFootprintBarsToCandles, mapVolumeProfileToHistogram } from "@/lib/orderflow/lightweightFeed";
import { useOrderbookStream } from "@/hooks/useOrderbookStream";
import { NormalizedTrade, useOrderflowStream } from "@/hooks/useOrderflowStream";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/formatters";

const MODE_OPTIONS = ["Bid x Ask", "Delta", "Volume"] as const;
type FootprintMode = (typeof MODE_OPTIONS)[number];

type ChartTimeframe = "1m" | "5m" | "15m";

const TIMEFRAME_OPTIONS: ChartTimeframe[] = ["1m", "5m", "15m"];

const TIMEFRAME_SECONDS: Record<ChartTimeframe, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
};

const MAX_CANDLES: Record<ChartTimeframe, number> = {
    "1m": 60,
    "5m": 12,
    "15m": 4,
};

const buildSimpleMovingAverage = (candles: FootprintLightweightChartProps["candles"], length: number) => {
    if (!candles.length || length <= 0) return [] as Array<{ time: number; value: number }>;
    const points: Array<{ time: number; value: number }> = [];

    for (let index = 0; index < candles.length; index += 1) {
        const start = Math.max(0, index - length + 1);
        const window = candles.slice(start, index + 1);
        if (window.length < length) continue;
        const average = window.reduce((sum, candle) => sum + candle.close, 0) / window.length;
        points.push({ time: Math.round(candles[index].time / 1000), value: average });
    }

    return points;
};

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
    // renderError is only set when Lightweight Charts itself fails to initialise; overlays log errors to the console.
    const [renderError, setRenderError] = useState<Error | null>(null);

    const [selectedSymbol, setSelectedSymbol] = useState<string>(ORDERFLOW_DEFAULT_SYMBOL);
    const [timeframe, setTimeframe] = useState<ChartTimeframe>("5m");
    const [mode, setMode] = useState<FootprintMode>("Bid x Ask");
    const [showNumbers, setShowNumbers] = useState(true);
    const [highlightImbalances, setHighlightImbalances] = useState(true);
    const [showMa9, setShowMa9] = useState(true);
    const [showMa21, setShowMa21] = useState(true);
    const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
    const [goLatestSignal, setGoLatestSignal] = useState(0);

    const bucketSizeSeconds = TIMEFRAME_SECONDS[timeframe];
    const targetWindowSeconds = TIMEFRAME_SECONDS[timeframe] * MAX_CANDLES[timeframe];

    const { windowedTrades: liveWindowedTrades } = useOrderflowStream({ symbol: selectedSymbol, windowSeconds: targetWindowSeconds });
    const { bids, asks } = useOrderbookStream(selectedSymbol, 24);
    const [historicalTrades, setHistoricalTrades] = useState<NormalizedTrade[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const handleRenderError = useCallback((error: Error) => {
        console.error("Footprint chart fatal render error", error);
        setRenderError(error);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoadingHistory(true);
        setHistoricalTrades([]);

        fetchHistoricalTrades(selectedSymbol, targetWindowSeconds)
            .then((trades) => {
                if (cancelled) return;
                setHistoricalTrades(trades);
            })
            .catch((error) => {
                if (cancelled) return;
                console.error("[Footprint] Failed to fetch historical trades", error);
            })
            .finally(() => {
                if (cancelled) return;
                setLoadingHistory(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedSymbol, targetWindowSeconds]);

    const combinedTrades = useMemo(() => {
        const cutoff = Date.now() - targetWindowSeconds * 1000;
        const merged = [...historicalTrades, ...liveWindowedTrades];
        const sorted = merged.sort((a, b) => a.timestamp - b.timestamp);
        return sorted.filter((trade) => trade.timestamp >= cutoff);
    }, [historicalTrades, liveWindowedTrades, targetWindowSeconds]);

    const priceStep = useMemo(() => {
        if (combinedTrades.length === 0) return 0;
        const inferred = inferPriceStepFromTrades(combinedTrades);
        const referencePrice = combinedTrades[combinedTrades.length - 1]?.price ?? 0;
        const fallback = referencePrice > 0 ? Math.max(referencePrice * 0.0005, 0.01) : 0;
        return inferred > 0 ? inferred : fallback;
    }, [combinedTrades]);

    const footprintBars = useMemo<FootprintBar[]>(() => {
        if (combinedTrades.length === 0) return [];
        const referenceTimestamp = Date.now();
        return buildFootprintBars(combinedTrades, {
            windowSeconds: targetWindowSeconds,
            bucketSizeSeconds,
            referenceTimestamp,
            priceStep: priceStep || undefined,
        });
    }, [bucketSizeSeconds, combinedTrades, priceStep, targetWindowSeconds]);

    const footprintCandles = useMemo(() => {
        const candles = mapFootprintBarsToCandles(footprintBars);
        return candles.slice(-MAX_CANDLES[timeframe]);
    }, [footprintBars, timeframe]);

    const ma9 = useMemo(
        () => (showMa9 ? buildSimpleMovingAverage(footprintCandles, 9) : []),
        [footprintCandles, showMa9],
    );

    const ma21 = useMemo(
        () => (showMa21 ? buildSimpleMovingAverage(footprintCandles, 21) : []),
        [footprintCandles, showMa21],
    );

    const { levels: profileLevels, referencePrice } = useMemo(
        () => buildVolumeProfileLevels(combinedTrades, priceStep),
        [combinedTrades, priceStep],
    );

    const volumeProfileHistogram = useMemo(() => mapVolumeProfileToHistogram(profileLevels), [profileLevels]);

    const domDepthLevels = useMemo(() => combineOrderbookDepth(bids, asks, 24), [asks, bids]);

    const chartOptions = useMemo<FootprintLightweightChartProps["options"]>(
        () => ({
            mode: mode === "Bid x Ask" ? "bid-ask" : mode === "Delta" ? "delta" : "volume",
            showNumbers,
            highlightImbalances,
            rowSizeTicks: 1,
            candleSize: "normal",
            scale: "linear",
        }),
        [highlightImbalances, mode, showNumbers],
    );

    const windowMinutes = Math.max(1, Math.round(targetWindowSeconds / 60));

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
                    <p className="text-xs uppercase tracking-wide text-gray-500">Chart timeframe</p>
                    <div className="flex flex-wrap gap-2">
                        {TIMEFRAME_OPTIONS.map((option) => (
                            <Button
                                key={option}
                                size="sm"
                                variant={option === timeframe ? "default" : "outline"}
                                className={cn("min-w-[3.5rem]", option === timeframe && "bg-emerald-600")}
                                onClick={() => setTimeframe(option)}
                            >
                                {option}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Lookback</p>
                    <div className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200">
                        ~1 hour (up to {MAX_CANDLES[timeframe]} candles)
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
                            <input
                                type="checkbox"
                                checked={showMa9}
                                onChange={(event) => setShowMa9(event.target.checked)}
                                className="h-4 w-4 rounded border-gray-700 bg-gray-900"
                            />
                            MA 9
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={showMa21}
                                onChange={(event) => setShowMa21(event.target.checked)}
                                className="h-4 w-4 rounded border-gray-700 bg-gray-900"
                            />
                            MA 21
                        </label>
                        <Button
                            size="sm"
                            variant={autoScrollEnabled ? "default" : "outline"}
                            className="ml-auto"
                            onClick={() => setAutoScrollEnabled((prev) => !prev)}
                        >
                            {autoScrollEnabled ? "Auto-scroll: On" : "Auto-scroll: Off"}
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                                setGoLatestSignal((value) => value + 1);
                                setAutoScrollEnabled(true);
                            }}
                        >
                            Go to latest
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-3">
                    <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
                        <div className="flex items-center justify-between pb-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500">Footprint Heatmap</p>
                                <h3 className="text-lg font-semibold text-white">
                                    {selectedSymbol.toUpperCase()} · {mode}
                                </h3>
                            </div>
                            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                                {footprintCandles.length} candles · ~{windowMinutes}m lookback
                            </span>
                        </div>
                        <div className="relative h-[520px] overflow-hidden rounded-lg border border-gray-900 bg-black/20">
                            <FootprintLightweightChart
                                candles={footprintCandles}
                                volumeProfile={volumeProfileHistogram}
                                domDepth={domDepthLevels}
                                ma9={ma9}
                                ma21={ma21}
                                timeframe={timeframe}
                                options={chartOptions}
                                autoScrollEnabled={autoScrollEnabled}
                                goToLatestSignal={goLatestSignal}
                                onRenderError={handleRenderError}
                                onAutoScrollChange={setAutoScrollEnabled}
                            />
                        </div>
                        {renderError ? (
                            <p className="mt-2 text-xs text-red-400">
                                Footprint chart failed to render fully; check console for details. The chart will attempt to continue showing
                                available data.
                            </p>
                        ) : null}
                        {loadingHistory ? (
                            <p className="mt-2 text-xs text-gray-500">Loading last {windowMinutes} minutes of trades…</p>
                        ) : null}
                        {referencePrice ? (
                            <p className="mt-2 text-xs text-gray-500">
                                Volume profile anchored near {formatNumber(referencePrice)} (step {formatNumber(priceStep)})
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function FootprintPage() {
    return <FootprintPageInner />;
}

