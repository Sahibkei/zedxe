"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type {
    CandlestickData,
    IChartApi,
    ISeriesApi,
    LogicalRange,
    MouseEventParams,
    UTCTimestamp,
} from "@/utils/lightweight-charts-loader";
import { CrosshairMode, loadLightweightCharts } from "@/utils/lightweight-charts-loader";

import { FootprintSideLadder } from "./FootprintSideLadder";
import { CandleFootprint } from "./footprint-types";

type FootprintMode = "Bid x Ask" | "Delta" | "Volume";

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
    mode: FootprintMode;
    showNumbers: boolean;
    highlightImbalances: boolean;
    imbalanceRatio?: number;
    priceStep: number | null;
    getFootprintForCandle: (tSec: number) => CandleFootprint | null;
    footprintUpdateKey?: number | null;
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
    mode,
    showNumbers,
    highlightImbalances,
    imbalanceRatio = 1.5,
    priceStep,
    getFootprintForCandle,
    footprintUpdateKey,
}: FootprintCandleChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartContainerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);
    const candlesRef = useRef<CandlestickData[]>([]);
    const followLiveRef = useRef(true);
    const latestCandleTimeRef = useRef<number | null>(null);
    const isHoveringRef = useRef(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [followLive, setFollowLive] = useState(true);
    const [selectedTimeSec, setSelectedTimeSec] = useState<number | null>(null);
    const [chartHeight, setChartHeight] = useState<number | null>(null);

    useEffect(() => {
        followLiveRef.current = followLive;
    }, [followLive]);

    useEffect(() => {
        let disposed = false;
        let rangeSubscription: ((range: LogicalRange) => void) | null = null;
        let crosshairSubscription: ((param: MouseEventParams) => void) | null = null;

        const setup = async () => {
            setLoading(true);
            setError(null);
            setFollowLive(true);
            followLiveRef.current = true;

            const container = containerRef.current;
            const chartContainer = chartContainerRef.current;
            if (!container || !chartContainer) return;

            const { createChart } = await loadLightweightCharts();
            if (disposed) return;

            const chart = createChart(chartContainer, {
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

            const applyResize = () => {
                const { width, height } = chartContainer.getBoundingClientRect();
                chart.applyOptions({ width: Math.max(width, 0), height: Math.max(height, 0) });
                setChartHeight(height);
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

            crosshairSubscription = (param: MouseEventParams) => {
                const time = param.time as number | undefined;
                if (time == null) {
                    isHoveringRef.current = false;
                    setSelectedTimeSec(latestCandleTimeRef.current);
                    return;
                }
                isHoveringRef.current = true;
                setSelectedTimeSec(time);
            };

            chart.subscribeCrosshairMove(crosshairSubscription);

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
                const latest = trimmed[trimmed.length - 1]?.time ?? null;
                latestCandleTimeRef.current = latest ?? null;
                if (!isHoveringRef.current) {
                    setSelectedTimeSec(latest ?? null);
                }
                series.setData(trimmed);
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
                    const latest = trimmed[trimmed.length - 1]?.time ?? null;
                    latestCandleTimeRef.current = latest ?? null;
                    if (!isHoveringRef.current) {
                        setSelectedTimeSec(latest ?? null);
                    }

                    if (trimmedChanged) {
                        series.setData(trimmed);
                    } else if (updated.length === trimmed.length) {
                        series.update(nextBar);
                    }

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

            if (crosshairSubscription && chartRef.current) {
                chartRef.current.unsubscribeCrosshairMove(crosshairSubscription);
            }

            chartRef.current?.remove();
            chartRef.current = null;
            seriesRef.current = null;
            candlesRef.current = [];
            latestCandleTimeRef.current = null;
            isHoveringRef.current = false;
            setSelectedTimeSec(null);
        };
    }, [symbol, interval]);

    const goLive = () => {
        followLiveRef.current = true;
        setFollowLive(true);
        chartRef.current?.timeScale().scrollToRealTime();
    };

    useEffect(() => {
        if (!isHoveringRef.current) {
            setSelectedTimeSec(latestCandleTimeRef.current);
        }
    }, [footprintUpdateKey]);

    const selectedFootprint = useMemo(
        () => (selectedTimeSec ? getFootprintForCandle(selectedTimeSec) : null),
        [getFootprintForCandle, selectedTimeSec, footprintUpdateKey],
    );

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="flex h-full w-full overflow-hidden rounded-lg">
                <div ref={chartContainerRef} className="relative h-full flex-1">
                    <div className="h-full w-full" />
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
                <FootprintSideLadder
                    footprint={selectedFootprint}
                    selectedTimeSec={selectedTimeSec}
                    mode={mode}
                    showNumbers={showNumbers}
                    highlightImbalances={highlightImbalances}
                    imbalanceRatio={imbalanceRatio}
                    priceStep={priceStep}
                    maxHeight={chartHeight}
                />
            </div>
        </div>
    );
}
