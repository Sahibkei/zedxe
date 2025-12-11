"use client";

import type { ReactNode } from "react";

import { Activity, Gauge, Waves } from "lucide-react";

import { formatNumber, formatTime } from "@/utils/formatters";

interface LargestCluster {
    startTimestamp: number;
    endTimestamp: number;
    volume: number;
    buyVolume: number;
    sellVolume: number;
    tradeCount: number;
}

interface SessionStatsProps {
    symbol: string;
    windowLabel: string;
    loading: boolean;
    error?: string | null;
    stats: {
        buyVolume: number;
        sellVolume: number;
        netDelta: number;
        vwap: number | null;
        largestCluster: LargestCluster | null;
    };
}

const formatTimeRange = (start: number, end: number) =>
    `${formatTime(start)} – ${formatTime(end)}`;

const ValueBlock = ({
    label,
    value,
    helper,
    icon,
    accent,
}: {
    label: string;
    value: string;
    helper?: string;
    icon?: ReactNode;
    accent?: string;
}) => (
    <div className="rounded-lg border border-gray-800/80 bg-[#0f1115] p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            {icon}
            <span>{label}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white">
            <span>{value}</span>
            {accent ? <span className="text-sm text-gray-400">{accent}</span> : null}
        </div>
        {helper ? <p className="mt-1 text-xs text-gray-500">{helper}</p> : null}
    </div>
);

export const SessionStats = ({ symbol, windowLabel, loading, error, stats }: SessionStatsProps) => {
    const { buyVolume, sellVolume, netDelta, vwap, largestCluster } = stats;
    const deltaPositive = netDelta >= 0;

    return (
        <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between pb-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Session Overview</p>
                    <h3 className="text-lg font-semibold text-white">
                        {symbol.toUpperCase()} · Last {windowLabel}
                    </h3>
                </div>
                <span
                    className={`rounded-full px-3 py-1 text-xs ${
                        loading
                            ? "bg-amber-500/20 text-amber-200"
                            : error
                              ? "bg-rose-500/20 text-rose-200"
                              : "bg-gray-800 text-gray-300"
                    }`}
                >
                    {loading ? "Refreshing" : error ? "Error" : "Live"}
                </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <ValueBlock
                    label="Session Delta"
                    value={`${deltaPositive ? "+" : ""}${formatNumber(netDelta)}`}
                    helper={`Buys ${formatNumber(buyVolume)} • Sells ${formatNumber(sellVolume)}`}
                    icon={<Waves size={14} className={deltaPositive ? "text-emerald-400" : "text-rose-400"} />}
                />
                <ValueBlock
                    label="Session VWAP"
                    value={vwap ? formatNumber(vwap, 2) : "–"}
                    helper="Volume-weighted average price of all trades."
                    icon={<Gauge size={14} className="text-gray-400" />}
                />
                <ValueBlock
                    label="Largest Cluster"
                    value={largestCluster ? formatNumber(largestCluster.volume) : "–"}
                    accent={largestCluster ? `${largestCluster.tradeCount} trades` : undefined}
                    helper={
                        largestCluster
                            ? `${formatTimeRange(largestCluster.startTimestamp, largestCluster.endTimestamp)}`
                            : "No cluster detected yet"
                    }
                    icon={<Activity size={14} className="text-gray-400" />}
                />
            </div>

            {error ? (
                <p className="mt-2 text-xs text-rose-200">{error}</p>
            ) : null}
        </div>
    );
};

export default SessionStats;
