"use client";

import { useMemo } from "react";

import { FootprintBar, FootprintTimeframe } from "@/lib/footprint/types";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/formatters";

interface FootprintCardProps {
    symbol: string;
    bars: FootprintBar[];
    timeframe: FootprintTimeframe;
    timeframeOptions: FootprintTimeframe[];
    loading: boolean;
    onChangeTimeframe: (value: FootprintTimeframe) => void;
}

const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const FootprintCard = ({
    symbol,
    bars,
    timeframe,
    timeframeOptions,
    loading,
    onChangeTimeframe,
}: FootprintCardProps) => {
    const recentBars = useMemo(() => bars.slice(-10).reverse(), [bars]);

    return (
        <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-400">Footprint</p>
                    <h2 className="text-lg font-semibold text-white">{symbol.toUpperCase()} footprint</h2>
                    <p className="text-xs text-gray-400">Volume split by price level and aggressor side.</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                    {timeframeOptions.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => onChangeTimeframe(option)}
                            className={cn(
                                "rounded-full border px-3 py-1 text-xs",
                                option === timeframe
                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                                    : "border-gray-800 text-gray-300 hover:border-emerald-700 hover:text-emerald-200",
                            )}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <p className="text-sm text-gray-400">Loading footprint…</p>
            ) : recentBars.length === 0 ? (
                <p className="text-sm text-gray-400">No footprint data yet for this window.</p>
            ) : (
                <div className="space-y-3">
                    {recentBars.map((bar) => (
                        <div key={`${bar.symbol}-${bar.startTime}`} className="rounded-lg border border-gray-800 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                                <span>
                                    {formatTime(bar.startTime)} – {formatTime(bar.endTime)} ({bar.timeframe})
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className="text-emerald-300">Δ {formatNumber(bar.delta)}</span>
                                    <span className="text-gray-300">
                                        Bid {formatNumber(bar.totalBidVolume)} / Ask {formatNumber(bar.totalAskVolume)}
                                    </span>
                                    <span className="text-gray-500">
                                        O:{bar.open} H:{bar.high} L:{bar.low} C:{bar.close}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {bar.cells.map((cell) => (
                                    <div
                                        key={`${bar.startTime}-${cell.price}`}
                                        className={cn(
                                            "rounded-lg border px-3 py-2 text-xs",
                                            cell.askVolume === cell.bidVolume
                                                ? "border-gray-800 bg-gray-900"
                                                : cell.askVolume > cell.bidVolume
                                                  ? "border-emerald-600/50 bg-emerald-600/10"
                                                  : "border-rose-600/50 bg-rose-600/10",
                                        )}
                                    >
                                        <div className="flex items-center justify-between text-gray-300">
                                            <span className="font-semibold text-white">{cell.price}</span>
                                            <span className="text-[10px] text-gray-400">{cell.tradesCount} trades</span>
                                        </div>
                                        <div className="mt-1 flex items-center justify-between">
                                            <span className="text-emerald-300">Ask {formatNumber(cell.askVolume)}</span>
                                            <span className="text-rose-300">Bid {formatNumber(cell.bidVolume)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FootprintCard;
