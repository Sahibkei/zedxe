'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import WorldVesselMap from '@/app/(root)/news/_components/WorldVesselMap';

type TerminalNewsItem = {
    id: string;
    title: string;
    source: string;
    url: string;
    summary: string;
    publishedAt: string | null;
    region: 'world' | 'us' | 'europe' | 'middle-east';
};

type LiveChannel = {
    key: string;
    label: string;
    embedUrl: string;
};

type GlobalIndex = {
    label: string;
    symbol: string;
    name: string;
    region: string;
};

type Quote = {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    exchange: string | null;
    currency: string | null;
};

type QuoteResponse = {
    updatedAt: string;
    source: 'yahoo';
    quotes: Quote[];
};

type Props = {
    items: TerminalNewsItem[];
    generatedAt: string;
};

const LIVE_NEWS_CHANNELS: LiveChannel[] = [
    { key: 'bloomberg', label: 'Bloomberg', embedUrl: 'https://www.youtube.com/embed/iEpJwprxDdk' },
    { key: 'euronews', label: 'EuroNews', embedUrl: 'https://www.youtube.com/embed/pykpO5kQJ98' },
    { key: 'cnbc', label: 'CNBC', embedUrl: 'https://www.youtube.com/embed/F0la2jccNDg' },
    { key: 'yfinance', label: 'YFinance', embedUrl: 'https://www.youtube.com/embed/KQp-e_XQnDE' },
];

const GLOBAL_MARKET_INDEXES: GlobalIndex[] = [
    { label: 'S&P 500', symbol: '^GSPC', name: 'US Index', region: 'US' },
    { label: 'NASDAQ 100', symbol: '^NDX', name: 'US Index', region: 'US' },
    { label: 'Dow Jones', symbol: '^DJI', name: 'US Index', region: 'US' },
    { label: 'Russell 2000', symbol: '^RUT', name: 'US Index', region: 'US' },
    { label: 'Euro Stoxx 50', symbol: '^STOXX50E', name: 'Europe Index', region: 'Europe' },
    { label: 'FTSE 100', symbol: '^FTSE', name: 'UK Index', region: 'Europe' },
    { label: 'DAX', symbol: '^GDAXI', name: 'Germany Index', region: 'Europe' },
    { label: 'Nikkei 225', symbol: '^N225', name: 'Japan Index', region: 'Asia' },
    { label: 'Hang Seng', symbol: '^HSI', name: 'Hong Kong Index', region: 'Asia' },
    { label: 'Nifty 50', symbol: '^NSEI', name: 'India Index', region: 'Asia' },
    { label: 'Bovespa', symbol: '^BVSP', name: 'Brazil Index', region: 'Americas' },
];

const sectionClass = 'rounded-xl border border-[#273042] bg-[#0b1019]/80 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm';
const topRowPanelClass = 'xl:h-[640px]';
const INDEX_REFRESH_MS = 20_000;
const DEFAULT_FEAR_GREED_SCORE = 46;
const FEAR_GREED_SNAPSHOT_SCORE = (() => {
    const configured = Number.parseInt(process.env.NEXT_PUBLIC_FEAR_GREED_SNAPSHOT ?? `${DEFAULT_FEAR_GREED_SCORE}`, 10);
    if (!Number.isFinite(configured)) return DEFAULT_FEAR_GREED_SCORE;
    return Math.min(100, Math.max(0, configured));
})();

const toFinite = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const formatIndexPrice = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatRelative = (iso: string | null) => {
    if (!iso) return 'n/a';
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) return 'n/a';
    const diffMinutes = Math.max(0, Math.floor((Date.now() - parsed) / 60000));
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
};

const groupLabel = (region: TerminalNewsItem['region']) => {
    if (region === 'us') return 'United States';
    if (region === 'europe') return 'Europe';
    if (region === 'middle-east') return 'Middle East';
    return 'World';
};

const fearGreedLabel = (score: number) => {
    if (score <= 24) return 'Extreme Fear';
    if (score <= 44) return 'Fear';
    if (score <= 55) return 'Neutral';
    if (score <= 74) return 'Greed';
    return 'Extreme Greed';
};

const fearGreedColor = (score: number) => {
    if (score <= 24) return 'text-red-300';
    if (score <= 44) return 'text-orange-300';
    if (score <= 55) return 'text-slate-200';
    if (score <= 74) return 'text-emerald-300';
    return 'text-teal-300';
};

const NewsTerminalClient = ({ items, generatedAt }: Props) => {
    const [selectedChannel, setSelectedChannel] = useState(LIVE_NEWS_CHANNELS[0].key);
    const [indexBySymbol, setIndexBySymbol] = useState<Record<string, Quote>>({});
    const [indexUpdatedAt, setIndexUpdatedAt] = useState<string | null>(null);
    const [indexSource, setIndexSource] = useState<'yahoo' | null>(null);
    const [indexError, setIndexError] = useState<string | null>(null);

    const activeChannel = LIVE_NEWS_CHANNELS.find((channel) => channel.key === selectedChannel) ?? LIVE_NEWS_CHANNELS[0];

    const grouped = useMemo(() => {
        const world = items.filter((item) => item.region === 'world').slice(0, 8);
        const us = items.filter((item) => item.region === 'us').slice(0, 8);
        return { world, us };
    }, [items]);

    useEffect(() => {
        let disposed = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;
        const symbols = GLOBAL_MARKET_INDEXES.map((index) => index.symbol).join(',');

        const loadIndexes = async () => {
            try {
                const response = await fetch(`/api/market/indices?symbols=${encodeURIComponent(symbols)}`, { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const payload = (await response.json()) as QuoteResponse;
                if (disposed) return;

                const bySymbol = payload.quotes.reduce<Record<string, Quote>>((acc, quote) => {
                    if (!quote?.symbol) return acc;
                    acc[quote.symbol] = quote;
                    return acc;
                }, {});

                setIndexBySymbol(bySymbol);
                setIndexUpdatedAt(payload.updatedAt ?? new Date().toISOString());
                setIndexSource(payload.source ?? null);
                setIndexError(null);
            } catch (error) {
                if (disposed) return;
                console.error('Failed to fetch global index quotes', error);
                setIndexError('Live quotes temporarily unavailable.');
            }
        };

        loadIndexes();
        intervalId = setInterval(loadIndexes, INDEX_REFRESH_MS);

        return () => {
            disposed = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    const intelligenceFeed = items.slice(0, 12);
    const generatedAtLabel = new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fearGreedScore = FEAR_GREED_SNAPSHOT_SCORE;
    const fearGreedState = fearGreedLabel(fearGreedScore);

    return (
        <section className="mx-auto w-full max-w-[1820px] px-2 pb-8">
            <div className={`${sectionClass} mb-3 flex items-center justify-between px-4 py-3`}>
                <div className="flex items-center gap-3 text-sm">
                    <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 font-semibold text-emerald-300">NEWS</span>
                    <span className="font-semibold tracking-[0.2em] text-slate-100">TERMINAL</span>
                    <span className="text-emerald-300">LIVE</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">Snapshot {generatedAtLabel}</span>
                    <Link
                        href="/news"
                        className="rounded-md border border-[#2d3748] bg-[#11192a] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-[#4a5568] hover:text-white"
                    >
                        Classic News
                    </Link>
                </div>
            </div>

            <article className={`${sectionClass} mb-3`}>
                <header className="flex items-center justify-between border-b border-[#273042] px-4 py-3">
                    <p className="text-sm font-semibold tracking-[0.14em] text-slate-200">WORLD MAP AND SHIPPING</p>
                    <span className="text-xs text-cyan-300">AISSTREAM</span>
                </header>
                <WorldVesselMap />
            </article>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:items-stretch">
                <article className={`${sectionClass} ${topRowPanelClass} flex flex-col overflow-hidden xl:col-span-5`}>
                    <header className="flex items-center justify-between border-b border-[#273042] px-4 py-3">
                        <p className="text-sm font-semibold tracking-[0.16em] text-slate-200">LIVE NEWS</p>
                        <span className="text-xs text-red-300">LIVE</span>
                    </header>
                    <div className="flex flex-wrap gap-2 border-b border-[#273042] px-4 py-3">
                        {LIVE_NEWS_CHANNELS.map((channel) => (
                            <button
                                key={channel.key}
                                type="button"
                                onClick={() => setSelectedChannel(channel.key)}
                                className={`rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                                    selectedChannel === channel.key
                                        ? 'border-red-400 bg-red-500/20 text-red-200'
                                        : 'border-[#2e3848] bg-[#111827] text-slate-400 hover:text-slate-100'
                                }`}
                            >
                                {channel.label}
                            </button>
                        ))}
                    </div>
                    <div className="aspect-video w-full bg-black xl:relative xl:aspect-auto xl:flex-1 xl:min-h-0">
                        <iframe
                            title={`${activeChannel.label} live stream`}
                            src={activeChannel.embedUrl}
                            className="h-full w-full xl:absolute xl:inset-0"
                            allow="autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                </article>

                <article className={`${sectionClass} ${topRowPanelClass} flex flex-col overflow-hidden xl:col-span-4`}>
                    <header className="flex items-center justify-between border-b border-[#273042] px-4 py-3">
                        <p className="text-sm font-semibold tracking-[0.16em] text-slate-200">LIVE MARKET INDEXES</p>
                        <span className="text-xs text-slate-500">
                            {indexUpdatedAt ? `${formatRelative(indexUpdatedAt)}${indexSource ? ' (live)' : ''}` : 'Loading...'}
                        </span>
                    </header>
                    <div className="scrollbar-hide min-h-0 flex-1 divide-y divide-[#273042] overflow-y-auto">
                        {GLOBAL_MARKET_INDEXES.map((index) => {
                            const quote = indexBySymbol[index.symbol];
                            const price = toFinite(quote?.price);
                            const change = toFinite(quote?.change);
                            const changePercent = toFinite(quote?.changePercent);
                            const tone =
                                typeof changePercent === 'number' && changePercent > 0
                                    ? 'text-emerald-300'
                                    : typeof changePercent === 'number' && changePercent < 0
                                      ? 'text-red-300'
                                      : 'text-slate-300';
                            const sign = typeof change === 'number' && change > 0 ? '+' : '';

                            return (
                                <div key={index.symbol} className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-100">{index.label}</p>
                                        <p className="text-xs text-slate-500">
                                            {index.region} - {quote?.name || index.name}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-slate-100">
                                            {typeof price === 'number' ? formatIndexPrice.format(price) : '--'}
                                        </p>
                                        <p className={`text-xs ${tone}`}>
                                            {typeof change === 'number' && typeof changePercent === 'number'
                                                ? `${sign}${change.toFixed(2)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`
                                                : '--'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {indexError ? (
                        <p className="border-t border-[#273042] px-4 py-2 text-xs text-amber-300">{indexError}</p>
                    ) : null}
                    <div className="border-t border-[#273042] px-4 py-2 text-[11px] text-slate-500">
                        Refreshes every {Math.floor(INDEX_REFRESH_MS / 1000)}s
                    </div>
                </article>

                <article className={`${sectionClass} ${topRowPanelClass} flex flex-col overflow-hidden xl:col-span-3`}>
                    <header className="flex items-center justify-between border-b border-[#273042] px-4 py-3">
                        <p className="text-sm font-semibold tracking-[0.12em] text-slate-200">AI INSIGHTS</p>
                        <span className="rounded-full border border-amber-400/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                            CACHED
                        </span>
                    </header>
                    <div className="scrollbar-hide min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                        {intelligenceFeed.slice(0, 3).map((item) => (
                            <a
                                key={item.id}
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg border border-[#2d3748] bg-[#101827] p-3 transition hover:border-cyan-400/40"
                            >
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">{groupLabel(item.region)}</p>
                                <p className="line-clamp-3 text-sm font-semibold text-slate-100">{item.title}</p>
                                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{item.summary}</p>
                            </a>
                        ))}
                    </div>
                </article>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
                <div className="xl:col-span-8 space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {([
                            ['world', grouped.world],
                            ['us', grouped.us],
                        ] as const).map(([region, regionItems]) => (
                            <article key={region} className={`${sectionClass} flex flex-col`}>
                                <header className="flex items-center justify-between border-b border-[#273042] px-4 py-3">
                                    <p className="text-sm font-semibold tracking-[0.14em] text-slate-200">{groupLabel(region)}</p>
                                    <span className="text-xs text-slate-500">{regionItems.length}</span>
                                </header>
                                <div className="min-h-0 flex-1 divide-y divide-[#273042]">
                                    {regionItems.slice(0, 4).map((item) => (
                                        <a
                                            key={`${region}-${item.id}`}
                                            href={item.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block px-4 py-3 transition hover:bg-[#111a2b]"
                                        >
                                            <p className="line-clamp-2 text-sm font-semibold text-slate-100">{item.title}</p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {item.source} - {formatRelative(item.publishedAt)}
                                            </p>
                                        </a>
                                    ))}
                                </div>
                            </article>
                        ))}

                        <article className={`${sectionClass} md:col-span-2`}>
                            <header className="flex items-center justify-between border-b border-[#273042] px-4 py-3">
                                <p className="text-sm font-semibold tracking-[0.14em] text-slate-200">FEAR AND GREED INDEX</p>
                                <span className={`text-xs font-semibold ${fearGreedColor(fearGreedScore)}`}>{fearGreedState}</span>
                            </header>
                            <div className="p-4">
                                <div className="rounded-xl border border-[#2d3748] bg-[#0f172a] p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs uppercase tracking-wider text-slate-500">Current Read (Snapshot)</p>
                                        <span className="text-xs text-slate-500">CNN: {fearGreedScore}</span>
                                    </div>
                                    <p className="mt-2 text-4xl font-bold text-slate-100">{fearGreedScore}</p>
                                    <p className={`mt-1 text-sm ${fearGreedColor(fearGreedScore)}`}>{fearGreedState}</p>
                                    <div className="mt-4 h-2 rounded bg-[#1f2937]">
                                        <div
                                            className="h-full rounded bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-400"
                                            style={{ width: `${fearGreedScore}%` }}
                                        />
                                    </div>
                                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                                        <span>Extreme Fear</span>
                                        <span>Neutral</span>
                                        <span>Extreme Greed</span>
                                    </div>
                                    <p className="mt-3 text-xs text-slate-500">
                                        Set <code>NEXT_PUBLIC_FEAR_GREED_SNAPSHOT</code> to update this value.
                                    </p>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>

                <aside className="xl:col-span-4 space-y-3">
                    <article className={`${sectionClass} flex max-h-[640px] flex-col overflow-hidden`}>
                        <header className="flex items-center justify-between border-b border-[#273042] px-4 py-3">
                            <p className="text-sm font-semibold tracking-[0.14em] text-slate-200">INTEL FEED</p>
                            <span className="text-xs text-emerald-300">LIVE</span>
                        </header>
                        <div className="scrollbar-hide min-h-0 flex-1 divide-y divide-[#273042] overflow-y-auto">
                            {intelligenceFeed.slice(0, 9).map((item) => (
                                <a
                                    key={`${item.id}-intel`}
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block px-4 py-3 transition hover:bg-[#111a2b]"
                                >
                                    <div className="mb-1 flex items-center justify-between">
                                        <p className="text-[11px] uppercase tracking-wider text-slate-500">{item.source}</p>
                                        <span className="text-xs text-slate-500">{formatRelative(item.publishedAt)}</span>
                                    </div>
                                    <p className="line-clamp-2 text-sm font-semibold text-slate-100">{item.title}</p>
                                </a>
                            ))}
                        </div>
                    </article>
                </aside>
            </div>
        </section>
    );
};

export default NewsTerminalClient;
