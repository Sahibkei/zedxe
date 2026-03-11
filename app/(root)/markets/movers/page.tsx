import MarketMoversPageClient from '@/components/markets/MarketMoversPageClient';
import { getUsTopMovers } from '@/lib/market/movers';

type MoversTab = 'gainers' | 'losers';
type MoversView = 'table' | 'heatmap';
type SearchParamsRecord = Record<string, string | string[] | undefined>;

type PageProps = {
    searchParams?: Promise<SearchParamsRecord | undefined>;
};

const getSearchParam = (searchParams: SearchParamsRecord | undefined, key: string) => {
    const value = searchParams?.[key];
    return Array.isArray(value) ? value[0] : value;
};

const parseTab = (tabParam?: string | null): MoversTab => (tabParam?.toLowerCase() === 'losers' ? 'losers' : 'gainers');

const parseView = (viewParam?: string | null): MoversView => (viewParam?.toLowerCase() === 'heatmap' ? 'heatmap' : 'table');

const MoversPage = async ({ searchParams }: PageProps) => {
    const resolvedSearchParams = await searchParams;
    const tabParam = getSearchParam(resolvedSearchParams, 'tab');
    const viewParam = getSearchParam(resolvedSearchParams, 'view');

    const initialTab = parseTab(tabParam);
    const initialView = parseView(viewParam);

    const movers = await getUsTopMovers({ count: 120 }).catch((error) => {
        console.error('[MoversPage] Failed to load movers', error);
        return {
            updatedAt: new Date().toISOString(),
            source: 'yahoo' as const,
            gainers: [],
            losers: [],
        };
    });

    return (
        <MarketMoversPageClient
            initialTab={initialTab}
            initialView={initialView}
            initialGainers={movers.gainers}
            initialLosers={movers.losers}
            initialUpdatedAt={movers.updatedAt}
        />
    );
};

export default MoversPage;
