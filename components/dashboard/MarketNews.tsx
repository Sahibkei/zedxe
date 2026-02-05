'use client';

import { useEffect, useState } from 'react';

export type MarketNewsItem = {
    headline: string;
    source: string;
    url: string;
    datetime: number;
    category?: string;
};

const formatRelativeTime = (unixSeconds: number) => {
    const diff = Math.max(0, Date.now() - unixSeconds * 1000);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

const MarketNews = () => {
    const [items, setItems] = useState<MarketNewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/market/news', { signal: controller.signal });
                if (!res.ok) throw new Error('Failed to load market news');
                const data = (await res.json()) as { items: MarketNewsItem[] };
                setItems(Array.isArray(data.items) ? data.items : []);
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    console.error('Market news fetch failed', error);
                    setItems([]);
                }
            } finally {
                setIsLoading(false);
            }
        };

        void load();
        return () => controller.abort();
    }, []);

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70">
            <div className="flex items-center justify-between border-b border-[#1c2432] px-4 py-3">
                <p className="text-sm font-mono text-slate-400">Market News</p>
                <a className="text-xs font-mono text-slate-500 hover:text-slate-300" href="/news">
                    View All
                </a>
            </div>
            <div className="divide-y divide-[#1c2432]">
                {isLoading ? (
                    <div className="px-4 py-6 text-xs font-mono text-slate-500">Loading market news...</div>
                ) : items.length ? (
                    items.slice(0, 6).map((item) => (
                        <div key={item.url} className="flex items-start justify-between gap-4 px-4 py-4">
                            <div className="space-y-2">
                                <span className="inline-flex rounded-full border border-[#1c2432] px-2 py-0.5 text-[10px] font-mono uppercase text-slate-400">
                                    {item.category || 'Market'}
                                </span>
                                <p className="text-xs text-slate-500">
                                    {item.source} • {formatRelativeTime(item.datetime)}
                                </p>
                                <p className="text-sm text-slate-100">{item.headline}</p>
                            </div>
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-500 transition hover:text-slate-200"
                                aria-label={`Open article: ${item.headline}`}
                            >
                                ↗
                            </a>
                        </div>
                    ))
                ) : (
                    <div className="px-4 py-6 text-xs font-mono text-slate-500">No news available.</div>
                )}
            </div>
        </div>
    );
};

export default MarketNews;
