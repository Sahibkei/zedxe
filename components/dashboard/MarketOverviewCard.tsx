'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const tabs = ['Financial', 'Technology', 'Services'] as const;
const ranges = ['1D', '1M', '3M', '1Y', '5Y', 'All'] as const;

type Range = (typeof ranges)[number];
type Tab = (typeof tabs)[number];

type ChartPoint = {
    t: number;
    value: number;
};

type ApiPoint = { t: number; v: number };
type ApiResponse = { points: ApiPoint[] };

const MarketOverviewCard = () => {
    const [activeTab, setActiveTab] = useState<Tab>('Financial');
    const [activeRange, setActiveRange] = useState<Range>('1Y');
    const [points, setPoints] = useState<ApiPoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams({
                    sector: activeTab.toLowerCase(),
                    range: activeRange.toUpperCase(),
                });
                const res = await fetch(`/api/market/overview?${params.toString()}`, { signal: controller.signal });
                if (!res.ok) {
                    throw new Error('Failed to load market overview');
                }
                const data = (await res.json()) as ApiResponse;
                setPoints(Array.isArray(data.points) ? data.points : []);
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    console.error('Market overview fetch failed', error);
                    setPoints([]);
                }
            } finally {
                setIsLoading(false);
            }
        };

        void load();
        return () => controller.abort();
    }, [activeRange, activeTab]);

    const chartData = useMemo<ChartPoint[]>(() => {
        return points
            .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v))
            .map((point) => ({
                t: point.t * 1000,
                value: point.v,
            }));
    }, [points]);

    const hasChartData = chartData.length >= 2;

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-full border border-[#1c2432] bg-[#0b0f14] p-1">
                    {tabs.map((tab) => {
                        const isActive = tab === activeTab;
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`rounded-full px-4 py-1 text-xs font-mono transition ${
                                    isActive ? 'bg-[#1c2432] text-white' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {tab}
                            </button>
                        );
                    })}
                </div>
                <span className="text-xs font-mono text-slate-500">{activeTab} sector</span>
            </div>

            <div className="mt-4 rounded-lg border border-[#1c2432] bg-[#0b0f14] p-3">
                <div className="h-40 w-full">
                    {isLoading ? (
                        <div className="flex h-full w-full animate-pulse items-center justify-center rounded-md border border-[#1c2432] bg-[#0d1117] text-xs font-mono text-slate-500">
                            Loading market data...
                        </div>
                    ) : hasChartData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                                <XAxis dataKey="t" hide />
                                <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
                                <Tooltip
                                    cursor={{ stroke: '#1c2432', strokeWidth: 1 }}
                                    contentStyle={{
                                        backgroundColor: '#0d1117',
                                        borderColor: '#1c2432',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        color: '#e2e8f0',
                                    }}
                                    labelStyle={{ color: '#94a3b8' }}
                                    labelFormatter={(value) =>
                                        new Date(Number(value)).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })
                                    }
                                    formatter={(value: number) => [`${value.toFixed(2)}`, 'Close']}
                                />
                                <Line type="monotone" dataKey="value" stroke="#00d395" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-md border border-[#1c2432] bg-[#0d1117] text-xs font-mono text-slate-500">
                            No data available.
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {ranges.map((range) => {
                    const isActive = range === activeRange;
                    return (
                        <button
                            key={range}
                            type="button"
                            onClick={() => setActiveRange(range)}
                            className={`rounded-full border px-3 py-1 text-xs font-mono transition ${
                                isActive
                                    ? 'border-[#1c2432] bg-[#1c2432] text-white'
                                    : 'border-transparent bg-[#0b0f14] text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {range}
                        </button>
                    );
                })}
            </div>
            {process.env.NODE_ENV !== 'production' ? (
                <p className="mt-3 text-xs font-mono text-slate-500">Market overview data sourced via Finnhub.</p>
            ) : null}
        </div>
    );
};

export default MarketOverviewCard;
