"use client";

import { LARGE_TRADE_THRESHOLD, NormalizedTrade } from "@/hooks/useOrderflowStream";
import { cn } from "@/lib/utils";
import { formatNumber, formatTime } from "@/utils/formatters";

export interface TradesTableProps {
    trades: NormalizedTrade[];
    className?: string;
}

export const TradesTable = ({ trades, className }: TradesTableProps) => {
    return (
        <div
            className={cn(
                "flex h-full flex-col rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20",
                className,
            )}
        >
            <div className="flex items-center justify-between pb-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Time & Sales</p>
                    <h3 className="text-lg font-semibold text-white">Most Recent Trades</h3>
                </div>
                <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">{trades.length} shown</span>
            </div>
            <div className="flex-1 overflow-hidden rounded-lg border border-gray-800/60">
                <div className="h-full max-h-full overflow-y-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="sticky top-0 z-10 bg-[#0f1115] text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-3 py-2">Time</th>
                                <th className="px-3 py-2">Price</th>
                                <th className="px-3 py-2">Quantity</th>
                                <th className="px-3 py-2 text-right">Side</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {trades.map((trade, index) => {
                                const isLarge = trade.quantity >= LARGE_TRADE_THRESHOLD;
                                return (
                                    <tr
                                        key={`${trade.timestamp}-${index}`}
                                        className={`transition-colors ${
                                            isLarge
                                                ? "bg-amber-500/5 text-amber-100"
                                                : trade.side === "buy"
                                                  ? "bg-emerald-500/5"
                                                  : "bg-rose-500/5"
                                        }`}
                                    >
                                        <td className="px-3 py-2 text-gray-300">{formatTime(trade.timestamp)}</td>
                                        <td className="px-3 py-2 text-white">{formatNumber(trade.price)}</td>
                                        <td className="px-3 py-2 font-semibold">{formatNumber(trade.quantity)}</td>
                                        <td className="px-3 py-2 text-right">
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                    trade.side === "buy"
                                                        ? "bg-emerald-500/20 text-emerald-300"
                                                        : "bg-rose-500/20 text-rose-300"
                                                } ${isLarge ? "ring-2 ring-amber-400/50" : ""}`}
                                            >
                                                {trade.side === "buy" ? "Buy" : "Sell"}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TradesTable;
