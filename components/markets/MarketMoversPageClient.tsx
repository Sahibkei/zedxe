'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { MarketMover } from '@/lib/market/movers';

type MoversTab = 'gainers' | 'losers';
type MoversView = 'table' | 'heatmap';

type Props = {
    initialTab: MoversTab;
    initialView: MoversView;
    initialGainers: MarketMover[];
    initialLosers: MarketMover[];
    initialUpdatedAt: string;
};

type MoversApiResponse = {
    gainers?: MarketMover[];
    losers?: MarketMover[];
    updatedAt?: string;
};

const REFRESH_INTERVAL_MS = 160000;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const formatPrice = (value: number | null) => {
    if (!isFiniteNumber(value)) return '--';
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatChange = (value: number | null) => {
    if (!isFiniteNumber(value)) return '--';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}`;
};

const formatPercent = (value: number | null) => {
    if (!isFiniteNumber(value)) return '--';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
};

const formatCompact = (value: number | null) => {
    if (!isFiniteNumber(value)) return '--';
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
    }).format(value);
};

const tabButtonClass = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm font-medium transition ${
        active
            ? 'border-[#2a3952] bg-[#1f2f4d] text-slate-100'
            : 'border-[#1c2432] bg-transparent text-slate-400 hover:border-slate-600 hover:text-slate-200'
    }`;

const viewButtonClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm font-medium transition ${
        active
            ? 'border-[#2a3952] bg-[#1f2f4d] text-slate-100'
            : 'border-[#1c2432] bg-transparent text-slate-400 hover:border-slate-600 hover:text-slate-200'
    }`;

const colorClass = (value: number | null) => {
    if (!isFiniteNumber(value)) return 'text-slate-400';
    return value >= 0 ? 'text-[#00d395]' : 'text-[#ff6b6b]';
};

const heatStyle = (value: number | null) => {
    if (!isFiniteNumber(value)) {
        return { backgroundColor: 'rgba(148,163,184,0.14)' };
    }

    const intensity = Math.min(1, Math.abs(value) / 12);
    const alpha = 0.2 + intensity * 0.6;
    return value >= 0
        ? { backgroundColor: `rgba(0, 211, 149, ${alpha.toFixed(3)})` }
        : { backgroundColor: `rgba(255, 107, 107, ${alpha.toFixed(3)})` };
};

const tileSpanClass = (index: number, marketCap: number | null) => {
    if (index === 0) return 'col-span-2 row-span-2';
    if (index < 6) return 'col-span-2 row-span-1';
    if (typeof marketCap === 'number' && marketCap > 120_000_000_000) return 'col-span-2 row-span-1';
    return 'col-span-1 row-span-1';
};

const MarketMoversPageClient = ({ initialTab, initialView, initialGainers, initialLosers, initialUpdatedAt }: Props) => {
    const [tab, setTab] = useState<MoversTab>(initialTab);
    const [view, setView] = useState<MoversView>(initialView);
    const [gainers, setGainers] = useState<MarketMover[]>(initialGainers);
    const [losers, setLosers] = useState<MarketMover[]>(initialLosers);
    const [updatedAt, setUpdatedAt] = useState<string>(initialUpdatedAt);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        let controller: AbortController | null = null;

        const refresh = async () => {
            setIsRefreshing(true);
            try {
                controller?.abort();
                controller = new AbortController();
                const response = await fetch('/api/market/movers?count=120', {
                    signal: controller.signal,
                    cache: 'no-store',
                });
                if (!response.ok) throw new Error(`Failed to refresh movers (${response.status})`);
                const payload = (await response.json()) as MoversApiResponse;

                if (!mounted) return;

                if (Array.isArray(payload.gainers)) setGainers(payload.gainers);
                if (Array.isArray(payload.losers)) setLosers(payload.losers);
                if (typeof payload.updatedAt === 'string') setUpdatedAt(payload.updatedAt);
                setErrorMessage(null);
            } catch (error) {
                if ((error as Error).name !== 'AbortError' && mounted) {
                    console.error('Movers refresh failed', error);
                    setErrorMessage('Live refresh failed. Showing latest available snapshot.');
                }
            } finally {
                if (mounted) setIsRefreshing(false);
            }
        };

        void refresh();
        const intervalId = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
        return () => {
            mounted = false;
            if (intervalId) clearInterval(intervalId);
            controller?.abort();
        };
    }, []);

    const rows = useMemo(() => (tab === 'gainers' ? gainers : losers), [tab, gainers, losers]);
    const heatRows = rows.slice(0, 80);

    const updatedTimeLabel = useMemo(() => {
        const timestamp = Date.parse(updatedAt);
        if (!Number.isFinite(timestamp)) return 'n/a';
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, [updatedAt]);

    return (
        <section className="mx-auto max-w-[1600px] space-y-5 px-4 pb-10">
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-slate-100">US Market Movers</h1>
                <p className="text-sm text-slate-400">Track the strongest day gainers and losers with table and heatmap view.</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 px-4 py-3">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setTab('gainers')} className={tabButtonClass(tab === 'gainers')}>
                        Top Gainers
                    </button>
                    <button type="button" onClick={() => setTab('losers')} className={tabButtonClass(tab === 'losers')}>
                        Top Losers
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setView('table')} className={viewButtonClass(view === 'table')}>
                        Table View
                    </button>
                    <button type="button" onClick={() => setView('heatmap')} className={viewButtonClass(view === 'heatmap')}>
                        Heatmap View
                    </button>
                    <span className="ml-2 text-xs font-mono text-slate-500">{isRefreshing ? 'Refreshing...' : `Updated ${updatedTimeLabel}`}</span>
                </div>
            </div>

            {errorMessage ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">{errorMessage}</div>
            ) : null}

            {view === 'table' ? (
                <div className="overflow-hidden rounded-2xl border border-[#1c2432] bg-[#0d1117]/70">
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="border-b border-[#1c2432] bg-[#0f1520]">
                                    <th className="px-3 py-3 text-left text-xs font-mono uppercase tracking-wide text-slate-400">Symbol</th>
                                    <th className="px-3 py-3 text-left text-xs font-mono uppercase tracking-wide text-slate-400">Name</th>
                                    <th className="px-3 py-3 text-right text-xs font-mono uppercase tracking-wide text-slate-400">Price</th>
                                    <th className="px-3 py-3 text-right text-xs font-mono uppercase tracking-wide text-slate-400">Change</th>
                                    <th className="px-3 py-3 text-right text-xs font-mono uppercase tracking-wide text-slate-400">Change %</th>
                                    <th className="px-3 py-3 text-right text-xs font-mono uppercase tracking-wide text-slate-400">Volume</th>
                                    <th className="px-3 py-3 text-right text-xs font-mono uppercase tracking-wide text-slate-400">Avg Vol (3M)</th>
                                    <th className="px-3 py-3 text-right text-xs font-mono uppercase tracking-wide text-slate-400">Market Cap</th>
                                    <th className="px-3 py-3 text-right text-xs font-mono uppercase tracking-wide text-slate-400">P/E</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.slice(0, 100).map((row) => (
                                    <tr key={row.symbol} className="border-b border-[#1c2432] transition hover:bg-[#111927]">
                                        <td className="px-3 py-3 text-sm font-semibold">
                                            <Link
                                                href={`/stocks/${encodeURIComponent(row.symbol)}`}
                                                className="text-slate-100 transition hover:text-[#58a6ff] hover:underline"
                                                aria-label={`Open ${row.symbol} stock profile`}
                                            >
                                                {row.symbol}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-3 text-sm text-slate-400">{row.name}</td>
                                        <td className="px-3 py-3 text-right text-sm font-medium text-slate-100">{formatPrice(row.price)}</td>
                                        <td className={`px-3 py-3 text-right text-sm font-medium ${colorClass(row.change)}`}>{formatChange(row.change)}</td>
                                        <td className={`px-3 py-3 text-right text-sm font-medium ${colorClass(row.changePercent)}`}>
                                            {formatPercent(row.changePercent)}
                                        </td>
                                        <td className="px-3 py-3 text-right text-sm text-slate-300">{formatCompact(row.volume)}</td>
                                        <td className="px-3 py-3 text-right text-sm text-slate-300">{formatCompact(row.avgVolume3m)}</td>
                                        <td className="px-3 py-3 text-right text-sm text-slate-300">{formatCompact(row.marketCap)}</td>
                                        <td className="px-3 py-3 text-right text-sm text-slate-300">
                                            {typeof row.peRatio === 'number' ? row.peRatio.toFixed(2) : '--'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate-400">Market cap weighted heatmap for {tab === 'gainers' ? 'gainers' : 'losers'}.</p>
                        <div className="flex items-center gap-1 text-xs font-mono">
                            <span className="rounded border border-[#1c2432] bg-[#ff6b6b]/30 px-2 py-1 text-slate-100">&lt;= -3%</span>
                            <span className="rounded border border-[#1c2432] bg-slate-700/40 px-2 py-1 text-slate-100">0%</span>
                            <span className="rounded border border-[#1c2432] bg-[#00d395]/30 px-2 py-1 text-slate-100">&gt;= +3%</span>
                        </div>
                    </div>
                    <div className="grid auto-rows-[88px] grid-cols-2 gap-2 md:grid-cols-6 xl:grid-cols-10">
                        {heatRows.map((row, index) => (
                            <Link
                                key={row.symbol}
                                href={`/stocks/${encodeURIComponent(row.symbol)}`}
                                className={`rounded-md border border-white/10 p-2 ${tileSpanClass(index, row.marketCap)}`}
                                style={heatStyle(row.changePercent)}
                                aria-label={`Open ${row.symbol} stock profile`}
                            >
                                <p className="text-sm font-semibold text-white">{row.symbol}</p>
                                <p className="truncate text-xs text-white/80">{row.name}</p>
                                <p className="mt-1 text-sm font-semibold text-white">{formatPercent(row.changePercent)}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};

export default MarketMoversPageClient;
