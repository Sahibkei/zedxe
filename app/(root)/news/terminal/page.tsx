import NewsTerminalClient from '@/app/(root)/news/_components/NewsTerminalClient';
import { fetchNews } from '@/app/(root)/news/data';
import type { MarketauxArticle } from '@/types/marketaux';

type TerminalNewsItem = {
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

const normalizeItem = (article: MarketauxArticle, index: number): TerminalNewsItem => {
    const title = (article.title ?? '').trim() || 'Untitled headline';
    const summary = (article.snippet ?? article.description ?? '').trim() || 'No summary available.';
    return {
        id: article.uuid ?? `${title}-${index}`,
        title,
        source: (article.source ?? 'Unknown source').trim(),
        url: article.url ?? '#',
        summary,
        publishedAt: article.published_at ?? null,
        region: inferRegion(article),
    };
};

const FALLBACK_ITEMS: TerminalNewsItem[] = [
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

const NewsTerminalPage = async () => {
    let items: TerminalNewsItem[] = [];

    try {
        const [pageOne, pageTwo] = await Promise.all([fetchNews(1), fetchNews(2)]);
        const allArticles = [...(pageOne.data ?? []), ...(pageTwo.data ?? [])];
        items = allArticles
            .filter((article) => article?.title && article?.url)
            .map(normalizeItem)
            .slice(0, 40);
    } catch (error) {
        console.error('[NewsTerminalPage] Failed to fetch MarketAux feed', error);
    }

    if (!items.length) {
        items = FALLBACK_ITEMS;
    }

    return <NewsTerminalClient items={items} generatedAt={new Date().toISOString()} />;
};

export default NewsTerminalPage;
