'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Filter } from 'lucide-react';

type IndexConstituent = {
    symbol: string;
    name: string;
    sector: string;
    industry: string;
};

type IndexConstituentsResponse = {
    updatedAt: string;
    symbol: string;
    name: string;
    sectors: string[];
    constituents: IndexConstituent[];
};

const DEFAULT_SYMBOL = '^GSPC';

const buildChartHref = (symbol: string, label: string) =>
    `/terminal/chart?symbol=${encodeURIComponent(symbol)}&label=${encodeURIComponent(label)}`;

const buildCompanyChartHref = (symbol: string, label: string) =>
    `/terminal/chart?symbol=${encodeURIComponent(symbol)}&label=${encodeURIComponent(label)}`;

const TerminalIndexConstituentsPageClient = () => {
    const searchParams = useSearchParams();
    const symbol = (searchParams.get('symbol') ?? DEFAULT_SYMBOL).trim().toUpperCase();
    const label = searchParams.get('label')?.trim() || symbol;

    const [payload, setPayload] = useState<IndexConstituentsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sectorFilter, setSectorFilter] = useState('All');
    const [query, setQuery] = useState('');

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const load = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/market/index-constituents?symbol=${encodeURIComponent(symbol)}`, {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const data = (await response.json()) as IndexConstituentsResponse;
                if (!isMounted) return;
                setPayload(data);
            } catch (fetchError) {
                if (!isMounted || controller.signal.aborted) return;
                setError(fetchError instanceof Error ? fetchError.message : 'Failed to load index constituents');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        void load();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [symbol]);

    const filteredConstituents = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return (payload?.constituents ?? []).filter((item) => {
            const matchesSector = sectorFilter === 'All' || item.sector === sectorFilter;
            const matchesQuery =
                !normalizedQuery ||
                item.symbol.toLowerCase().includes(normalizedQuery) ||
                item.name.toLowerCase().includes(normalizedQuery) ||
                item.industry.toLowerCase().includes(normalizedQuery);

            return matchesSector && matchesQuery;
        });
    }, [payload?.constituents, query, sectorFilter]);

    return (
        <section className="space-y-3">
            <div className="terminal-banner">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link href={buildChartHref(symbol, label)} prefetch={false} className="terminal-mini-btn">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Link>
                        <p className="terminal-banner-kicker">Index Constituents</p>
                    </div>
                    <p className="text-xl font-semibold">{payload?.name ?? label}</p>
                    <p className="text-sm terminal-muted">
                        {symbol} {payload?.updatedAt ? `| Updated ${new Date(payload.updatedAt).toLocaleTimeString()}` : ''}
                    </p>
                </div>
                <div className="text-sm terminal-muted">
                    {filteredConstituents.length} of {payload?.constituents.length ?? 0} companies
                </div>
            </div>

            <article className="terminal-widget" style={{ height: 'max(72vh, 620px)' }}>
                <header className="terminal-widget-head">
                    <p className="text-sm font-semibold">Constituent Explorer</p>
                    <span className="text-xs terminal-muted">Filter by sector or search for a company</span>
                </header>

                <div className="flex flex-wrap items-center gap-3 border-b border-[var(--terminal-border)] px-4 py-3">
                    <div className="min-w-[260px] flex-1">
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search symbol, company, or industry"
                            className="w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 py-2 text-sm text-[var(--terminal-text)] outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 terminal-muted" />
                        <select
                            value={sectorFilter}
                            onChange={(event) => setSectorFilter(event.target.value)}
                            className="rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 py-2 text-sm text-[var(--terminal-text)] outline-none"
                        >
                            <option value="All">All sectors</option>
                            {(payload?.sectors ?? []).map((sector) => (
                                <option key={sector} value={sector}>
                                    {sector}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center text-sm terminal-muted">Loading constituents...</div>
                    ) : error ? (
                        <div className="flex h-full items-center justify-center text-sm terminal-down">{error}</div>
                    ) : filteredConstituents.length ? (
                        <div className="min-w-[940px]">
                            <div className="grid grid-cols-[120px_minmax(260px,1.5fr)_minmax(220px,1fr)_minmax(260px,1fr)] gap-3 border-b border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">
                                <span>Symbol</span>
                                <span>Company</span>
                                <span>Sector</span>
                                <span>Industry</span>
                            </div>
                            {filteredConstituents.map((item) => (
                                <div
                                    key={`${item.symbol}-${item.name}`}
                                    className="grid grid-cols-[120px_minmax(260px,1.5fr)_minmax(220px,1fr)_minmax(260px,1fr)] gap-3 border-b border-[var(--terminal-border)] px-4 py-3 text-sm last:border-b-0"
                                >
                                    <Link
                                        href={buildCompanyChartHref(item.symbol, item.name)}
                                        className="font-semibold text-[var(--terminal-accent)] hover:underline"
                                    >
                                        {item.symbol}
                                    </Link>
                                    <span className="truncate">{item.name}</span>
                                    <span className="terminal-muted">{item.sector}</span>
                                    <span className="truncate terminal-muted">{item.industry}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm terminal-muted">
                            No companies match the current filters.
                        </div>
                    )}
                </div>
            </article>
        </section>
    );
};

export default TerminalIndexConstituentsPageClient;
