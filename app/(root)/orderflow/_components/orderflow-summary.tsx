"use client";

import { ArrowDownRight, ArrowUpRight, ActivitySquare, Scale } from "lucide-react";

import { formatNumber } from "@/utils/formatters";

interface OrderflowSummaryProps {
    delta: number;
    buyVolume: number;
    sellVolume: number;
    buyTradesCount: number;
    sellTradesCount: number;
    averageTradeSize: number;
}

const formatPercent = (value: number) => `${value.toFixed(0)}%`;

const SummaryCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
        <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
        <div className="mt-3 text-white">{children}</div>
    </div>
);

export const OrderflowSummary = ({
    delta,
    buyVolume,
    sellVolume,
    buyTradesCount,
    sellTradesCount,
    averageTradeSize,
}: OrderflowSummaryProps) => {
    const totalVolume = buyVolume + sellVolume;
    const buyPercent = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 0;
    const sellPercent = 100 - buyPercent;
    const deltaPositive = delta >= 0;

    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Net Delta">
                <div className="flex items-center justify-between">
                    <div className={`text-3xl font-semibold ${deltaPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {deltaPositive ? "+" : ""}
                        {formatNumber(delta)}
                    </div>
                    <div
                        className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                            deltaPositive ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
                        }`}
                    >
                        {deltaPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        {deltaPositive ? "Buy Imbalance" : "Sell Imbalance"}
                    </div>
                </div>
                <p className="mt-2 text-sm text-gray-400">Difference between aggressive buy and sell volume.</p>
            </SummaryCard>

            <SummaryCard title="Buy vs Sell Volume">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-sm text-gray-400">Buy Volume</p>
                        <p className="text-xl font-semibold text-emerald-300">{formatNumber(buyVolume)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-400">Sell Volume</p>
                        <p className="text-xl font-semibold text-rose-300">{formatNumber(sellVolume)}</p>
                    </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                        <div
                            role="progressbar"
                            aria-valuenow={buyPercent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Buy volume percentage"
                            className="h-full bg-emerald-500"
                            style={{ width: `${buyPercent}%` }}
                        />
                    </div>
                    <span>{formatPercent(buyPercent)} Buy</span>
                    <span className="text-gray-600">|</span>
                    <span>{formatPercent(sellPercent)} Sell</span>
                </div>
            </SummaryCard>

            <SummaryCard title="Trade Counts">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-300">
                        <ActivitySquare size={18} />
                        <div>
                            <p className="text-xs text-gray-400">Buys</p>
                            <p className="text-xl font-semibold">{buyTradesCount}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-rose-300">
                        <ActivitySquare size={18} />
                        <div className="text-right">
                            <p className="text-xs text-gray-400">Sells</p>
                            <p className="text-xl font-semibold">{sellTradesCount}</p>
                        </div>
                    </div>
                </div>
            </SummaryCard>

            <SummaryCard title="Average Trade Size">
                <div className="flex items-center justify-between">
                    <div className="text-3xl font-semibold text-white">{formatNumber(averageTradeSize)}</div>
                    <div className="flex items-center gap-2 rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-300">
                        <Scale size={16} />
                        <span>per trade</span>
                    </div>
                </div>
                <p className="mt-2 text-sm text-gray-400">Based on total volume divided by total trades.</p>
            </SummaryCard>
        </div>
    );
};

export default OrderflowSummary;

