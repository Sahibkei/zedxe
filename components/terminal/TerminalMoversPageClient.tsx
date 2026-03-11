'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { MarketMover } from '@/lib/market/movers';
import { cn } from '@/lib/utils';

type MoversTab = 'gainers' | 'losers';
type MoversView = 'table' | 'heatmap';
type MoversUniverse = 'all' | 'sp500' | 'nasdaq100' | 'dow30';

type MoversApiResponse = {
    gainers?: MarketMover[];
    losers?: MarketMover[];
    updatedAt?: string;
};

type IndexConstituentsResponse = {
    constituents?: Array<{
        symbol: string;
    }>;
};

const REFRESH_INTERVAL_MS = 160_000;
const UNIVERSE_OPTIONS: Array<{ key: MoversUniverse; label: string; indexSymbol?: string }> = [
    { key: 'all', label: 'All US' },
    { key: 'sp500', label: 'S&P 500', indexSymbol: '^GSPC' },
    { key: 'nasdaq100', label: 'Nasdaq 100', indexSymbol: '^NDX' },
    { key: 'dow30', label: 'Dow 30', indexSymbol: '^DJI' },
];

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const parseTab = (value: string | null): MoversTab => (value?.toLowerCase() === 'losers' ? 'losers' : 'gainers');
const parseView = (value: string | null): MoversView => (value?.toLowerCase() === 'heatmap' ? 'heatmap' : 'table');
const parseUniverse = (value: string | null): MoversUniverse =>
    value === 'sp500' || value === 'nasdaq100' || value === 'dow30' ? value : 'all';

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
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
};

const formatPercent = (value: number | null) => {
    if (!isFiniteNumber(value)) return '--';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const formatCompact = (value: number | null) => {
    if (!isFiniteNumber(value)) return '--';
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
    }).format(value);
};

const colorClass = (value: number | null) => {
    if (!isFiniteNumber(value)) return 'terminal-muted';
    return value >= 0 ? 'terminal-up' : 'terminal-down';
};

const heatStyle = (value: number | null) => {
    if (!isFiniteNumber(value)) {
        return {
            background:
                'linear-gradient(180deg, color-mix(in srgb, var(--terminal-panel-soft) 92%, transparent), color-mix(in srgb, var(--terminal-panel) 96%, transparent))',
            borderColor: 'color-mix(in srgb, var(--terminal-border) 88%, transparent)',
        };
    }

    const intensity = Math.min(1, Math.abs(value) / 12);
    if (value >= 0) {
        return {
            background: `linear-gradient(180deg, color-mix(in srgb, var(--terminal-up) ${18 + intensity * 22}%, var(--terminal-panel-soft)), color-mix(in srgb, var(--terminal-up) ${12 + intensity * 12}%, var(--terminal-panel)))`,
            borderColor: `color-mix(in srgb, var(--terminal-up) ${26 + intensity * 28}%, var(--terminal-border))`,
        };
    }

    return {
        background: `linear-gradient(180deg, color-mix(in srgb, var(--terminal-down) ${18 + intensity * 22}%, var(--terminal-panel-soft)), color-mix(in srgb, var(--terminal-down) ${12 + intensity * 12}%, var(--terminal-panel)))`,
        borderColor: `color-mix(in srgb, var(--terminal-down) ${26 + intensity * 28}%, var(--terminal-border))`,
    };
};

const tileSpanClass = (index: number, marketCap: number | null) => {
    if (index === 0) return 'col-span-2 row-span-2';
    if (index < 6) return 'col-span-2 row-span-1';
    if (typeof marketCap === 'number' && marketCap > 120_000_000_000) return 'col-span-2 row-span-1';
    return 'col-span-1 row-span-1';
};

const buildTerminalChartHref = (symbol: string, label: string) =>
    `/terminal/chart?symbol=${encodeURIComponent(symbol)}&label=${encodeURIComponent(label)}`;

const TerminalMoversPageClient = () => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const tab = parseTab(searchParams.get('tab'));
    const view = parseView(searchParams.get('view'));
    const universe = parseUniverse(searchParams.get('universe'));

    const [gainers, setGainers] = useState<MarketMover[]>([]);
    const [losers, setLosers] = useState<MarketMover[]>([]);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [constituentMap, setConstituentMap] = useState<Partial<Record<MoversUniverse, string[]>>>({});
    const [isLoadingUniverse, setIsLoadingUniverse] = useState(false);

    const updateQuery = (next: Partial<{ tab: MoversTab; view: MoversView; universe: MoversUniverse }>) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next.tab) params.set('tab', next.tab);
        if (next.view) params.set('view', next.view);
        if (next.universe) {
            if (next.universe === 'all') {
                params.delete('universe');
            } else {
                params.set('universe', next.universe);
            }
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    useEffect(() => {
        let mounted = true;
        let controller: AbortController | null = null;

        const refresh = async () => {
            setIsRefreshing(true);
            try {
                controller?.abort();
                controller = new AbortController();
                const response = await fetch('/api/market/movers?count=250', {
                    signal: controller.signal,
                    cache: 'no-store',
                });
                if (!response.ok) throw new Error(`Failed to refresh movers (${response.status})`);
                const payload = (await response.json()) as MoversApiResponse;
                if (!mounted) return;

                setGainers(Array.isArray(payload.gainers) ? payload.gainers : []);
                setLosers(Array.isArray(payload.losers) ? payload.losers : []);
                setUpdatedAt(typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString());
                setErrorMessage(null);
            } catch (error) {
                if ((error as Error).name !== 'AbortError' && mounted) {
                    console.error('Terminal movers refresh failed', error);
                    setErrorMessage('Live movers refresh failed. Showing the latest available snapshot.');
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

    useEffect(() => {
        const option = UNIVERSE_OPTIONS.find((item) => item.key === universe);
        if (universe === 'all' || !option?.indexSymbol || constituentMap[universe]) return;

        let mounted = true;
        const controller = new AbortController();

        const loadConstituents = async () => {
            setIsLoadingUniverse(true);
            try {
                const response = await fetch(
                    `/api/market/index-constituents?symbol=${encodeURIComponent(option.indexSymbol)}`,
                    { cache: 'no-store', signal: controller.signal }
                );
                if (!response.ok) throw new Error(`Failed to load ${option.label} constituents`);
                const payload = (await response.json()) as IndexConstituentsResponse;
                if (!mounted) return;

                setConstituentMap((prev) => ({
                    ...prev,
                    [universe]: (payload.constituents ?? []).map((item) => item.symbol.toUpperCase()),
                }));
            } catch (error) {
                if ((error as Error).name !== 'AbortError' && mounted) {
                    console.error('Terminal movers universe filter failed', error);
                    setErrorMessage(`Unable to load ${option.label} constituents right now.`);
                }
            } finally {
                if (mounted) setIsLoadingUniverse(false);
            }
        };

        void loadConstituents();
        return () => {
            mounted = false;
            controller.abort();
        };
    }, [constituentMap, universe]);

    const activeRows = useMemo(() => (tab === 'gainers' ? gainers : losers), [gainers, losers, tab]);
    const constituentSet = useMemo(
        () => new Set((universe === 'all' ? [] : constituentMap[universe] ?? []).map((item) => item.toUpperCase())),
        [constituentMap, universe]
    );
    const filteredRows = useMemo(() => {
        if (universe === 'all') return activeRows;
        return activeRows.filter((row) => constituentSet.has(row.symbol.toUpperCase()));
    }, [activeRows, constituentSet, universe]);
    const heatRows = useMemo(() => filteredRows.slice(0, 80), [filteredRows]);

    const updatedTimeLabel = useMemo(() => {
        const timestamp = Date.parse(updatedAt ?? '');
        if (!Number.isFinite(timestamp)) return 'n/a';
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, [updatedAt]);

    const activeUniverseLabel = UNIVERSE_OPTIONS.find((item) => item.key === universe)?.label ?? 'All US';

    return (
        <section className="space-y-3">
            <div className="terminal-banner">
                <div>
                    <p className="terminal-banner-kicker">Terminal Movers</p>
                    <p className="text-sm terminal-muted">
                        Track top gainers and losers with a terminal-native table and heatmap, then filter by benchmark universe.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="terminal-series-chip">{tab === 'gainers' ? 'Top gainers' : 'Top losers'}</span>
                    <span className="terminal-series-chip">{view === 'heatmap' ? 'Heatmap view' : 'Table view'}</span>
                    <span className="terminal-series-chip">{activeUniverseLabel}</span>
                </div>
            </div>

            <article className="terminal-widget overflow-hidden">
                <header className="terminal-widget-head">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => updateQuery({ tab: 'gainers' })}
                            className={cn('terminal-mini-btn', tab === 'gainers' && 'terminal-mini-btn-active')}
                        >
                            Top Gainers
                        </button>
                        <button
                            type="button"
                            onClick={() => updateQuery({ tab: 'losers' })}
                            className={cn('terminal-mini-btn', tab === 'losers' && 'terminal-mini-btn-active')}
                        >
                            Top Losers
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                            type="button"
                            onClick={() => updateQuery({ view: 'table' })}
                            className={cn('terminal-mini-btn', view === 'table' && 'terminal-mini-btn-active')}
                        >
                            Table View
                        </button>
                        <button
                            type="button"
                            onClick={() => updateQuery({ view: 'heatmap' })}
                            className={cn('terminal-mini-btn', view === 'heatmap' && 'terminal-mini-btn-active')}
                        >
                            Heatmap View
                        </button>
                        <span className="terminal-muted">{isRefreshing ? 'Refreshing...' : `Updated ${updatedTimeLabel}`}</span>
                    </div>
                </header>

                <div className="border-b border-[var(--terminal-border)] px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {UNIVERSE_OPTIONS.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => updateQuery({ universe: option.key })}
                                    className={cn('terminal-mini-btn', universe === option.key && 'terminal-mini-btn-active')}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <span className="text-xs terminal-muted">
                            {isLoadingUniverse ? `Loading ${activeUniverseLabel} constituents...` : `${filteredRows.length} movers in ${activeUniverseLabel}`}
                        </span>
                    </div>
                </div>

                {errorMessage ? (
                    <div className="border-b border-[var(--terminal-border)] px-4 py-2 text-sm text-amber-300">{errorMessage}</div>
                ) : null}

                {view === 'table' ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)]">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Ticker</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Name</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Price</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Change</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Change %</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Volume</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Avg Vol (3M)</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Market Cap</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">P/E</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.slice(0, 120).map((row) => (
                                    <tr key={row.symbol} className="border-b border-[var(--terminal-border)] transition hover:bg-[var(--terminal-panel-soft)]">
                                        <td className="px-4 py-3 text-sm font-semibold">
                                            <Link
                                                href={buildTerminalChartHref(row.symbol, row.name)}
                                                className="terminal-ticker-link"
                                                aria-label={`Open ${row.symbol} terminal chart`}
                                            >
                                                {row.symbol}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm terminal-muted">{row.name}</td>
                                        <td className="px-4 py-3 text-right text-sm font-medium">{formatPrice(row.price)}</td>
                                        <td className={cn('px-4 py-3 text-right text-sm font-medium', colorClass(row.change))}>{formatChange(row.change)}</td>
                                        <td className={cn('px-4 py-3 text-right text-sm font-medium', colorClass(row.changePercent))}>
                                            {formatPercent(row.changePercent)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm terminal-muted">{formatCompact(row.volume)}</td>
                                        <td className="px-4 py-3 text-right text-sm terminal-muted">{formatCompact(row.avgVolume3m)}</td>
                                        <td className="px-4 py-3 text-right text-sm terminal-muted">{formatCompact(row.marketCap)}</td>
                                        <td className="px-4 py-3 text-right text-sm terminal-muted">
                                            {typeof row.peRatio === 'number' ? row.peRatio.toFixed(2) : '--'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!filteredRows.length ? (
                            <div className="px-4 py-10 text-center text-sm terminal-muted">
                                {isLoadingUniverse ? 'Loading benchmark membership...' : `No ${tab} found for ${activeUniverseLabel} right now.`}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm terminal-muted">
                                Market-cap weighted heatmap for {tab === 'gainers' ? 'gainers' : 'losers'} in {activeUniverseLabel}.
                            </p>
                            <div className="flex items-center gap-1 text-xs">
                                <span className="rounded border border-[var(--terminal-border)] bg-[color-mix(in_srgb,var(--terminal-down)_24%,var(--terminal-panel-soft))] px-2 py-1">
                                    &lt;= -3%
                                </span>
                                <span className="rounded border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-2 py-1">0%</span>
                                <span className="rounded border border-[var(--terminal-border)] bg-[color-mix(in_srgb,var(--terminal-up)_24%,var(--terminal-panel-soft))] px-2 py-1">
                                    &gt;= +3%
                                </span>
                            </div>
                        </div>

                        {heatRows.length ? (
                            <div className="grid auto-rows-[88px] grid-cols-2 gap-2 md:grid-cols-6 xl:grid-cols-10">
                                {heatRows.map((row, index) => (
                                    <Link
                                        key={row.symbol}
                                        href={buildTerminalChartHref(row.symbol, row.name)}
                                        className={cn('rounded-md border p-2', tileSpanClass(index, row.marketCap))}
                                        style={heatStyle(row.changePercent)}
                                        aria-label={`Open ${row.symbol} terminal chart`}
                                    >
                                        <p className="text-sm font-semibold">{row.symbol}</p>
                                        <p className="truncate text-xs terminal-muted">{row.name}</p>
                                        <p className={cn('mt-1 text-sm font-semibold', colorClass(row.changePercent))}>
                                            {formatPercent(row.changePercent)}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-10 text-center text-sm terminal-muted">
                                {isLoadingUniverse ? 'Loading benchmark membership...' : `No ${tab} available for ${activeUniverseLabel}.`}
                            </div>
                        )}
                    </div>
                )}
            </article>
        </section>
    );
};

export default TerminalMoversPageClient;
