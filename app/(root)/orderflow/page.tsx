"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Radio } from "lucide-react";

import CumulativeDeltaChart, {
    CumulativeDeltaPoint,
} from "@/app/(root)/orderflow/_components/cumulative-delta-chart";
import OrderflowChart, { VolumeBucket } from "@/app/(root)/orderflow/_components/orderflow-chart";
import OrderflowSummary from "@/app/(root)/orderflow/_components/orderflow-summary";
import ReplayControls from "@/app/(root)/orderflow/_components/replay-controls";
import SessionStats from "@/app/(root)/orderflow/_components/session-stats";
import TradesTable from "@/app/(root)/orderflow/_components/trades-table";
import {
    ORDERFLOW_BUCKET_PRESETS,
    ORDERFLOW_DEFAULT_SYMBOL,
    ORDERFLOW_SMALL_TRADE_THRESHOLD,
    ORDERFLOW_SYMBOL_OPTIONS,
    ORDERFLOW_WINDOW_PRESETS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { LARGE_TRADE_THRESHOLD, NormalizedTrade, useOrderflowStream } from "@/hooks/useOrderflowStream";
import { usePersistOrderflowTrades } from "@/hooks/usePersistOrderflowTrades";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/formatters";

const bucketTrades = (
    trades: NormalizedTrade[],
    windowSeconds: number,
    bucketSizeSeconds: number,
    referenceTimestamp: number,
): VolumeBucket[] => {
    const windowStart = referenceTimestamp - windowSeconds * 1000;
    const bucketSizeMs = bucketSizeSeconds * 1000;
    const bucketCount = Math.ceil(windowSeconds / bucketSizeSeconds);

    const buckets: VolumeBucket[] = Array.from({ length: bucketCount }).map((_, index) => {
        const start = windowStart + index * bucketSizeMs;
        return {
            timestamp: start,
            buyVolume: 0,
            sellVolume: 0,
            delta: 0,
        };
    });

    trades.forEach((trade) => {
        if (trade.timestamp < windowStart) return;
        const bucketIndex = Math.floor((trade.timestamp - windowStart) / bucketSizeMs);
        if (bucketIndex < 0 || bucketIndex >= buckets.length) return;

        const bucket = buckets[bucketIndex];
        if (trade.side === "buy") {
            bucket.buyVolume += trade.quantity;
        } else {
            bucket.sellVolume += trade.quantity;
        }
        bucket.delta = bucket.buyVolume - bucket.sellVolume;
    });

    return buckets;
};

interface SessionStatsResponse {
    buyVolume: number;
    sellVolume: number;
    netDelta: number;
    vwap: number | null;
    largestCluster: {
        startTimestamp: number;
        endTimestamp: number;
        volume: number;
        buyVolume: number;
        sellVolume: number;
        tradeCount: number;
    } | null;
}

const SESSION_WINDOW_SECONDS = 86_400;
const SESSION_REFRESH_INTERVAL_MS = 20_000;
const MAX_DISPLAY_TRADES = 300;

const OrderflowPage = () => {
    const defaultWindowSeconds = ORDERFLOW_WINDOW_PRESETS[1]?.value ?? ORDERFLOW_WINDOW_PRESETS[0].value;
    const defaultBucketSize = ORDERFLOW_BUCKET_PRESETS[1]?.value ?? ORDERFLOW_BUCKET_PRESETS[0].value;

    const [selectedSymbol, setSelectedSymbol] = useState<string>(ORDERFLOW_DEFAULT_SYMBOL);
    const [windowSeconds, setWindowSeconds] = useState<number>(defaultWindowSeconds);
    const [bucketSizeSeconds, setBucketSizeSeconds] = useState<number>(defaultBucketSize);
    const [hideSmallTrades, setHideSmallTrades] = useState(false);
    const [replayEnabled, setReplayEnabled] = useState(false);
    const [replayIndex, setReplayIndex] = useState<number | null>(null);

    const { trades: liveTrades, connected, error } = useOrderflowStream({ symbol: selectedSymbol });
    const [historyTrades, setHistoryTrades] = useState<NormalizedTrade[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [sessionStats, setSessionStats] = useState<SessionStatsResponse>({
        buyVolume: 0,
        sellVolume: 0,
        netDelta: 0,
        vwap: null,
        largestCluster: null,
    });
    const [sessionStatsLoading, setSessionStatsLoading] = useState(false);

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

    useEffect(() => {
        let isCancelled = false;

        const fetchSessionStats = async () => {
            setSessionStatsLoading(true);
            try {
                const params = new URLSearchParams({
                    symbol: selectedSymbol,
                    sessionWindowSeconds: String(SESSION_WINDOW_SECONDS),
                });

                const response = await fetch(`/api/orderflow/session-stats?${params.toString()}`);
                if (!response.ok) {
                    throw new Error(`Failed to load session stats (${response.status})`);
                }

                const data = (await response.json()) as Partial<SessionStatsResponse>;
                if (isCancelled) return;

                const parsedLargestCluster = data?.largestCluster
                    ? {
                          startTimestamp: Number(data.largestCluster.startTimestamp),
                          endTimestamp: Number(data.largestCluster.endTimestamp),
                          volume: Number(data.largestCluster.volume),
                          buyVolume: Number(data.largestCluster.buyVolume),
                          sellVolume: Number(data.largestCluster.sellVolume),
                          tradeCount: Number(data.largestCluster.tradeCount),
                      }
                    : null;

                setSessionStats({
                    buyVolume: Number(data?.buyVolume) || 0,
                    sellVolume: Number(data?.sellVolume) || 0,
                    netDelta: Number(data?.netDelta) || 0,
                    vwap: Number.isFinite(Number(data?.vwap)) ? Number(data?.vwap) : null,
                    largestCluster: parsedLargestCluster,
                });
            } catch (fetchError) {
                console.error("Failed to fetch session stats", fetchError);
            } finally {
                if (!isCancelled) {
                    setSessionStatsLoading(false);
                }
            }
        };

        fetchSessionStats();
        const interval = setInterval(fetchSessionStats, SESSION_REFRESH_INTERVAL_MS);

        return () => {
            isCancelled = true;
            clearInterval(interval);
        };
    }, [selectedSymbol]);

    useEffect(() => {
        setReplayEnabled(false);
        setReplayIndex(null);
    }, [selectedSymbol, windowSeconds]);

    const combinedTrades = useMemo(() => {
        const allTrades = [...historyTrades, ...liveTrades];
        const uniqueTrades = new Map<string, NormalizedTrade>();

        allTrades.forEach((trade) => {
            const key = `${trade.timestamp}-${trade.side}-${trade.price}-${trade.quantity}`;
            uniqueTrades.set(key, trade);
        });

        return Array.from(uniqueTrades.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [historyTrades, liveTrades]);

    const now = Date.now();

    const windowStart = now - windowSeconds * 1000;

    const windowedTrades = useMemo(
        () => combinedTrades.filter((trade) => trade.timestamp >= windowStart),
        [combinedTrades, windowStart],
    );

    const baseBuckets = useMemo(
        () => bucketTrades(windowedTrades, windowSeconds, bucketSizeSeconds, now),
        [windowedTrades, windowSeconds, bucketSizeSeconds, now],
    );

    const bucketTimeline = useMemo(
        () => [...baseBuckets].sort((a, b) => a.timestamp - b.timestamp),
        [baseBuckets],
    );

    const windowBounds = useMemo(() => {
        const end = bucketTimeline.length
            ? bucketTimeline[bucketTimeline.length - 1].timestamp
            : now;
        const start = Math.max(end - windowSeconds * 1000, 0);
        return { start, end };
    }, [bucketTimeline, now, windowSeconds]);

    useEffect(() => {
        if (!replayEnabled) {
            setReplayIndex(null);
            return;
        }

        const lastIndex = bucketTimeline.length ? bucketTimeline.length - 1 : null;
        setReplayIndex((previous) => {
            if (lastIndex === null) return null;
            if (previous === null) return lastIndex;
            return Math.min(Math.max(previous, 0), lastIndex);
        });
    }, [bucketTimeline, replayEnabled]);

    const replayCutoffTimestamp = useMemo(() => {
        if (!replayEnabled || bucketTimeline.length === 0) return null;
        const clampedIndex = Math.min(
            Math.max(replayIndex ?? bucketTimeline.length - 1, 0),
            bucketTimeline.length - 1,
        );
        return bucketTimeline[clampedIndex].timestamp;
    }, [bucketTimeline, replayEnabled, replayIndex]);

    const effectiveTrades = useMemo(() => {
        const trades =
            replayCutoffTimestamp === null
                ? windowedTrades
                : windowedTrades.filter((trade) => trade.timestamp <= replayCutoffTimestamp);
        if (hideSmallTrades) {
            return trades.filter((trade) => trade.quantity >= ORDERFLOW_SMALL_TRADE_THRESHOLD);
        }
        return trades;
    }, [hideSmallTrades, replayCutoffTimestamp, windowedTrades]);

    const effectiveBuckets = useMemo(
        () =>
            replayCutoffTimestamp === null
                ? baseBuckets
                : baseBuckets.filter((bucket) => bucket.timestamp <= replayCutoffTimestamp),
        [baseBuckets, replayCutoffTimestamp],
    );

    const metrics = useMemo(() => {
        let buyVolume = 0;
        let sellVolume = 0;
        let buyTradesCount = 0;
        let sellTradesCount = 0;

        effectiveTrades.forEach((trade) => {
            if (trade.side === "buy") {
                buyVolume += trade.quantity;
                buyTradesCount += 1;
            } else {
                sellVolume += trade.quantity;
                sellTradesCount += 1;
            }
        });

        const delta = buyVolume - sellVolume;
        const totalTrades = buyTradesCount + sellTradesCount;
        const averageTradeSize = totalTrades > 0 ? (buyVolume + sellVolume) / totalTrades : 0;

        return { buyVolume, sellVolume, delta, buyTradesCount, sellTradesCount, averageTradeSize };
    }, [effectiveTrades]);

    const cumulativeDeltaData = useMemo<CumulativeDeltaPoint[]>(() => {
        let runningDelta = 0;
        return [...effectiveBuckets]
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((bucket) => {
                const bucketDelta = bucket.buyVolume - bucket.sellVolume;
                runningDelta += bucketDelta;
                return { timestamp: bucket.timestamp, cumulativeDelta: runningDelta };
            });
    }, [effectiveBuckets]);

    const displayedTrades = useMemo(
        () => effectiveTrades.slice(-MAX_DISPLAY_TRADES).reverse(),
        [effectiveTrades],
    );

    const statusText = loadingHistory
        ? "Loading history"
        : connected
          ? "Connected"
          : windowedTrades.length > 0
            ? "Disconnected"
            : "Connecting";
    const statusColor = loadingHistory
        ? "bg-amber-500/20 text-amber-200"
        : connected
          ? "bg-emerald-500/20 text-emerald-300"
          : windowedTrades.length > 0
            ? "bg-rose-500/20 text-rose-300"
            : "bg-amber-500/20 text-amber-200";

    const hasData = replayEnabled ? effectiveTrades.length > 0 : windowedTrades.length > 0;
    const windowMinutes = Math.max(1, Math.round(windowSeconds / 60));
    const sessionWindowLabel = `${Math.round(SESSION_WINDOW_SECONDS / 3600)}h`;
    const replaySliderValue = replayCutoffTimestamp ?? windowBounds.end;

    const handleToggleReplay = (enabled: boolean) => {
        setReplayEnabled(enabled);
        if (enabled) {
            const lastIndex = bucketTimeline.length ? bucketTimeline.length - 1 : null;
            setReplayIndex(lastIndex);
        } else {
            setReplayIndex(null);
        }
    };

    const handleReplayChange = (value: number) => {
        if (!bucketTimeline.length) return;

        const closest = bucketTimeline.reduce(
            (result, bucket, index) => {
                const distance = Math.abs(bucket.timestamp - value);
                if (distance < result.distance) {
                    return { distance, index };
                }
                return result;
            },
            { distance: Number.POSITIVE_INFINITY, index: bucketTimeline.length - 1 },
        );

        setReplayIndex(closest.index);
    };

    return (
        <section className="space-y-6 px-4 py-6 md:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-400">Orderflow</p>
                    <h1 className="text-3xl font-bold text-white">Orderflow – Phase 3</h1>
                    <p className="text-gray-400">
                        Live orderflow for {selectedSymbol.toUpperCase()} using exchange WebSocket.
                    </p>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${statusColor}`}>
                            <Radio size={16} />
                            <span>{statusText}</span>
                        </div>
                        {error ? (
                            <div className="flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-sm text-rose-300">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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

                    <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                            type="checkbox"
                            checked={hideSmallTrades}
                            onChange={(event) => setHideSmallTrades(event.target.checked)}
                            className="h-4 w-4 rounded border-gray-700 bg-[#0f1115] text-emerald-500 focus:ring-emerald-500"
                        />
                        Hide tiny trades (below {formatNumber(ORDERFLOW_SMALL_TRADE_THRESHOLD)})
                    </label>
                </div>
            </div>

            {hasData ? (
                <OrderflowSummary {...metrics} />
            ) : (
                <div className="rounded-xl border border-gray-800 bg-[#0f1115] px-4 py-6 text-center shadow-lg shadow-black/20">
                    <p className="text-sm font-semibold text-white">No recent trades</p>
                    <p className="text-xs text-gray-400">
                        We haven’t seen trades in the last {windowMinutes} minute{windowMinutes === 1 ? "" : "s"} for {" "}
                        {selectedSymbol.toUpperCase()}. Try a longer window or another symbol.
                    </p>
                </div>
            )}

            <div className="grid items-stretch gap-4 xl:grid-cols-[2fr_1fr]">
                <SessionStats
                    symbol={selectedSymbol}
                    windowLabel={sessionWindowLabel}
                    loading={sessionStatsLoading}
                    stats={sessionStats}
                />
                <ReplayControls
                    startTimestamp={windowBounds.start}
                    endTimestamp={windowBounds.end}
                    value={replaySliderValue}
                    enabled={replayEnabled}
                    onToggle={handleToggleReplay}
                    onChange={handleReplayChange}
                    disabled={!hasData}
                />
            </div>

            <div className="grid items-stretch gap-4 lg:grid-cols-[2fr_1fr] xl:grid-cols-[3fr_1fr]">
                <div className="space-y-4">
                    {hasData && <OrderflowChart buckets={effectiveBuckets} />}
                    {hasData && <CumulativeDeltaChart data={cumulativeDeltaData} />}
                    <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 text-sm text-gray-400 shadow-lg shadow-black/20">
                        <p>
                            Bucketing trades every <span className="font-semibold text-white">{bucketSizeSeconds}s</span> over the last
                            <span className="font-semibold text-white"> {windowSeconds}s</span>.
                            Large trades are highlighted at <span className="font-semibold text-white">{LARGE_TRADE_THRESHOLD}+</span>{" "}
                            base units.
                        </p>
                    </div>
                </div>
                <TradesTable trades={displayedTrades} className="h-full min-h-[360px]" />
            </div>
        </section>
    );
};

export default OrderflowPage;
