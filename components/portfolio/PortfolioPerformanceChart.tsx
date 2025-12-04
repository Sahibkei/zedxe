"use client";

import { useEffect, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

import { Button } from '@/components/ui/button';
import { getPortfolioPerformanceAction } from '@/lib/portfolio/actions';
import type { PortfolioPerformancePoint, PortfolioPerformanceRange } from '@/lib/portfolio/portfolio-service';

const RANGE_OPTIONS: PortfolioPerformanceRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y', 'YTD', 'MAX'];

export type PortfolioPerformanceChartProps = {
    portfolioId: string;
    baseCurrency: string;
    initialRange: PortfolioPerformanceRange;
    initialPoints: PortfolioPerformancePoint[];
};

const formatCurrency = (value: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
    }).format(value || 0);

const PortfolioPerformanceChart = ({
    portfolioId,
    baseCurrency,
    initialRange,
    initialPoints,
}: PortfolioPerformanceChartProps) => {
    const [selectedRange, setSelectedRange] = useState<PortfolioPerformanceRange>(initialRange);
    const [points, setPoints] = useState<PortfolioPerformancePoint[]>(initialPoints);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setSelectedRange(initialRange);
        setPoints(initialPoints);
        setError('');
    }, [portfolioId, initialRange, initialPoints]);

    const chartData = useMemo(() => points.map((p) => ({ ...p, value: Number(p.value || 0) })), [points]);

    const handleRangeChange = async (range: PortfolioPerformanceRange) => {
        if (range === selectedRange || !portfolioId) return;
        setLoading(true);
        setError('');
        try {
            const res = await getPortfolioPerformanceAction(portfolioId, range);
            if (res.success) {
                setPoints(res.points);
                setSelectedRange(range);
            } else {
                setError(res.error);
            }
        } catch (e) {
            console.error('Failed to load performance series', e);
            setError('Unable to load this range right now.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-400">Performance</p>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {RANGE_OPTIONS.map((range) => {
                        const isActive = selectedRange === range;
                        return (
                            <Button
                                key={range}
                                size="sm"
                                variant={isActive ? 'default' : 'outline'}
                                className={
                                    isActive
                                        ? 'bg-yellow-500 text-black hover:bg-yellow-400'
                                        : 'border-gray-700 text-gray-200 hover:bg-gray-800'
                                }
                                onClick={() => handleRangeChange(range)}
                                disabled={loading}
                            >
                                {range}
                            </Button>
                        );
                    })}
                </div>
            </div>

            <div className="h-72 w-full rounded-lg border border-gray-800 bg-gray-900/60 p-4">
                {loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading performance...</div>
                ) : chartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                        No data for this range yet
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ left: 0, right: 12, top: 12, bottom: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#1f2937' }} />
                            <YAxis
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: '#1f2937' }}
                                tickFormatter={(value: number) => formatCurrency(value, baseCurrency)}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0b1224', borderColor: '#1f2937', color: '#e5e7eb' }}
                                formatter={(value: number) => formatCurrency(value, baseCurrency)}
                                labelFormatter={(label) => label}
                            />
                            <Line type="monotone" dataKey="value" stroke="#facc15" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default PortfolioPerformanceChart;
