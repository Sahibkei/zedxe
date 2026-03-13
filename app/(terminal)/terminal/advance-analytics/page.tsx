import TerminalAdvanceAnalyticsClient from '@/components/terminal/TerminalAdvanceAnalyticsClient';
import { getNews } from '@/lib/actions/finnhub.actions';
import { getStockProfileV2 } from '@/lib/stocks/getStockProfileV2';

type SearchParamsRecord = Record<string, string | string[] | undefined>;

type PageProps = {
    searchParams?: Promise<SearchParamsRecord | undefined>;
};

const DEFAULT_SYMBOL = 'NVDA';

const getSearchParam = (searchParams: SearchParamsRecord | undefined, key: string) => {
    const value = searchParams?.[key];
    return Array.isArray(value) ? value[0] : value;
};

const normalizeSymbol = (value?: string | null) => {
    const trimmed = value?.trim().toUpperCase();
    return trimmed || DEFAULT_SYMBOL;
};

const TerminalAdvanceAnalyticsPage = async ({ searchParams }: PageProps) => {
    const resolvedSearchParams = await searchParams;
    const symbol = normalizeSymbol(getSearchParam(resolvedSearchParams, 'symbol'));

    const [profileResult, newsResult] = await Promise.allSettled([getStockProfileV2(symbol), getNews([symbol])]);

    if (profileResult.status !== 'fulfilled') {
        const message =
            profileResult.reason instanceof Error
                ? profileResult.reason.message
                : 'Advance Analytics is currently unavailable for this symbol.';

        return (
            <section className="space-y-3">
                <div className="terminal-banner">
                    <div>
                        <p className="terminal-banner-kicker">Advance Analytics</p>
                        <p className="text-sm terminal-muted">Terminal company workspace</p>
                    </div>
                </div>

                <article className="terminal-widget">
                    <header className="terminal-widget-head">
                        <p className="text-sm font-semibold">Unable to load {symbol}</p>
                    </header>
                    <div className="p-5 text-sm terminal-muted">{message}</div>
                </article>
            </section>
        );
    }

    return (
        <TerminalAdvanceAnalyticsClient
            key={profileResult.value.finnhubSymbol}
            profile={profileResult.value}
            newsItems={newsResult.status === 'fulfilled' ? newsResult.value : []}
        />
    );
};

export default TerminalAdvanceAnalyticsPage;
