'use client';

import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { PlotParams } from 'react-plotly.js';
import { ChartSpline, Download, Globe2, Plus, Radar, RefreshCw, X } from 'lucide-react';
import TerminalNewsMarketBoard, { type NewsTabKey } from '@/components/terminal/TerminalNewsMarketBoard';
import { cn } from '@/lib/utils';

const Plot = dynamic(() => import('react-plotly.js'), {
    ssr: false,
}) as ComponentType<PlotParams>;

type MacroMetricKey = 'none' | 'inflation' | 'interest' | 'gdp' | 'unemployment' | 'debt';

type MacroCountryPoint = {
    iso3: string;
    country: string;
    value: number;
    year: number;
};

type MacroPayload = {
    updatedAt: string;
    source: 'worldbank';
    metric: Exclude<MacroMetricKey, 'none'>;
    label: string;
    unit: string;
    countries: MacroCountryPoint[];
    stats: {
        coverage: number;
        min: number;
        max: number;
        median: number;
    } | null;
    warning?: string;
};

type MacroHistoryPoint = {
    year: number;
    value: number;
};

type MacroHistoryPayload = {
    updatedAt: string;
    source: 'worldbank';
    metric: Exclude<MacroMetricKey, 'none'>;
    label: string;
    unit: string;
    countryIso3: string;
    country: string;
    series: MacroHistoryPoint[];
    warning?: string;
};

type GlobeRoute = {
    key: string;
    from: { label: string; lat: number; lon: number };
    to: { label: string; lat: number; lon: number };
    color: string;
};

const METRIC_OPTIONS: Array<{ key: MacroMetricKey; label: string; short: string }> = [
    { key: 'none', label: 'Default Globe', short: 'Default' },
    { key: 'gdp', label: 'GDP', short: 'GDP' },
    { key: 'inflation', label: 'Inflation', short: 'Inflation' },
    { key: 'interest', label: 'Interest Rate', short: 'Interest' },
    { key: 'unemployment', label: 'Unemployment', short: 'Jobs' },
    { key: 'debt', label: 'Debt To GDP', short: 'Debt' },
];

const HISTORY_YEARS_OPTIONS = [10, 15, 20] as const;
const MAX_COMPARE_COUNTRIES = 3;
const COMPARE_COLORS = ['#7dd3fc', '#fbbf24', '#f472b6'];

const DEFAULT_ROUTES: GlobeRoute[] = [
    {
        key: 'nyc-london',
        from: { label: 'New York', lat: 40.7128, lon: -74.006 },
        to: { label: 'London', lat: 51.5072, lon: -0.1276 },
        color: '#ff8c32',
    },
    {
        key: 'london-singapore',
        from: { label: 'London', lat: 51.5072, lon: -0.1276 },
        to: { label: 'Singapore', lat: 1.3521, lon: 103.8198 },
        color: '#42d4ff',
    },
    {
        key: 'dubai-saopaulo',
        from: { label: 'Dubai', lat: 25.2048, lon: 55.2708 },
        to: { label: 'Sao Paulo', lat: -23.5505, lon: -46.6333 },
        color: '#ff4fa3',
    },
];

const readTerminalTheme = () => {
    if (typeof document === 'undefined') return 'light';
    return document.querySelector('.terminal-shell')?.getAttribute('data-terminal-theme') === 'dark' ? 'dark' : 'light';
};

const getPalette = (theme: 'dark' | 'light') =>
    theme === 'dark'
        ? {
              panel: '#050d18',
              panelSoft: '#0b1627',
              border: '#2b3445',
              borderStrong: '#3b475d',
              text: '#e4e9f2',
              muted: '#9ea8b8',
              accent: '#59b0ff',
              land: '#071329',
              ocean: '#020816',
              coast: '#74c0ff',
              routeGlow: '#98d3ff',
              chartGrid: '#1c2a42',
          }
        : {
              panel: '#eaf1fb',
              panelSoft: '#dfe8f4',
              border: '#bac3d1',
              borderStrong: '#a8b4c7',
              text: '#102033',
              muted: '#556277',
              accent: '#1376d3',
              land: '#cddcf0',
              ocean: '#f3f7fd',
              coast: '#3589e4',
              routeGlow: '#6bb8ff',
              chartGrid: '#d0dae8',
          };

const colorscaleForMetric = (metric: MacroMetricKey) => {
    if (metric === 'gdp') {
        return [
            [0, '#08172f'],
            [0.3, '#0e2e63'],
            [0.6, '#1b64c1'],
            [1, '#62cbff'],
        ];
    }
    if (metric === 'inflation') {
        return [
            [0, '#24120d'],
            [0.3, '#6c2e11'],
            [0.6, '#b85a1f'],
            [1, '#ffd166'],
        ];
    }
    if (metric === 'interest') {
        return [
            [0, '#180d2c'],
            [0.3, '#4d1e8a'],
            [0.6, '#7c4dff'],
            [1, '#c5b3ff'],
        ];
    }
    if (metric === 'unemployment') {
        return [
            [0, '#220f16'],
            [0.3, '#7a223d'],
            [0.6, '#c74361'],
            [1, '#ff97ad'],
        ];
    }
    return [
        [0, '#1a0f14'],
        [0.3, '#5e1f3c'],
        [0.6, '#aa3d74'],
        [1, '#ff8cc8'],
    ];
};

const percentile = (values: number[], p: number) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const formatMetricValue = (payload: MacroPayload | MacroHistoryPayload | null, value: number | null) => {
    if (!payload || typeof value !== 'number' || !Number.isFinite(value)) return '--';
    if (payload.unit === 'USD') {
        return new Intl.NumberFormat('en-US', {
            notation: 'compact',
            maximumFractionDigits: 2,
        }).format(value);
    }
    return `${value.toFixed(2)}%`;
};

const formatAxisValue = (unit: string, value: number) => {
    if (!Number.isFinite(value)) return '';
    if (unit === 'USD') {
        return new Intl.NumberFormat('en-US', {
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(value);
    }
    return `${value.toFixed(1)}%`;
};

const formatRelative = (iso: string | null) => {
    if (!iso) return 'n/a';
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) return 'n/a';
    const diffMinutes = Math.max(0, Math.floor((Date.now() - parsed) / 60000));
    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
};

const buildHistoryCacheKey = (metric: Exclude<MacroMetricKey, 'none'>, iso3: string, years: number) =>
    `${metric}:${iso3}:${years}`;

const TerminalNewsGlobeClient = () => {
    const [selectedMetric, setSelectedMetric] = useState<MacroMetricKey>('none');
    const [activeNewsTab, setActiveNewsTab] = useState<NewsTabKey>('topNews');
    const [metricCache, setMetricCache] = useState<Partial<Record<Exclude<MacroMetricKey, 'none'>, MacroPayload>>>({});
    const [metricError, setMetricError] = useState<string | null>(null);
    const [isLoadingMetric, setIsLoadingMetric] = useState(false);
    const [refreshNonce, setRefreshNonce] = useState(0);
    const [rotationLon, setRotationLon] = useState(-18);
    const [rotationLat, setRotationLat] = useState(14);
    const [theme, setTheme] = useState<'dark' | 'light'>(() => readTerminalTheme());
    const [historyYears, setHistoryYears] = useState<(typeof HISTORY_YEARS_OPTIONS)[number]>(10);
    const [primaryCountryIso, setPrimaryCountryIso] = useState('');
    const [pendingCompareIso, setPendingCompareIso] = useState('');
    const [compareCountryIsos, setCompareCountryIsos] = useState<string[]>([]);
    const [historyCache, setHistoryCache] = useState<Record<string, MacroHistoryPayload>>({});
    const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const historyChartRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const shell = document.querySelector('.terminal-shell');
        if (!shell) return;
        setTheme(readTerminalTheme());
        const observer = new MutationObserver(() => setTheme(readTerminalTheme()));
        observer.observe(shell, { attributes: true, attributeFilter: ['data-terminal-theme'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setRotationLon((prev) => (prev >= 180 ? -180 : prev + 0.3));
        }, 60);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (selectedMetric === 'none') return;
        if (metricCache[selectedMetric] && refreshNonce === 0) return;

        let disposed = false;
        const loadMetric = async () => {
            setIsLoadingMetric(true);
            setMetricError(null);
            try {
                const response = await fetch(`/api/world/macro?metric=${selectedMetric}`, { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = (await response.json()) as MacroPayload;
                if (disposed) return;
                setMetricCache((prev) => ({ ...prev, [selectedMetric]: payload }));
                setMetricError(payload.warning ?? null);
            } catch (error) {
                if (disposed) return;
                console.error('Failed to load macro globe data', error);
                setMetricError('Metric data is temporarily unavailable.');
            } finally {
                if (!disposed) setIsLoadingMetric(false);
            }
        };

        void loadMetric();
        return () => {
            disposed = true;
        };
    }, [metricCache, refreshNonce, selectedMetric]);

    const palette = useMemo(() => getPalette(theme), [theme]);
    const activePayload = selectedMetric === 'none' ? null : metricCache[selectedMetric] ?? null;

    const sortedCountries = useMemo(
        () => (activePayload ? [...activePayload.countries].sort((a, b) => a.country.localeCompare(b.country)) : []),
        [activePayload]
    );

    const topCountries = useMemo(
        () => (activePayload ? [...activePayload.countries].sort((a, b) => b.value - a.value).slice(0, 10) : []),
        [activePayload]
    );

    useEffect(() => {
        if (selectedMetric === 'none') {
            setPrimaryCountryIso('');
            setPendingCompareIso('');
            setCompareCountryIsos([]);
            setHistoryStatus('idle');
            setHistoryError(null);
            setExportError(null);
            return;
        }

        if (!sortedCountries.length) return;

        const available = new Set(sortedCountries.map((country) => country.iso3));
        const defaultCountry = topCountries[0]?.iso3 ?? sortedCountries[0]?.iso3 ?? '';

        setPrimaryCountryIso((prev) => (prev && available.has(prev) ? prev : defaultCountry));
        setPendingCompareIso((prev) =>
            prev && available.has(prev) && prev !== defaultCountry && prev !== primaryCountryIso ? prev : ''
        );
        setCompareCountryIsos((prev) =>
            prev.filter((iso3) => available.has(iso3) && iso3 !== defaultCountry).slice(0, MAX_COMPARE_COUNTRIES)
        );
    }, [primaryCountryIso, selectedMetric, sortedCountries, topCountries]);

    useEffect(() => {
        if (!primaryCountryIso) {
            setCompareCountryIsos([]);
            return;
        }

        setCompareCountryIsos((prev) => prev.filter((iso3) => iso3 !== primaryCountryIso).slice(0, MAX_COMPARE_COUNTRIES));
        setPendingCompareIso((prev) => (prev === primaryCountryIso ? '' : prev));
    }, [primaryCountryIso]);

    useEffect(() => {
        if (selectedMetric === 'none' || !primaryCountryIso) return;

        const metric = selectedMetric;
        const targets = [primaryCountryIso, ...compareCountryIsos];
        const targetKeys = targets.map((iso3) => buildHistoryCacheKey(metric, iso3, historyYears));
        const missingTargets = targets.filter((iso3) => !historyCache[buildHistoryCacheKey(metric, iso3, historyYears)]);

        if (!targetKeys.length) return;
        if (!missingTargets.length) {
            setHistoryStatus('ready');
            return;
        }

        let disposed = false;
        const loadHistory = async () => {
            setHistoryStatus('loading');
            setHistoryError(null);
            try {
                const responses = await Promise.all(
                    missingTargets.map(async (iso3) => {
                        const response = await fetch(
                            `/api/world/macro/history?metric=${metric}&country=${iso3}&years=${historyYears}`,
                            { cache: 'no-store' }
                        );
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        const payload = (await response.json()) as MacroHistoryPayload;
                        return { iso3, payload };
                    })
                );

                if (disposed) return;

                setHistoryCache((prev) => {
                    const next = { ...prev };
                    responses.forEach(({ iso3, payload }) => {
                        next[buildHistoryCacheKey(metric, iso3, historyYears)] = payload;
                    });
                    return next;
                });

                const primaryWarning = responses.find(({ iso3 }) => iso3 === primaryCountryIso)?.payload.warning ?? null;
                setHistoryError(primaryWarning);
                setHistoryStatus('ready');
            } catch (error) {
                if (disposed) return;
                console.error('Failed to load macro history data', error);
                setHistoryError('Unable to load historical data right now.');
                setHistoryStatus('ready');
            }
        };

        void loadHistory();
        return () => {
            disposed = true;
        };
    }, [compareCountryIsos, historyCache, historyYears, primaryCountryIso, selectedMetric]);

    const historyPayloads = useMemo(() => {
        if (selectedMetric === 'none' || !primaryCountryIso) return [];
        const metric = selectedMetric;
        return [primaryCountryIso, ...compareCountryIsos]
            .map((iso3) => historyCache[buildHistoryCacheKey(metric, iso3, historyYears)] ?? null)
            .filter((payload): payload is MacroHistoryPayload => payload !== null);
    }, [compareCountryIsos, historyCache, historyYears, primaryCountryIso, selectedMetric]);

    const primaryHistoryPayload = historyPayloads[0] ?? null;

    const comparisonOptions = useMemo(
        () =>
            sortedCountries.filter(
                (country) => country.iso3 !== primaryCountryIso && !compareCountryIsos.includes(country.iso3)
            ),
        [compareCountryIsos, primaryCountryIso, sortedCountries]
    );

    const historyTraces = useMemo<PlotParams['data']>(() => {
        if (!historyPayloads.length) return [];

        return historyPayloads
            .filter((payload) => payload.series.length)
            .map((payload, index) => ({
                type: 'scatter',
                mode: 'lines+markers',
                x: payload.series.map((point) => point.year),
                y: payload.series.map((point) => point.value),
                name: payload.country,
                line: {
                    width: index === 0 ? 3 : 2.3,
                    color: index === 0 ? palette.accent : COMPARE_COLORS[index - 1] ?? palette.muted,
                    shape: 'spline',
                    smoothing: 0.6,
                },
                marker: {
                    size: index === 0 ? 7 : 6,
                    color: index === 0 ? palette.accent : COMPARE_COLORS[index - 1] ?? palette.muted,
                    line: {
                        width: 1,
                        color: theme === 'dark' ? '#020816' : '#f7fbff',
                    },
                },
                hovertemplate: `<b>${payload.country}</b><br>Year %{x}<br>${payload.label}: %{y:,.2f}${payload.unit === 'USD' ? '' : '%'}<extra></extra>`,
            }))
            .filter(Boolean);
    }, [historyPayloads, palette, theme]);

    const historyLayout = useMemo<PlotParams['layout']>(() => {
        const unit = primaryHistoryPayload?.unit ?? '%';
        return {
            margin: { t: 18, r: 18, b: 44, l: 54 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            hovermode: 'x unified',
            uirevision: `history-${selectedMetric}-${historyYears}`,
            legend: {
                orientation: 'h',
                x: 0,
                y: 1.15,
                font: { color: palette.muted, size: 11 },
            },
            xaxis: {
                title: '',
                color: palette.muted,
                linecolor: palette.borderStrong,
                tickfont: { color: palette.muted, size: 11 },
                gridcolor: palette.chartGrid,
                zeroline: false,
                dtick: 2,
            },
            yaxis: {
                title: '',
                color: palette.muted,
                linecolor: palette.borderStrong,
                tickfont: { color: palette.muted, size: 11 },
                gridcolor: palette.chartGrid,
                zeroline: false,
                tickformat: unit === 'USD' ? '~s' : '.1f',
                tickprefix: unit === 'USD' ? '$' : '',
                ticksuffix: unit === '%' ? '%' : '',
            },
            hoverlabel: {
                bgcolor: palette.panelSoft,
                bordercolor: palette.borderStrong,
                font: { color: palette.text, size: 12 },
            },
        };
    }, [historyYears, palette, primaryHistoryPayload?.unit, selectedMetric]);

    const primaryHistoryStats = useMemo(() => {
        if (!primaryHistoryPayload?.series.length) {
            return {
                latest: null as MacroHistoryPoint | null,
                changeAbsolute: null as number | null,
                changePercent: null as number | null,
                min: null as number | null,
                max: null as number | null,
            };
        }

        const first = primaryHistoryPayload.series[0];
        const latest = primaryHistoryPayload.series[primaryHistoryPayload.series.length - 1];
        const values = primaryHistoryPayload.series.map((point) => point.value);
        const changeAbsolute = latest.value - first.value;
        const changePercent =
            first.value !== 0 ? ((latest.value - first.value) / Math.abs(first.value)) * 100 : null;

        return {
            latest,
            changeAbsolute,
            changePercent,
            min: Math.min(...values),
            max: Math.max(...values),
        };
    }, [primaryHistoryPayload]);

    const plotData = useMemo<PlotParams['data']>(() => {
        const routeTraces = DEFAULT_ROUTES.map((route) => ({
            type: 'scattergeo',
            mode: 'lines+markers',
            lat: [route.from.lat, route.to.lat],
            lon: [route.from.lon, route.to.lon],
            text: [route.from.label, route.to.label],
            hovertemplate: '%{text}<extra></extra>',
            line: {
                width: 2,
                color: route.color,
            },
            marker: {
                size: [9, 11],
                color: [route.color, route.color],
                line: {
                    width: 1,
                    color: palette.routeGlow,
                },
            },
            opacity: 0.92,
            showlegend: false,
        }));

        if (!activePayload || selectedMetric === 'none') {
            return routeTraces;
        }

        const values = activePayload.countries.map((point) => point.value);
        const zmin = percentile(values, 0.05);
        const zmax = percentile(values, 0.95);
        return [
            {
                type: 'choropleth',
                locationmode: 'ISO-3',
                locations: activePayload.countries.map((point) => point.iso3),
                z: activePayload.countries.map((point) => point.value),
                customdata: activePayload.countries.map((point) => [point.country, point.year]),
                hovertemplate: `<b>%{customdata[0]}</b><br>${activePayload.label}: %{z:,.2f}${activePayload.unit === '%' ? '%' : ''}<br>Year: %{customdata[1]}<extra></extra>`,
                colorscale: colorscaleForMetric(selectedMetric),
                zmin,
                zmax: zmax > zmin ? zmax : undefined,
                marker: {
                    line: {
                        color: theme === 'dark' ? '#08111f' : '#d8e2f0',
                        width: 0.4,
                    },
                },
                colorbar: {
                    title: activePayload.unit === 'USD' ? 'USD' : '%',
                    thickness: 10,
                    x: 1.02,
                    y: 0.5,
                    len: 0.56,
                    tickcolor: palette.muted,
                    tickfont: { color: palette.muted, size: 10 },
                    titlefont: { color: palette.muted, size: 10 },
                    outlinewidth: 0,
                },
                hoverlabel: {
                    bgcolor: palette.panelSoft,
                    bordercolor: palette.borderStrong,
                    font: { color: palette.text, size: 12 },
                },
                showscale: true,
            },
            ...routeTraces,
        ];
    }, [activePayload, palette, selectedMetric, theme]);

    const plotLayout = useMemo<PlotParams['layout']>(
        () => ({
            margin: { t: 0, r: 0, b: 0, l: 0 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            showlegend: false,
            uirevision: 'terminal-news-globe',
            geo: {
                projection: {
                    type: 'orthographic',
                    scale: 0.97,
                    rotation: { lon: rotationLon, lat: rotationLat },
                },
                bgcolor: 'transparent',
                showframe: false,
                showcoastlines: true,
                coastlinecolor: palette.coast,
                coastlinewidth: 1.15,
                showcountries: true,
                countrycolor: palette.borderStrong,
                countrywidth: 0.5,
                showland: true,
                landcolor: activePayload ? palette.land : theme === 'dark' ? '#061425' : '#d8e7fb',
                showocean: true,
                oceancolor: palette.ocean,
                lakecolor: palette.ocean,
                showlakes: true,
                lonaxis: { showgrid: false },
                lataxis: { showgrid: false },
            },
        }),
        [activePayload, palette, rotationLat, rotationLon, theme]
    );

    const handleAddCompare = () => {
        if (!pendingCompareIso || compareCountryIsos.includes(pendingCompareIso) || pendingCompareIso === primaryCountryIso) {
            return;
        }
        setCompareCountryIsos((prev) => [...prev, pendingCompareIso].slice(0, MAX_COMPARE_COUNTRIES));
        setPendingCompareIso('');
    };

    const handleExportHistory = async () => {
        if (!historyChartRef.current || !primaryHistoryPayload?.series.length) return;

        setExportError(null);
        setIsExporting(true);
        try {
            const { toJpeg } = await import('html-to-image');
            const dataUrl = await toJpeg(historyChartRef.current, {
                quality: 0.96,
                pixelRatio: 2,
                backgroundColor: theme === 'dark' ? '#0b1627' : '#dfe8f4',
            });

            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `zedxe-${selectedMetric}-${primaryCountryIso}-${historyYears}y.jpeg`;
            link.click();
        } catch (error) {
            console.error('Failed to export history chart', error);
            setExportError('Unable to export chart as JPEG right now.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <section className="space-y-3">
            <div className="terminal-banner">
                <div>
                    <p className="terminal-banner-kicker">Market News Globe</p>
                    <p className="text-sm terminal-muted">
                        Interactive globe with rotating default view and macro heat overlays for GDP, inflation, rates, unemployment, and debt.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="terminal-series-chip">Auto rotate</span>
                    <span className="terminal-series-chip">Drag to move</span>
                    <span
                        className={cn(
                            'terminal-series-chip',
                            selectedMetric === 'none'
                                ? 'border-[var(--terminal-border)]'
                                : 'border-[var(--terminal-accent)] text-[var(--terminal-accent)]'
                        )}
                    >
                        {METRIC_OPTIONS.find((option) => option.key === selectedMetric)?.label ?? 'Default Globe'}
                    </span>
                </div>
            </div>

            <TerminalNewsMarketBoard activeTab={activeNewsTab} onActiveTabChange={setActiveNewsTab} />

            {activeNewsTab === 'topNews' ? <div className="terminal-bento-grid">
                <article className="terminal-widget col-span-2 row-span-4 overflow-hidden md:col-span-6 xl:col-span-8">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">3D World Globe</p>
                            <p className="mt-1 text-xs terminal-muted">
                                Default mode shows the animated globe network. Select a metric to paint the countries as a heat layer.
                            </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs text-cyan-300">
                            <Globe2 className="h-3.5 w-3.5" />
                            Live model
                        </span>
                    </header>
                    <div className="border-b border-[var(--terminal-border)] px-2.5 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                            {METRIC_OPTIONS.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => setSelectedMetric(option.key)}
                                    className={cn(
                                        'terminal-mini-btn',
                                        selectedMetric === option.key && 'terminal-mini-btn-active'
                                    )}
                                >
                                    {option.short}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 p-2">
                        <div
                            className="h-full min-h-[560px] rounded-xl border"
                            style={{
                                borderColor: palette.border,
                                background:
                                    theme === 'dark'
                                        ? 'radial-gradient(circle at 50% 35%, rgba(61,129,255,0.18), rgba(4,9,19,0.96) 58%, #010409 100%)'
                                        : 'radial-gradient(circle at 50% 35%, rgba(50,114,214,0.18), rgba(233,240,249,0.95) 58%, #dfe8f4 100%)',
                            }}
                        >
                            <Plot
                                data={plotData}
                                layout={plotLayout}
                                config={{
                                    displayModeBar: false,
                                    responsive: true,
                                    scrollZoom: false,
                                }}
                                useResizeHandler
                                style={{ width: '100%', height: '100%' }}
                                onRelayout={(event) => {
                                    const nextLon = event['geo.projection.rotation.lon'];
                                    const nextLat = event['geo.projection.rotation.lat'];
                                    if (typeof nextLon === 'number' && Number.isFinite(nextLon)) setRotationLon(nextLon);
                                    if (typeof nextLat === 'number' && Number.isFinite(nextLat)) setRotationLat(nextLat);
                                }}
                                onClick={(event) => {
                                    if (selectedMetric === 'none') return;
                                    const iso3 = `${event.points?.[0]?.location ?? ''}`.trim().toUpperCase();
                                    if (!/^[A-Z]{3}$/.test(iso3)) return;
                                    setPrimaryCountryIso(iso3);
                                }}
                            />
                        </div>
                    </div>
                </article>

                <article className="terminal-widget col-span-2 row-span-2 overflow-hidden md:col-span-3 xl:col-span-4">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Data Controls</p>
                            <p className="mt-1 text-xs terminal-muted">Switch what the globe paints on the world surface.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setRefreshNonce((prev) => prev + 1)}
                            className="terminal-mini-btn px-2 py-1"
                            title="Refresh selected metric"
                        >
                            <RefreshCw className={cn('h-3.5 w-3.5', isLoadingMetric && 'animate-spin')} />
                        </button>
                    </header>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 pr-2">
                        <div className="grid grid-cols-2 gap-2">
                            {METRIC_OPTIONS.map((option) => (
                                <button
                                    key={`tile-${option.key}`}
                                    type="button"
                                    onClick={() => setSelectedMetric(option.key)}
                                    className={cn(
                                        'rounded-lg border px-3 py-3 text-left transition',
                                        selectedMetric === option.key
                                            ? 'border-[var(--terminal-accent)] bg-[color-mix(in_srgb,var(--terminal-accent)_14%,var(--terminal-panel-soft))]'
                                            : 'border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] hover:border-[var(--terminal-border-strong)]'
                                    )}
                                >
                                    <p className="text-sm font-semibold">{option.short}</p>
                                    <p className="mt-1 text-xs terminal-muted">{option.label}</p>
                                </button>
                            ))}
                        </div>

                        <div className="mt-3 rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] terminal-muted">Status</p>
                            <p className="mt-2 text-sm font-semibold">
                                {selectedMetric === 'none'
                                    ? 'Default globe active'
                                    : isLoadingMetric
                                      ? 'Loading metric overlay...'
                                      : activePayload
                                        ? `${activePayload.label} loaded`
                                        : 'Waiting for metric data'}
                            </p>
                            <p className="mt-1 text-xs terminal-muted">
                                {selectedMetric === 'none'
                                    ? 'The globe stays in rotating network mode until a metric is selected.'
                                    : activePayload?.updatedAt
                                      ? `Updated ${formatRelative(activePayload.updatedAt)}`
                                      : 'Select a metric to paint the globe.'}
                            </p>
                            {metricError ? <p className="mt-2 text-xs text-amber-300">{metricError}</p> : null}
                        </div>

                        <div className="mt-3 rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] terminal-muted">Chart focus</p>
                            <p className="mt-2 text-sm font-semibold">
                                {primaryCountryIso
                                    ? sortedCountries.find((country) => country.iso3 === primaryCountryIso)?.country ?? primaryCountryIso
                                    : 'No country selected'}
                            </p>
                            <p className="mt-1 text-xs terminal-muted">
                                Click a country on the globe or use Top Countries to load its historical track.
                            </p>
                        </div>
                    </div>
                </article>

                <article className="terminal-widget col-span-2 row-span-2 overflow-hidden md:col-span-3 xl:col-span-4">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Overlay Stats</p>
                            <p className="mt-1 text-xs terminal-muted">Coverage and range for the selected dataset.</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs terminal-muted">
                            <Radar className="h-3.5 w-3.5" />
                            World Bank
                        </span>
                    </header>
                    <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 p-4">
                        <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] terminal-muted">Coverage</p>
                            <p className="mt-2 text-2xl font-semibold">{activePayload?.stats?.coverage ?? '--'}</p>
                        </div>
                        <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] terminal-muted">Median</p>
                            <p className="mt-2 text-2xl font-semibold">
                                {formatMetricValue(activePayload, activePayload?.stats?.median ?? null)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] terminal-muted">Min</p>
                            <p className="mt-2 text-lg font-semibold">
                                {formatMetricValue(activePayload, activePayload?.stats?.min ?? null)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] terminal-muted">Max</p>
                            <p className="mt-2 text-lg font-semibold">
                                {formatMetricValue(activePayload, activePayload?.stats?.max ?? null)}
                            </p>
                        </div>
                    </div>
                </article>

                <article className="terminal-widget col-span-2 row-span-4 overflow-hidden md:col-span-6 xl:col-span-8">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Historical Compare</p>
                            <p className="mt-1 text-xs terminal-muted">
                                Compare one country against up to three peers and export the chart as JPEG.
                            </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs text-cyan-300">
                            <ChartSpline className="h-3.5 w-3.5" />
                            World Bank history
                        </span>
                    </header>
                    <div className="border-b border-[var(--terminal-border)] px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={primaryCountryIso}
                                onChange={(event) => setPrimaryCountryIso(event.target.value)}
                                disabled={selectedMetric === 'none' || !sortedCountries.length}
                                className="h-9 min-w-44 rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 text-sm text-[var(--terminal-text)] outline-none transition focus:border-[var(--terminal-accent)] disabled:opacity-50"
                            >
                                <option value="">Primary country...</option>
                                {sortedCountries.map((country) => (
                                    <option key={country.iso3} value={country.iso3}>
                                        {country.country}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={pendingCompareIso}
                                onChange={(event) => setPendingCompareIso(event.target.value)}
                                disabled={
                                    selectedMetric === 'none' ||
                                    !primaryCountryIso ||
                                    compareCountryIsos.length >= MAX_COMPARE_COUNTRIES
                                }
                                className="h-9 min-w-44 rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 text-sm text-[var(--terminal-text)] outline-none transition focus:border-[var(--terminal-accent)] disabled:opacity-50"
                            >
                                <option value="">Compare country...</option>
                                {comparisonOptions.map((country) => (
                                    <option key={`compare-${country.iso3}`} value={country.iso3}>
                                        {country.country}
                                    </option>
                                ))}
                            </select>

                            <button
                                type="button"
                                onClick={handleAddCompare}
                                disabled={
                                    !pendingCompareIso ||
                                    selectedMetric === 'none' ||
                                    compareCountryIsos.length >= MAX_COMPARE_COUNTRIES
                                }
                                className="terminal-mini-btn px-3 py-2 disabled:opacity-50"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add compare
                            </button>

                            <div className="ml-auto flex flex-wrap items-center gap-1">
                                {HISTORY_YEARS_OPTIONS.map((years) => (
                                    <button
                                        key={years}
                                        type="button"
                                        onClick={() => setHistoryYears(years)}
                                        className={cn(
                                            'terminal-mini-btn',
                                            historyYears === years && 'terminal-mini-btn-active'
                                        )}
                                    >
                                        {years}Y
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleExportHistory}
                                    disabled={!primaryHistoryPayload?.series.length || isExporting}
                                    className="terminal-mini-btn px-3 py-2 disabled:opacity-50"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    {isExporting ? 'Exporting...' : 'Export JPEG'}
                                </button>
                            </div>
                        </div>
                        {compareCountryIsos.length ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                {compareCountryIsos.map((iso3) => {
                                    const country = sortedCountries.find((item) => item.iso3 === iso3);
                                    return (
                                        <span
                                            key={`chip-${iso3}`}
                                            className="inline-flex items-center gap-2 rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 py-1 text-xs"
                                        >
                                            {country?.country ?? iso3}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setCompareCountryIsos((prev) => prev.filter((item) => item !== iso3))
                                                }
                                                className="text-[var(--terminal-muted)] transition hover:text-[var(--terminal-text)]"
                                                aria-label={`Remove ${country?.country ?? iso3}`}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                    <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                        <div
                            ref={historyChartRef}
                            className="min-h-[420px] rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3"
                        >
                            {selectedMetric === 'none' ? (
                                <div className="flex h-full items-center justify-center text-sm terminal-muted">
                                    Select a macro overlay to unlock historical country comparison.
                                </div>
                            ) : primaryHistoryPayload?.series.length ? (
                                <Plot
                                    data={historyTraces}
                                    layout={historyLayout}
                                    config={{
                                        displayModeBar: false,
                                        responsive: true,
                                        scrollZoom: false,
                                    }}
                                    useResizeHandler
                                    style={{ width: '100%', height: '100%' }}
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm terminal-muted">
                                    {historyStatus === 'loading'
                                        ? 'Loading historical chart...'
                                        : 'No historical values found for this country.'}
                                </div>
                            )}
                        </div>

                        <div className="grid gap-3">
                            <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                                <p className="text-[11px] uppercase tracking-[0.14em] terminal-muted">Latest</p>
                                <p className="mt-2 text-2xl font-semibold">
                                    {formatMetricValue(primaryHistoryPayload, primaryHistoryStats.latest?.value ?? null)}
                                </p>
                                <p className="text-xs terminal-muted">{primaryHistoryStats.latest?.year ?? 'n/a'}</p>
                            </div>

                            <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                                <p className="text-[11px] uppercase tracking-[0.14em] terminal-muted">{historyYears}Y Change</p>
                                <p
                                    className={cn(
                                        'mt-2 text-2xl font-semibold',
                                        (primaryHistoryStats.changeAbsolute ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                                    )}
                                >
                                    {formatMetricValue(primaryHistoryPayload, primaryHistoryStats.changeAbsolute)}
                                </p>
                                <p className="text-xs terminal-muted">
                                    {typeof primaryHistoryStats.changePercent === 'number'
                                        ? `${primaryHistoryStats.changePercent >= 0 ? '+' : ''}${primaryHistoryStats.changePercent.toFixed(2)}%`
                                        : 'n/a'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                                <p className="text-[11px] uppercase tracking-[0.14em] terminal-muted">Range</p>
                                <p className="mt-2 text-sm font-semibold">
                                    Min: {formatMetricValue(primaryHistoryPayload, primaryHistoryStats.min)}
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    Max: {formatMetricValue(primaryHistoryPayload, primaryHistoryStats.max)}
                                </p>
                                <p className="mt-2 text-xs terminal-muted">
                                    Updated {formatRelative(primaryHistoryPayload?.updatedAt ?? null)}
                                </p>
                            </div>

                            <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                                <p className="text-[11px] uppercase tracking-[0.14em] terminal-muted">Source</p>
                                <p className="mt-2 text-sm font-semibold">World Bank API</p>
                                <p className="mt-1 text-xs terminal-muted">
                                    {primaryHistoryPayload
                                        ? formatAxisValue(primaryHistoryPayload.unit, primaryHistoryStats.latest?.value ?? 0)
                                        : '--'}
                                </p>
                            </div>
                        </div>
                    </div>
                    {historyError ? <p className="px-3 pb-3 text-xs text-amber-300">{historyError}</p> : null}
                    {exportError ? <p className="px-3 pb-3 text-xs text-amber-300">{exportError}</p> : null}
                </article>

                <article className="terminal-widget col-span-2 row-span-4 overflow-hidden md:col-span-6 xl:col-span-4">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Top Countries</p>
                            <p className="mt-1 text-xs terminal-muted">Highest values for the active overlay.</p>
                        </div>
                    </header>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {topCountries.length ? (
                            topCountries.map((country) => {
                                const isPrimary = country.iso3 === primaryCountryIso;
                                const isCompared = compareCountryIsos.includes(country.iso3);
                                return (
                                    <div key={`${country.iso3}-${country.year}`} className="terminal-news-row">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold">{country.country}</p>
                                                <p className="text-xs terminal-muted">
                                                    {country.iso3} - {country.year}
                                                </p>
                                            </div>
                                            <p className="text-sm font-semibold">
                                                {formatMetricValue(activePayload, country.value)}
                                            </p>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPrimaryCountryIso(country.iso3)}
                                                className={cn(
                                                    'terminal-mini-btn px-2.5 py-1',
                                                    isPrimary && 'terminal-mini-btn-active'
                                                )}
                                            >
                                                {isPrimary ? 'Chart focus' : 'Set chart'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isCompared || isPrimary || compareCountryIsos.length >= MAX_COMPARE_COUNTRIES) {
                                                        return;
                                                    }
                                                    setCompareCountryIsos((prev) =>
                                                        [...prev, country.iso3].slice(0, MAX_COMPARE_COUNTRIES)
                                                    );
                                                }}
                                                disabled={isCompared || isPrimary || compareCountryIsos.length >= MAX_COMPARE_COUNTRIES}
                                                className="terminal-mini-btn px-2.5 py-1 disabled:opacity-50"
                                            >
                                                {isCompared ? 'Compared' : 'Add compare'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="px-3 py-4 text-sm terminal-muted">
                                {selectedMetric === 'none'
                                    ? 'No overlay selected. Pick GDP, inflation, interest, unemployment, or debt.'
                                    : isLoadingMetric
                                      ? 'Loading countries...'
                                      : 'No country values available.'}
                            </div>
                        )}
                    </div>
                </article>
            </div> : null}
        </section>
    );
};

export default TerminalNewsGlobeClient;
