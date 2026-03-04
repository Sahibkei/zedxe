import { fetchNews } from '@/app/(root)/news/data';
import type { MarketauxArticle } from '@/types/marketaux';

export type TerminalNewsItem = {
    id: string;
    title: string;
    source: string;
    url: string;
    summary: string;
    publishedAt: string | null;
    region: 'world' | 'us' | 'europe' | 'middle-east';
};

const inferRegion = (article: MarketauxArticle): TerminalNewsItem['region'] => {
    const blob = `${article.title ?? ''} ${article.description ?? ''} ${article.snippet ?? ''} ${article.source ?? ''}`.toLowerCase();

    if (/(iran|israel|gaza|lebanon|syria|yemen|saudi|uae|qatar|middle east)/.test(blob)) return 'middle-east';
    if (/(ukraine|russia|europe|eu |france|germany|italy|spain|uk\b|britain|eurozone)/.test(blob)) return 'europe';
    if (/(united states|u\.s\.| us |nasdaq|nyse|washington|federal reserve|fed )/.test(blob)) return 'us';
    return 'world';
};

const sanitizeExternalUrl = (url: string | undefined) => {
    const candidate = (url ?? '').trim();
    if (!candidate) return '#';
    try {
        const parsed = new URL(candidate);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.toString();
        }
    } catch {
        return '#';
    }
    return '#';
};

const normalizeItem = (article: MarketauxArticle, index: number, forcedRegion?: TerminalNewsItem['region']): TerminalNewsItem => {
    const title = (article.title ?? '').trim() || 'Untitled headline';
    const summary = (article.snippet ?? article.description ?? '').trim() || 'No summary available.';
    return {
        id: article.uuid ?? `${title}-${index}`,
        title,
        source: (article.source ?? 'Unknown source').trim(),
        url: sanitizeExternalUrl(article.url),
        summary,
        publishedAt: article.published_at ?? null,
        region: forcedRegion ?? inferRegion(article),
    };
};

export const TERMINAL_FALLBACK_ITEMS: TerminalNewsItem[] = [
    {
        id: 'fallback-world',
        title: 'Global markets hold steady as traders await central bank remarks',
        source: 'Terminal Feed',
        url: '#',
        summary: 'Risk assets remain range-bound with lower volatility heading into policy updates.',
        publishedAt: new Date().toISOString(),
        region: 'world',
    },
    {
        id: 'fallback-us',
        title: 'US futures edge higher in pre-market session',
        source: 'Terminal Feed',
        url: '#',
        summary: 'Broad indices rise modestly with tech and industrials leading early flows.',
        publishedAt: new Date().toISOString(),
        region: 'us',
    },
    {
        id: 'fallback-eu',
        title: 'European equities mixed amid industrial demand concerns',
        source: 'Terminal Feed',
        url: '#',
        summary: 'Investors are watching energy prices and manufacturing indicators closely.',
        publishedAt: new Date().toISOString(),
        region: 'europe',
    },
    {
        id: 'fallback-me',
        title: 'Middle East risk premium remains elevated in shipping corridors',
        source: 'Terminal Feed',
        url: '#',
        summary: 'Security posture around key maritime routes continues to influence freight rates.',
        publishedAt: new Date().toISOString(),
        region: 'middle-east',
    },
];

export const loadTerminalNewsItems = async () => {
    try {
        const [world, us, europe, middleEast] = await Promise.all([
            fetchNews(1, { countries: 'us,gb,de,fr,it,es,in,jp,au,ca' }),
            fetchNews(1, { countries: 'us' }),
            fetchNews(1, { countries: 'gb,de,fr,it,es,nl,se,ch' }),
            fetchNews(1, { countries: 'ae,sa,qa,il,eg,tr' }),
        ]);

        const regionalArticles: Array<{ region: TerminalNewsItem['region']; data: MarketauxArticle[] }> = [
            { region: 'world', data: world.data ?? [] },
            { region: 'us', data: us.data ?? [] },
            { region: 'europe', data: europe.data ?? [] },
            { region: 'middle-east', data: middleEast.data ?? [] },
        ];

        const seen = new Set<string>();
        const items: TerminalNewsItem[] = [];
        for (const panel of regionalArticles) {
            for (const article of panel.data) {
                if (!article?.title) continue;
                const normalized = normalizeItem(article, items.length, panel.region);
                if (normalized.url === '#') continue;
                if (seen.has(normalized.url)) continue;
                seen.add(normalized.url);
                items.push(normalized);
            }
        }

        const cappedItems = items.slice(0, 40);

        if (cappedItems.length) return cappedItems;
    } catch (error) {
        console.error('[loadTerminalNewsItems] Failed to fetch MarketAux feed', error);
    }

    return TERMINAL_FALLBACK_ITEMS;
};
