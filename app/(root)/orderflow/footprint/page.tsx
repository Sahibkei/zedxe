"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import OrderflowChart from "@/app/(root)/orderflow/_components/orderflow-chart";
import VolumeProfile, { VolumeProfileLevel } from "@/app/(root)/orderflow/_components/volume-profile";
import { bucketTrades } from "@/app/(root)/orderflow/_utils/bucketing";
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
import { usePersistOrderflowTrades } from "@/hooks/usePersistOrderflowTrades";
import { cn } from "@/lib/utils";

type FootprintMode = "Bid x Ask" | "Delta" | "Volume";

interface FootprintCandle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

const TIMEFRAME_OPTIONS = ["5s", "15s", "30s", "1m", "5m", "15m"] as const;
const MODE_OPTIONS: FootprintMode[] = ["Bid x Ask", "Delta", "Volume"];
const DEFAULT_TIMEFRAME: (typeof TIMEFRAME_OPTIONS)[number] = "15s";

const buildCandles = (
    trades: NormalizedTrade[],
    windowSeconds: number,
    bucketSizeSeconds: number,
    referenceTimestamp: number,
): FootprintCandle[] => {
    const windowStart = referenceTimestamp - windowSeconds * 1000;
    const bucketSizeMs = bucketSizeSeconds * 1000;
    const bucketCount = Math.ceil(windowSeconds / bucketSizeSeconds);
    const buckets: { timestamp: number; prices: number[] }[] = Array.from({ length: bucketCount }).map((_, index) => ({
        timestamp: windowStart + index * bucketSizeMs,
        prices: [],
    }));

    trades.forEach((trade) => {
        if (trade.timestamp < windowStart) return;
        const bucketIndex = Math.floor((trade.timestamp - windowStart) / bucketSizeMs);
        if (bucketIndex < 0 || bucketIndex >= buckets.length) return;
        buckets[bucketIndex]?.prices.push(trade.price);
    });

    let lastClose: number | null = null;

    return buckets
        .map((bucket) => {
            if (bucket.prices.length === 0) {
                if (lastClose === null) return null;
                return {
                    timestamp: bucket.timestamp,
                    open: lastClose,
                    high: lastClose,
                    low: lastClose,
                    close: lastClose,
                } satisfies FootprintCandle;
            }

            const open = bucket.prices[0];
            const close = bucket.prices[bucket.prices.length - 1];
            const high = Math.max(...bucket.prices);
            const low = Math.min(...bucket.prices);

            lastClose = close;

            return {
                timestamp: bucket.timestamp,
                open,
                high,
                low,
                close,
            } satisfies FootprintCandle;
        })
        .filter(Boolean) as FootprintCandle[];
};

const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const FootprintPage = () => {
    const defaultWindowSeconds = ORDERFLOW_WINDOW_PRESETS[1]?.value ?? ORDERFLOW_WINDOW_PRESETS[0].value;
    const defaultBucketSize = ORDERFLOW_BUCKET_PRESETS[1]?.value ?? ORDERFLOW_BUCKET_PRESETS[0].value;

    const [selectedSymbol, setSelectedSymbol] = useState<string>(ORDERFLOW_DEFAULT_SYMBOL);
    const [selectedTimeframe, setSelectedTimeframe] = useState<(typeof TIMEFRAME_OPTIONS)[number]>(DEFAULT_TIMEFRAME);
    const [windowSeconds, setWindowSeconds] = useState<number>(defaultWindowSeconds);
    const [bucketSizeSeconds, setBucketSizeSeconds] = useState<number>(defaultBucketSize);
    const [mode, setMode] = useState<FootprintMode>("Bid x Ask");
    const [showNumbers, setShowNumbers] = useState(true);
    const [highlightImbalances, setHighlightImbalances] = useState(true);
    const [historyTrades, setHistoryTrades] = useState<NormalizedTrade[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const { trades: liveTrades, windowedTrades: liveWindowedTrades } = useOrderflowStream({
        symbol: selectedSymbol,
        windowSeconds,
    });

    usePersistOrderflowTrades(selectedSymbol, liveTrades, true);

    useEffect(() => {
        let isCancelled = false;

        const fetchHistory = async () => {
            setLoadingHistory(true);
            try {
                const params = new URLSearchParams({
                    symbol: selectedSymbol,
                    windowSeconds: String(windowSeconds),
                    maxPoints: "5000",
                });

                const response = await fetch(`/api/orderflow/history?${params.toString()}`);
                if (!response.ok) {
                    throw new Error(`Failed to load history (${response.status})`);
                }

                const data = await response.json();
                if (isCancelled) return;

                const fetchedTrades: NormalizedTrade[] = Array.isArray(data?.trades)
                    ? data.trades
                          .map((trade: NormalizedTrade) => ({
                              timestamp: Number(trade.timestamp),
                              price: Number(trade.price),
                              quantity: Number(trade.quantity),
                              side: trade.side === "sell" ? "sell" : "buy",
                          }))
                          .filter(
                              (trade) =>
                                  Number.isFinite(trade.timestamp) &&
                                  Number.isFinite(trade.price) &&
                                  Number.isFinite(trade.quantity),
                          )
                    : [];

                setHistoryTrades(fetchedTrades);
            } catch (fetchError) {
                console.error("Failed to fetch orderflow history", fetchError);
                if (!isCancelled) {
                    setHistoryTrades([]);
                }
            } finally {
                if (!isCancelled) {
                    setLoadingHistory(false);
                }
            }
        };

        fetchHistory();

        return () => {
            isCancelled = true;
        };
    }, [selectedSymbol, windowSeconds]);

    const combinedTrades = useMemo(() => {
        const allTrades = [...historyTrades, ...liveWindowedTrades];
        const uniqueTrades = new Map<string, NormalizedTrade>();

        allTrades.forEach((trade) => {
            const key = `${trade.timestamp}-${trade.side}-${trade.price}-${trade.quantity}`;
            uniqueTrades.set(key, trade);
        });

        return Array.from(uniqueTrades.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [historyTrades, liveWindowedTrades]);

    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const effectiveTrades = useMemo(
        () => combinedTrades.filter((trade) => trade.timestamp >= windowStart),
        [combinedTrades, windowStart],
    );

    const candles = useMemo(
        () => buildCandles(effectiveTrades, windowSeconds, bucketSizeSeconds, now),
        [effectiveTrades, windowSeconds, bucketSizeSeconds, now],
    );

    const effectiveBuckets = useMemo(
        () => bucketTrades(effectiveTrades, windowSeconds, bucketSizeSeconds, now),
        [effectiveTrades, windowSeconds, bucketSizeSeconds, now],
    );

    const priceStep = useMemo(() => {
        if (effectiveTrades.length === 0) return 0;

        const sortedPrices = [...effectiveTrades].map((trade) => trade.price).sort((a, b) => a - b);
        const deltas: number[] = [];

        for (let index = 1; index < sortedPrices.length; index += 1) {
            const diff = sortedPrices[index] - sortedPrices[index - 1];
            if (diff > 0) {
                deltas.push(diff);
            }
        }

        const medianDelta = (() => {
            if (!deltas.length) return 0;
            const sorted = deltas.sort((a, b) => a - b);
            const middle = Math.floor(sorted.length / 2);
            if (sorted.length % 2 === 0) {
                return (sorted[middle - 1] + sorted[middle]) / 2;
            }
            return sorted[middle];
        })();

        const referencePrice = effectiveTrades[effectiveTrades.length - 1]?.price ?? 0;
        const fallbackStep = Math.max(referencePrice * 0.0005, 0.01);

        return Math.max(medianDelta, fallbackStep);
    }, [effectiveTrades]);

    const volumeProfile = useMemo(() => {
        if (effectiveTrades.length === 0) {
            return { levels: [] as VolumeProfileLevel[], priceStep: 0, referencePrice: null };
        }

        const sortedTrades = [...effectiveTrades].sort((a, b) => a.timestamp - b.timestamp);
        const referencePrice = sortedTrades[sortedTrades.length - 1]?.price ?? null;
        if (!referencePrice) {
            return { levels: [] as VolumeProfileLevel[], priceStep: 0, referencePrice: null };
        }

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
            const imbalancePercent =
                totalVolume > 0 ? (Math.abs(volume.buyVolume - volume.sellVolume) / totalVolume) * 100 : 0;
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

        return { levels, priceStep: step, referencePrice };
    }, [effectiveTrades, priceStep]);

    const hasData = effectiveTrades.length > 0 || effectiveBuckets.some((bucket) => bucket.totalVolume > 0);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const resize = () => {
            const parent = canvas.parentElement;
            const width = parent?.clientWidth ?? 800;
            const height = parent?.clientHeight ?? 520;
            const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            context.resetTransform();
            context.scale(dpr, dpr);

            context.fillStyle = "#0b0d12";
            context.fillRect(0, 0, width, height);

            if (!candles.length) {
                context.fillStyle = "#9ca3af";
                context.font = "14px Inter, system-ui, -apple-system, sans-serif";
                context.fillText("Waiting for footprint data…", 16, height / 2);
                return;
            }

            const paddingX = 20;
            const paddingY = 20;
            const chartWidth = width - paddingX * 2;
            const chartHeight = height - paddingY * 2;

            const minPrice = Math.min(...candles.map((candle) => candle.low));
            const maxPrice = Math.max(...candles.map((candle) => candle.high));
            const priceRange = Math.max(maxPrice - minPrice, 1);

            const candleSpacing = chartWidth / Math.max(candles.length, 1);
            const bodyWidth = Math.max(candleSpacing * 0.6, 4);

            const yForPrice = (price: number) =>
                paddingY + (1 - (price - minPrice) / priceRange) * chartHeight;

            context.strokeStyle = "#1f2937";
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(paddingX, paddingY);
            context.lineTo(paddingX, paddingY + chartHeight);
            context.lineTo(paddingX + chartWidth, paddingY + chartHeight);
            context.stroke();

            candles.forEach((candle, index) => {
                const x = paddingX + index * candleSpacing + candleSpacing / 2;
                const openY = yForPrice(candle.open);
                const closeY = yForPrice(candle.close);
                const highY = yForPrice(candle.high);
                const lowY = yForPrice(candle.low);

                const bullish = candle.close > candle.open;
                const bearish = candle.close < candle.open;
                const color = bullish ? "#34d399" : bearish ? "#f87171" : "#9ca3af";

                context.strokeStyle = color;
                context.beginPath();
                context.moveTo(x, highY);
                context.lineTo(x, lowY);
                context.stroke();

                const bodyX = x - bodyWidth / 2;
                const bodyY = Math.min(openY, closeY);
                const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

                context.fillStyle = color;
                context.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
            });

            context.fillStyle = "#6b7280";
            context.font = "11px Inter, system-ui, -apple-system, sans-serif";
            const lastCandles = candles.slice(-5);
            lastCandles.forEach((candle, index) => {
                const label = formatTime(candle.timestamp);
                const labelX = paddingX + (candles.length - lastCandles.length + index) * candleSpacing;
                context.fillText(label, labelX, height - 6);
            });
        };

        resize();

        window.addEventListener("resize", resize);
        return () => {
            window.removeEventListener("resize", resize);
        };
    }, [candles]);

    return (
        <section className="space-y-6 px-4 py-6 md:px-6 min-w-0">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-400">Orderflow</p>
                    <h1 className="text-3xl font-bold text-white">Footprint – {selectedSymbol.toUpperCase()}</h1>
                    <p className="text-gray-400">Full candlestick + footprint view using live orderflow.</p>
                </div>
                <Link href="/orderflow" className="self-start md:self-auto">
                    <Button variant="ghost" className="text-sm text-emerald-200 hover:text-emerald-100">
                        ← Back to Orderflow
                    </Button>
                </Link>
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Symbol</span>
                        <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                            <SelectTrigger size="sm" className="min-w-[140px] text-white">
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

                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Window</span>
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

                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Bucket</span>
                        <div className="flex flex-wrap gap-2">
                            {ORDERFLOW_BUCKET_PRESETS.map((preset) => (
                                <Button
                                    key={preset.value}
                                    size="sm"
                                    variant={preset.value === bucketSizeSeconds ? "default" : "outline"}
                                    className={cn("min-w-[3.5rem]", preset.value === bucketSizeSeconds && "bg-emerald-600")}
                                    onClick={() => setBucketSizeSeconds(preset.value)}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Timeframe</span>
                        <div className="flex flex-wrap gap-2">
                            {TIMEFRAME_OPTIONS.map((option) => (
                                <Button
                                    key={option}
                                    size="sm"
                                    variant={option === selectedTimeframe ? "default" : "outline"}
                                    className={cn("min-w-[3rem]", option === selectedTimeframe && "bg-emerald-600")}
                                    onClick={() => setSelectedTimeframe(option)}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Mode</span>
                        <div className="flex flex-wrap gap-2">
                            {MODE_OPTIONS.map((option) => (
                                <Button
                                    key={option}
                                    size="sm"
                                    variant={option === mode ? "default" : "outline"}
                                    className={cn("min-w-[4.5rem]", option === mode && "bg-emerald-600")}
                                    onClick={() => setMode(option)}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                            type="checkbox"
                            checked={showNumbers}
                            onChange={(event) => setShowNumbers(event.target.checked)}
                            className="h-4 w-4 rounded border-gray-700 bg-[#0f1115] text-emerald-500 focus:ring-emerald-500"
                        />
                        Show numbers
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                            type="checkbox"
                            checked={highlightImbalances}
                            onChange={(event) => setHighlightImbalances(event.target.checked)}
                            className="h-4 w-4 rounded border-gray-700 bg-[#0f1115] text-emerald-500 focus:ring-emerald-500"
                        />
                        Highlight imbalances
                    </label>

                    {loadingHistory && (
                        <span className="rounded-full bg-gray-900 px-3 py-1 text-xs text-gray-300">Syncing history…</span>
                    )}
                </div>
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[3fr_1fr] min-w-0">
                <div className="space-y-4 min-w-0">
                    <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
                        <div className="flex items-center justify-between pb-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500">Footprint</p>
                                <h3 className="text-lg font-semibold text-white">Footprint Chart (canvas placeholder)</h3>
                                <p className="text-xs text-gray-400">
                                    Rendering basic candles now. Footprint clusters and imbalances will attach here later.
                                </p>
                            </div>
                            <span className="rounded-full bg-gray-900 px-3 py-1 text-xs text-gray-300">
                                {effectiveBuckets.length} buckets
                            </span>
                        </div>
                        <div className="h-[520px] w-full rounded-lg border border-gray-900/80 bg-[#0b0d12]">
                            <canvas ref={canvasRef} className="h-full w-full" />
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 text-sm text-gray-400 shadow-lg shadow-black/20">
                        <p>
                            Timeframe {selectedTimeframe} • Bucket size {bucketSizeSeconds}s • Showing numbers:{" "}
                            <span className="font-semibold text-white">{showNumbers ? "On" : "Off"}</span> • Highlight
                            imbalances: <span className="font-semibold text-white">{highlightImbalances ? "On" : "Off"}</span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                            Current mode: <span className="text-emerald-200">{mode}</span>. Control wiring is ready for the
                            full ATAS-style footprint renderer in the next phase.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <VolumeProfile
                        levels={volumeProfile.levels}
                        priceStep={volumeProfile.priceStep}
                        referencePrice={volumeProfile.referencePrice}
                    />
                    <div className="rounded-xl border border-dashed border-gray-800 bg-[#0f1115] p-4 text-sm text-gray-400 shadow-lg shadow-black/20">
                        <p className="text-white font-semibold">Mini Volume Profile (coming from Phase 4 component)</p>
                        <p className="mt-1">Side panel reserved for mini-profile reuse and per-price metrics.</p>
                        <p className="mt-2 text-xs text-gray-500">
                            This column mirrors the existing mini volume profile placement and will share data sources in
                            the next phase.
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between pb-3">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Volume Over Time</p>
                        <h3 className="text-lg font-semibold text-white">Volume over time (Buy vs Sell stacked)</h3>
                    </div>
                    {!hasData && <span className="text-xs text-gray-400">Waiting for trades…</span>}
                </div>
                {hasData ? (
                    <OrderflowChart buckets={effectiveBuckets} />
                ) : (
                    <div className="rounded-lg border border-dashed border-gray-800 bg-[#0b0d12] p-6 text-center text-sm text-gray-400">
                        Stacked Buy vs Sell volume chart – coming in a later phase.
                    </div>
                )}
            </div>
        </section>
    );
};

export default FootprintPage;

