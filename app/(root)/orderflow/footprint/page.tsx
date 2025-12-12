"use client";

import React, { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { buildFootprintBars, FootprintBar, inferPriceStepFromTrades } from "@/app/(root)/orderflow/_utils/footprint";
import FootprintLightweightChart from "@/components/orderflow/FootprintLightweightChart";
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
import { FootprintCandle, mapFootprintBarsToCandles } from "@/lib/orderflow/lightweightFeed";
import { useOrderflowStream, NormalizedTrade } from "@/hooks/useOrderflowStream";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/formatters";

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

const FootprintPageInner = () => {
    const [renderError, setRenderError] = useState<Error | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState<string>(ORDERFLOW_DEFAULT_SYMBOL);
    const [timeframe, setTimeframe] = useState<ChartTimeframe>("5m");

    const bucketSizeSeconds = TIMEFRAME_SECONDS[timeframe];
    const targetWindowSeconds = TIMEFRAME_SECONDS[timeframe] * MAX_CANDLES[timeframe];

    const { windowedTrades: liveWindowedTrades } = useOrderflowStream({ symbol: selectedSymbol, windowSeconds: targetWindowSeconds });
    const [historicalTrades, setHistoricalTrades] = useState<NormalizedTrade[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

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

    const footprintCandles = useMemo<FootprintCandle[]>(() => {
        const candles = mapFootprintBarsToCandles(footprintBars);
        return candles.slice(-MAX_CANDLES[timeframe]);
    }, [footprintBars, timeframe]);

    const windowMinutes = Math.max(1, Math.round(targetWindowSeconds / 60));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Orderflow</p>
                    <h1 className="text-2xl font-semibold text-white">Footprint</h1>
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
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between pb-3">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Live price</p>
                        <h3 className="text-lg font-semibold text-white">{selectedSymbol.toUpperCase()} · Candles</h3>
                    </div>
                    <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                        {footprintCandles.length} candles · ~{windowMinutes}m lookback
                    </span>
                </div>
                <div className="relative h-[520px] overflow-hidden rounded-lg border border-gray-900 bg-black/20">
                    <FootprintLightweightChart candles={footprintCandles} onRenderError={setRenderError} />
                </div>
                {renderError ? (
                    <p className="mt-2 text-xs text-red-400">Footprint chart failed to render; check console for details.</p>
                ) : null}
                {loadingHistory ? (
                    <p className="mt-2 text-xs text-gray-500">Loading last {windowMinutes} minutes of trades…</p>
                ) : null}
                {footprintCandles.length > 0 ? (
                    <p className="mt-2 text-xs text-gray-500">
                        Price step {formatNumber(priceStep)} · Latest close {formatNumber(footprintCandles[footprintCandles.length - 1]?.close)}
                    </p>
                ) : null}
            </div>
        </div>
    );
};

export default function FootprintPage() {
    return <FootprintPageInner />;
}

