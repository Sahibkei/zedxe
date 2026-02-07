"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export type PortfolioAllocationPieProps = {
    positions: {
        symbol: string;
        companyName?: string;
        weightPct: number;
    }[];
    title?: string;
};

const COLORS = ['#78b9ff', '#10b981', '#f59e0b', '#f97316', '#a78bfa', '#f43f5e', '#22d3ee'];

const PortfolioAllocationPie = ({ positions, title = 'Allocation' }: PortfolioAllocationPieProps) => {
    const data = positions
        .filter((position) => Number.isFinite(position.weightPct) && position.weightPct > 0)
        .sort((a, b) => b.weightPct - a.weightPct)
        .map((position) => ({
            symbol: position.symbol,
            companyName: position.companyName,
            weight: position.weightPct,
        }));

    return (
        <div className="rounded-xl border border-border/80 bg-card p-5">
            <div className="border-b border-border/60 pb-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
            </div>

            {data.length === 0 ? (
                <div className="flex h-[250px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/15 text-sm text-muted-foreground">
                    Allocation will appear after you add holdings.
                </div>
            ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px]">
                    <div className="h-[220px] min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    dataKey="weight"
                                    nameKey="symbol"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={54}
                                    outerRadius={86}
                                    stroke="#0b111a"
                                    strokeWidth={2}
                                    paddingAngle={1}
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`${entry.symbol}-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number, _name, payload: { payload?: { symbol?: string; companyName?: string } }) => {
                                        const symbol = payload?.payload?.symbol || '--';
                                        const company = payload?.payload?.companyName;
                                        return [`${Number(value).toFixed(2)}%`, company ? `${symbol} (${company})` : symbol];
                                    }}
                                    contentStyle={{
                                        backgroundColor: '#0b111a',
                                        borderColor: '#1f2a3a',
                                        borderRadius: '0.5rem',
                                        color: '#d5dee9',
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="space-y-2">
                        {data.slice(0, 6).map((entry, index) => (
                            <div
                                key={`allocation-legend-${entry.symbol}`}
                                className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-xs"
                            >
                                <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="truncate text-muted-foreground">{entry.symbol}</span>
                                <span className="font-semibold tabular-nums text-foreground">{entry.weight.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortfolioAllocationPie;
