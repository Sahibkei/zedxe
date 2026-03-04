'use client';

import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { GripVertical, RefreshCw, RotateCcw } from 'lucide-react';

type TerminalQuote = {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
};

type IndicesApiResponse = {
    updatedAt?: string;
    quotes?: Array<{
        symbol: string;
        name: string;
        price: number;
        change: number;
        changePercent: number;
    }>;
};

type QuotesApiResponse = {
    updatedAt?: string;
    quotes?: Array<{
        symbol: string;
        price: number;
        change: number;
        changePercent: number;
    }>;
};

type MoversApiResponse = {
    gainers?: Array<{ symbol: string; name: string; price: number; changePercent: number }>;
    losers?: Array<{ symbol: string; name: string; price: number; changePercent: number }>;
};

type MarketNewsResponse = {
    items?: Array<{
        headline: string;
        source: string;
        url: string;
        datetime: number;
    }>;
};

type PerformanceSeries = {
    symbol: string;
    name: string;
    points: Array<{
        t: number;
        close: number;
    }>;
};

type PerformanceApiResponse = {
    updatedAt?: string;
    range?: string;
    series?: PerformanceSeries[];
};

type WidgetId =
    | 'usMarkets'
    | 'chart'
    | 'globalMarkets'
    | 'usSectors'
    | 'currencies'
    | 'topGainers'
    | 'topLosers'
    | 'commodities'
    | 'watchList'
    | 'news'
    | 'liveStream';

type WidgetLayout = {
    w: number;
    h: number;
};

type ResizeSession = {
    id: WidgetId;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    gridWidth: number;
    gridGap: number;
    gridRows: number;
    gridCols: number;
};

type TableCell = {
    value: string;
    tone?: 'up' | 'down' | 'muted';
};

type TableRow = {
    key: string;
    cells: TableCell[];
    linkHref?: string;
    checkbox?: {
        checked: boolean;
        onToggle: () => void;
        label: string;
    };
};

type ChartDatum = {
    time: number;
    [key: string]: number;
};

const STORAGE_KEY = 'zedxe-terminal-dashboard-layout-v3';
const REFRESH_MS = 30_000;
const CHART_SYMBOL_LIMIT = 6;

const DEFAULT_ORDER: WidgetId[] = [
    'usMarkets',
    'chart',
    'globalMarkets',
    'usSectors',
    'currencies',
    'topGainers',
    'topLosers',
    'commodities',
    'watchList',
    'news',
    'liveStream',
];

const DEFAULT_LAYOUTS: Record<WidgetId, WidgetLayout> = {
    usMarkets: { w: 3, h: 2 },
    chart: { w: 6, h: 4 },
    globalMarkets: { w: 3, h: 2 },
    usSectors: { w: 3, h: 2 },
    currencies: { w: 3, h: 2 },
    topGainers: { w: 3, h: 1 },
    topLosers: { w: 3, h: 1 },
    commodities: { w: 3, h: 1 },
    watchList: { w: 3, h: 1 },
    news: { w: 6, h: 2 },
    liveStream: { w: 6, h: 2 },
};

const WIDGET_TITLES: Record<WidgetId, string> = {
    usMarkets: 'U.S. Equity Markets',
    chart: 'Normalized Performance',
    globalMarkets: 'Global Markets',
    usSectors: 'U.S. Equity Sectors',
    currencies: 'Currencies',
    topGainers: 'Top Gainers',
    topLosers: 'Top Losers',
    commodities: 'Commodities',
    watchList: 'Watch List',
    news: 'News',
    liveStream: 'Live News Stream',
};

const US_INDEXES = [
    { symbol: '^GSPC', label: 'S&P 500' },
    { symbol: '^NDX', label: 'Nasdaq 100' },
    { symbol: '^DJI', label: 'Dow Jones' },
    { symbol: '^RUT', label: 'Russell 2000' },
    { symbol: '^VIX', label: 'CBOE VIX' },
];

const US_SECTORS = [
    { symbol: 'XLE', label: 'Energy' },
    { symbol: 'XLI', label: 'Industrials' },
    { symbol: 'XLK', label: 'Technology' },
    { symbol: 'XLRE', label: 'Real Estate' },
    { symbol: 'XLC', label: 'Communications' },
    { symbol: 'XLF', label: 'Financials' },
    { symbol: 'XLB', label: 'Materials' },
    { symbol: 'XLU', label: 'Utilities' },
    { symbol: 'XLV', label: 'Health Care' },
    { symbol: 'XLP', label: 'Cons. Staples' },
    { symbol: 'XLY', label: 'Cons. Discretionary' },
];

const GLOBAL_MARKETS = [
    { symbol: '^STOXX50E', label: 'Euro Stoxx 50' },
    { symbol: '^FTSE', label: 'FTSE 100' },
    { symbol: '^GDAXI', label: 'DAX' },
    { symbol: '^N225', label: 'Nikkei 225' },
    { symbol: '^HSI', label: 'Hang Seng' },
    { symbol: '^NSEI', label: 'Nifty 50' },
    { symbol: '^BVSP', label: 'Bovespa' },
];

const CURRENCIES = [
    { symbol: 'JPY=X', label: 'Japanese Yen' },
    { symbol: 'GBPUSD=X', label: 'British Pound' },
    { symbol: 'EURUSD=X', label: 'Euro' },
    { symbol: 'BTC-USD', label: 'Bitcoin' },
];

const COMMODITIES = [
    { symbol: 'BZ=F', label: 'Brent Crude' },
    { symbol: 'CL=F', label: 'Crude Oil' },
    { symbol: 'NG=F', label: 'Natural Gas' },
    { symbol: 'GC=F', label: 'Gold' },
];

const WATCHLIST_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META'] as const;

const LIVE_CHANNELS = [
    { key: 'bloomberg', label: 'Bloomberg', embedUrl: 'https://www.youtube.com/embed/iEpJwprxDdk' },
    { key: 'cnbc', label: 'CNBC', embedUrl: 'https://www.youtube.com/embed/F0la2jccNDg' },
    { key: 'euronews', label: 'EuroNews', embedUrl: 'https://www.youtube.com/embed/pykpO5kQJ98' },
];

const CHART_RANGES = [
    { key: '1D', label: '1D' },
    { key: '1M', label: '1M' },
    { key: '3M', label: '3M' },
    { key: 'YTD', label: 'YTD' },
    { key: '1Y', label: '1Y' },
    { key: '5Y', label: '5Y' },
] as const;

const CHART_DEFAULT_SYMBOLS = ['^GSPC', '^NDX', '^DJI'];
const CHART_COLORS = ['#1b84ff', '#7a2fff', '#ff7f32', '#d9a400', '#16a085', '#de4f98'];
const CHECKBOX_TABLE_COLUMNS = '30px minmax(110px, 1.85fr) minmax(74px, 0.95fr) minmax(72px, 0.95fr) minmax(58px, 0.75fr)';
const CHART_TICKER_ALIAS: Record<string, string> = {
    '^GSPC': 'SPX',
    '^NDX': 'NDX',
    '^DJI': 'DJI',
    '^RUT': 'RTY',
    '^VIX': 'VIX',
    '^STOXX50E': 'SX5E',
    '^FTSE': 'FTSE',
    '^GDAXI': 'DAX',
    '^N225': 'N225',
    '^HSI': 'HSI',
    '^NSEI': 'NIFTY',
    '^BVSP': 'IBOV',
    'JPY=X': 'JPY',
    'GBPUSD=X': 'GBPUSD',
    'EURUSD=X': 'EURUSD',
    'BTC-USD': 'BTCUSD',
    'BZ=F': 'BZ',
    'CL=F': 'CL',
    'NG=F': 'NG',
    'GC=F': 'GOLD',
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
const formatSigned = (value: number, digits = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

const formatChartTick = (value: number, range: (typeof CHART_RANGES)[number]['key']) => {
    if (!Number.isFinite(value)) return '--';
    const date = new Date(value);
    if (range === '1D') return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatChartTooltipLabel = (value: number, range: (typeof CHART_RANGES)[number]['key']) => {
    if (!Number.isFinite(value)) return '--';
    const date = new Date(value);
    if (range === '1D') {
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const buildTerminalChartHref = (symbol: string, label: string) =>
    `/terminal/chart?symbol=${encodeURIComponent(symbol)}&label=${encodeURIComponent(label)}`;

const toTableQuoteMap = (payload: IndicesApiResponse | QuotesApiResponse): Record<string, TerminalQuote> =>
    (payload.quotes ?? []).reduce<Record<string, TerminalQuote>>((acc, item) => {
        const key = (item.symbol ?? '').toUpperCase();
        if (!key) return acc;
        acc[key] = {
            symbol: key,
            name: 'name' in item && item.name ? item.name : key,
            price: item.price,
            change: item.change,
            changePercent: item.changePercent,
        };
        return acc;
    }, {});

const TableWidget = ({
    headers,
    rows,
    columns = 'minmax(0, 1.5fr) 86px 84px 56px',
    compact = false,
}: {
    headers: string[];
    rows: TableRow[];
    columns?: string;
    compact?: boolean;
}) => (
    <div className="terminal-table">
        {(() => {
            const hasCheckboxColumn = rows.some((row) => Boolean(row.checkbox));
            const labelColumnIndex = hasCheckboxColumn ? 1 : 0;
            return (
                <>
                    <div className="terminal-table-head" style={{ gridTemplateColumns: columns }}>
                        {headers.map((header, index) => (
                            <span
                                key={`${header}-${index}`}
                                className={cn(
                                    index === labelColumnIndex && 'text-left',
                                    index !== labelColumnIndex && 'text-right',
                                    hasCheckboxColumn && index === 0 && 'text-center'
                                )}
                            >
                                {header}
                            </span>
                        ))}
                    </div>
                    {rows.map((row) => {
                        const rowHasCheckbox = Boolean(row.checkbox);
                        const rowLabelIndex = rowHasCheckbox ? 1 : 0;
                        return (
                            <div key={row.key} className={cn('terminal-table-row', compact && 'terminal-table-row-compact')} style={{ gridTemplateColumns: columns }}>
                                {row.cells.map((cell, cellIndex) => (
                                    <span
                                        key={`${row.key}-${cellIndex}`}
                                        className={cn(
                                            'terminal-table-cell',
                                            cellIndex === rowLabelIndex ? 'terminal-table-cell-left' : 'terminal-table-cell-right',
                                            rowHasCheckbox && cellIndex === 0 && 'terminal-table-cell-check',
                                            cellIndex === rowLabelIndex && 'font-semibold',
                                            cell.tone === 'up' && 'terminal-up',
                                            cell.tone === 'down' && 'terminal-down',
                                            cell.tone === 'muted' && 'terminal-muted'
                                        )}
                                    >
                                        {rowHasCheckbox && cellIndex === 0 ? (
                                            <input
                                                type="checkbox"
                                                checked={row.checkbox?.checked}
                                                onChange={row.checkbox?.onToggle}
                                                aria-label={row.checkbox?.label}
                                                className="terminal-check-input"
                                                onMouseDown={(event) => event.stopPropagation()}
                                                onClick={(event) => event.stopPropagation()}
                                            />
                                        ) : row.linkHref && cellIndex === rowLabelIndex ? (
                                            <Link href={row.linkHref} className="terminal-ticker-link" title={`Open ${cell.value} chart`}>
                                                {cell.value}
                                            </Link>
                                        ) : (
                                            cell.value
                                        )}
                                    </span>
                                ))}
                            </div>
                        );
                    })}
                </>
            );
        })()}
    </div>
);

const buildQuoteCells = (quote: TerminalQuote | undefined, priceDigits = 2, changeDigits = 2, percentDigits = 1) => {
    const isUp = typeof quote?.changePercent === 'number' && quote.changePercent >= 0;
    return [
        { value: typeof quote?.price === 'number' ? quote.price.toFixed(priceDigits) : '--' },
        {
            value: typeof quote?.change === 'number' ? formatSigned(quote.change, changeDigits) : '--',
            tone: typeof quote?.change === 'number' ? (isUp ? 'up' : 'down') : 'muted',
        },
        {
            value:
                typeof quote?.changePercent === 'number'
                    ? `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(percentDigits)}%`
                    : '--',
            tone: typeof quote?.changePercent === 'number' ? (isUp ? 'up' : 'down') : 'muted',
        },
    ] as TableCell[];
};

const TerminalDashboardClient = () => {
    const [layouts, setLayouts] = useState<Record<WidgetId, WidgetLayout>>(DEFAULT_LAYOUTS);
    const [order, setOrder] = useState<WidgetId[]>(DEFAULT_ORDER);
    const [dragging, setDragging] = useState<WidgetId | null>(null);
    const [resizing, setResizing] = useState<WidgetId | null>(null);
    const [gridColumns, setGridColumns] = useState(12);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [usIndexMap, setUsIndexMap] = useState<Record<string, TerminalQuote>>({});
    const [usSectorsMap, setUsSectorsMap] = useState<Record<string, TerminalQuote>>({});
    const [globalMap, setGlobalMap] = useState<Record<string, TerminalQuote>>({});
    const [currencyMap, setCurrencyMap] = useState<Record<string, TerminalQuote>>({});
    const [commodityMap, setCommodityMap] = useState<Record<string, TerminalQuote>>({});
    const [watchMap, setWatchMap] = useState<Record<string, TerminalQuote>>({});
    const [movers, setMovers] = useState<MoversApiResponse>({});
    const [headlines, setHeadlines] = useState<MarketNewsResponse['items']>([]);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);

    const [selectedChannel, setSelectedChannel] = useState(LIVE_CHANNELS[0].key);
    const [chartRangeKey, setChartRangeKey] = useState<(typeof CHART_RANGES)[number]['key']>('1Y');
    const [selectedChartSymbols, setSelectedChartSymbols] = useState<string[]>(CHART_DEFAULT_SYMBOLS);
    const [chartSeries, setChartSeries] = useState<PerformanceSeries[]>([]);
    const [chartUpdatedAt, setChartUpdatedAt] = useState<string | null>(null);
    const [isChartLoading, setIsChartLoading] = useState(false);

    const gridRef = useRef<HTMLDivElement | null>(null);
    const resizeSessionRef = useRef<ResizeSession | null>(null);

    const activeChannel = LIVE_CHANNELS.find((item) => item.key === selectedChannel) ?? LIVE_CHANNELS[0];

    const chartUniverseMap = useMemo(() => {
        const merged = [...US_INDEXES, ...GLOBAL_MARKETS, ...CURRENCIES, ...COMMODITIES];
        return merged.reduce<Record<string, string>>((acc, item) => {
            acc[item.symbol.toUpperCase()] = item.label;
            return acc;
        }, {});
    }, []);

    const selectedChartSymbolSet = useMemo(() => new Set(selectedChartSymbols.map((symbol) => symbol.toUpperCase())), [selectedChartSymbols]);

    const chartColorMap = useMemo(
        () =>
            selectedChartSymbols.reduce<Record<string, string>>((acc, symbol, index) => {
                acc[symbol.toUpperCase()] = CHART_COLORS[index % CHART_COLORS.length];
                return acc;
            }, {}),
        [selectedChartSymbols]
    );

    const normalizedChartData = useMemo(() => {
        const rows = new Map<number, ChartDatum>();
        for (const series of chartSeries) {
            const key = series.symbol.toUpperCase();
            const sorted = [...series.points].sort((a, b) => a.t - b.t);
            const firstPoint = sorted.find((point) => Number.isFinite(point.close));
            const base = firstPoint?.close;
            if (!base || base === 0) continue;
            for (const point of sorted) {
                if (!Number.isFinite(point.t) || !Number.isFinite(point.close)) continue;
                const time = point.t * 1000;
                const normalized = ((point.close - base) / base) * 100;
                const existing = rows.get(time) ?? ({ time } as ChartDatum);
                existing[key] = normalized;
                rows.set(time, existing);
            }
        }
        return Array.from(rows.values()).sort((a, b) => a.time - b.time);
    }, [chartSeries]);

    const plottedSymbols = useMemo(() => {
        const available = new Set(chartSeries.map((series) => series.symbol.toUpperCase()));
        return selectedChartSymbols.map((symbol) => symbol.toUpperCase()).filter((symbol) => available.has(symbol));
    }, [chartSeries, selectedChartSymbols]);

    const chartSideLabels = useMemo(() => {
        return plottedSymbols
            .map((symbol) => {
                for (let index = normalizedChartData.length - 1; index >= 0; index -= 1) {
                    const value = normalizedChartData[index]?.[symbol];
                    if (typeof value === 'number' && Number.isFinite(value)) {
                        return { symbol, value };
                    }
                }
                return null;
            })
            .filter((item): item is { symbol: string; value: number } => Boolean(item));
    }, [normalizedChartData, plottedSymbols]);

    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw) as { order?: WidgetId[]; layouts?: Partial<Record<WidgetId, WidgetLayout>> };
            if (Array.isArray(parsed.order) && parsed.order.length) {
                const normalized = Array.from(new Set(parsed.order)).filter((id): id is WidgetId => DEFAULT_ORDER.includes(id));
                const missing = DEFAULT_ORDER.filter((id) => !normalized.includes(id));
                setOrder([...normalized, ...missing]);
            }
            if (parsed.layouts) {
                setLayouts((prev) => {
                    const next = { ...prev };
                    (Object.keys(DEFAULT_LAYOUTS) as WidgetId[]).forEach((id) => {
                        const saved = parsed.layouts?.[id];
                        if (!saved) return;
                        next[id] = {
                            w: clamp(saved.w ?? prev[id].w, 1, 12),
                            h: clamp(saved.h ?? prev[id].h, 1, 6),
                        };
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error('Failed to parse dashboard layout', error);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, layouts }));
    }, [order, layouts]);

    useEffect(() => {
        const grid = gridRef.current;
        if (!grid) return;

        const applyCols = () => {
            const styles = window.getComputedStyle(grid);
            const cols = styles.gridTemplateColumns.split(' ').filter(Boolean).length;
            if (cols > 0) setGridColumns(cols);
        };

        applyCols();
        const observer = new ResizeObserver(() => applyCols());
        observer.observe(grid);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        setLayouts((prev) => {
            const next = { ...prev };
            (Object.keys(next) as WidgetId[]).forEach((id) => {
                next[id] = {
                    w: clamp(next[id].w, 1, gridColumns),
                    h: clamp(next[id].h, 1, 6),
                };
            });
            return next;
        });
    }, [gridColumns]);

    const fetchIndicesGroup = useCallback(async (symbols: string[]) => {
        const response = await fetch(`/api/market/indices?symbols=${encodeURIComponent(symbols.join(','))}`, { cache: 'no-store' });
        if (!response.ok) return {};
        const payload = (await response.json()) as IndicesApiResponse;
        return toTableQuoteMap(payload);
    }, []);

    const fetchQuotesGroup = useCallback(async (symbols: string[]) => {
        const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`, { cache: 'no-store' });
        if (!response.ok) return {};
        const payload = (await response.json()) as QuotesApiResponse;
        return toTableQuoteMap(payload);
    }, []);

    const refreshData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const [
                usIndices,
                usSectors,
                globalMarkets,
                currencies,
                commodities,
                watchlist,
                moversResponse,
                newsResponse,
            ] = await Promise.all([
                fetchIndicesGroup(US_INDEXES.map((item) => item.symbol)),
                fetchQuotesGroup(US_SECTORS.map((item) => item.symbol)),
                fetchIndicesGroup(GLOBAL_MARKETS.map((item) => item.symbol)),
                fetchIndicesGroup(CURRENCIES.map((item) => item.symbol)),
                fetchIndicesGroup(COMMODITIES.map((item) => item.symbol)),
                fetchQuotesGroup([...WATCHLIST_SYMBOLS]),
                fetch('/api/market/movers?count=40', { cache: 'no-store' }),
                fetch('/api/market/news', { cache: 'no-store' }),
            ]);

            setUsIndexMap(usIndices);
            setUsSectorsMap(usSectors);
            setGlobalMap(globalMarkets);
            setCurrencyMap(currencies);
            setCommodityMap(commodities);
            setWatchMap(watchlist);
            setUpdatedAt(new Date().toISOString());

            if (moversResponse.ok) {
                const moversPayload = (await moversResponse.json()) as MoversApiResponse;
                setMovers(moversPayload);
            }

            if (newsResponse.ok) {
                const newsPayload = (await newsResponse.json()) as MarketNewsResponse;
                setHeadlines(newsPayload.items ?? []);
            }
        } catch (error) {
            console.error('Terminal dashboard refresh failed', error);
        } finally {
            setIsRefreshing(false);
        }
    }, [fetchIndicesGroup, fetchQuotesGroup]);

    const refreshChartData = useCallback(async () => {
        if (!selectedChartSymbols.length) {
            setChartSeries([]);
            return;
        }

        setIsChartLoading(true);
        try {
            const response = await fetch(
                `/api/market/performance?range=${chartRangeKey}&symbols=${encodeURIComponent(selectedChartSymbols.join(','))}`,
                { cache: 'no-store' }
            );

            if (!response.ok) {
                setChartSeries([]);
                return;
            }

            const payload = (await response.json()) as PerformanceApiResponse;
            setChartSeries(payload.series ?? []);
            setChartUpdatedAt(payload.updatedAt ?? new Date().toISOString());
        } catch (error) {
            console.error('Terminal chart refresh failed', error);
            setChartSeries([]);
        } finally {
            setIsChartLoading(false);
        }
    }, [chartRangeKey, selectedChartSymbols]);

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;
        void refreshData();
        intervalId = setInterval(() => void refreshData(), REFRESH_MS);
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [refreshData]);

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;
        void refreshChartData();
        intervalId = setInterval(() => void refreshChartData(), REFRESH_MS);
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [refreshChartData]);

    const refreshAll = useCallback(async () => {
        await Promise.all([refreshData(), refreshChartData()]);
    }, [refreshData, refreshChartData]);

    const toggleChartSymbol = useCallback((symbol: string) => {
        const normalized = symbol.toUpperCase();
        setSelectedChartSymbols((prev) => {
            const current = prev.map((value) => value.toUpperCase());
            const exists = current.includes(normalized);

            if (exists) {
                if (current.length === 1) return prev;
                return prev.filter((value) => value.toUpperCase() !== normalized);
            }

            if (current.length >= CHART_SYMBOL_LIMIT) {
                return [...prev.slice(1), normalized];
            }

            return [...prev, normalized];
        });
    }, []);

    const onDropCard = (targetId: WidgetId) => {
        if (!dragging || dragging === targetId) return;
        setOrder((prev) => {
            const from = prev.indexOf(dragging);
            const to = prev.indexOf(targetId);
            if (from < 0 || to < 0) return prev;
            const next = [...prev];
            next.splice(from, 1);
            next.splice(to, 0, dragging);
            return next;
        });
        setDragging(null);
    };

    const beginResize = (event: ReactMouseEvent<HTMLButtonElement>, id: WidgetId) => {
        event.preventDefault();
        event.stopPropagation();

        const grid = gridRef.current;
        if (!grid) return;

        const styles = window.getComputedStyle(grid);
        const gap = Number.parseFloat(styles.columnGap || '12') || 12;
        const rowHeight = Number.parseFloat(styles.gridAutoRows || '150') || 150;
        const rect = grid.getBoundingClientRect();
        const current = layouts[id];

        resizeSessionRef.current = {
            id,
            startX: event.clientX,
            startY: event.clientY,
            startW: current.w,
            startH: current.h,
            gridWidth: rect.width,
            gridGap: gap,
            gridRows: rowHeight,
            gridCols: gridColumns,
        };
        setResizing(id);
    };

    useEffect(() => {
        if (!resizing) return;

        const onMouseMove = (event: MouseEvent) => {
            const session = resizeSessionRef.current;
            if (!session) return;

            const cellWidth = (session.gridWidth - session.gridGap * (session.gridCols - 1)) / session.gridCols;
            const xDelta = event.clientX - session.startX;
            const yDelta = event.clientY - session.startY;
            const wDelta = Math.round(xDelta / (cellWidth + session.gridGap));
            const hDelta = Math.round(yDelta / (session.gridRows + session.gridGap));

            setLayouts((prev) => ({
                ...prev,
                [session.id]: {
                    w: clamp(session.startW + wDelta, 1, session.gridCols),
                    h: clamp(session.startH + hDelta, 1, 6),
                },
            }));
        };

        const onMouseUp = () => {
            resizeSessionRef.current = null;
            setResizing(null);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [resizing]);

    const resetLayout = () => {
        setOrder(DEFAULT_ORDER);
        setLayouts(DEFAULT_LAYOUTS);
        localStorage.removeItem(STORAGE_KEY);
    };

    const widgetContent: Record<WidgetId, JSX.Element> = {
        usMarkets: (
            <TableWidget
                headers={['', 'Major Indices & ETFs', 'Price', 'Chg', '%']}
                columns={CHECKBOX_TABLE_COLUMNS}
                rows={US_INDEXES.map((item) => {
                    const quote = usIndexMap[item.symbol.toUpperCase()];
                    const quoteCells = buildQuoteCells(quote, 2, 2, 1);
                    return {
                        key: item.symbol,
                        linkHref: buildTerminalChartHref(item.symbol, item.label),
                        checkbox: {
                            checked: selectedChartSymbolSet.has(item.symbol.toUpperCase()),
                            onToggle: () => toggleChartSymbol(item.symbol),
                            label: `Show ${item.label} in chart`,
                        },
                        cells: [{ value: '' }, { value: item.label }, ...quoteCells],
                    } satisfies TableRow;
                })}
            />
        ),
        usSectors: (
            <TableWidget
                headers={['S&P Sector ETFs', 'Price', 'Chg', '%']}
                columns="minmax(0, 1.45fr) 88px 82px 56px"
                rows={US_SECTORS.map((item) => {
                    const quote = usSectorsMap[item.symbol.toUpperCase()];
                    const quoteCells = buildQuoteCells(quote, 2, 2, 1);
                    return {
                        key: item.symbol,
                        cells: [{ value: item.label }, ...quoteCells],
                    } satisfies TableRow;
                })}
            />
        ),
        chart: (
            <div className="flex h-full min-h-0 flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--terminal-border)] px-2.5 py-2">
                    <div className="flex items-center gap-1">
                        {CHART_RANGES.map((range) => (
                            <button
                                key={range.key}
                                type="button"
                                onClick={() => setChartRangeKey(range.key)}
                                className={cn('terminal-mini-btn', chartRangeKey === range.key && 'terminal-mini-btn-active')}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                    <span className="text-xs terminal-muted">{selectedChartSymbols.length} symbols selected</span>
                </div>

                <div className="flex flex-wrap items-center gap-1 border-b border-[var(--terminal-border)] px-2.5 py-1.5">
                    {selectedChartSymbols.map((symbol) => {
                        const key = symbol.toUpperCase();
                        return (
                            <span key={key} className="terminal-series-chip" style={{ borderColor: chartColorMap[key], color: chartColorMap[key] }}>
                                {chartUniverseMap[key] ?? key}
                            </span>
                        );
                    })}
                </div>

                <div className="min-h-0 flex-1 px-1.5 pb-1.5 pt-2">
                    {isChartLoading ? (
                        <div className="flex h-full items-center justify-center text-sm terminal-muted">Loading chart data...</div>
                    ) : normalizedChartData.length > 1 && plottedSymbols.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={normalizedChartData} margin={{ top: 8, right: 84, bottom: 0, left: 0 }}>
                                    <CartesianGrid stroke="var(--terminal-border)" strokeDasharray="3 3" />
                                    <XAxis
                                        type="number"
                                        dataKey="time"
                                        domain={['dataMin', 'dataMax']}
                                        tickFormatter={(value) => formatChartTick(Number(value), chartRangeKey)}
                                        tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }}
                                        stroke="var(--terminal-border-strong)"
                                    />
                                    <YAxis
                                        tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                                        tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }}
                                        stroke="var(--terminal-border-strong)"
                                        width={54}
                                    />
                                    <Tooltip
                                        labelFormatter={(value) => formatChartTooltipLabel(Number(value), chartRangeKey)}
                                        formatter={(value, name) => {
                                            const numeric = Number(value);
                                            const symbol = String(name);
                                            const label = chartUniverseMap[symbol.toUpperCase()] ?? symbol;
                                            return [`${numeric.toFixed(2)}%`, label];
                                        }}
                                        contentStyle={{
                                            background: 'var(--terminal-panel)',
                                            border: '1px solid var(--terminal-border)',
                                            borderRadius: 8,
                                            color: 'var(--terminal-text)',
                                        }}
                                        itemStyle={{ color: 'var(--terminal-text)' }}
                                        labelStyle={{ color: 'var(--terminal-muted)' }}
                                    />
                                    {plottedSymbols.map((symbol) => (
                                        <Line
                                            key={symbol}
                                            type="monotone"
                                            dataKey={symbol}
                                            stroke={chartColorMap[symbol] ?? '#1b84ff'}
                                            strokeWidth={2}
                                            dot={false}
                                            connectNulls
                                            isAnimationActive={false}
                                        />
                                    ))}
                                    {chartSideLabels.map((entry) => {
                                        const alias = CHART_TICKER_ALIAS[entry.symbol] ?? entry.symbol.replace('^', '');
                                        const tone = `${entry.value >= 0 ? '+' : ''}${entry.value.toFixed(2)}%`;
                                        return (
                                            <ReferenceLine
                                                key={`side-${entry.symbol}`}
                                                y={entry.value}
                                                stroke="transparent"
                                                ifOverflow="extendDomain"
                                                label={{
                                                    value: `${alias} ${tone}`,
                                                    position: 'right',
                                                    fill: chartColorMap[entry.symbol] ?? '#1b84ff',
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                }}
                                            />
                                        );
                                    })}
                                </LineChart>
                            </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-center text-sm terminal-muted">
                            Select symbols with the checkboxes in Markets, Global Markets, Currencies, or Commodities.
                        </div>
                    )}
                </div>
            </div>
        ),
        globalMarkets: (
            <TableWidget
                headers={['', 'Broad Markets', 'Price', 'Chg', '%']}
                columns={CHECKBOX_TABLE_COLUMNS}
                rows={GLOBAL_MARKETS.map((item) => {
                    const quote = globalMap[item.symbol.toUpperCase()];
                    const quoteCells = buildQuoteCells(quote, 2, 2, 1);
                    return {
                        key: item.symbol,
                        linkHref: buildTerminalChartHref(item.symbol, item.label),
                        checkbox: {
                            checked: selectedChartSymbolSet.has(item.symbol.toUpperCase()),
                            onToggle: () => toggleChartSymbol(item.symbol),
                            label: `Show ${item.label} in chart`,
                        },
                        cells: [{ value: '' }, { value: item.label }, ...quoteCells],
                    } satisfies TableRow;
                })}
            />
        ),
        currencies: (
            <TableWidget
                headers={['', 'USD FX Crosses', 'Price', 'Chg', '%']}
                columns={CHECKBOX_TABLE_COLUMNS}
                rows={CURRENCIES.map((item) => {
                    const quote = currencyMap[item.symbol.toUpperCase()];
                    const quoteCells = buildQuoteCells(quote, 4, 4, 1);
                    return {
                        key: item.symbol,
                        linkHref: buildTerminalChartHref(item.symbol, item.label),
                        checkbox: {
                            checked: selectedChartSymbolSet.has(item.symbol.toUpperCase()),
                            onToggle: () => toggleChartSymbol(item.symbol),
                            label: `Show ${item.label} in chart`,
                        },
                        cells: [{ value: '' }, { value: item.label }, ...quoteCells],
                    } satisfies TableRow;
                })}
            />
        ),
        topGainers: (
            <TableWidget
                headers={['Top Gainers', 'Price', 'Chg']}
                columns="minmax(0, 1.4fr) 100px 84px"
                compact
                rows={(movers.gainers ?? []).slice(0, 8).map((item) => ({
                    key: item.symbol,
                    cells: [
                        { value: item.symbol },
                        { value: money.format(item.price) },
                        { value: `+${item.changePercent.toFixed(2)}%`, tone: 'up' },
                    ],
                }))}
            />
        ),
        topLosers: (
            <TableWidget
                headers={['Top Losers', 'Price', 'Chg']}
                columns="minmax(0, 1.4fr) 100px 84px"
                compact
                rows={(movers.losers ?? []).slice(0, 8).map((item) => ({
                    key: item.symbol,
                    cells: [
                        { value: item.symbol },
                        { value: money.format(item.price) },
                        { value: `${item.changePercent.toFixed(2)}%`, tone: 'down' },
                    ],
                }))}
            />
        ),
        commodities: (
            <TableWidget
                headers={['', 'Commodities', 'Price', 'Chg', '%']}
                columns={CHECKBOX_TABLE_COLUMNS}
                compact
                rows={COMMODITIES.map((item) => {
                    const quote = commodityMap[item.symbol.toUpperCase()];
                    const quoteCells = buildQuoteCells(quote, 2, 2, 1);
                    return {
                        key: item.symbol,
                        linkHref: buildTerminalChartHref(item.symbol, item.label),
                        checkbox: {
                            checked: selectedChartSymbolSet.has(item.symbol.toUpperCase()),
                            onToggle: () => toggleChartSymbol(item.symbol),
                            label: `Show ${item.label} in chart`,
                        },
                        cells: [{ value: '' }, { value: item.label }, ...quoteCells],
                    } satisfies TableRow;
                })}
            />
        ),
        watchList: (
            <TableWidget
                headers={['Watch List', 'Price', 'Chg']}
                columns="minmax(0, 1.45fr) 100px 84px"
                compact
                rows={WATCHLIST_SYMBOLS.map((symbol) => {
                    const quote = watchMap[symbol];
                    const isUp = typeof quote?.changePercent === 'number' && quote.changePercent >= 0;
                    return {
                        key: symbol,
                        cells: [
                            { value: symbol },
                            { value: typeof quote?.price === 'number' ? money.format(quote.price) : '--' },
                            {
                                value:
                                    typeof quote?.changePercent === 'number'
                                        ? `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%`
                                        : '--',
                                tone: typeof quote?.changePercent === 'number' ? (isUp ? 'up' : 'down') : 'muted',
                            },
                        ],
                    } satisfies TableRow;
                })}
            />
        ),
        news: (
            <div className="terminal-table">
                {headlines.slice(0, 12).map((item) => (
                    <a key={`${item.url}-${item.datetime}`} href={item.url} target="_blank" rel="noreferrer" className="terminal-news-row">
                        <p className="line-clamp-1 text-sm font-semibold">{item.headline}</p>
                        <p className="text-xs terminal-muted">{item.source}</p>
                    </a>
                ))}
            </div>
        ),
        liveStream: (
            <div className="flex h-full min-h-0 flex-col">
                <div className="flex items-center gap-1 border-b border-[var(--terminal-border)] px-2.5 py-2">
                    {LIVE_CHANNELS.map((channel) => (
                        <button
                            key={channel.key}
                            type="button"
                            onClick={() => setSelectedChannel(channel.key)}
                            className={cn('terminal-mini-btn', selectedChannel === channel.key && 'terminal-mini-btn-active')}
                        >
                            {channel.label}
                        </button>
                    ))}
                </div>
                <div className="min-h-0 flex-1 p-2">
                    <iframe
                        title={`${activeChannel.label} live`}
                        src={activeChannel.embedUrl}
                        className="h-full w-full rounded border border-[var(--terminal-border)]"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            </div>
        ),
    };

    return (
        <section className="space-y-3">
            <div className="terminal-banner">
                <div>
                    <p className="terminal-banner-kicker">Terminal Dashboard</p>
                    <p className="terminal-muted text-sm">Select symbols with checkboxes to plot them on the custom chart. Drag, resize, and reset anytime.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => void refreshAll()} className="terminal-mini-btn">
                        <RefreshCw className={cn('h-4 w-4', (isRefreshing || isChartLoading) && 'animate-spin')} />
                        Refresh
                    </button>
                    <button type="button" onClick={resetLayout} className="terminal-mini-btn">
                        <RotateCcw className="h-4 w-4" />
                        Reset Layout
                    </button>
                </div>
            </div>

            <div ref={gridRef} className="terminal-bento-grid">
                {order.map((id) => {
                    const layout = layouts[id];
                    const displayW = clamp(layout.w, 1, gridColumns);
                    return (
                        <article
                            key={id}
                            draggable
                            onDragStart={() => setDragging(id)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => onDropCard(id)}
                            onDragEnd={() => setDragging(null)}
                            className={cn('terminal-widget', dragging === id && 'opacity-70')}
                            style={{ gridColumn: `span ${displayW} / span ${displayW}`, gridRow: `span ${layout.h} / span ${layout.h}` }}
                        >
                            <header className="terminal-widget-head">
                                <p className="text-sm font-semibold">{WIDGET_TITLES[id]}</p>
                                <span className="terminal-drag-icon" title="Drag to reorder">
                                    <GripVertical className="h-3.5 w-3.5" />
                                </span>
                            </header>
                            <div className="min-h-0 flex-1">{widgetContent[id]}</div>
                            <button
                                type="button"
                                onMouseDown={(event) => beginResize(event, id)}
                                className={cn('terminal-resize-handle', resizing === id && 'terminal-resizing')}
                                title="Resize block"
                                aria-label={`Resize ${WIDGET_TITLES[id]} block`}
                            />
                        </article>
                    );
                })}
            </div>

            <p className="text-xs terminal-muted">
                Last market update: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : '--'}
                {' | '}
                Chart update: {chartUpdatedAt ? new Date(chartUpdatedAt).toLocaleTimeString() : '--'}
            </p>
        </section>
    );
};

export default TerminalDashboardClient;
