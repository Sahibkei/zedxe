"use client";

import { ArrowDown, ArrowUp, Radio } from "lucide-react";

import { useOrderbookStream } from "@/hooks/useOrderbookStream";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/formatters";

interface OrderbookPanelProps {
    symbol: string;
    levelCount?: number;
}

const formatSpread = (spread: number | null, spreadPct: number | null) => {
    if (spread === null) return "–";
    const pctText = spreadPct !== null ? ` (${(spreadPct * 100).toFixed(3)}%)` : "";
    return `${spread.toFixed(2)}${pctText}`;
};

const OrderbookPanel = ({ symbol, levelCount = 16 }: OrderbookPanelProps) => {
    const { bids, asks, summary, connected, error } = useOrderbookStream(symbol, levelCount);

    const maxSize = Math.max(
        bids.reduce((max, level) => Math.max(max, level.size), 0),
        asks.reduce((max, level) => Math.max(max, level.size), 0),
        1,
    );

    const displayAsks = [...asks].sort((a, b) => b.price - a.price);
    const displayBids = bids;

    return (
        <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-400">Order Book</p>
                    <h2 className="text-xl font-semibold text-white">DOM – {symbol.toUpperCase()}</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                    <div
                        className={cn(
                            "flex items-center gap-2 rounded-full px-3 py-1",
                            connected ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200",
                        )}
                    >
                        <Radio size={14} />
                        <span>{connected ? "Live" : "Connecting"}</span>
                    </div>
                    {error ? (
                        <span className="text-xs text-rose-300">{error}</span>
                    ) : summary.bestBid && summary.bestAsk ? (
                        <span className="text-xs text-gray-400">
                            Spread: <span className="font-semibold text-white">{formatSpread(summary.spread, summary.spreadPct)}</span>
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Best Bid</p>
                    <div className="flex items-baseline gap-2 text-emerald-300">
                        <span className="text-lg font-semibold">
                            {summary.bestBid ? summary.bestBid.toLocaleString() : "–"}
                        </span>
                        <span className="text-xs text-gray-500">Size: {formatNumber(summary.totalBidSize, 2)}</span>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Best Ask</p>
                    <div className="flex items-baseline justify-end gap-2 text-rose-300">
                        <span className="text-xs text-gray-500">
                            Size: {formatNumber(summary.totalAskSize, 2)}
                        </span>
                        <span className="text-lg font-semibold">
                            {summary.bestAsk ? summary.bestAsk.toLocaleString() : "–"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
                        <span className="flex items-center gap-1">
                            <ArrowUp size={12} /> Asks
                        </span>
                        <span>Size</span>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-gray-800 bg-black/40">
                        {displayAsks.map((level, index) => {
                            const sizeRatio = Math.min(1, level.size / maxSize);
                            return (
                                <div
                                    key={`ask-${level.price}-${index}`}
                                    className="relative flex items-center justify-between px-3 py-1.5"
                                >
                                    <div
                                        className="absolute inset-y-0 left-0 bg-rose-500/15"
                                        style={{ width: `${sizeRatio * 100}%` }}
                                    />
                                    <span className="relative z-10 font-medium text-rose-300">
                                        {level.price.toLocaleString()}
                                    </span>
                                    <span className="relative z-10 text-gray-200">{formatNumber(level.size, 4)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
                        <span>Bids</span>
                        <span className="flex items-center gap-1">
                            Size <ArrowDown size={12} />
                        </span>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-gray-800 bg-black/40">
                        {displayBids.map((level, index) => {
                            const sizeRatio = Math.min(1, level.size / maxSize);
                            return (
                                <div
                                    key={`bid-${level.price}-${index}`}
                                    className="relative flex items-center justify-between px-3 py-1.5"
                                >
                                    <div
                                        className="absolute inset-y-0 right-0 bg-emerald-500/15"
                                        style={{ width: `${sizeRatio * 100}%` }}
                                    />
                                    <span className="relative z-10 font-medium text-emerald-300">
                                        {level.price.toLocaleString()}
                                    </span>
                                    <span className="relative z-10 text-gray-200">{formatNumber(level.size, 4)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderbookPanel;
