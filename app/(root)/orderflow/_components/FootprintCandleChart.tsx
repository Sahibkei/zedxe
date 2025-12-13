"use client";

import { useEffect, useRef, useState } from "react";

import type {
    CandlestickData,
    IChartApi,
    ISeriesApi,
    LogicalRange,
    UTCTimestamp,
} from "@/utils/lightweight-charts-loader";
import { CrosshairMode, loadLightweightCharts } from "@/utils/lightweight-charts-loader";
import { drawFootprintLadderOverlay } from "./FootprintLadderOverlayCanvas";

const INTERVAL_SECONDS: Record<string, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
};

const WINDOW_MS = 2 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

interface FootprintCandleChartProps {
    symbol: string;
    interval: keyof typeof INTERVAL_SECONDS;
    getFootprintForCandle?: (tSec: number) => {
        levels: { price: number; bid: number; ask: number; total: number }[];
        buyTotal: number;
        sellTotal: number;
    } | null;
    priceStep?: number | null;
    mode?: "bidAsk" | "delta" | "volume";
    showNumbers?: boolean;
    highlightImbalances?: boolean;
    footprintUpdateKey?: string | number | null;
}

const fetchWithTimeout = async (url: string, { timeoutMs }: { timeoutMs: number }) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
};

const trimToWindow = (candles: CandlestickData[]) => {
    if (!candles.length) return candles;
    const cutoffSec = (Date.now() - WINDOW_MS) / 1000;
    return candles.filter((bar) => bar.time >= cutoffSec);
};

export function FootprintCandleChart({
    symbol,
    interval,
    getFootprintForCandle,
    priceStep,
    mode = "bidAsk",
    showNumbers = true,
    highlightImbalances = false,
    footprintUpdateKey,
}: FootprintCandleChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartMountRef = useRef<HTMLDivElement | null>(null);
    const ladderCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);
    const candlesRef = useRef<CandlestickData[]>([]);
    const followLiveRef = useRef(true);
    const ladderDrawRef = useRef<(() => void) | null>(null);
    const [chartReadyToken, setChartReadyToken] = useState(0);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [followLive, setFollowLive] = useState(true);

    useEffect(() => {
        followLiveRef.current = followLive;
    }, [followLive]);

    useEffect(() => {
        let disposed = false;
        let rangeSubscription: ((range: LogicalRange) => void) | null = null;

        const setup = async () => {
            setLoading(true);
            setError(null);
            setFollowLive(true);
            followLiveRef.current = true;

            const container = containerRef.current;
            const chartMount = chartMountRef.current;
            if (!container || !chartMount) return;

            const { createChart } = await loadLightweightCharts();
            if (disposed) return;

            const chart = createChart(chartMount, {
                layout: {
                    background: { color: "transparent" },
                    textColor: "#e5e7eb",
                },
                rightPriceScale: { borderVisible: false },
                timeScale: { borderVisible: false, secondsVisible: interval === "1m" },
                crosshair: { mode: CrosshairMode.Normal },
                grid: {
                    vertLines: { color: "rgba(255,255,255,0.04)" },
                    horzLines: { color: "rgba(255,255,255,0.06)" },
                },
            });

            chartRef.current = chart;

            const series = chart.addCandlestickSeries({
                upColor: "#34d399",
                downColor: "#f87171",
                borderUpColor: "#34d399",
                borderDownColor: "#f87171",
                wickUpColor: "#34d399",
                wickDownColor: "#f87171",
            });
            seriesRef.current = series;
            setChartReadyToken((token) => token + 1);

            const applyResize = () => {
                const { width, height } = container.getBoundingClientRect();
                chart.applyOptions({ width: Math.max(width, 0), height: Math.max(height, 0) });
                const canvas = ladderCanvasRef.current;
                if (canvas) {
                    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
                    canvas.width = Math.max(Math.floor(width * dpr), 1);
                    canvas.height = Math.max(Math.floor(height * dpr), 1);
                    canvas.style.width = `${Math.max(width, 0)}px`;
                    canvas.style.height = `${Math.max(height, 0)}px`;
                }
            };

            applyResize();
            resizeObserverRef.current = new ResizeObserver(() => applyResize());
            resizeObserverRef.current.observe(container);

            rangeSubscription = (range: LogicalRange) => {
                if (!range || !candlesRef.current.length) return;
                const lastIndex = candlesRef.current.length - 1;
                if (range.to < lastIndex - 0.5 && followLiveRef.current) {
                    followLiveRef.current = false;
                    setFollowLive(false);
                }
            };

            chart.timeScale().subscribeVisibleLogicalRangeChange(rangeSubscription);

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

            try {
                let klines: unknown[] | null = null;
                let lastError: Error | null = null;

                for (const url of urls) {
                    try {
                        const response = await fetchWithTimeout(url, { timeoutMs: FETCH_TIMEOUT_MS });
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        const json = await response.json();
                        if (!Array.isArray(json)) throw new Error("Invalid kline response");
                        klines = json;
                        lastError = null;
                        break;
                    } catch (error) {
                        lastError = error as Error;
                    }
                }

                if (disposed) return;

                if (!klines) {
                    throw lastError ?? new Error("Failed to load klines");
                }

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

                const trimmed = trimToWindow(parsed);
                candlesRef.current = trimmed;
                series.setData(trimmed);
                ladderDrawRef.current?.();
                setFollowLive(true);
                if (followLiveRef.current) {
                    chart.timeScale().scrollToRealTime();
                }
            } catch (error) {
                if (!disposed) {
                    console.error("Failed to load klines", error);
                    setError("Failed to load recent candles. Please try again.");
                }
            } finally {
                if (!disposed) {
                    setLoading(false);
                }
            }

            if (disposed) return;

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

                    const updated = [...candlesRef.current];
                    const last = updated[updated.length - 1];
                    if (last && last.time === nextBar.time) {
                        updated[updated.length - 1] = nextBar;
                    } else {
                        updated.push(nextBar);
                    }

                    const trimmed = trimToWindow(updated);
                    const trimmedChanged = trimmed.length !== updated.length;
                    candlesRef.current = trimmed;

                    if (trimmedChanged) {
                        series.setData(trimmed);
                    } else if (updated.length === trimmed.length) {
                        series.update(nextBar);
                    }

                    ladderDrawRef.current?.();

                    if (followLiveRef.current) {
                        chart.timeScale().scrollToRealTime();
                    }
                } catch (err) {
                    console.error("Failed to process kline", err);
                }
            };
        };

        setup();

        return () => {
            disposed = true;
            websocketRef.current?.close();
            websocketRef.current = null;

            if (rangeSubscription && chartRef.current) {
                chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(rangeSubscription);
            }

            resizeObserverRef.current?.disconnect();
            resizeObserverRef.current = null;

            chartRef.current?.remove();
            chartRef.current = null;
            seriesRef.current = null;
            candlesRef.current = [];
        };
    }, [symbol, interval]);

    useEffect(() => {
        const chart = chartRef.current;
        const series = seriesRef.current;
        const canvas = ladderCanvasRef.current;
        const container = containerRef.current;
        if (!chart || !series || !canvas || !container || !getFootprintForCandle || !priceStep || priceStep <= 0) {
            ladderDrawRef.current = null;
            return;
        }

        let frame: number | null = null;

        const scheduleDraw = () => {
            if (frame != null) return;
            frame = requestAnimationFrame(() => {
                frame = null;
                drawFootprintLadderOverlay({
                    chart,
                    series,
                    canvas,
                    getCandles: () => candlesRef.current,
                    getFootprintForCandle,
                    priceStep,
                    mode,
                    showNumbers,
                    highlightImbalances,
                });
            });
        };

        ladderDrawRef.current = scheduleDraw;
        scheduleDraw();

        const timeScale = chart.timeScale();
        const rangeSubscription = () => scheduleDraw();
        timeScale.subscribeVisibleLogicalRangeChange(rangeSubscription);

        const resizeObserver = new ResizeObserver(() => {
            const { width, height } = container.getBoundingClientRect();
            const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
            canvas.width = Math.max(Math.floor(width * dpr), 1);
            canvas.height = Math.max(Math.floor(height * dpr), 1);
            canvas.style.width = `${Math.max(width, 0)}px`;
            canvas.style.height = `${Math.max(height, 0)}px`;
            scheduleDraw();
        });
        resizeObserver.observe(container);

        return () => {
            ladderDrawRef.current = null;
            if (frame != null) {
                cancelAnimationFrame(frame);
                frame = null;
            }
            timeScale.unsubscribeVisibleLogicalRangeChange(rangeSubscription);
            resizeObserver.disconnect();
        };
    }, [chartReadyToken, getFootprintForCandle, priceStep, mode, showNumbers, highlightImbalances]);

    useEffect(() => {
        if (footprintUpdateKey == null) return;
        ladderDrawRef.current?.();
    }, [footprintUpdateKey]);

    const goLive = () => {
        followLiveRef.current = true;
        setFollowLive(true);
        chartRef.current?.timeScale().scrollToRealTime();
    };

    return (
        <div ref={containerRef} className="relative h-full w-full">
            <div ref={chartMountRef} className="h-full w-full" />
            <canvas ref={ladderCanvasRef} className="pointer-events-none absolute inset-0 z-20" />
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
