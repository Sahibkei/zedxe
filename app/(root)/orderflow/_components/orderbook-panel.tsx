"use client";

import { ArrowDown, ArrowUp, Radio } from "lucide-react";

import { useOrderbookStream } from "@/hooks/useOrderbookStream";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/formatters";

interface OrderbookPanelProps {
    symbol: string;
    levelCount?: number;
}

const OrderbookPanel = ({ symbol, levelCount = 16 }: OrderbookPanelProps) => {
    const { bids, asks, summary, connected, error } = useOrderbookStream(symbol, levelCount);

    const hasBids = bids.length > 0;
    const hasAsks = asks.length > 0;
    const maxSize = Math.max(
        bids.reduce((max, level) => Math.max(max, level.size), 0),
        asks.reduce((max, level) => Math.max(max, level.size), 0),
        1,
    );

    const midPrice = summary.bestBid && summary.bestAsk ? (summary.bestBid.price + summary.bestAsk.price) / 2 : null;
    const spreadPct = summary.spread !== undefined && midPrice ? (summary.spread ?? 0) / midPrice : null;
    const spreadText =
        summary.spread !== undefined && summary.bestBid && summary.bestAsk
            ? `${(summary.spread ?? 0).toFixed(2)}${spreadPct ? ` (${(spreadPct * 100).toFixed(3)}%)` : ""}`
            : "–";

    const renderStatus = (waitingText: string) => {
        if (error) return "Depth stream error";
        if (!connected) return "Connecting…";
        return waitingText;
    };

    const renderEmptyState = (label: string) => (
        <div className="px-3 py-4 text-center text-xs text-gray-500">{label}</div>
    );

    return (
        <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-400">Order Book</p>
                    <h2 className="text-xl font-semibold text-white">DOM – {symbol.toUpperCase()}</h2>
                </div>
                <div className="flex flex-col items-end gap-1 text-sm text-gray-300 sm:flex-row sm:items-center">
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
                    ) : summary.spread !== undefined && summary.bestBid && summary.bestAsk ? (
                        <span className="text-xs text-gray-400">
                            Spread: <span className="font-semibold text-white">{spreadText}</span>
                        </span>
                    ) : null}
                </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Best Bid</p>
                    <div className="flex items-baseline gap-2 text-emerald-300">
                        <span className="text-lg font-semibold">
                            {summary.bestBid ? summary.bestBid.price.toLocaleString() : "–"}
                        </span>
                        <span className="text-xs text-gray-500">
                            Size: {formatNumber(summary.bestBid?.size ?? 0, 4)}
                        </span>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Best Ask</p>
                    <div className="flex items-baseline justify-end gap-2 text-rose-300">
                        <span className="text-lg font-semibold">
                            {summary.bestAsk ? summary.bestAsk.price.toLocaleString() : "–"}
                        </span>
                        <span className="text-xs text-gray-500">
                            Size: {formatNumber(summary.bestAsk?.size ?? 0, 4)}
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
                    <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-800 bg-black/40">
                        {hasAsks ? (
                            asks.map((level, index) => {
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
                            })
                        ) : (
                            renderEmptyState(renderStatus("Waiting for asks…"))
                        )}
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
                        <span>Bids</span>
                        <span className="flex items-center gap-1">
                            Size <ArrowDown size={12} />
                        </span>
                    </div>
                    <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-800 bg-black/40">
                        {hasBids ? (
                            bids.map((level, index) => {
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
                            })
                        ) : (
                            renderEmptyState(renderStatus("Waiting for bids…"))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderbookPanel;
