'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EChartsOption, EChartsType } from 'echarts';
import { ArrowLeft } from 'lucide-react';
import EChart from '@/components/charts/EChart';
import { cn } from '@/lib/utils';

type ChartMode = 'candles' | 'line' | 'percent';

type HistoryPoint = {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number | null;
};

type HistoryResponse = {
    updatedAt: string;
    source: 'yahoo';
    symbol: string;
    name: string;
    currency: string | null;
    range: string;
    points: HistoryPoint[];
};

const RANGE_OPTIONS = [
    { key: '1D', label: '1D' },
    { key: '1M', label: '1M' },
    { key: '3M', label: '3M' },
    { key: 'YTD', label: 'YTD' },
    { key: '1Y', label: '1Y' },
    { key: '5Y', label: '5Y' },
] as const;

const MODE_OPTIONS: Array<{ key: ChartMode; label: string }> = [
    { key: 'candles', label: 'Candles' },
    { key: 'line', label: 'Line' },
    { key: 'percent', label: '% Chart' },
];

const FALLBACK_SYMBOL = '^GSPC';

const formatPrice = (value: number, currency: string | null) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency ?? 'USD',
        maximumFractionDigits: 2,
    }).format(value);

const formatAxisTime = (unixMillis: number, range: string) => {
    const date = new Date(unixMillis);
    if (range === '1D') {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    if (range === '1M' || range === '3M') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const formatDateLong = (unixSeconds: number) =>
    new Date(unixSeconds * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

const toTicker = (symbol: string) => symbol.replace('^', '');
const clampPercent = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

const quantile = (values: number[], ratio: number) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const position = (sorted.length - 1) * Math.min(Math.max(ratio, 0), 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sorted[lower];
    const weight = position - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const TerminalInstrumentChartClient = () => {
    const searchParams = useSearchParams();
    const symbol = (searchParams.get('symbol') ?? FALLBACK_SYMBOL).trim().toUpperCase();
    const searchLabel = searchParams.get('label')?.trim() ?? '';

    const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]['key']>('1Y');
    const [mode, setMode] = useState<ChartMode>('candles');
    const [payload, setPayload] = useState<HistoryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const chartRef = useRef<EChartsType | null>(null);
    const [chartInstanceVersion, setChartInstanceVersion] = useState(0);

    useEffect(() => {
        const shell = document.querySelector<HTMLElement>('.terminal-shell');
        if (!shell) return;

        const applyTheme = () => {
            setTheme(shell.getAttribute('data-terminal-theme') === 'light' ? 'light' : 'dark');
        };

        applyTheme();
        const observer = new MutationObserver(applyTheme);
        observer.observe(shell, { attributes: true, attributeFilter: ['data-terminal-theme'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(
                    `/api/market/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`,
                    { cache: 'no-store', signal: controller.signal }
                );
                const data = (await response.json()) as HistoryResponse;
                if (!isMounted) return;
                setPayload(data);
            } catch (fetchError) {
                if (!isMounted || controller.signal.aborted) return;
                setError(fetchError instanceof Error ? fetchError.message : 'Failed to load chart history');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        void load();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [range, symbol]);

    const points = useMemo(() => payload?.points ?? [], [payload]);
    const chartPoints = useMemo(
        () =>
            points.filter((point) =>
                [point.o, point.h, point.l, point.c].every((value) => Number.isFinite(value) && value > 0)
            ),
        [points]
    );
    const displayName = searchLabel || payload?.name || symbol;
    const latestPoint = chartPoints[chartPoints.length - 1];
    const previousPoint = chartPoints[chartPoints.length - 2];
    const latestPrice = latestPoint?.c ?? null;
    const change = latestPoint && previousPoint ? latestPoint.c - previousPoint.c : null;
    const changePct = latestPoint && previousPoint && previousPoint.c !== 0 ? (change! / previousPoint.c) * 100 : null;

    const palette = useMemo(
        () =>
            theme === 'dark'
                ? {
                      bg: '#0f1622',
                      text: '#e4e9f2',
                      muted: '#9ea8b8',
                      border: '#2b3445',
                      grid: '#273244',
                      up: '#16b97f',
                      down: '#de5a51',
                      line: '#2794ff',
                      percent: '#7a2fff',
                  }
                : {
                      bg: '#f3f5f8',
                      text: '#111827',
                      muted: '#556277',
                      border: '#bac3d1',
                      grid: '#c4cdd8',
                      up: '#0d8f5d',
                      down: '#c43e34',
                      line: '#1376d3',
                      percent: '#6d33f1',
                  },
        [theme]
    );

    const chartOption = useMemo<EChartsOption>(() => {
        if (!chartPoints.length) {
            return {
                backgroundColor: palette.bg,
                xAxis: { show: false },
                yAxis: { show: false },
                series: [],
            };
        }

        const candleData = chartPoints.map((point) => [point.t * 1000, point.o, point.c, point.l, point.h]);
        const closeData = chartPoints.map((point) => [point.t * 1000, point.c]);
        const baseClose = chartPoints[0]?.c ?? 1;
        const percentData = chartPoints.map((point) => [point.t * 1000, ((point.c - baseClose) / baseClose) * 100]);
        const selectedData = mode === 'percent' ? percentData.map((item) => item[1]) : closeData.map((item) => item[1]);
        const selectedMax = Math.max(...selectedData);
        const selectedMin = Math.min(...selectedData);
        const pad = Math.max((selectedMax - selectedMin) * 0.1, mode === 'percent' ? 0.4 : 0.8);
        const candleHighs = chartPoints.map((point) => point.h);
        const candleLows = chartPoints.map((point) => point.l);
        const lowerBound = quantile(candleLows, 0.02);
        const upperBound = quantile(candleHighs, 0.98);
        const latestLow = chartPoints[chartPoints.length - 1]?.l ?? lowerBound;
        const latestHigh = chartPoints[chartPoints.length - 1]?.h ?? upperBound;
        const candleMin = Math.min(lowerBound, latestLow);
        const candleMax = Math.max(upperBound, latestHigh);
        const candlePad = Math.max((candleMax - candleMin) * 0.1, 1);

        return {
            backgroundColor: palette.bg,
            animation: false,
            grid: { left: 18, right: 92, top: 18, bottom: 42, containLabel: true },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: palette.bg,
                borderColor: palette.border,
                textStyle: { color: palette.text },
                formatter: (paramsRaw) => {
                    const params = Array.isArray(paramsRaw) ? paramsRaw : [paramsRaw];
                    const pointIndex = Number(params[0]?.dataIndex ?? 0);
                    const point = chartPoints[pointIndex];
                    if (!point) return '';

                    if (mode === 'candles') {
                        return [
                            `<strong>${formatDateLong(point.t)}</strong>`,
                            `Open: ${point.o.toFixed(2)}`,
                            `High: ${point.h.toFixed(2)}`,
                            `Low: ${point.l.toFixed(2)}`,
                            `Close: ${point.c.toFixed(2)}`,
                        ].join('<br/>');
                    }

                    const value = Number(params[0]?.value ?? point.c);
                    if (mode === 'percent') {
                        return `<strong>${formatDateLong(point.t)}</strong><br/>${toTicker(symbol)}: ${value.toFixed(2)}%`;
                    }
                    return `<strong>${formatDateLong(point.t)}</strong><br/>${toTicker(symbol)}: ${value.toFixed(2)}`;
                },
            },
            xAxis: {
                type: 'time',
                boundaryGap: false,
                min: 'dataMin',
                max: 'dataMax',
                axisLine: { lineStyle: { color: palette.border } },
                axisLabel: {
                    color: palette.muted,
                    fontSize: 11,
                    hideOverlap: true,
                    formatter: (value: number) => formatAxisTime(value, range),
                },
                axisTick: { show: false },
                splitLine: { lineStyle: { color: palette.grid, type: 'dashed' } },
            },
            yAxis: {
                type: 'value',
                position: 'right',
                min: mode === 'candles' ? candleMin - candlePad : selectedMin - pad,
                max: mode === 'candles' ? candleMax + candlePad : selectedMax + pad,
                splitNumber: 6,
                axisLine: { lineStyle: { color: palette.border } },
                splitLine: { lineStyle: { color: palette.grid, type: 'dashed' } },
                axisLabel: {
                    color: palette.muted,
                    margin: 12,
                    formatter: (value: number) =>
                        mode === 'percent'
                            ? `${value.toFixed(1)}%`
                            : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                },
            },
            dataZoom: [
                {
                    id: 'xZoom',
                    type: 'inside',
                    xAxisIndex: 0,
                    filterMode: 'none',
                    start: 0,
                    end: 100,
                    zoomOnMouseWheel: true,
                    moveOnMouseWheel: false,
                    moveOnMouseMove: false,
                    preventDefaultMouseMove: true,
                },
                {
                    id: 'yZoom',
                    type: 'inside',
                    yAxisIndex: 0,
                    filterMode: 'none',
                    start: 0,
                    end: 100,
                    zoomOnMouseWheel: true,
                    moveOnMouseWheel: false,
                    moveOnMouseMove: false,
                    preventDefaultMouseMove: true,
                },
            ],
            series:
                mode === 'candles'
                    ? [
                          {
                              type: 'candlestick',
                              data: candleData,
                              barMaxWidth: 12,
                              barMinWidth: 3,
                              itemStyle: {
                                  color: palette.up,
                                  color0: palette.down,
                                  borderColor: palette.up,
                                  borderColor0: palette.down,
                              },
                          },
                      ]
                    : [
                          {
                              type: 'line',
                              data: mode === 'percent' ? percentData : closeData,
                              showSymbol: false,
                              smooth: false,
                              lineStyle: { width: 2, color: mode === 'percent' ? palette.percent : palette.line },
                              itemStyle: { color: mode === 'percent' ? palette.percent : palette.line },
                          },
                      ],
        };
    }, [chartPoints, mode, palette, range, symbol]);

    const onChartReady = useCallback((instance: EChartsType) => {
        chartRef.current = instance;
        setChartInstanceVersion((prev) => prev + 1);
    }, []);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;
        const dom = chart.getDom?.() as HTMLElement | null;
        const zr = chart.getZr?.();
        if (!dom || !zr) return;

        const zoomState = {
            x: { start: 0, end: 100 },
            y: { start: 0, end: 100 },
        };
        let drag:
            | {
                  startX: number;
                  startY: number;
                  xStart: number;
                  xEnd: number;
                  yStart: number;
                  yEnd: number;
              }
            | null = null;

        const syncZoomFromOption = () => {
            const option = chart.getOption() as { dataZoom?: Array<{ id?: string; start?: number; end?: number }> };
            const zoomList = option.dataZoom ?? [];
            const xZoom = zoomList.find((item) => item.id === 'xZoom') ?? zoomList[0];
            const yZoom = zoomList.find((item) => item.id === 'yZoom') ?? zoomList[1];
            if (typeof xZoom?.start === 'number' && typeof xZoom?.end === 'number') {
                zoomState.x.start = xZoom.start;
                zoomState.x.end = xZoom.end;
            }
            if (typeof yZoom?.start === 'number' && typeof yZoom?.end === 'number') {
                zoomState.y.start = yZoom.start;
                zoomState.y.end = yZoom.end;
            }
        };

        syncZoomFromOption();

        const onDataZoom = () => {
            syncZoomFromOption();
        };

        const onContextMenu = (event: Event) => {
            event.preventDefault();
        };

        const onMouseDown = (evt: { event?: { button?: number }; offsetX?: number; offsetY?: number }) => {
            if (evt.event?.button !== 2) return;
            syncZoomFromOption();
            drag = {
                startX: evt.offsetX ?? 0,
                startY: evt.offsetY ?? 0,
                xStart: zoomState.x.start,
                xEnd: zoomState.x.end,
                yStart: zoomState.y.start,
                yEnd: zoomState.y.end,
            };
        };

        const onMouseMove = (evt: { offsetX?: number; offsetY?: number }) => {
            if (!drag) return;

            const width = Math.max(chart.getWidth() - 120, 120);
            const height = Math.max(chart.getHeight() - 96, 120);
            const dx = (evt.offsetX ?? 0) - drag.startX;
            const dy = (evt.offsetY ?? 0) - drag.startY;

            const xSpan = Math.max(drag.xEnd - drag.xStart, 0.1);
            const ySpan = Math.max(drag.yEnd - drag.yStart, 0.1);
            const xShift = (-dx / width) * xSpan;
            const yShift = (dy / height) * ySpan;

            const xStart = clampPercent(drag.xStart + xShift, 0, 100 - xSpan);
            const yStart = clampPercent(drag.yStart + yShift, 0, 100 - ySpan);

            chart.dispatchAction({
                type: 'dataZoom',
                dataZoomId: 'xZoom',
                start: xStart,
                end: xStart + xSpan,
            });
            chart.dispatchAction({
                type: 'dataZoom',
                dataZoomId: 'yZoom',
                start: yStart,
                end: yStart + ySpan,
            });
        };

        const onMouseUp = () => {
            drag = null;
        };

        chart.on('datazoom', onDataZoom);
        dom.addEventListener('contextmenu', onContextMenu);
        zr.on('mousedown', onMouseDown);
        zr.on('mousemove', onMouseMove);
        zr.on('mouseup', onMouseUp);
        zr.on('globalout', onMouseUp);

        return () => {
            drag = null;
            if (!chart.isDisposed?.()) {
                chart.off('datazoom', onDataZoom);
            }
            dom.removeEventListener('contextmenu', onContextMenu);
            zr.off('mousedown', onMouseDown);
            zr.off('mousemove', onMouseMove);
            zr.off('mouseup', onMouseUp);
            zr.off('globalout', onMouseUp);
        };
    }, [chartInstanceVersion]);

    return (
        <section className="space-y-3">
            <div className="terminal-banner">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link href="/terminal/dashboard" className="terminal-mini-btn">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Link>
                        <p className="terminal-banner-kicker">Instrument Chart</p>
                    </div>
                    <p className="text-xl font-semibold">{displayName}</p>
                    <p className="text-sm terminal-muted">
                        {symbol} {latestPrice !== null ? `• ${formatPrice(latestPrice, payload?.currency ?? 'USD')}` : ''}{' '}
                        {change !== null && changePct !== null ? (
                            <span className={cn(change >= 0 ? 'terminal-up' : 'terminal-down')}>
                                ({change >= 0 ? '+' : ''}
                                {change.toFixed(2)} / {changePct >= 0 ? '+' : ''}
                                {changePct.toFixed(2)}%)
                            </span>
                        ) : null}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                        {RANGE_OPTIONS.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setRange(item.key)}
                                className={cn('terminal-mini-btn', range === item.key && 'terminal-mini-btn-active')}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1">
                        {MODE_OPTIONS.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setMode(item.key)}
                                className={cn('terminal-mini-btn', mode === item.key && 'terminal-mini-btn-active')}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <article className="terminal-widget" style={{ height: 'max(68vh, 560px)' }}>
                <header className="terminal-widget-head">
                    <p className="text-sm font-semibold">
                        {toTicker(symbol)} {mode === 'candles' ? 'Candlestick' : mode === 'line' ? 'Line' : 'Percent'} Chart
                    </p>
                    <span className="text-xs terminal-muted">
                        {payload?.updatedAt ? `Updated ${new Date(payload.updatedAt).toLocaleTimeString()}` : 'No live update yet'}
                    </span>
                </header>
                <div className="min-h-0 flex-1 p-2">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center text-sm terminal-muted">Loading chart...</div>
                    ) : error ? (
                        <div className="flex h-full items-center justify-center text-sm terminal-down">{error}</div>
                    ) : chartPoints.length < 2 ? (
                        <div className="flex h-full items-center justify-center text-sm terminal-muted">No historical data available for this symbol.</div>
                    ) : (
                        <div className="h-full min-h-[480px]">
                            <EChart option={chartOption} onChartReady={onChartReady} style={{ height: '100%', width: '100%' }} />
                        </div>
                    )}
                </div>
            </article>
        </section>
    );
};

export default TerminalInstrumentChartClient;
