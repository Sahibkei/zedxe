'use client';

import {
    cloneElement,
    type CSSProperties,
    type JSX,
    type MouseEvent as ReactMouseEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import Link from 'next/link';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { Expand, GripVertical, LayoutGrid, Plus, RefreshCw, RotateCcw, Save, Sparkles, Trash2, X } from 'lucide-react';
import TerminalEconomicCalendarWidget from '@/components/terminal/TerminalEconomicCalendarWidget';
import TerminalMarketHeatmapWidget from '@/components/terminal/TerminalMarketHeatmapWidget';
import TerminalPortfolioSnapshotWidget, {
    type TerminalPortfolioWidgetPayload,
} from '@/components/terminal/TerminalPortfolioSnapshotWidget';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

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

type SavedLayoutSlot = {
    id: string;
    name: string;
    order: WidgetId[];
    layouts: Record<WidgetId, WidgetLayout>;
    savedAt: string;
};

type WidgetId =
    | 'usMarkets'
    | 'chart'
    | 'globalMarkets'
    | 'usSectors'
    | 'heatmap'
    | 'currencies'
    | 'calendar'
    | 'portfolio'
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

type ExpandedTickerItem = {
    key: string;
    symbol: string;
    ticker: string;
    name: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
    href: string;
};

type ChartDatum = {
    time: number;
    [key: string]: number;
};

const STORAGE_KEY = 'zedxe-terminal-dashboard-layout-v4';
const DATA_REFRESH_MS = 180_000;
const CHART_REFRESH_MS = 300_000;
const CHART_SYMBOL_LIMIT = 6;
const LAYOUT_SLOT_IDS = ['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'] as const;

const DEFAULT_ORDER: WidgetId[] = [
    'usMarkets',
    'chart',
    'globalMarkets',
    'usSectors',
    'heatmap',
    'currencies',
    'calendar',
    'portfolio',
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
    heatmap: { w: 6, h: 2 },
    currencies: { w: 3, h: 2 },
    calendar: { w: 4, h: 2 },
    portfolio: { w: 4, h: 2 },
    topGainers: { w: 3, h: 1 },
    topLosers: { w: 3, h: 1 },
    commodities: { w: 4, h: 1 },
    watchList: { w: 4, h: 1 },
    news: { w: 6, h: 2 },
    liveStream: { w: 6, h: 2 },
};

const WIDGET_TITLES: Record<WidgetId, string> = {
    usMarkets: 'U.S. Equity Markets',
    chart: 'Normalized Performance',
    globalMarkets: 'Global Markets',
    usSectors: 'U.S. Equity Sectors',
    heatmap: 'Heatmap',
    currencies: 'Currencies',
    calendar: 'Economic Calendar',
    portfolio: 'Portfolio Holdings',
    topGainers: 'Top Gainers',
    topLosers: 'Top Losers',
    commodities: 'Commodities',
    watchList: 'Watch List',
    news: 'News',
    liveStream: 'Live News Stream',
};

const WIDGET_VIEW_ALL_HREFS: Partial<Record<WidgetId, string>> = {
    topGainers: '/terminal/movers?tab=gainers',
    topLosers: '/terminal/movers?tab=losers',
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
const formatExpandedPrice = (value: number | null) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
    const digits = value >= 1000 ? 2 : value >= 100 ? 2 : value >= 1 ? 2 : 4;
    return value.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

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
        const maybeNamedItem = item as { name?: unknown };
        const name = typeof maybeNamedItem.name === 'string' ? maybeNamedItem.name : key;
        acc[key] = {
            symbol: key,
            name,
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
                                            <Link href={row.linkHref} prefetch={false} className="terminal-ticker-link" title={`Open ${cell.value} chart`}>
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

const normalizeWidgetOrder = (input: WidgetId[] | undefined) => {
    if (!Array.isArray(input) || !input.length) return DEFAULT_ORDER;
    return Array.from(new Set(input)).filter((id): id is WidgetId => DEFAULT_ORDER.includes(id));
};

const normalizeLayouts = (input?: Partial<Record<WidgetId, WidgetLayout>>, maxColumns = 12) => {
    const next = { ...DEFAULT_LAYOUTS };
    (Object.keys(DEFAULT_LAYOUTS) as WidgetId[]).forEach((id) => {
        const saved = input?.[id];
        if (!saved) return;
        next[id] = {
            w: clamp(saved.w ?? next[id].w, 1, maxColumns),
            h: clamp(saved.h ?? next[id].h, 1, 6),
        };
    });
    return next;
};

const readTerminalTheme = () => {
    if (typeof document === 'undefined') return 'light';
    return document.querySelector('.terminal-shell')?.getAttribute('data-terminal-theme') === 'dark' ? 'dark' : 'light';
};

const getTerminalPalette = (theme: 'dark' | 'light') =>
    theme === 'dark'
        ? {
              panel: '#0f1622',
              panelSoft: '#111b2a',
              border: '#2b3445',
              borderStrong: '#3b475d',
              text: '#e4e9f2',
              muted: '#9ea8b8',
              accent: '#2794ff',
              up: '#00a86b',
              down: '#d94f45',
          }
        : {
              panel: '#f3f5f8',
              panelSoft: '#e8ecf2',
              border: '#bac3d1',
              borderStrong: '#a8b4c7',
              text: '#111827',
              muted: '#556277',
              accent: '#1376d3',
              up: '#0d8f5d',
              down: '#c43e34',
          };

const buildAutoAdjustedState = (visibleOrder: WidgetId[], maxColumns: number) => {
    const columns = Math.max(1, maxColumns);
    const normalizedOrder = DEFAULT_ORDER.filter((id) => visibleOrder.includes(id));
    const nextLayouts = normalizeLayouts(undefined, columns);

    if (columns <= 2) {
        for (const id of normalizedOrder) {
            nextLayouts[id] = {
                w: columns,
                h: DEFAULT_LAYOUTS[id].h,
            };
        }
        return { order: normalizedOrder, layouts: nextLayouts };
    }

    const sideWidgets: WidgetId[] = ['usMarkets', 'globalMarkets', 'usSectors', 'currencies'];
    const adaptableWidgets: WidgetId[] = ['calendar', 'portfolio'];
    const compactWidgets: WidgetId[] = ['topGainers', 'topLosers', 'commodities', 'watchList'];
    const wideWidgets: WidgetId[] = ['heatmap', 'news', 'liveStream'];
    const heroFillWidgets: WidgetId[] = [...sideWidgets, ...adaptableWidgets, ...compactWidgets];
    const standardRowWidgets: WidgetId[] = [...sideWidgets, ...adaptableWidgets, ...compactWidgets];
    const remaining = [...normalizedOrder];
    const nextOrder: WidgetId[] = [];

    const takeFirstMatch = (candidates: WidgetId[]) => {
        const index = remaining.findIndex((id) => candidates.includes(id));
        if (index < 0) return null;
        const [id] = remaining.splice(index, 1);
        return id;
    };

    const takeMany = (candidates: WidgetId[], count: number) => {
        const picked: WidgetId[] = [];
        while (picked.length < count) {
            const id = takeFirstMatch(candidates);
            if (!id) break;
            picked.push(id);
        }
        return picked;
    };

    const placeItems = (items: Array<{ id: WidgetId; w: number; h: number }>) => {
        items.forEach(({ id, w, h }) => {
            nextOrder.push(id);
            nextLayouts[id] = {
                w: clamp(w, 1, columns),
                h: clamp(h, 1, 6),
            };
        });
    };

    if (columns < 12) {
        const chart = takeFirstMatch(['chart']);
        if (chart) {
            placeItems([{ id: chart, w: columns, h: 4 }]);
        }

        while (remaining.length > 0) {
            const wide = takeFirstMatch([...wideWidgets, ...adaptableWidgets]);
            if (wide) {
                placeItems([{ id: wide, w: columns, h: DEFAULT_LAYOUTS[wide].h }]);
                continue;
            }

            const pair = takeMany(standardRowWidgets, 2);
            if (pair.length === 2) {
                placeItems([
                    { id: pair[0], w: Math.ceil(columns / 2), h: 2 },
                    { id: pair[1], w: Math.floor(columns / 2), h: 2 },
                ]);
                continue;
            }

            if (pair.length === 1) {
                placeItems([{ id: pair[0], w: columns, h: 2 }]);
            }
        }

        return {
            order: nextOrder,
            layouts: nextLayouts,
        };
    }

    const chart = takeFirstMatch(['chart']);

    if (chart) {
        const heroFillers = takeMany(heroFillWidgets, 4);

        if (heroFillers.length >= 4) {
            placeItems([
                { id: heroFillers[0], w: 3, h: 2 },
                { id: chart, w: 6, h: 4 },
                { id: heroFillers[1], w: 3, h: 2 },
                { id: heroFillers[2], w: 3, h: 2 },
                { id: heroFillers[3], w: 3, h: 2 },
            ]);
        } else if (heroFillers.length === 3) {
            placeItems([
                { id: heroFillers[0], w: 3, h: 4 },
                { id: chart, w: 6, h: 4 },
                { id: heroFillers[1], w: 3, h: 2 },
                { id: heroFillers[2], w: 3, h: 2 },
            ]);
        } else if (heroFillers.length === 2) {
            placeItems([
                { id: heroFillers[0], w: 3, h: 4 },
                { id: chart, w: 6, h: 4 },
                { id: heroFillers[1], w: 3, h: 4 },
            ]);
        } else if (heroFillers.length === 1) {
            placeItems([
                { id: heroFillers[0], w: 4, h: 4 },
                { id: chart, w: 8, h: 4 },
            ]);
        } else {
            placeItems([{ id: chart, w: 12, h: 4 }]);
        }
    }

    while (remaining.length > 0) {
        const sixWide = takeFirstMatch(wideWidgets);
        const pairOfThrees = takeMany(standardRowWidgets, 2);

        if (sixWide && pairOfThrees.length === 2) {
            placeItems([
                { id: pairOfThrees[0], w: 3, h: 2 },
                { id: sixWide, w: 6, h: 2 },
                { id: pairOfThrees[1], w: 3, h: 2 },
            ]);
            continue;
        }

        if (sixWide && pairOfThrees.length === 1) {
            placeItems([
                { id: pairOfThrees[0], w: 3, h: 2 },
                { id: sixWide, w: 9, h: 2 },
            ]);
            continue;
        }

        if (sixWide) {
            const secondWide = takeFirstMatch([...wideWidgets, ...adaptableWidgets]);
            if (secondWide) {
                placeItems([
                    { id: sixWide, w: 6, h: 2 },
                    { id: secondWide, w: 6, h: 2 },
                ]);
            } else {
                placeItems([{ id: sixWide, w: 12, h: 2 }]);
            }
            continue;
        }

        const adaptablePair = takeMany(adaptableWidgets, 2);
        if (adaptablePair.length === 2) {
            placeItems([
                { id: adaptablePair[0], w: 6, h: 2 },
                { id: adaptablePair[1], w: 6, h: 2 },
            ]);
            continue;
        }

        if (adaptablePair.length === 1) {
            const supporting = takeMany([...sideWidgets, ...compactWidgets], 2);
            if (supporting.length === 2) {
                placeItems([
                    { id: supporting[0], w: 3, h: 2 },
                    { id: adaptablePair[0], w: 6, h: 2 },
                    { id: supporting[1], w: 3, h: 2 },
                ]);
                continue;
            }

            if (supporting.length === 1) {
                placeItems([
                    { id: supporting[0], w: 4, h: 2 },
                    { id: adaptablePair[0], w: 8, h: 2 },
                ]);
                continue;
            }

            placeItems([{ id: adaptablePair[0], w: 12, h: 2 }]);
            continue;
        }

        const fourSmall = takeMany([...sideWidgets, ...compactWidgets], 4);
        if (fourSmall.length === 4) {
            placeItems(fourSmall.map((id) => ({ id, w: 3, h: 2 })));
            continue;
        }

        if (fourSmall.length === 3) {
            placeItems(fourSmall.map((id) => ({ id, w: 4, h: 2 })));
            continue;
        }

        if (fourSmall.length === 2) {
            placeItems([
                { id: fourSmall[0], w: 6, h: 2 },
                { id: fourSmall[1], w: 6, h: 2 },
            ]);
            continue;
        }

        if (fourSmall.length === 1) {
            placeItems([{ id: fourSmall[0], w: 12, h: 2 }]);
        }
    }

    return {
        order: nextOrder,
        layouts: nextLayouts,
    };
};

const DEFAULT_LAYOUT_BUILT_AT = '2026-03-08T00:00:00.000Z';

const DEFAULT_LAYOUT_PRESETS: Array<{
    id: (typeof LAYOUT_SLOT_IDS)[number];
    name: string;
    widgets: WidgetId[];
}> = [
    {
        id: 'slot-1',
        name: 'Market Desk',
        widgets: DEFAULT_ORDER,
    },
    {
        id: 'slot-2',
        name: 'Macro Pulse',
        widgets: ['chart', 'globalMarkets', 'currencies', 'calendar', 'commodities', 'news', 'liveStream', 'heatmap'],
    },
    {
        id: 'slot-3',
        name: 'Equity Flow',
        widgets: ['usMarkets', 'chart', 'usSectors', 'heatmap', 'topGainers', 'topLosers', 'watchList', 'news', 'portfolio'],
    },
    {
        id: 'slot-4',
        name: 'Portfolio Pulse',
        widgets: ['portfolio', 'watchList', 'chart', 'usMarkets', 'globalMarkets', 'news', 'calendar', 'topGainers', 'topLosers'],
    },
    {
        id: 'slot-5',
        name: 'Newsroom',
        widgets: ['news', 'liveStream', 'calendar', 'chart', 'globalMarkets', 'currencies', 'commodities', 'watchList'],
    },
];

const DEFAULT_SAVED_LAYOUTS: SavedLayoutSlot[] = DEFAULT_LAYOUT_PRESETS.map((preset) => {
    const nextState = buildAutoAdjustedState(preset.widgets, 12);
    return {
        id: preset.id,
        name: preset.name,
        order: nextState.order,
        layouts: nextState.layouts,
        savedAt: DEFAULT_LAYOUT_BUILT_AT,
    };
});

const mergeSavedLayoutsWithDefaults = (input: SavedLayoutSlot[]) =>
    LAYOUT_SLOT_IDS.map((slotId) => {
        const defaultSlot = DEFAULT_SAVED_LAYOUTS.find((slot) => slot.id === slotId);
        const existing = input.find((slot) => slot.id === slotId);

        if (!defaultSlot) return existing ?? null;
        if (!existing) return defaultSlot;
        if (existing.name === defaultSlot.name) return defaultSlot;
        return existing;
    }).filter((slot): slot is SavedLayoutSlot => Boolean(slot));

const PRIMARY_DEFAULT_LAYOUT = DEFAULT_SAVED_LAYOUTS[0];

const TerminalDashboardClient = () => {
    const [layouts, setLayouts] = useState<Record<WidgetId, WidgetLayout>>(PRIMARY_DEFAULT_LAYOUT.layouts);
    const [order, setOrder] = useState<WidgetId[]>(PRIMARY_DEFAULT_LAYOUT.order);
    const [savedLayouts, setSavedLayouts] = useState<SavedLayoutSlot[]>(DEFAULT_SAVED_LAYOUTS);
    const [selectedLayoutSlotId, setSelectedLayoutSlotId] = useState<string | null>(PRIMARY_DEFAULT_LAYOUT.id);
    const [layoutDraftName, setLayoutDraftName] = useState(PRIMARY_DEFAULT_LAYOUT.name);
    const [isWidgetDialogOpen, setIsWidgetDialogOpen] = useState(false);
    const [isLayoutDialogOpen, setIsLayoutDialogOpen] = useState(false);
    const [expandedWidgetId, setExpandedWidgetId] = useState<WidgetId | null>(null);
    const [terminalTheme, setTerminalTheme] = useState<'dark' | 'light'>(() => readTerminalTheme());
    const [dragging, setDragging] = useState<WidgetId | null>(null);
    const [resizing, setResizing] = useState<WidgetId | null>(null);
    const [gridColumns, setGridColumns] = useState(12);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPortfolioLoading, setIsPortfolioLoading] = useState(false);

    const [usIndexMap, setUsIndexMap] = useState<Record<string, TerminalQuote>>({});
    const [usSectorsMap, setUsSectorsMap] = useState<Record<string, TerminalQuote>>({});
    const [globalMap, setGlobalMap] = useState<Record<string, TerminalQuote>>({});
    const [currencyMap, setCurrencyMap] = useState<Record<string, TerminalQuote>>({});
    const [commodityMap, setCommodityMap] = useState<Record<string, TerminalQuote>>({});
    const [watchMap, setWatchMap] = useState<Record<string, TerminalQuote>>({});
    const [movers, setMovers] = useState<MoversApiResponse>({});
    const [headlines, setHeadlines] = useState<MarketNewsResponse['items']>([]);
    const [portfolioSnapshot, setPortfolioSnapshot] = useState<TerminalPortfolioWidgetPayload | null>(null);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);

    const [selectedChannel, setSelectedChannel] = useState(LIVE_CHANNELS[0].key);
    const [chartRangeKey, setChartRangeKey] = useState<(typeof CHART_RANGES)[number]['key']>('1Y');
    const [expandedRangeKey, setExpandedRangeKey] = useState<(typeof CHART_RANGES)[number]['key']>('1Y');
    const [selectedChartSymbols, setSelectedChartSymbols] = useState<string[]>(CHART_DEFAULT_SYMBOLS);
    const [chartSeries, setChartSeries] = useState<PerformanceSeries[]>([]);
    const [expandedTickerSeries, setExpandedTickerSeries] = useState<PerformanceSeries[]>([]);
    const [chartUpdatedAt, setChartUpdatedAt] = useState<string | null>(null);
    const [isChartLoading, setIsChartLoading] = useState(false);
    const [isExpandedTickerLoading, setIsExpandedTickerLoading] = useState(false);

    const gridRef = useRef<HTMLDivElement | null>(null);
    const resizeSessionRef = useRef<ResizeSession | null>(null);
    const pendingLayoutPayloadRef = useRef<string | null>(null);
    const isPageVisibleRef = useRef(true);

    const activeChannel = LIVE_CHANNELS.find((item) => item.key === selectedChannel) ?? LIVE_CHANNELS[0];
    const terminalPalette = useMemo(() => getTerminalPalette(terminalTheme), [terminalTheme]);
    const dialogSurfaceStyle = useMemo(() => {
        const style = {
                background: terminalPalette.panel,
                backgroundColor: terminalPalette.panel,
                backgroundImage: 'none',
                color: terminalPalette.text,
                borderColor: terminalPalette.border,
                boxShadow: terminalTheme === 'dark' ? '0 20px 60px rgba(0,0,0,0.45)' : '0 20px 50px rgba(15,23,42,0.18)',
                opacity: 1,
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                '--terminal-panel': terminalPalette.panel,
                '--terminal-panel-soft': terminalPalette.panelSoft,
                '--terminal-border': terminalPalette.border,
                '--terminal-border-strong': terminalPalette.borderStrong,
                '--terminal-text': terminalPalette.text,
                '--terminal-muted': terminalPalette.muted,
                '--terminal-accent': terminalPalette.accent,
            };
        return style as unknown as CSSProperties & Record<string, string>;
    }, [terminalPalette, terminalTheme]);

    const expandedTickerItems = useMemo<ExpandedTickerItem[]>(() => {
        if (!expandedWidgetId) return [];

        const toItems = (
            entries: Array<{ symbol: string; label: string }>,
            quoteMap: Record<string, TerminalQuote>
        ) =>
            entries.map((entry) => {
                const key = entry.symbol.toUpperCase();
                const quote = quoteMap[key];
                return {
                    key,
                    symbol: entry.symbol,
                    ticker: CHART_TICKER_ALIAS[key] ?? entry.symbol.replace('^', ''),
                    name: entry.label,
                    price: quote?.price ?? null,
                    change: quote?.change ?? null,
                    changePercent: quote?.changePercent ?? null,
                    href: buildTerminalChartHref(entry.symbol, entry.label),
                } satisfies ExpandedTickerItem;
            });

        if (expandedWidgetId === 'usMarkets') return toItems(US_INDEXES, usIndexMap);
        if (expandedWidgetId === 'usSectors') return toItems(US_SECTORS, usSectorsMap);
        if (expandedWidgetId === 'globalMarkets') return toItems(GLOBAL_MARKETS, globalMap);
        if (expandedWidgetId === 'currencies') return toItems(CURRENCIES, currencyMap);
        if (expandedWidgetId === 'commodities') return toItems(COMMODITIES, commodityMap);
        if (expandedWidgetId === 'watchList') {
            return WATCHLIST_SYMBOLS.map((symbol) => {
                const key = symbol.toUpperCase();
                const quote = watchMap[key];
                return {
                    key,
                    symbol,
                    ticker: symbol,
                    name: symbol,
                    price: quote?.price ?? null,
                    change: quote?.change ?? null,
                    changePercent: quote?.changePercent ?? null,
                    href: buildTerminalChartHref(symbol, symbol),
                } satisfies ExpandedTickerItem;
            });
        }
        if (expandedWidgetId === 'topGainers' || expandedWidgetId === 'topLosers') {
            const items = expandedWidgetId === 'topGainers' ? movers.gainers ?? [] : movers.losers ?? [];
            return items.slice(0, 16).map((item) => ({
                key: item.symbol,
                symbol: item.symbol,
                ticker: item.symbol,
                name: item.name,
                price: item.price,
                change: null,
                changePercent: item.changePercent,
                href: buildTerminalChartHref(item.symbol, item.name),
            }));
        }

        return [];
    }, [commodityMap, currencyMap, expandedWidgetId, globalMap, movers.gainers, movers.losers, usIndexMap, usSectorsMap, watchMap]);

    const expandedTickerSeriesMap = useMemo(
        () =>
            expandedTickerSeries.reduce<Record<string, PerformanceSeries>>((acc, series) => {
                acc[series.symbol.toUpperCase()] = series;
                return acc;
            }, {}),
        [expandedTickerSeries]
    );

    const expandedWidgetAllowsChartSelection =
        expandedWidgetId === 'usMarkets' ||
        expandedWidgetId === 'globalMarkets' ||
        expandedWidgetId === 'currencies' ||
        expandedWidgetId === 'commodities';

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

    const widgetSelectorItems = useMemo(
        () =>
            DEFAULT_ORDER.map((id) => ({
                id,
                title: WIDGET_TITLES[id],
                visible: order.includes(id),
            })),
        [order]
    );

    const layoutSlots = useMemo(
        () =>
            LAYOUT_SLOT_IDS.map((slotId) => ({
                id: slotId,
                saved: savedLayouts.find((slot) => slot.id === slotId) ?? null,
            })),
        [savedLayouts]
    );

    const heatmapGroups = useMemo(
        () => [
            {
                key: 'sectors',
                label: 'US Sectors',
                items: US_SECTORS.map((item) => {
                    const quote = usSectorsMap[item.symbol.toUpperCase()];
                    return {
                        key: item.symbol,
                        symbol: item.symbol.replace('XL', ''),
                        label: item.label,
                        sublabel: 'ETF',
                        price: typeof quote?.price === 'number' ? quote.price : null,
                        changePercent: typeof quote?.changePercent === 'number' ? quote.changePercent : null,
                        href: buildTerminalChartHref(item.symbol, item.label),
                    };
                }),
            },
            {
                key: 'global',
                label: 'Global',
                items: GLOBAL_MARKETS.map((item) => {
                    const quote = globalMap[item.symbol.toUpperCase()];
                    return {
                        key: item.symbol,
                        symbol: item.label,
                        label: item.label,
                        sublabel: 'Index',
                        price: typeof quote?.price === 'number' ? quote.price : null,
                        changePercent: typeof quote?.changePercent === 'number' ? quote.changePercent : null,
                        href: buildTerminalChartHref(item.symbol, item.label),
                    };
                }),
            },
            {
                key: 'watchlist',
                label: 'Watchlist',
                items: WATCHLIST_SYMBOLS.map((symbol) => {
                    const quote = watchMap[symbol];
                    return {
                        key: symbol,
                        symbol,
                        label: symbol,
                        sublabel: 'Equity',
                        price: typeof quote?.price === 'number' ? quote.price : null,
                        changePercent: typeof quote?.changePercent === 'number' ? quote.changePercent : null,
                        href: `/stocks/${encodeURIComponent(symbol)}`,
                    };
                }),
            },
        ],
        [globalMap, usSectorsMap, watchMap]
    );

    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw) as {
                order?: WidgetId[];
                layouts?: Partial<Record<WidgetId, WidgetLayout>>;
                savedLayouts?: SavedLayoutSlot[];
                selectedLayoutSlotId?: string | null;
            };
            setOrder(normalizeWidgetOrder(parsed.order));
            setLayouts(normalizeLayouts(parsed.layouts));
            if (Array.isArray(parsed.savedLayouts)) {
                const normalizedSavedLayouts = parsed.savedLayouts
                    .filter((slot): slot is SavedLayoutSlot => Boolean(slot?.id))
                    .slice(0, LAYOUT_SLOT_IDS.length)
                    .map((slot) => ({
                        ...slot,
                        order: normalizeWidgetOrder(slot.order),
                        layouts: normalizeLayouts(slot.layouts),
                    }));
                const effectiveSavedLayouts =
                    normalizedSavedLayouts.length > 0 ? mergeSavedLayoutsWithDefaults(normalizedSavedLayouts) : DEFAULT_SAVED_LAYOUTS;
                setSavedLayouts(effectiveSavedLayouts);
                const selected =
                    parsed.selectedLayoutSlotId && effectiveSavedLayouts.some((slot) => slot.id === parsed.selectedLayoutSlotId)
                        ? parsed.selectedLayoutSlotId
                        : effectiveSavedLayouts[0]?.id ?? null;
                setSelectedLayoutSlotId(selected);
                const selectedSlot = effectiveSavedLayouts.find((slot) => slot.id === selected) ?? effectiveSavedLayouts[0];
                if (selectedSlot?.name) {
                    setLayoutDraftName(selectedSlot.name);
                }
                if (selectedSlot && DEFAULT_SAVED_LAYOUTS.some((slot) => slot.id === selectedSlot.id && slot.name === selectedSlot.name)) {
                    setOrder(selectedSlot.order);
                    setLayouts(normalizeLayouts(selectedSlot.layouts));
                }
            } else {
                setSavedLayouts(DEFAULT_SAVED_LAYOUTS);
                setSelectedLayoutSlotId(PRIMARY_DEFAULT_LAYOUT.id);
                setLayoutDraftName(PRIMARY_DEFAULT_LAYOUT.name);
            }
        } catch (error) {
            console.error('Failed to parse dashboard layout', error);
        }
    }, []);

    useEffect(() => {
        const shell = document.querySelector('.terminal-shell');
        if (!shell) return;

        setTerminalTheme(readTerminalTheme());
        const observer = new MutationObserver(() => setTerminalTheme(readTerminalTheme()));
        observer.observe(shell, { attributes: true, attributeFilter: ['data-terminal-theme'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const payload = JSON.stringify({ order, layouts, savedLayouts, selectedLayoutSlotId });
        pendingLayoutPayloadRef.current = payload;

        const timer = window.setTimeout(() => {
            if (!pendingLayoutPayloadRef.current) return;
            localStorage.setItem(STORAGE_KEY, pendingLayoutPayloadRef.current);
            pendingLayoutPayloadRef.current = null;
        }, 220);

        return () => window.clearTimeout(timer);
    }, [order, layouts, savedLayouts, selectedLayoutSlotId]);

    useEffect(
        () => () => {
            if (!pendingLayoutPayloadRef.current) return;
            localStorage.setItem(STORAGE_KEY, pendingLayoutPayloadRef.current);
            pendingLayoutPayloadRef.current = null;
        },
        []
    );

    useEffect(() => {
        const onVisibilityChange = () => {
            isPageVisibleRef.current = !document.hidden;
        };
        onVisibilityChange();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

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

    const refreshData = useCallback(async (force = false) => {
        if (!force && !isPageVisibleRef.current) return;
        setIsRefreshing(true);
        setIsPortfolioLoading(true);
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
                portfolioResponse,
            ] = await Promise.all([
                fetchIndicesGroup(US_INDEXES.map((item) => item.symbol)),
                fetchQuotesGroup(US_SECTORS.map((item) => item.symbol)),
                fetchIndicesGroup(GLOBAL_MARKETS.map((item) => item.symbol)),
                fetchIndicesGroup(CURRENCIES.map((item) => item.symbol)),
                fetchIndicesGroup(COMMODITIES.map((item) => item.symbol)),
                fetchQuotesGroup([...WATCHLIST_SYMBOLS]),
                fetch('/api/market/movers?count=40', { cache: 'no-store' }),
                fetch('/api/market/news', { cache: 'no-store' }),
                fetch('/api/portfolio/widget', { cache: 'no-store' }),
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

            const portfolioPayload = (await portfolioResponse.json().catch(() => null)) as TerminalPortfolioWidgetPayload | null;
            setPortfolioSnapshot(portfolioPayload);
        } catch (error) {
            console.error('Terminal dashboard refresh failed', error);
        } finally {
            setIsRefreshing(false);
            setIsPortfolioLoading(false);
        }
    }, [fetchIndicesGroup, fetchQuotesGroup]);

    const refreshChartData = useCallback(async (force = false) => {
        if (!force && !isPageVisibleRef.current) return;
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
        void refreshData(true);
        intervalId = setInterval(() => void refreshData(), DATA_REFRESH_MS);
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [refreshData]);

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;
        void refreshChartData(true);
        intervalId = setInterval(() => void refreshChartData(), CHART_REFRESH_MS);
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [refreshChartData]);

    useEffect(() => {
        if (!expandedWidgetId || !expandedTickerItems.length) {
            setExpandedTickerSeries([]);
            setIsExpandedTickerLoading(false);
            return;
        }

        let isMounted = true;
        const controller = new AbortController();

        const loadExpandedTickerSeries = async () => {
            setIsExpandedTickerLoading(true);
            try {
                const response = await fetch(
                    `/api/market/performance?range=${expandedRangeKey}&symbols=${encodeURIComponent(
                        expandedTickerItems.map((item) => item.symbol).join(',')
                    )}`,
                    { cache: 'no-store', signal: controller.signal }
                );

                if (!response.ok) {
                    if (isMounted) setExpandedTickerSeries([]);
                    return;
                }

                const payload = (await response.json()) as PerformanceApiResponse;
                if (!isMounted) return;
                setExpandedTickerSeries(payload.series ?? []);
            } catch (error) {
                if ((error as Error).name === 'AbortError' || !isMounted) return;
                console.error('Expanded widget performance refresh failed', error);
                setExpandedTickerSeries([]);
            } finally {
                if (isMounted) setIsExpandedTickerLoading(false);
            }
        };

        void loadExpandedTickerSeries();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [expandedRangeKey, expandedTickerItems, expandedWidgetId]);

    const refreshAll = useCallback(async () => {
        await Promise.all([refreshData(true), refreshChartData(true)]);
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
        setOrder(PRIMARY_DEFAULT_LAYOUT.order);
        setLayouts(PRIMARY_DEFAULT_LAYOUT.layouts);
        setSavedLayouts(DEFAULT_SAVED_LAYOUTS);
        setSelectedLayoutSlotId(PRIMARY_DEFAULT_LAYOUT.id);
        setLayoutDraftName(PRIMARY_DEFAULT_LAYOUT.name);
        localStorage.removeItem(STORAGE_KEY);
    };

    const toggleWidgetVisibility = (id: WidgetId) => {
        setOrder((prev) => {
            if (prev.includes(id)) {
                if (prev.length === 1) return prev;
                if (expandedWidgetId === id) {
                    setExpandedWidgetId(null);
                }
                return prev.filter((item) => item !== id);
            }

            const next = [...prev, id];
            return DEFAULT_ORDER.filter((widgetId) => next.includes(widgetId));
        });

        setLayouts((prev) => ({
            ...prev,
            [id]: prev[id] ?? DEFAULT_LAYOUTS[id],
        }));
    };

    const autoAdjustLayout = () => {
        const nextState = buildAutoAdjustedState(order, gridColumns);
        setOrder(nextState.order);
        setLayouts(nextState.layouts);
    };

    const saveCurrentLayout = () => {
        const fallbackId = selectedLayoutSlotId ?? LAYOUT_SLOT_IDS.find((id) => !savedLayouts.some((slot) => slot.id === id)) ?? LAYOUT_SLOT_IDS[0];
        const name = layoutDraftName.trim() || `Layout ${savedLayouts.length + 1}`;
        const snapshot: SavedLayoutSlot = {
            id: fallbackId,
            name,
            order,
            layouts,
            savedAt: new Date().toISOString(),
        };

        setSavedLayouts((prev) => {
            const withoutCurrent = prev.filter((slot) => slot.id !== fallbackId);
            return [...withoutCurrent, snapshot].sort(
                (a, b) => LAYOUT_SLOT_IDS.indexOf(a.id as (typeof LAYOUT_SLOT_IDS)[number]) - LAYOUT_SLOT_IDS.indexOf(b.id as (typeof LAYOUT_SLOT_IDS)[number])
            );
        });
        setSelectedLayoutSlotId(fallbackId);
        setIsLayoutDialogOpen(false);
    };

    const loadSavedLayout = (slotId: string) => {
        const slot = savedLayouts.find((item) => item.id === slotId);
        setSelectedLayoutSlotId(slotId);
        if (!slot) return;
        setOrder(normalizeWidgetOrder(slot.order));
        setLayouts(normalizeLayouts(slot.layouts, gridColumns));
        setLayoutDraftName(slot.name);
        setIsLayoutDialogOpen(false);
    };

    const deleteSavedLayout = () => {
        if (!selectedLayoutSlotId) return;
        setSavedLayouts((prev) => prev.filter((slot) => slot.id !== selectedLayoutSlotId));
        setSelectedLayoutSlotId(null);
        setLayoutDraftName(PRIMARY_DEFAULT_LAYOUT.name);
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
        heatmap: <TerminalMarketHeatmapWidget groups={heatmapGroups} />,
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
        calendar: <TerminalEconomicCalendarWidget />,
        portfolio: <TerminalPortfolioSnapshotWidget payload={portfolioSnapshot} isLoading={isPortfolioLoading} />,
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
                {(headlines ?? []).slice(0, 12).map((item) => (
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
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="terminal-banner-kicker">Terminal Dashboard</p>
                        <p className="terminal-muted text-sm">
                            Configure widgets, save up to five named layouts, and auto-fit the board when the mix changes.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setIsWidgetDialogOpen(true)} className="terminal-mini-btn">
                            <Plus className="h-4 w-4" />
                            Widgets
                        </button>
                        <button type="button" onClick={() => setIsLayoutDialogOpen(true)} className="terminal-mini-btn">
                            <Save className="h-4 w-4" />
                            Layouts
                        </button>
                        <button type="button" onClick={() => void refreshAll()} className="terminal-mini-btn">
                            <RefreshCw className={cn('h-4 w-4', (isRefreshing || isChartLoading) && 'animate-spin')} />
                            Refresh
                        </button>
                        <button type="button" onClick={autoAdjustLayout} className="terminal-mini-btn">
                            <Sparkles className="h-4 w-4" />
                            Auto Adjust
                        </button>
                        <button type="button" onClick={resetLayout} className="terminal-mini-btn">
                            <RotateCcw className="h-4 w-4" />
                            Reset Layout
                        </button>
                        <span className="inline-flex items-center gap-1 text-xs terminal-muted">
                            <LayoutGrid className="h-3.5 w-3.5" />
                            {order.length} active widgets
                        </span>
                    </div>
                </div>
            </div>

            <Dialog open={isWidgetDialogOpen} onOpenChange={setIsWidgetDialogOpen}>
                <DialogContent
                    className="max-w-3xl border-[var(--terminal-border)] !bg-[var(--terminal-panel)] text-[var(--terminal-text)] sm:max-w-3xl"
                    style={dialogSurfaceStyle}
                >
                    <DialogHeader>
                        <DialogTitle>Widget Library</DialogTitle>
                        <DialogDescription className="text-[var(--terminal-muted)]">
                            Toggle widgets on or off for the terminal dashboard.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {widgetSelectorItems.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleWidgetVisibility(item.id)}
                                className={cn(
                                    'flex items-center justify-between rounded-lg border px-3 py-3 text-left transition',
                                    item.visible
                                        ? 'border-[var(--terminal-accent)] bg-[color-mix(in_srgb,var(--terminal-accent)_14%,var(--terminal-panel-soft))]'
                                        : 'border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] hover:border-[var(--terminal-border-strong)]'
                                )}
                            >
                                <span className="text-sm font-semibold">{item.title}</span>
                                <span className="text-xs uppercase tracking-[0.12em] terminal-muted">{item.visible ? 'On' : 'Off'}</span>
                            </button>
                        ))}
                    </div>
                    <DialogFooter>
                        <button type="button" onClick={() => setIsWidgetDialogOpen(false)} className="terminal-mini-btn">
                            Close
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isLayoutDialogOpen} onOpenChange={setIsLayoutDialogOpen}>
                <DialogContent
                    className="max-w-3xl border-[var(--terminal-border)] !bg-[var(--terminal-panel)] text-[var(--terminal-text)] sm:max-w-3xl"
                    style={dialogSurfaceStyle}
                >
                    <DialogHeader>
                        <DialogTitle>Saved Layouts</DialogTitle>
                        <DialogDescription className="text-[var(--terminal-muted)]">
                            Save the current arrangement or load one of up to five named presets.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Input
                            value={layoutDraftName}
                            onChange={(event) => setLayoutDraftName(event.target.value)}
                            placeholder="Layout name"
                            className="border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] text-[var(--terminal-text)]"
                        />
                        <button type="button" onClick={saveCurrentLayout} className="terminal-mini-btn">
                            <Save className="h-4 w-4" />
                            Save Current
                        </button>
                        <button type="button" onClick={deleteSavedLayout} className="terminal-mini-btn" disabled={!selectedLayoutSlotId}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        {layoutSlots.map((slot, index) => {
                            const isActive = slot.id === selectedLayoutSlotId;
                            return (
                                <button
                                    key={slot.id}
                                    type="button"
                                    onClick={() => loadSavedLayout(slot.id)}
                                    className={cn(
                                        'rounded-lg border px-3 py-3 text-left transition',
                                        isActive
                                            ? 'border-[var(--terminal-accent)] bg-[color-mix(in_srgb,var(--terminal-accent)_16%,var(--terminal-panel-soft))]'
                                            : 'border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] hover:border-[var(--terminal-border-strong)]'
                                    )}
                                >
                                    <p className="text-[11px] uppercase tracking-[0.14em] terminal-muted">Slot {index + 1}</p>
                                    <p className="mt-1 truncate text-sm font-semibold">{slot.saved?.name ?? 'Empty'}</p>
                                    <p className="mt-1 text-xs terminal-muted">
                                        {slot.saved?.savedAt ? new Date(slot.saved.savedAt).toLocaleDateString() : 'No layout saved'}
                                    </p>
                                </button>
                            );
                        })}
                    </div>

                    <DialogFooter>
                        <button type="button" onClick={() => setIsLayoutDialogOpen(false)} className="terminal-mini-btn">
                            Close
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(expandedWidgetId)} onOpenChange={(open) => !open && setExpandedWidgetId(null)}>
                <DialogContent
                    className="flex h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-none flex-col overflow-hidden border-[var(--terminal-border)] !bg-[var(--terminal-panel)] p-0 text-[var(--terminal-text)] sm:max-w-none"
                    style={dialogSurfaceStyle}
                >
                    {expandedWidgetId ? (
                        <>
                            <DialogHeader className="border-b border-[var(--terminal-border)] px-6 py-4 pr-14">
                                <DialogTitle>{WIDGET_TITLES[expandedWidgetId]}</DialogTitle>
                                <DialogDescription className="text-[var(--terminal-muted)]">
                                    Full view for the selected dashboard widget.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="min-h-0 flex-1 overflow-hidden p-4">
                                <article className="terminal-widget h-full overflow-hidden">
                                    {expandedTickerItems.length ? (
                                        <div className="flex h-full min-h-0 flex-col overflow-hidden">
                                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--terminal-border)] px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {CHART_RANGES.map((range) => (
                                                        <button
                                                            key={`expanded-${range.key}`}
                                                            type="button"
                                                            onClick={() => setExpandedRangeKey(range.key)}
                                                            className={cn(
                                                                'terminal-mini-btn',
                                                                expandedRangeKey === range.key && 'terminal-mini-btn-active'
                                                            )}
                                                        >
                                                            {range.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 text-xs terminal-muted">
                                                    {expandedWidgetAllowsChartSelection ? (
                                                        <span>
                                                            {selectedChartSymbols.length}/{CHART_SYMBOL_LIMIT} selected for chart
                                                        </span>
                                                    ) : null}
                                                    <span>
                                                        {isExpandedTickerLoading
                                                            ? 'Loading widget performance...'
                                                            : `${expandedTickerItems.length} tickers in view`}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="min-h-0 flex-1 overflow-auto">
                                                <div className="min-w-[1080px]">
                                                    <div
                                                        className="grid gap-3 border-b border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] terminal-muted"
                                                        style={{
                                                            gridTemplateColumns: expandedWidgetAllowsChartSelection
                                                                ? '40px 120px minmax(220px,1.45fr) 120px 110px 110px 100px'
                                                                : '120px minmax(220px,1.45fr) 120px 110px 110px 100px',
                                                        }}
                                                    >
                                                        {expandedWidgetAllowsChartSelection ? (
                                                            <span className="text-center">Sel</span>
                                                        ) : null}
                                                        <span>Ticker</span>
                                                        <span>Name</span>
                                                        <span className="text-right">Last Price</span>
                                                        <span className="text-right">1-Day %</span>
                                                        <span className="text-right">Return</span>
                                                        <span className="text-right">Chart</span>
                                                    </div>

                                                    {expandedTickerItems.map((item) => {
                                                        const series = expandedTickerSeriesMap[item.symbol.toUpperCase()];
                                                        const points = series?.points ?? [];
                                                        const firstPoint = points[0];
                                                        const lastPoint = points[points.length - 1];
                                                        const rangeReturn =
                                                            firstPoint &&
                                                            lastPoint &&
                                                            Number.isFinite(firstPoint.close) &&
                                                            Number.isFinite(lastPoint.close) &&
                                                            firstPoint.close !== 0
                                                                ? ((lastPoint.close - firstPoint.close) / firstPoint.close) * 100
                                                                : null;

                                                        return (
                                                            <div
                                                                key={`expanded-row-${item.key}`}
                                                                className="grid items-center gap-3 border-b border-[var(--terminal-border)] px-4 py-3 text-sm last:border-b-0"
                                                                style={{
                                                                    gridTemplateColumns: expandedWidgetAllowsChartSelection
                                                                        ? '40px 120px minmax(220px,1.45fr) 120px 110px 110px 100px'
                                                                        : '120px minmax(220px,1.45fr) 120px 110px 110px 100px',
                                                                }}
                                                            >
                                                                {expandedWidgetAllowsChartSelection ? (
                                                                    <div className="flex justify-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedChartSymbolSet.has(item.symbol.toUpperCase())}
                                                                            onChange={() => toggleChartSymbol(item.symbol)}
                                                                            aria-label={`Show ${item.name} in chart`}
                                                                            className="terminal-check-input"
                                                                        />
                                                                    </div>
                                                                ) : null}
                                                                <div className="min-w-0">
                                                                    <Link href={item.href} prefetch={false} className="terminal-ticker-link text-sm font-semibold">
                                                                        {item.ticker}
                                                                    </Link>
                                                                    <p className="mt-1 truncate text-xs terminal-muted">{item.symbol}</p>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="truncate font-semibold">{item.name}</p>
                                                                    <p className="mt-1 text-xs terminal-muted">
                                                                        {CHART_TICKER_ALIAS[item.symbol.toUpperCase()] ? 'Terminal chart available' : 'Live dashboard feed'}
                                                                    </p>
                                                                </div>
                                                                <span className="text-right font-medium">{formatExpandedPrice(item.price)}</span>
                                                                <span
                                                                    className={cn(
                                                                        'text-right font-medium',
                                                                        typeof item.changePercent === 'number' ? '' : 'terminal-muted'
                                                                    )}
                                                                    style={
                                                                        typeof item.changePercent === 'number'
                                                                            ? {
                                                                                  color:
                                                                                      item.changePercent >= 0
                                                                                          ? terminalPalette.up
                                                                                          : terminalPalette.down,
                                                                              }
                                                                            : undefined
                                                                    }
                                                                >
                                                                    {typeof item.changePercent === 'number'
                                                                        ? `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%`
                                                                        : '--'}
                                                                </span>
                                                                <span
                                                                    className={cn(
                                                                        'text-right font-medium',
                                                                        typeof rangeReturn === 'number' ? '' : 'terminal-muted'
                                                                    )}
                                                                    style={
                                                                        typeof rangeReturn === 'number'
                                                                            ? {
                                                                                  color:
                                                                                      rangeReturn >= 0
                                                                                          ? terminalPalette.up
                                                                                          : terminalPalette.down,
                                                                              }
                                                                            : undefined
                                                                    }
                                                                >
                                                                    {typeof rangeReturn === 'number'
                                                                        ? `${rangeReturn >= 0 ? '+' : ''}${rangeReturn.toFixed(2)}%`
                                                                        : '--'}
                                                                </span>
                                                                <div className="flex justify-end">
                                                                    <Link href={item.href} prefetch={false} className="terminal-mini-btn px-2.5 py-1">
                                                                        Open
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex h-full min-h-0 flex-col overflow-hidden">
                                            {cloneElement(widgetContent[expandedWidgetId], {
                                                key: `expanded-${expandedWidgetId}`,
                                            })}
                                        </div>
                                    )}
                                </article>
                            </div>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

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
                                <div className="flex items-center gap-2">
                                    {WIDGET_VIEW_ALL_HREFS[id] ? (
                                        <Link
                                            href={WIDGET_VIEW_ALL_HREFS[id]}
                                            prefetch={false}
                                            onClick={(event) => event.stopPropagation()}
                                            className="terminal-mini-btn px-2 py-1 text-xs"
                                        >
                                            View all
                                        </Link>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setExpandedWidgetId(id);
                                        }}
                                        className="terminal-mini-btn px-2 py-1"
                                        title={`Open ${WIDGET_TITLES[id]} in full view`}
                                        aria-label={`Open ${WIDGET_TITLES[id]} in full view`}
                                    >
                                        <Expand className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            toggleWidgetVisibility(id);
                                        }}
                                        className="terminal-mini-btn px-2 py-1"
                                        title={`Remove ${WIDGET_TITLES[id]}`}
                                        aria-label={`Remove ${WIDGET_TITLES[id]}`}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="terminal-drag-icon" title="Drag to reorder">
                                        <GripVertical className="h-3.5 w-3.5" />
                                    </span>
                                </div>
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
