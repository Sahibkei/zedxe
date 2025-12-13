"use client";

import { useEffect, useRef, useState } from "react";

import type {
    CandlestickData,
    IChartApi,
    ISeriesApi,
    LogicalRange,
    MouseEventParams,
    UTCTimestamp,
} from "@/utils/lightweight-charts-loader";
import { CrosshairMode, loadLightweightCharts } from "@/utils/lightweight-charts-loader";

import { CandleFootprint } from "./footprint-types";

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
    getFootprintForCandle: (tSec: number) => CandleFootprint | null;
    footprintUpdateKey?: number | null;
    onSelectionChange?: (payload: { timeSec: number | null; footprint: CandleFootprint | null }) => void;
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
    footprintUpdateKey,
    onSelectionChange,
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
    const lastCrosshairTimeRef = useRef<number | null>(null);
    const selectedTimeRef = useRef<number | null>(null);
    const onSelectionChangeRef = useRef<FootprintCandleChartProps["onSelectionChange"]>(onSelectionChange);
    const getFootprintForCandleRef = useRef(getFootprintForCandle);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [followLive, setFollowLive] = useState(true);
    const [selectedTimeSec, setSelectedTimeSec] = useState<number | null>(null);

    useEffect(() => {
        followLiveRef.current = followLive;
    }, [followLive]);

    useEffect(() => {
        selectedTimeRef.current = selectedTimeSec;
    }, [selectedTimeSec]);

    useEffect(() => {
        onSelectionChangeRef.current = onSelectionChange;
    }, [onSelectionChange]);

    useEffect(() => {
        let disposed = false;
        let rangeSubscription: ((range: LogicalRange) => void) | null = null;
        let crosshairSubscription: ((param: MouseEventParams) => void) | null = null;
        let resizeObserver: ResizeObserver | null = null;

        setLoading(true);
        setError(null);
        setFollowLive(true);
        followLiveRef.current = true;

        const chartContainer = chartContainerRef.current;
        if (!chartContainer) {
            setError("Chart container missing.");
            setLoading(false);
            return () => {};
        }

        let createChartFn: typeof import("lightweight-charts").createChart | null = null;

        const handleResize = () => {
            if (disposed) return;
            const element = chartContainerRef.current;
            if (!element) return;
            const rect = element.getBoundingClientRect();
            const width = rect.width || element.clientWidth;
            const height = rect.height || element.clientHeight;
            if (!width || !height) return;

            if (!chartRef.current) {
                if (!createChartFn) return;

                try {
                    const chart = createChartFn(element, {
                        layout: {
                            background: { color: "transparent" },
                            textColor: "#e5e7eb",
                        },
                        width,
                        height,
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
                            lastCrosshairTimeRef.current = null;
                            if (selectedTimeRef.current !== latestCandleTimeRef.current) {
                                setSelectedTimeSec(latestCandleTimeRef.current);
                            }
                            return;
                        }
                        isHoveringRef.current = true;
                        if (lastCrosshairTimeRef.current !== time) {
                            lastCrosshairTimeRef.current = time;
                            setSelectedTimeSec(time);
                        }
                    };

                    chart.subscribeCrosshairMove(crosshairSubscription);

                    void loadInitialData(chart, series);
                    subscribeLive(chart, series);
                } catch (err) {
                    console.error("FootprintCandleChart init error", err);
                    if (!disposed) {
                        setError("Footprint chart failed to render. Please try again.");
                        setLoading(false);
                    }
                }
            } else {
                chartRef.current.applyOptions({ width, height });
            }
        };

        loadLightweightCharts()
            .then(({ createChart }) => {
                if (disposed) return;
                createChartFn = createChart;
                handleResize();
                resizeObserver = new ResizeObserver(() => handleResize());
                resizeObserver.observe(chartContainer);
                resizeObserverRef.current = resizeObserver;
            })
            .catch((err) => {
                console.error("FootprintCandleChart init error", err);
                if (!disposed) {
                    setError("Failed to load chart library. Please try again.");
                    setLoading(false);
                }
            });

        const loadInitialData = async (chart: IChartApi, series: ISeriesApi) => {
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
                if (!isHoveringRef.current && selectedTimeRef.current !== latest) {
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
        };

        const subscribeLive = (chart: IChartApi, series: ISeriesApi) => {
            if (disposed) return;
            const stream = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;
            const socket = new WebSocket(stream);
            websocketRef.current = socket;

            const isCurrent = () => websocketRef.current === socket;

            socket.onmessage = (event) => {
                if (!isCurrent()) return;
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
                    if (!isHoveringRef.current && selectedTimeRef.current !== latest) {
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

            socket.onerror = (err) => {
                if (!isCurrent()) return;
                console.error("Footprint chart socket error", err);
            };
        };

        return () => {
            disposed = true;
            const socket = websocketRef.current;
            if (socket) {
                socket.onopen = null;
                socket.onmessage = null;
                socket.onerror = null;
                socket.onclose = null;
                socket.close();
            }
            websocketRef.current = null;

            if (rangeSubscription && chartRef.current) {
                chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(rangeSubscription);
            }

            if (crosshairSubscription && chartRef.current) {
                chartRef.current.unsubscribeCrosshairMove(crosshairSubscription);
            }

            resizeObserver?.disconnect();
            resizeObserverRef.current?.disconnect();
            resizeObserverRef.current = null;

            chartRef.current?.remove();
            chartRef.current = null;
            seriesRef.current = null;
            candlesRef.current = [];
            latestCandleTimeRef.current = null;
            isHoveringRef.current = false;
        };
    }, [symbol, interval]);

    const goLive = () => {
        followLiveRef.current = true;
        setFollowLive(true);
        chartRef.current?.timeScale().scrollToRealTime();
    };

    useEffect(() => {
        if (footprintUpdateKey == null) return;
        if (!isHoveringRef.current && selectedTimeRef.current !== latestCandleTimeRef.current) {
            setSelectedTimeSec(latestCandleTimeRef.current);
        }
    }, [footprintUpdateKey]);

    useEffect(() => {
        getFootprintForCandleRef.current = getFootprintForCandle;
    }, [getFootprintForCandle]);

    useEffect(() => {
        const footprint = selectedTimeSec != null ? getFootprintForCandleRef.current(selectedTimeSec) : null;
        onSelectionChangeRef.current?.({ timeSec: selectedTimeSec, footprint });
    }, [selectedTimeSec, footprintUpdateKey]);

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-lg">
                <div ref={chartContainerRef} className="relative h-full w-full">
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
            </div>
        </div>
    );
}
