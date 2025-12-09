"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    ResponsiveContainer,
    Tooltip,
    TooltipProps,
    XAxis,
    YAxis,
} from "recharts";

import { formatNumber, formatTime } from "@/utils/formatters";

export interface VolumeBucket {
    timestamp: number;
    buyVolume: number;
    sellVolume: number;
    delta: number;
    totalVolume: number;
    imbalance: number; // -1 to 1 ratio of buy/sell dominance
    imbalancePercent: number; // 0-100 absolute imbalance
    dominantSide: "buy" | "sell" | null;
}

interface OrderflowChartProps {
    buckets: VolumeBucket[];
}

const tooltipFormatter = (value: number, name: string) => [
    formatNumber(value),
    name === "buyVolume" ? "Buy" : name === "sellVolume" ? "Sell" : "Delta",
];

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;

    const bucket = payload[0]?.payload as VolumeBucket;
    const imbalanceLabel = bucket.dominantSide
        ? `${bucket.imbalancePercent.toFixed(0)}% ${bucket.dominantSide === "buy" ? "Buy" : "Sell"}`
        : "Neutral";

    return (
        <div className="rounded-lg border border-gray-800 bg-[#0b0d12] p-3 shadow-xl">
            <p className="text-xs text-gray-400">{formatTime(Number(label))}</p>
            <div className="mt-1 space-y-1 text-sm text-gray-200">
                <div className="flex items-center justify-between">
                    <span>Buy</span>
                    <span className="text-emerald-300">{formatNumber(bucket.buyVolume)}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span>Sell</span>
                    <span className="text-rose-300">{formatNumber(bucket.sellVolume)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-gray-800 pt-1 text-xs text-gray-400">
                    <span>Imbalance</span>
                    <span className="text-white">{imbalanceLabel}</span>
                </div>
            </div>
        </div>
    );
};

const buildFill = (bucket: VolumeBucket, side: "buy" | "sell") => {
    if (bucket.totalVolume === 0) {
        return side === "buy" ? "rgba(52, 211, 153, 0.35)" : "rgba(248, 113, 113, 0.35)";
    }

    const imbalanceStrength = Math.min(1, bucket.imbalancePercent / 90);
    const dominant = bucket.dominantSide === side;
    const baseOpacity = dominant ? 0.55 : 0.35;
    const boost = dominant ? 0.25 * imbalanceStrength : 0.05;

    const opacity = Math.min(0.95, baseOpacity + boost);
    return side === "buy"
        ? `rgba(52, 211, 153, ${opacity.toFixed(3)})`
        : `rgba(248, 113, 113, ${opacity.toFixed(3)})`;
};

export const OrderflowChart = ({ buckets }: OrderflowChartProps) => {
    return (
        <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between pb-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Volume Over Time</p>
                    <h3 className="text-lg font-semibold text-white">Buy vs Sell (stacked footprint)</h3>
                </div>
                <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">Last {buckets.length} buckets</span>
            </div>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buckets} stackOffset="sign">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#9ca3af" tickLine={false} />
                        <YAxis stroke="#9ca3af" tickLine={false} axisLine={false} />
                        <Tooltip
                            contentStyle={{ background: "#0b0d12", border: "1px solid #1f2937" }}
                            labelStyle={{ color: "#e5e7eb" }}
                            labelFormatter={(label) => formatTime(Number(label))}
                            formatter={tooltipFormatter}
                            content={<CustomTooltip />}
                        />
                        <Legend wrapperStyle={{ color: "#9ca3af" }} />
                        <Bar dataKey="buyVolume" stackId="volume" name="Buy" radius={[4, 4, 0, 0]}>
                            {buckets.map((bucket) => (
                                <Cell key={`buy-${bucket.timestamp}`} fill={buildFill(bucket, "buy")} />
                            ))}
                        </Bar>
                        <Bar dataKey="sellVolume" stackId="volume" name="Sell" radius={[0, 0, 4, 4]}>
                            {buckets.map((bucket) => (
                                <Cell key={`sell-${bucket.timestamp}`} fill={buildFill(bucket, "sell")} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default OrderflowChart;

