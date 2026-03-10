'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
    ArrowUpRight,
    Building2,
    CalendarClock,
    ExternalLink,
    Globe2,
    Newspaper,
} from 'lucide-react';
import TerminalEconomicCalendarWidget from '@/components/terminal/TerminalEconomicCalendarWidget';
import { GLOBAL_MARKET_INDEXES } from '@/lib/market/global-indices';
import { cn } from '@/lib/utils';

export type NewsTabKey = 'topNews' | 'globalMarkets' | 'corporateEvents' | 'economicCalendar';

type MarketNewsItem = {
    headline: string;
    source: string;
    url: string;
    datetime: number;
    category?: string;
};

type MarketNewsResponse = {
    items?: MarketNewsItem[];
};

type IndexQuote = {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    exchange: string | null;
    currency: string | null;
};

type IndicesResponse = {
    updatedAt?: string;
    source?: 'yahoo';
    quotes?: IndexQuote[];
};

type CorporateEventCategory = 'Earnings' | 'M&A' | 'Dividend' | 'Guidance' | 'Leadership' | 'Regulatory';

type CorporateEventItem = {
    id: string;
    category: CorporateEventCategory;
    headline: string;
    source: string;
    url: string;
    timeLabel: string;
    impact: 'High' | 'Medium';
};

const NEWS_REFRESH_MS = 60_000;
const INDEX_REFRESH_MS = 30_000;
const NEWS_LIMIT = 16;
const INDEX_CONSTITUENTS_SYMBOLS = new Set(['^GSPC', '^NDX', '^DJI']);

const TAB_ITEMS: Array<{ key: NewsTabKey; label: string; icon: typeof Newspaper }> = [
    { key: 'topNews', label: 'Top News', icon: Newspaper },
    { key: 'globalMarkets', label: 'Global Markets', icon: Globe2 },
    { key: 'corporateEvents', label: 'Corporate Events', icon: Building2 },
    { key: 'economicCalendar', label: 'Economic Calendar', icon: CalendarClock },
];

const formatRelative = (timestamp: number | string | null | undefined) => {
    if (timestamp === null || timestamp === undefined) return 'n/a';
    const parsed =
        typeof timestamp === 'number'
            ? timestamp < 10_000_000_000
                ? timestamp * 1000
                : timestamp
            : Date.parse(timestamp);
    if (!Number.isFinite(parsed)) return 'n/a';
    const diffMinutes = Math.max(0, Math.floor((Date.now() - parsed) / 60000));
    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
};

const formatIndexPrice = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const toTone = (value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'text-[var(--terminal-muted)]';
    if (value > 0) return 'text-emerald-300';
    if (value < 0) return 'text-rose-300';
    return 'text-[var(--terminal-text)]';
};

const buildTerminalChartHref = (symbol: string, label: string) =>
    `/terminal/chart?symbol=${encodeURIComponent(symbol)}&label=${encodeURIComponent(label)}`;

const scoreGlobalImpact = (item: MarketNewsItem) => {
    const headline = item.headline.toLowerCase();
    const hoursAgo = Math.max(0, (Date.now() - item.datetime * 1000) / 3_600_000);
    const impactPatterns: RegExp[] = [
        /\bfed\b|\bfomc\b|ecb|boj|boe|central bank/,
        /inflation|cpi|ppi|jobs|payrolls|gdp|recession|rates?/,
        /war|attack|missile|sanction|tariff|ceasefire|oil|crude|opec/,
        /china|europe|eurozone|united states|u\.s\.|japan|iran|russia/,
        /treasury|bond|yield|currency|dollar|yen|euro/,
    ];
    const patternScore = impactPatterns.reduce((score, pattern) => score + (pattern.test(headline) ? 3 : 0), 0);
    const sourceScore = /reuters|bloomberg|financial times|wall street journal|cnbc/i.test(item.source) ? 2 : 1;
    const recencyScore = Math.max(0, 6 - Math.min(hoursAgo, 6));
    return patternScore + sourceScore + recencyScore;
};

const classifyCorporateEvent = (item: MarketNewsItem): CorporateEventItem | null => {
    const headline = item.headline;
    const lower = headline.toLowerCase();

    const rules: Array<{ category: CorporateEventCategory; impact: 'High' | 'Medium'; match: RegExp }> = [
        { category: 'Earnings', impact: 'High', match: /earnings|quarter|results|eps|revenue/ },
        { category: 'M&A', impact: 'High', match: /acquire|acquisition|merger|buyout|deal|takeover/ },
        { category: 'Dividend', impact: 'Medium', match: /dividend|buyback|repurchase|split|spinoff|spin-off/ },
        { category: 'Guidance', impact: 'High', match: /guidance|forecast|outlook|raises|cuts|warns/ },
        { category: 'Leadership', impact: 'Medium', match: /ceo|cfo|chair|executive|board|resign|appoint/ },
        { category: 'Regulatory', impact: 'High', match: /regulator|antitrust|probe|lawsuit|court|approval|fda|sec/ },
    ];

    const matched = rules.find((rule) => rule.match.test(lower));
    if (!matched) return null;

    return {
        id: `${matched.category}-${item.url}`,
        category: matched.category,
        headline: item.headline,
        source: item.source,
        url: item.url,
        timeLabel: formatRelative(item.datetime),
        impact: matched.impact,
    };
};

type Props = {
    activeTab: NewsTabKey;
    onActiveTabChange: (tab: NewsTabKey) => void;
};

const TerminalNewsMarketBoard = ({ activeTab, onActiveTabChange }: Props) => {
    const [newsItems, setNewsItems] = useState<MarketNewsItem[]>([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsError, setNewsError] = useState<string | null>(null);
    const [quoteMap, setQuoteMap] = useState<Record<string, IndexQuote>>({});
    const [quotesUpdatedAt, setQuotesUpdatedAt] = useState<string | null>(null);
    const [quotesLoading, setQuotesLoading] = useState(true);
    const [quotesError, setQuotesError] = useState<string | null>(null);

    useEffect(() => {
        let disposed = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const loadNews = async () => {
            setNewsLoading(true);
            try {
                const response = await fetch(`/api/market/news?count=${NEWS_LIMIT}`, { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = (await response.json()) as MarketNewsResponse;
                if (disposed) return;
                setNewsItems(payload.items ?? []);
                setNewsError(null);
            } catch (error) {
                if (disposed) return;
                console.error('Terminal market board news fetch failed', error);
                setNewsError('Top news is temporarily unavailable.');
            } finally {
                if (!disposed) setNewsLoading(false);
            }
        };

        void loadNews();
        intervalId = setInterval(() => void loadNews(), NEWS_REFRESH_MS);
        return () => {
            disposed = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    useEffect(() => {
        let disposed = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;
        const symbols = GLOBAL_MARKET_INDEXES.map((item) => item.symbol).join(',');

        const loadQuotes = async () => {
            setQuotesLoading(true);
            try {
                const response = await fetch(`/api/market/indices?symbols=${encodeURIComponent(symbols)}`, {
                    cache: 'no-store',
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = (await response.json()) as IndicesResponse;
                if (disposed) return;

                const nextMap = (payload.quotes ?? []).reduce<Record<string, IndexQuote>>((acc, quote) => {
                    acc[quote.symbol] = quote;
                    return acc;
                }, {});

                setQuoteMap(nextMap);
                setQuotesUpdatedAt(payload.updatedAt ?? null);
                setQuotesError(null);
            } catch (error) {
                if (disposed) return;
                console.error('Terminal market board quotes fetch failed', error);
                setQuotesError('Global market quotes are temporarily unavailable.');
            } finally {
                if (!disposed) setQuotesLoading(false);
            }
        };

        void loadQuotes();
        intervalId = setInterval(() => void loadQuotes(), INDEX_REFRESH_MS);
        return () => {
            disposed = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    const topNewsPrimary = useMemo(() => newsItems.slice(0, 6), [newsItems]);
    const topNewsLatest = useMemo(() => newsItems.slice(6, 14), [newsItems]);
    const featuredGlobalNews = useMemo(
        () =>
            [...newsItems]
                .sort((left, right) => scoreGlobalImpact(right) - scoreGlobalImpact(left))
                .at(0) ?? null,
        [newsItems]
    );

    const corporateEvents = useMemo(() => {
        const classified = newsItems.map(classifyCorporateEvent).filter((item): item is CorporateEventItem => item !== null);
        if (classified.length) return classified.slice(0, 10);

        return newsItems.slice(0, 8).map((item) => ({
            id: item.url,
            category: 'Guidance' as const,
            headline: item.headline,
            source: item.source,
            url: item.url,
            timeLabel: formatRelative(item.datetime),
            impact: 'Medium' as const,
        }));
    }, [newsItems]);

    const corporateStats = useMemo(() => {
        return corporateEvents.reduce<Record<CorporateEventCategory, number>>(
            (acc, item) => {
                acc[item.category] += 1;
                return acc;
            },
            {
                Earnings: 0,
                'M&A': 0,
                Dividend: 0,
                Guidance: 0,
                Leadership: 0,
                Regulatory: 0,
            }
        );
    }, [corporateEvents]);

    const globalMarketRows = useMemo(
        () =>
            GLOBAL_MARKET_INDEXES.map((index) => {
                const quote = quoteMap[index.symbol];
                return {
                    ...index,
                    quote,
                };
            }),
        [quoteMap]
    );

    const marketStats = useMemo(() => {
        const moves = globalMarketRows
            .map((row) => row.quote?.changePercent)
            .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        const advancing = moves.filter((value) => value > 0).length;
        const declining = moves.filter((value) => value < 0).length;
        const averageMove = moves.length ? moves.reduce((sum, value) => sum + value, 0) / moves.length : null;
        return { advancing, declining, averageMove, total: moves.length };
    }, [globalMarketRows]);

    const renderTopNews = () => (
        <div className="grid min-h-[560px] gap-3 p-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <section className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)]">
                <div className="flex items-center justify-between border-b border-[var(--terminal-border)] px-4 py-3">
                    <p className="text-sm font-semibold">Trending News</p>
                    <span className="text-xs terminal-muted">
                        {newsLoading ? 'Refreshing...' : `${topNewsPrimary.length} stories`}
                    </span>
                </div>
                <div className="divide-y divide-[var(--terminal-border)]">
                    {(topNewsPrimary.length ? topNewsPrimary : newsItems).map((item) => (
                        <a
                            key={item.url}
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-start justify-between gap-4 px-4 py-3 transition hover:bg-[color-mix(in_srgb,var(--terminal-accent)_7%,var(--terminal-panel-soft))]"
                        >
                            <div className="min-w-0">
                                <p className="line-clamp-2 text-sm font-semibold">{item.headline}</p>
                                <p className="mt-1 text-xs terminal-muted">
                                    {item.source} · {item.category || 'Market'} · {formatRelative(item.datetime)}
                                </p>
                            </div>
                            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[var(--terminal-muted)]" />
                        </a>
                    ))}
                    {!newsLoading && !newsItems.length ? (
                        <div className="px-4 py-6 text-sm terminal-muted">No market headlines available right now.</div>
                    ) : null}
                </div>
            </section>

            <div className="grid gap-3">
                <section className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)]">
                    <div className="flex items-center justify-between border-b border-[var(--terminal-border)] px-4 py-3">
                        <p className="text-sm font-semibold">Latest News</p>
                        <span className="text-xs terminal-muted">Live tape</span>
                    </div>
                    <div className="divide-y divide-[var(--terminal-border)]">
                        {topNewsLatest.map((item) => (
                            <a
                                key={`latest-${item.url}`}
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block px-4 py-3 transition hover:bg-[color-mix(in_srgb,var(--terminal-accent)_7%,var(--terminal-panel-soft))]"
                            >
                                <p className="line-clamp-2 text-sm font-semibold">{item.headline}</p>
                                <p className="mt-1 text-xs terminal-muted">
                                    {item.source} · {formatRelative(item.datetime)}
                                </p>
                            </a>
                        ))}
                    </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] terminal-muted">News Load</p>
                        <p className="mt-2 text-2xl font-semibold">{newsItems.length || '--'}</p>
                        <p className="mt-1 text-xs terminal-muted">Stories in current tape</p>
                    </div>
                    <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] terminal-muted">Sources</p>
                        <p className="mt-2 text-2xl font-semibold">{new Set(newsItems.map((item) => item.source)).size || '--'}</p>
                        <p className="mt-1 text-xs terminal-muted">Unique publishers</p>
                    </div>
                    <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] terminal-muted">Refresh</p>
                        <p className="mt-2 text-2xl font-semibold">60s</p>
                        <p className="mt-1 text-xs terminal-muted">Automatic update cycle</p>
                    </div>
                </section>
            </div>
        </div>
    );

    const renderGlobalMarkets = () => (
        <div className="grid min-h-[560px] gap-3 p-3">
            <section className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
                    <a
                        href={featuredGlobalNews?.url ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                            'group rounded-xl border border-[var(--terminal-border)] bg-[color-mix(in_srgb,var(--terminal-panel)_72%,black)] p-4 transition',
                            featuredGlobalNews
                                ? 'hover:border-[var(--terminal-accent)] hover:bg-[color-mix(in_srgb,var(--terminal-accent)_7%,var(--terminal-panel))]'
                                : 'pointer-events-none'
                        )}
                    >
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--terminal-accent)]">
                            Global Impact
                        </p>
                        <div className="mt-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="line-clamp-3 text-lg font-semibold">
                                    {featuredGlobalNews?.headline ?? 'Waiting for the highest-impact global headline.'}
                                </p>
                                <p className="mt-2 text-sm terminal-muted">
                                    {featuredGlobalNews
                                        ? `${featuredGlobalNews.source} | ${featuredGlobalNews.category || 'Global'} | ${formatRelative(featuredGlobalNews.datetime)}`
                                        : 'Live headlines will populate here as the market news feed refreshes.'}
                                </p>
                                <p className="mt-3 text-xs terminal-muted">
                                    {featuredGlobalNews
                                        ? 'Selected from the live tape using macro, geopolitics, and cross-market impact signals.'
                                        : 'Using the same live market news feed as the rest of the board.'}
                                </p>
                            </div>
                            <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-[var(--terminal-muted)] transition group-hover:text-[var(--terminal-accent)]" />
                        </div>
                    </a>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-[var(--terminal-border)] bg-[color-mix(in_srgb,var(--terminal-panel)_65%,black)] p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] terminal-muted">Advancing</p>
                            <p className="mt-2 text-2xl font-semibold">{marketStats.advancing}</p>
                            <p className="mt-1 text-xs terminal-muted">Indexes printing green</p>
                        </div>
                        <div className="rounded-xl border border-[var(--terminal-border)] bg-[color-mix(in_srgb,var(--terminal-panel)_65%,black)] p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] terminal-muted">Declining</p>
                            <p className="mt-2 text-2xl font-semibold">{marketStats.declining}</p>
                            <p className="mt-1 text-xs terminal-muted">Indexes printing red</p>
                        </div>
                        <div className="rounded-xl border border-[var(--terminal-border)] bg-[color-mix(in_srgb,var(--terminal-panel)_65%,black)] p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] terminal-muted">Average Move</p>
                            <p className={cn('mt-2 text-2xl font-semibold', toTone(marketStats.averageMove))}>
                                {typeof marketStats.averageMove === 'number'
                                    ? `${marketStats.averageMove > 0 ? '+' : ''}${marketStats.averageMove.toFixed(2)}%`
                                    : '--'}
                            </p>
                            <p className="mt-1 text-xs terminal-muted">
                                {quotesUpdatedAt ? `Updated ${formatRelative(quotesUpdatedAt)}` : 'Waiting for quotes'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-[var(--terminal-border)] bg-[color-mix(in_srgb,var(--terminal-panel)_65%,black)] p-4">
                            <p className="text-[11px] uppercase tracking-[0.16em] terminal-muted">Coverage</p>
                            <p className="mt-2 text-2xl font-semibold">{marketStats.total || '--'}</p>
                            <p className="mt-1 text-xs terminal-muted">Tracked global benchmarks</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)]">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--terminal-border)] px-4 py-3">
                    <div>
                        <p className="text-sm font-semibold">Global Indexes</p>
                        <p className="mt-1 text-xs terminal-muted">
                            Open any row for the terminal chart and index detail view.
                        </p>
                    </div>
                    <span className="text-xs terminal-muted">
                        {quotesLoading ? 'Refreshing quotes...' : `${globalMarketRows.length} tracked benchmarks`}
                    </span>
                </div>
                <div className="grid grid-cols-[0.85fr_2fr_1fr_1fr_auto] border-b border-[var(--terminal-border)] px-4 py-3 text-[11px] uppercase tracking-[0.16em] terminal-muted">
                    <span>Ticker</span>
                    <span>Market</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Move</span>
                    <span className="text-right">Profile</span>
                </div>
                <div className="divide-y divide-[var(--terminal-border)]">
                    {globalMarketRows.map((row) => (
                        <Link
                            key={row.symbol}
                            href={buildTerminalChartHref(row.symbol, row.label)}
                            className="grid grid-cols-[0.85fr_2fr_1fr_1fr_auto] items-center gap-3 px-4 py-3 transition hover:bg-[color-mix(in_srgb,var(--terminal-accent)_7%,var(--terminal-panel-soft))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--terminal-accent)]"
                            aria-label={`Open ${row.label} index profile`}
                        >
                            <div>
                                <p className="text-sm font-semibold">{row.ticker}</p>
                                <p className="text-xs terminal-muted">{row.region}</p>
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{row.label}</p>
                                <p className="truncate text-xs terminal-muted">
                                    {row.quote?.name ?? row.name}
                                    {INDEX_CONSTITUENTS_SYMBOLS.has(row.symbol) ? ' | Constituents available' : ''}
                                </p>
                            </div>
                            <p className="text-right text-sm font-semibold">
                                {typeof row.quote?.price === 'number' ? formatIndexPrice.format(row.quote.price) : '--'}
                            </p>
                            <div className="text-right">
                                <p className={cn('text-sm font-semibold', toTone(row.quote?.changePercent))}>
                                    {typeof row.quote?.changePercent === 'number'
                                        ? `${row.quote.changePercent > 0 ? '+' : ''}${row.quote.changePercent.toFixed(2)}%`
                                        : '--'}
                                </p>
                                <p className={cn('text-xs', toTone(row.quote?.change))}>
                                    {typeof row.quote?.change === 'number'
                                        ? `${row.quote.change > 0 ? '+' : ''}${row.quote.change.toFixed(2)}`
                                        : '--'}
                                </p>
                            </div>
                            <span className="justify-self-end rounded-full border border-[var(--terminal-border)] px-2 py-1 text-[11px] font-semibold text-[var(--terminal-accent)]">
                                Open
                            </span>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );

    const renderCorporateEvents = () => (
        <div className="grid min-h-[560px] gap-3 p-3">
            <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {(Object.entries(corporateStats) as Array<[CorporateEventCategory, number]>).map(([label, count]) => (
                    <div key={label} className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] terminal-muted">{label}</p>
                        <p className="mt-2 text-2xl font-semibold">{count}</p>
                        <p className="mt-1 text-xs terminal-muted">Detected headline events</p>
                    </div>
                ))}
            </section>

            <section className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)]">
                <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-[var(--terminal-border)] px-4 py-3 text-[11px] uppercase tracking-[0.16em] terminal-muted">
                    <span>Type</span>
                    <span>Headline</span>
                    <span>Impact</span>
                    <span>When</span>
                </div>
                <div className="divide-y divide-[var(--terminal-border)]">
                    {corporateEvents.map((event) => (
                        <a
                            key={event.id}
                            href={event.url}
                            target="_blank"
                            rel="noreferrer"
                            className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 transition hover:bg-[color-mix(in_srgb,var(--terminal-accent)_7%,var(--terminal-panel-soft))]"
                        >
                            <span className="rounded-md border border-[var(--terminal-border-strong)] px-2 py-1 text-[11px] font-semibold">
                                {event.category}
                            </span>
                            <div className="min-w-0">
                                <p className="line-clamp-2 text-sm font-semibold">{event.headline}</p>
                                <p className="mt-1 text-xs terminal-muted">{event.source}</p>
                            </div>
                            <span
                                className={cn(
                                    'rounded-full px-2 py-1 text-[11px] font-semibold',
                                    event.impact === 'High'
                                        ? 'bg-rose-500/15 text-rose-300'
                                        : 'bg-amber-500/15 text-amber-300'
                                )}
                            >
                                {event.impact}
                            </span>
                            <span className="text-xs terminal-muted">{event.timeLabel}</span>
                        </a>
                    ))}
                </div>
            </section>
        </div>
    );

    const renderEconomicCalendar = () => (
        <div className="grid min-h-[560px] gap-3 p-3">
            <section className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold">Macro releases</p>
                        <p className="mt-1 text-xs terminal-muted">
                            High-priority events from the U.S., Europe, U.K., Japan, China, Australia, and Canada.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="terminal-series-chip">Terminal filter</span>
                        <span className="terminal-series-chip">Live embed</span>
                    </div>
                </div>
            </section>
            <section className="min-h-[640px] rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-2">
                <TerminalEconomicCalendarWidget />
            </section>
        </div>
    );

    return (
        <article className="terminal-widget overflow-hidden">
            <header className="terminal-widget-head">
                <div>
                    <p className="text-sm font-semibold">Market News Board</p>
                    <p className="mt-1 text-xs terminal-muted">Koyfin-style tabbed tape for headlines, markets, corporate catalysts, and calendar flow.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="terminal-series-chip">{quotesLoading ? 'Loading quotes' : 'Live markets'}</span>
                    <span className="terminal-series-chip">{newsLoading ? 'Loading news' : 'Live news'}</span>
                </div>
            </header>

            <div className="border-b border-[var(--terminal-border)] px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                    {TAB_ITEMS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => onActiveTabChange(tab.key)}
                                className={cn(
                                    'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition',
                                    activeTab === tab.key
                                        ? 'border-[var(--terminal-accent)] bg-[color-mix(in_srgb,var(--terminal-accent)_12%,var(--terminal-panel-soft))] text-[var(--terminal-text)]'
                                        : 'border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] text-[var(--terminal-muted)] hover:border-[var(--terminal-border-strong)] hover:text-[var(--terminal-text)]'
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                    <div className="ml-auto flex items-center gap-2 text-xs terminal-muted">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {quotesUpdatedAt ? `Updated ${formatRelative(quotesUpdatedAt)}` : 'Terminal feed'}
                    </div>
                </div>
            </div>

            {activeTab === 'topNews' ? renderTopNews() : null}
            {activeTab === 'globalMarkets' ? renderGlobalMarkets() : null}
            {activeTab === 'corporateEvents' ? renderCorporateEvents() : null}
            {activeTab === 'economicCalendar' ? renderEconomicCalendar() : null}

            {newsError || quotesError ? (
                <div className="border-t border-[var(--terminal-border)] px-4 py-2 text-xs text-amber-300">
                    {[newsError, quotesError].filter(Boolean).join(' ')}
                </div>
            ) : null}
        </article>
    );
};

export default TerminalNewsMarketBoard;
