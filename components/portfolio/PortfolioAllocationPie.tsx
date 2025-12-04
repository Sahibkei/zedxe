"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export type PortfolioAllocationPieProps = {
    positions: {
        symbol: string;
        companyName?: string;
        weightPct: number;
    }[];
};

const COLORS = ['#facc15', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#f97316', '#22d3ee', '#c084fc', '#fef08a'];

const PortfolioAllocationPie = ({ positions }: PortfolioAllocationPieProps) => {
    if (!positions || positions.length === 0) {
        return (
            <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-400">
                No holdings yet
            </div>
        );
    }

    const data = positions
        .filter((p) => p.weightPct > 0)
        .map((p, idx) => ({
            name: p.companyName ? `${p.symbol} – ${p.companyName}` : p.symbol,
            symbol: p.symbol,
            weight: p.weightPct,
            fill: COLORS[idx % COLORS.length],
        }));

    if (data.length === 0) {
        return (
            <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-400">No holdings yet</div>
        );
    }

    return (
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
            <h3 className="text-lg font-semibold text-gray-100">Allocation</h3>
            <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="weight"
                            nameKey="symbol"
                            cx="50%"
                            cy="50%"
                            outerRadius={90}
                            label={({ symbol, weight }) => `${symbol}: ${weight.toFixed(1)}%`}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${entry.symbol}-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number, _name, payload) =>
                                `${payload?.payload?.symbol ?? ''} – ${Number(value).toFixed(2)}%`
                            }
                            contentStyle={{ backgroundColor: '#0b1224', borderColor: '#1f2937', color: '#e5e7eb' }}
                        />
                        <Legend
                            layout="horizontal"
                            verticalAlign="bottom"
                            align="center"
                            wrapperStyle={{ color: '#e5e7eb', fontSize: 12 }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PortfolioAllocationPie;
