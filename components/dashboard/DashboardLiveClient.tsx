'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import IndicesStrip from '@/components/dashboard/IndicesStrip';
import MarketList from '@/components/dashboard/MarketList';
import MarketOverviewCard from '@/components/dashboard/MarketOverviewCard';
import MarketNews from '@/components/dashboard/MarketNews';
import TopMovers from '@/components/dashboard/TopMovers';
import type { MarketMover } from '@/lib/market/movers';
import { GLOBAL_MARKET_INDEXES } from '@/lib/market/global-indices';
import type { MarketQuote } from '@/lib/market/providers';

type Props = {
    stocks: StockWithWatchlistStatus[];
    initialQuotes: Record<string, MarketQuote | null>;
    initialIndexQuotes: Record<string, MarketQuote | null>;
    initialGainers: MarketMover[];
    initialLosers: MarketMover[];
};

type QuotesApiResponse = {
    quotes?: Array<{
        symbol: string;
        price: number;
        change: number;
        changePercent: number;
    }>;
};

type MoversApiResponse = {
    gainers?: MarketMover[];
    losers?: MarketMover[];
};

type IndicesApiResponse = {
    quotes?: Array<{
        symbol: string;
        price: number;
        change: number;
        changePercent: number;
    }>;
};

const REFRESH_INTERVAL_MS = 60000;

const toMarketQuoteMap = (data: QuotesApiResponse): Record<string, MarketQuote | null> => {
    const quoteEntries =
        data.quotes?.map((item) => [
            item.symbol.toUpperCase(),
            {
                c: item.price,
                d: item.change,
                dp: item.changePercent,
            } satisfies MarketQuote,
        ]) ?? [];
    return Object.fromEntries(quoteEntries);
};

const DashboardLiveClient = ({ stocks, initialQuotes, initialIndexQuotes, initialGainers, initialLosers }: Props) => {
    const [quotes, setQuotes] = useState<Record<string, MarketQuote | null>>(initialQuotes);
    const [indexQuotes, setIndexQuotes] = useState<Record<string, MarketQuote | null>>(initialIndexQuotes);
    const [gainers, setGainers] = useState<MarketMover[]>(initialGainers);
    const [losers, setLosers] = useState<MarketMover[]>(initialLosers);
    const isMounted = useRef(true);

    const symbols = useMemo(() => stocks.map((stock) => stock.symbol.toUpperCase()), [stocks]);
    const indexSymbols = useMemo(() => GLOBAL_MARKET_INDEXES.map((index) => index.symbol.toUpperCase()), []);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (!symbols.length) return;

        let intervalId: ReturnType<typeof setInterval> | null = null;
        let inflightController: AbortController | null = null;

        const refreshQuotes = async () => {
            try {
                inflightController?.abort();
                inflightController = new AbortController();
                const [quotesResponse, moversResponse, indicesResponse] = await Promise.all([
                    fetch(`/api/quotes?symbols=${symbols.join(',')}`, {
                        signal: inflightController.signal,
                        cache: 'no-store',
                    }),
                    fetch('/api/market/movers?count=50', {
                        signal: inflightController.signal,
                        cache: 'no-store',
                    }),
                    fetch(`/api/market/indices?symbols=${encodeURIComponent(indexSymbols.join(','))}`, {
                        signal: inflightController.signal,
                        cache: 'no-store',
                    }),
                ]);

                if (!isMounted.current) return;

                if (quotesResponse.ok) {
                    const payload = (await quotesResponse.json()) as QuotesApiResponse;
                    const merged = toMarketQuoteMap(payload);

                    const nextStockQuotes = symbols.reduce<Record<string, MarketQuote | null>>((acc, symbol) => {
                        acc[symbol] = merged[symbol] ?? null;
                        return acc;
                    }, {});

                    setQuotes(nextStockQuotes);
                }

                if (moversResponse.ok) {
                    const moversPayload = (await moversResponse.json()) as MoversApiResponse;
                    if (Array.isArray(moversPayload.gainers) && moversPayload.gainers.length) {
                        setGainers(moversPayload.gainers);
                    }
                    if (Array.isArray(moversPayload.losers) && moversPayload.losers.length) {
                        setLosers(moversPayload.losers);
                    }
                }

                if (indicesResponse.ok) {
                    const payload = (await indicesResponse.json()) as IndicesApiResponse;
                    const merged = toMarketQuoteMap(payload);

                    const nextIndexQuotes = indexSymbols.reduce<Record<string, MarketQuote | null>>((acc, symbol) => {
                        acc[symbol] = merged[symbol] ?? null;
                        return acc;
                    }, {});

                    setIndexQuotes(nextIndexQuotes);
                }
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    console.error('Dashboard quote refresh failed:', error);
                }
            }
        };

        refreshQuotes();
        intervalId = setInterval(refreshQuotes, REFRESH_INTERVAL_MS);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void refreshQuotes();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            if (intervalId) clearInterval(intervalId);
            inflightController?.abort();
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [symbols, indexSymbols]);

    const topGainers = gainers.slice(0, 5).map((item) => ({
        symbol: item.symbol,
        name: item.name,
        price: item.price,
        changePercent: item.changePercent,
    }));

    const topLosers = losers.slice(0, 5).map((item) => ({
        symbol: item.symbol,
        name: item.name,
        price: item.price,
        changePercent: item.changePercent,
    }));

    return (
        <div className="bento-page">
            <section className="bento-card px-5 py-4 md:px-6">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Market Desk</p>
                <h1 className="mt-1 text-3xl font-semibold text-slate-100">Overview</h1>
                <p className="mt-1 text-sm text-slate-400">Bento-aligned live snapshot of indices, movers, and headlines.</p>
            </section>

            <IndicesStrip quotes={indexQuotes} />

            <div className="bento-grid items-start">
                <section className="space-y-5 xl:col-span-4">
                    <MarketOverviewCard />
                    <MarketList stocks={stocks} quotes={quotes} />
                </section>

                <section className="space-y-5 xl:col-span-8">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <TopMovers title="Top Gainers" movers={topGainers} viewAllHref="/markets/movers?tab=gainers" />
                        <TopMovers title="Top Losers" movers={topLosers} viewAllHref="/markets/movers?tab=losers" />
                    </div>
                    <MarketNews />
                </section>
            </div>
        </div>
    );
};

export default DashboardLiveClient;
