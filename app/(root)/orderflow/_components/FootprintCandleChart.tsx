"use client";

import { useEffect, useRef, useState } from "react";

import {
    CandlestickData,
    CrosshairMode,
    IChartApi,
    ISeriesApi,
    LogicalRange,
    UTCTimestamp,
    loadLightweightCharts,
} from "@/utils/lightweight-charts-loader";

const INTERVAL_SECONDS: Record<string, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
};

const WINDOW_MS = 2 * 60 * 60 * 1000;

interface FootprintCandleChartProps {
    symbol: string;
    interval: keyof typeof INTERVAL_SECONDS;
}

const trimToWindow = (candles: CandlestickData[], interval: keyof typeof INTERVAL_SECONDS) => {
    if (!candles.length) return candles;
    const cutoff = (Date.now() - WINDOW_MS) / 1000;
    const maxBars = Math.ceil(WINDOW_MS / (INTERVAL_SECONDS[interval] * 1000));
    const filtered = candles.filter((bar) => bar.time >= cutoff);
    return filtered.slice(-maxBars);
};

export function FootprintCandleChart({ symbol, interval }: FootprintCandleChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);
    const candlesRef = useRef<CandlestickData[]>([]);
    const followLiveRef = useRef(true);

    const [candles, setCandles] = useState<CandlestickData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [followLive, setFollowLive] = useState(true);
    const [chartReady, setChartReady] = useState(false);

    useEffect(() => {
        followLiveRef.current = followLive;
        if (followLive) {
            chartRef.current?.timeScale().scrollToRealTime();
        }
    }, [followLive]);

    useEffect(() => {
        let disposed = false;

        const setupChart = async () => {
            const container = containerRef.current;
            if (!container || disposed) return;

            const { createChart } = await loadLightweightCharts();
            if (disposed) return;

            const chart = createChart(container, {
                layout: {
                    background: { color: "transparent" },
                    textColor: "#e5e7eb",
                },
                rightPriceScale: {
                    borderVisible: false,
                },
                timeScale: {
                    borderVisible: false,
                    secondsVisible: interval === "1m",
                },
                crosshair: {
                    mode: CrosshairMode.Normal,
                },
                grid: {
                    vertLines: { color: "rgba(255,255,255,0.04)" },
                    horzLines: { color: "rgba(255,255,255,0.06)" },
                },
            });

            const series = chart.addCandlestickSeries({
                upColor: "#34d399",
                downColor: "#f87171",
                borderUpColor: "#34d399",
                borderDownColor: "#f87171",
                wickUpColor: "#34d399",
                wickDownColor: "#f87171",
            });

            chartRef.current = chart;
            seriesRef.current = series;

            resizeObserverRef.current = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    chart.applyOptions({ width, height });
                }
            });

            resizeObserverRef.current.observe(container);
            setChartReady(true);
        };

        setupChart();

        return () => {
            disposed = true;
            websocketRef.current?.close();
            resizeObserverRef.current?.disconnect();
            chartRef.current?.remove();
            chartRef.current = null;
            seriesRef.current = null;
            setChartReady(false);
        };
    }, []);

    useEffect(() => {
        const handleRangeChange = (range: LogicalRange) => {
            if (!range || !candlesRef.current.length) return;
            const lastIndex = candlesRef.current.length - 1;
            if (followLiveRef.current && range.to < lastIndex - 0.5) {
                setFollowLive(false);
            }
        };

        const chart = chartRef.current;
        const scale = chart?.timeScale();
        if (!chart || !scale) return;

        scale.subscribeVisibleLogicalRangeChange(handleRangeChange);

        return () => scale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
    }, [chartReady, interval]);

    useEffect(() => {
        if (!chartReady) return;

        let cancelled = false;

        const backfillHistory = async () => {
            setLoading(true);
            setError(null);

            try {
                const endTime = Date.now();
                const startTime = endTime - WINDOW_MS;
                const params = new URLSearchParams({
                    symbol: symbol.toUpperCase(),
                    interval,
                    startTime: String(startTime),
                    endTime: String(endTime),
                });
                const urls = [
                    `https://api.binance.com/api/v3/klines?${params.toString()}`,
                    `https://data-api.binance.vision/api/v3/klines?${params.toString()}`,
                ];

                let klines: unknown[] = [];
                let lastError: Error | null = null;
                for (const url of urls) {
                    try {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        klines = await response.json();
                        if (!Array.isArray(klines)) throw new Error("Invalid kline response");
                        lastError = null;
                        break;
                    } catch (error) {
                        lastError = error as Error;
                    }
                }

                if (lastError) throw lastError;

                const parsed: CandlestickData[] = klines.map((kline) => {
                    const [openTime, open, high, low, close] = kline as [number, string, string, string, string];
                    return {
                        time: (openTime / 1000) as UTCTimestamp,
                        open: Number(open),
                        high: Number(high),
                        low: Number(low),
                        close: Number(close),
                    } satisfies CandlestickData;
                });

                const trimmed = trimToWindow(parsed, interval);
                if (cancelled) return;

                candlesRef.current = trimmed;
                setCandles(trimmed);
                seriesRef.current?.setData(trimmed);
                setLoading(false);
                if (followLiveRef.current) {
                    chartRef.current?.timeScale().scrollToRealTime();
                }
            } catch (error) {
                if (cancelled) return;
                console.error("Failed to load klines", error);
                setError("Failed to load recent candles. Please try again.");
                setLoading(false);
            }
        };

        backfillHistory();

        return () => {
            cancelled = true;
            setCandles([]);
            candlesRef.current = [];
            websocketRef.current?.close();
        };
    }, [chartReady, interval, symbol]);

    useEffect(() => {
        if (!candles.length || !seriesRef.current) return;

        websocketRef.current?.close();
        const stream = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;
        const socket = new WebSocket(stream);
        websocketRef.current = socket;

        socket.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                const kline = parsed?.k;
                if (!kline) return;

                const openTime: UTCTimestamp = Math.floor(kline.t / 1000);
                const nextBar: CandlestickData = {
                    time: openTime,
                    open: Number(kline.o),
                    high: Number(kline.h),
                    low: Number(kline.l),
                    close: Number(kline.c),
                };

                setCandles((prev) => {
                    const updated = [...prev];
                    if (updated.length && updated[updated.length - 1]?.time === nextBar.time) {
                        updated[updated.length - 1] = nextBar;
                        seriesRef.current?.update(nextBar);
                    } else {
                        updated.push(nextBar);
                        seriesRef.current?.update(nextBar);
                    }
                    const trimmed = trimToWindow(updated, interval);
                    candlesRef.current = trimmed;
                    if (trimmed.length !== updated.length) {
                        seriesRef.current?.setData(trimmed);
                    }
                    if (followLiveRef.current) {
                        chartRef.current?.timeScale().scrollToRealTime();
                    }
                    return trimmed;
                });
            } catch (error) {
                console.error("Failed to process kline", error);
            }
        };

        return () => socket.close();
    }, [candles.length, chartReady, interval, symbol]);

    const goLive = () => {
        setFollowLive(true);
        chartRef.current?.timeScale().scrollToRealTime();
    };

    return (
        <div className="relative h-[520px] overflow-hidden rounded-lg border border-gray-900 bg-black/20">
            <div ref={containerRef} className="h-full w-full" />
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-300">
                    Loading chart…
                </div>
            )}
            {error && !loading && (
                <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-400">
                    {error}
                </div>
            )}
            {!followLive && !loading && !error && (
                <div className="absolute right-4 top-4">
                    <button
                        type="button"
                        onClick={goLive}
                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-emerald-600/40"
                    >
                        Go live
                    </button>
                </div>
            )}
        </div>
    );
}
