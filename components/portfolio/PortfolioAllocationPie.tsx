"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export type PortfolioAllocationPieProps = {
    positions: {
        symbol: string;
        companyName?: string;
        weightPct: number;
    }[];
};

const COLORS = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'];

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
        .map((p) => ({
            name: p.companyName ? `${p.symbol} – ${p.companyName}` : p.symbol,
            symbol: p.symbol,
            companyName: p.companyName,
            weight: p.weightPct,
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
                                <Cell key={entry.symbol} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value, _name, entry: any) => {
                                const symbol = entry?.payload?.symbol ?? '';
                                const company = entry?.payload?.companyName ?? '';
                                const weight = typeof value === 'number' ? value : Number(value);
                                const label = company ? `${symbol} – ${company}` : symbol;
                                return [`${weight.toFixed(2)}%`, label];
                            }}
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                borderRadius: 9999,
                                border: '1px solid #1f2937',
                                padding: '4px 8px',
                            }}
                            itemStyle={{ color: '#ffffff' }}
                            cursor={{ fill: 'rgba(148, 163, 184, 0.15)' }}
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
