"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { formatNumber, formatTime } from "@/utils/formatters";

export interface VolumeBucket {
    timestamp: number;
    buyVolume: number;
    sellVolume: number;
    delta: number;
}

interface OrderflowChartProps {
    buckets: VolumeBucket[];
}

const tooltipFormatter = (value: number, name: string) => [
    formatNumber(value),
    name === "buyVolume" ? "Buy" : name === "sellVolume" ? "Sell" : "Delta",
];

export const OrderflowChart = ({ buckets }: OrderflowChartProps) => {
    return (
        <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between pb-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Volume Over Time</p>
                    <h3 className="text-lg font-semibold text-white">Buy vs Sell (stacked)</h3>
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
                        />
                        <Legend wrapperStyle={{ color: "#9ca3af" }} />
                        <Bar dataKey="buyVolume" stackId="volume" fill="#34d399" name="Buy" />
                        <Bar dataKey="sellVolume" stackId="volume" fill="#f87171" name="Sell" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default OrderflowChart;

