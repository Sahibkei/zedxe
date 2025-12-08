"use client";

import { useMemo } from "react";
import { AlertCircle, Radio } from "lucide-react";

import OrderflowChart, { VolumeBucket } from "@/app/(root)/orderflow/_components/orderflow-chart";
import OrderflowSummary from "@/app/(root)/orderflow/_components/orderflow-summary";
import TradesTable from "@/app/(root)/orderflow/_components/trades-table";
import {
    BUCKET_SIZE_SECONDS,
    DEFAULT_SYMBOL,
    LARGE_TRADE_THRESHOLD,
    NormalizedTrade,
    WINDOW_SECONDS,
    useOrderflowStream,
} from "@/hooks/useOrderflowStream";

const bucketTrades = (trades: NormalizedTrade[]): VolumeBucket[] => {
    const now = Date.now();
    const windowStart = now - WINDOW_SECONDS * 1000;
    const bucketSizeMs = BUCKET_SIZE_SECONDS * 1000;
    const bucketCount = Math.ceil(WINDOW_SECONDS / BUCKET_SIZE_SECONDS);

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

const OrderflowPage = () => {
    const { trades, connected, error } = useOrderflowStream({ symbol: DEFAULT_SYMBOL });

    const windowedTrades = useMemo(() => {
        const now = Date.now();
        const cutoff = now - WINDOW_SECONDS * 1000;
        return trades.filter((trade) => trade.timestamp >= cutoff);
    }, [trades]);

    const metrics = useMemo(() => {
        let buyVolume = 0;
        let sellVolume = 0;
        let buyTradesCount = 0;
        let sellTradesCount = 0;

        windowedTrades.forEach((trade) => {
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
    }, [windowedTrades]);

    const buckets = useMemo(() => bucketTrades(windowedTrades), [windowedTrades]);

    const statusText = connected ? "Connected" : trades.length > 0 ? "Disconnected" : "Connecting";
    const statusColor = connected ? "bg-emerald-500/20 text-emerald-300" : trades.length > 0 ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-200";

    const hasData = trades.length > 0;

    return (
        <section className="space-y-6 px-4 py-6 md:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-400">Orderflow</p>
                    <h1 className="text-3xl font-bold text-white">Orderflow – Phase 1</h1>
                    <p className="text-gray-400">Live orderflow for {DEFAULT_SYMBOL.toUpperCase()} using exchange WebSocket.</p>
                </div>
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

            {!hasData ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#0f1115]" />
                    ))}
                </div>
            ) : (
                <OrderflowSummary {...metrics} />
            )}

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr] xl:grid-cols-[3fr_1fr]">
                <div className="space-y-4">
                    <OrderflowChart buckets={buckets} />
                    <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20 text-sm text-gray-400">
                        <p>
                            Bucketing trades every <span className="text-white font-semibold">{BUCKET_SIZE_SECONDS}s</span> over the last
                            <span className="text-white font-semibold"> {WINDOW_SECONDS}s</span>. Large trades are highlighted at
                            <span className="text-white font-semibold"> {LARGE_TRADE_THRESHOLD}+</span> base units.
                        </p>
                    </div>
                </div>
                <TradesTable trades={windowedTrades} />
            </div>

            {!hasData && (
                <div className="rounded-xl border border-gray-800 bg-[#0f1115] px-4 py-6 text-center text-gray-400">
                    <p className="text-sm font-semibold text-white">Connecting to orderflow…</p>
                    <p className="text-xs text-gray-500">Stay on this page to watch live trades stream in.</p>
                </div>
            )}
        </section>
    );
};

export default OrderflowPage;

