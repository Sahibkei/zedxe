"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatNumber, formatTime } from "@/utils/formatters";

export interface CumulativeDeltaPoint {
    timestamp: number;
    cumulativeDelta: number;
}

interface CumulativeDeltaChartProps {
    data: CumulativeDeltaPoint[];
}

const tooltipFormatter = (value: number) => [formatNumber(value), "Cumulative Delta"];

const CumulativeDeltaChart = ({ data }: CumulativeDeltaChartProps) => {
    return (
        <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between pb-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Delta Over Time</p>
                    <h3 className="text-lg font-semibold text-white">Cumulative Delta</h3>
                </div>
                <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">{data.length} buckets</span>
            </div>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#9ca3af" tickLine={false} />
                        <YAxis stroke="#9ca3af" tickLine={false} axisLine={false} />
                        <Tooltip
                            contentStyle={{ background: "#0b0d12", border: "1px solid #1f2937" }}
                            labelStyle={{ color: "#e5e7eb" }}
                            labelFormatter={(label) => formatTime(Number(label))}
                            formatter={tooltipFormatter}
                        />
                        <Area
                            type="monotone"
                            dataKey="cumulativeDelta"
                            stroke="#60a5fa"
                            fill="#1d4ed8"
                            fillOpacity={0.2}
                            strokeWidth={2}
                            name="Cumulative Delta"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default CumulativeDeltaChart;
