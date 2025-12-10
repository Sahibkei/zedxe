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
    refreshing?: boolean;
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
    refreshing = false,
    onChangeTimeframe,
}: FootprintCardProps) => {
    const displayedBars = useMemo(() => bars.slice(-60), [bars]);

    const getCellStyles = (bidVolume: number, askVolume: number, maxVolume: number) => {
        const totalVolume = bidVolume + askVolume;
        const imbalance = totalVolume > 0 ? Math.abs(askVolume - bidVolume) / totalVolume : 0;
        const dominant = askVolume === bidVolume ? "even" : askVolume > bidVolume ? "ask" : "bid";
        const baseWidth = Math.max(25, Math.min(100, (totalVolume / (maxVolume || 1)) * 100));

        const backgroundColor =
            dominant === "ask"
                ? `rgba(52, 211, 153, ${0.12 + imbalance * 0.25})`
                : dominant === "bid"
                  ? `rgba(248, 113, 113, ${0.12 + imbalance * 0.25})`
                  : "rgba(75, 85, 99, 0.35)";

        return { backgroundColor, width: `${baseWidth}%`, dominant };
    };

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
            ) : displayedBars.length === 0 ? (
                <p className="text-sm text-gray-400">No footprint data yet for this window.</p>
            ) : (
                <div className="relative">
                    {refreshing && (
                        <div className="absolute right-2 top-0 z-10 rounded-full border border-emerald-700/50 bg-emerald-600/10 px-3 py-1 text-[11px] text-emerald-200">
                            Refreshing…
                        </div>
                    )}
                    <div className="overflow-x-auto pb-2">
                        <div className="flex items-end gap-3">
                            {displayedBars.map((bar) => {
                                const orderedCells = [...bar.cells].sort((a, b) => b.price - a.price);
                                const maxVolume = Math.max(
                                    ...orderedCells.map((cell) => cell.askVolume + cell.bidVolume),
                                    0,
                                );

                                return (
                                    <div
                                        key={`${bar.symbol}-${bar.startTime}`}
                                        className="flex min-w-[200px] flex-col gap-2 rounded-lg border border-gray-800 bg-gray-900/40 p-3"
                                    >
                                        <div className="flex items-start justify-between gap-2 text-[11px] text-gray-300">
                                            <div>
                                                <p className="text-sm font-semibold text-white">{formatTime(bar.startTime)}</p>
                                                <p className="text-[10px] text-gray-500">{bar.timeframe}</p>
                                            </div>
                                            <div className="text-right">
                                                <p
                                                    className={cn(
                                                        "text-xs font-semibold",
                                                        bar.delta >= 0 ? "text-emerald-300" : "text-rose-300",
                                                    )}
                                                >
                                                    Δ {formatNumber(bar.delta)}
                                                </p>
                                                <p className="text-[10px] text-gray-400">
                                                    Bid {formatNumber(bar.totalBidVolume)} / Ask {formatNumber(bar.totalAskVolume)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1 text-[11px]">
                                            {orderedCells.map((cell) => {
                                                const { backgroundColor, width, dominant } = getCellStyles(
                                                    cell.bidVolume,
                                                    cell.askVolume,
                                                    maxVolume,
                                                );

                                                return (
                                                    <div
                                                        key={`${bar.startTime}-${cell.price}`}
                                                        className={cn(
                                                            "relative overflow-hidden rounded border bg-gray-900",
                                                            dominant === "ask"
                                                                ? "border-emerald-700/50"
                                                                : dominant === "bid"
                                                                  ? "border-rose-700/50"
                                                                  : "border-gray-800",
                                                        )}
                                                    >
                                                        <div className="absolute inset-y-0 left-0" style={{ width, backgroundColor }} />
                                                        <div className="relative flex items-center justify-between gap-2 px-2 py-1">
                                                            <div className="flex flex-col text-[10px] leading-tight text-gray-200">
                                                                <span className="text-xs font-semibold text-white">
                                                                    {formatNumber(cell.price, 6)}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400">
                                                                    {cell.tradesCount} trades
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[11px] font-semibold">
                                                                <span className="text-rose-200">
                                                                    {formatNumber(cell.bidVolume, 2)}
                                                                </span>
                                                                <span className="text-gray-400">×</span>
                                                                <span className="text-emerald-200">
                                                                    {formatNumber(cell.askVolume, 2)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FootprintCard;
