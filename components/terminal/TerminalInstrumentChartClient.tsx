'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import TerminalAssetMetricsPanel from '@/components/terminal/TerminalAssetMetricsPanel';
import TerminalIndexConstituentsButton from '@/components/terminal/TerminalIndexConstituentsButton';
import TerminalTradingViewAdvancedChart from '@/components/terminal/TerminalTradingViewAdvancedChart';
import type { HistoryPoint } from '@/components/terminal/TerminalTradingChart';
import { cn } from '@/lib/utils';

type HistoryResponse = {
    updatedAt: string;
    source: 'yahoo';
    symbol: string;
    name: string;
    currency: string | null;
    range: string;
    points: HistoryPoint[];
};

const RANGE_OPTIONS = [
    { key: '1D', label: '1D' },
    { key: '1M', label: '1M' },
    { key: '3M', label: '3M' },
    { key: 'YTD', label: 'YTD' },
    { key: '1Y', label: '1Y' },
    { key: '5Y', label: '5Y' },
] as const;

const FALLBACK_SYMBOL = '^GSPC';
const SECTOR_ETFS = new Set(['XLB', 'XLC', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLRE', 'XLU', 'XLV', 'XLY']);
const NASDAQ_SYMBOLS = new Set(['AAPL', 'AMZN', 'GOOGL', 'GOOG', 'META', 'MSFT', 'NVDA', 'TSLA']);
const INDEX_TV_SYMBOLS: Record<string, string> = {
    '^GSPC': 'SP:SPX',
    '^DJI': 'DJ:DJI',
    '^IXIC': 'NASDAQ:IXIC',
    '^NDX': 'NASDAQ:NDX',
    '^RUT': 'TVC:RUT',
    '^VIX': 'TVC:VIX',
    '^STOXX50E': 'TVC:SX5E',
    '^FTSE': 'TVC:UKX',
    '^GDAXI': 'XETR:DAX',
    '^N225': 'TVC:NI225',
    '^HSI': 'HSI:HSI',
    '^NSEI': 'NSE:NIFTY',
    '^BVSP': 'BMFBOVESPA:IBOV',
};

const formatPrice = (value: number, currency: string | null) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency ?? 'USD',
        maximumFractionDigits: 2,
    }).format(value);

const resolveTradingViewSymbol = (symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return 'SP:SPX';
    if (normalized.includes(':')) return normalized;
    if (INDEX_TV_SYMBOLS[normalized]) return INDEX_TV_SYMBOLS[normalized];
    if (SECTOR_ETFS.has(normalized)) return `AMEX:${normalized}`;
    if (NASDAQ_SYMBOLS.has(normalized)) return `NASDAQ:${normalized}`;
    return `NYSE:${normalized}`;
};

const resolveTradingViewInterval = (range: (typeof RANGE_OPTIONS)[number]['key']) => {
    const intervalMap: Record<(typeof RANGE_OPTIONS)[number]['key'], string> = {
        '1D': '5',
        '1M': '60',
        '3M': 'D',
        YTD: 'D',
        '1Y': 'W',
        '5Y': 'M',
    };

    return intervalMap[range];
};

const TerminalInstrumentChartClient = () => {
    const searchParams = useSearchParams();
    const symbol = (searchParams.get('symbol') ?? FALLBACK_SYMBOL).trim().toUpperCase();
    const searchLabel = searchParams.get('label')?.trim() ?? '';

    const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]['key']>('1Y');
    const [payload, setPayload] = useState<HistoryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const tradingViewSymbol = useMemo(() => resolveTradingViewSymbol(symbol), [symbol]);
    const tradingViewInterval = useMemo(() => resolveTradingViewInterval(range), [range]);

    useEffect(() => {
        const shell = document.querySelector<HTMLElement>('.terminal-shell');
        if (!shell) return;

        const applyTheme = () => {
            setTheme(shell.getAttribute('data-terminal-theme') === 'light' ? 'light' : 'dark');
        };

        applyTheme();
        const observer = new MutationObserver(applyTheme);
        observer.observe(shell, { attributes: true, attributeFilter: ['data-terminal-theme'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const load = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(
                    `/api/market/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`,
                    { cache: 'no-store', signal: controller.signal }
                );
                const data = (await response.json()) as HistoryResponse;
                if (!isMounted) return;
                setPayload(data);
            } catch (fetchError) {
                if (!isMounted || controller.signal.aborted) return;
                setError(fetchError instanceof Error ? fetchError.message : 'Failed to load chart history');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        void load();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [range, symbol]);

    const points = useMemo(() => payload?.points ?? [], [payload]);
    const chartPoints = useMemo(
        () =>
            points.filter((point) =>
                [point.o, point.h, point.l, point.c].every((value) => Number.isFinite(value) && value > 0)
            ),
        [points]
    );

    const displayName = searchLabel || payload?.name || symbol;
    const latestPoint = chartPoints[chartPoints.length - 1];
    const previousPoint = chartPoints[chartPoints.length - 2];
    const latestPrice = latestPoint?.c ?? null;
    const change = latestPoint && previousPoint ? latestPoint.c - previousPoint.c : null;
    const changePct =
        latestPoint && previousPoint && previousPoint.c !== 0
            ? ((latestPoint.c - previousPoint.c) / previousPoint.c) * 100
            : null;

    return (
        <section className="space-y-3">
            <div className="terminal-banner">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link href="/terminal/dashboard" prefetch={false} className="terminal-mini-btn">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Link>
                        <p className="terminal-banner-kicker">Instrument Chart</p>
                    </div>
                    <p className="text-xl font-semibold">{displayName}</p>
                    <p className="text-sm terminal-muted">
                        {symbol} {latestPrice !== null ? `| ${formatPrice(latestPrice, payload?.currency ?? 'USD')}` : ''}{' '}
                        {change !== null && changePct !== null ? (
                            <span className={cn(change >= 0 ? 'terminal-up' : 'terminal-down')}>
                                ({change >= 0 ? '+' : ''}
                                {change.toFixed(2)} / {changePct >= 0 ? '+' : ''}
                                {changePct.toFixed(2)}%)
                            </span>
                        ) : null}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <TerminalIndexConstituentsButton symbol={symbol} label={displayName} />
                    <div className="flex items-center gap-1">
                        {RANGE_OPTIONS.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setRange(item.key)}
                                className={cn('terminal-mini-btn', range === item.key && 'terminal-mini-btn-active')}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <span className="terminal-series-chip">TradingView Pro Chart</span>
                    <span className="terminal-series-chip">Indicators enabled</span>
                </div>
            </div>

            <article className="terminal-widget" style={{ height: 'max(72vh, 640px)' }}>
                <header className="terminal-widget-head">
                    <div>
                        <p className="text-sm font-semibold">Price Dashboard</p>
                        <p className="text-xs terminal-muted">Multi-range price view for {displayName}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="terminal-series-chip">{tradingViewSymbol}</span>
                        <span className="terminal-series-chip">
                            {payload?.updatedAt ? `Updated ${new Date(payload.updatedAt).toLocaleTimeString()}` : 'Live chart'}
                        </span>
                    </div>
                </header>
                <div className="min-h-0 flex-1 p-3">
                    <div className="h-full min-h-[560px] overflow-hidden rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)]">
                        <TerminalTradingViewAdvancedChart
                            symbol={tradingViewSymbol}
                            interval={tradingViewInterval}
                            theme={theme}
                            className="h-full w-full"
                        />
                    </div>
                    {error ? <div className="mt-3 text-sm terminal-down">{error}</div> : null}
                    {!isLoading && !error && chartPoints.length < 2 ? (
                        <div className="mt-3 text-sm terminal-muted">Local history is unavailable, but the TradingView chart can still load market data.</div>
                    ) : null}
                </div>
            </article>

            <TerminalAssetMetricsPanel symbol={symbol} theme={theme} />
        </section>
    );
};

export default TerminalInstrumentChartClient;
