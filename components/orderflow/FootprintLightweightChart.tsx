"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createChart, IChartApi, ISeriesApi, LogicalRange, PriceScaleMode, Time } from "lightweight-charts";

import { DomDepthLevel, FootprintCandle, VolumeProfileDatum } from "@/lib/orderflow/lightweightFeed";

export interface FootprintLightweightChartProps {
    candles: FootprintCandle[];
    volumeProfile: VolumeProfileDatum[];
    domDepth: DomDepthLevel[];
    ma9?: Array<{ time: number; value: number }>;
    ma21?: Array<{ time: number; value: number }>;
    timeframe?: "1m" | "5m" | "15m";
    options: {
        mode: "bid-ask" | "delta" | "volume";
        showNumbers: boolean;
        highlightImbalances: boolean;
        rowSizeTicks: number;
        candleSize: "compact" | "normal" | "wide";
        scale: "log" | "linear";
    };
    autoScrollEnabled?: boolean;
    goToLatestSignal?: number;
    onRenderError?: (error: Error) => void;
    onAutoScrollChange?: (enabled: boolean) => void;
}

const getCandleWidth = (spacing: number, size: FootprintLightweightChartProps["options"]["candleSize"]): number => {
    const multiplier = size === "wide" ? 0.8 : size === "compact" ? 0.55 : 0.65;
    return Math.max(4, spacing * multiplier);
};

export default function FootprintLightweightChart({
    candles,
    volumeProfile,
    domDepth,
    ma9 = [],
    ma21 = [],
    timeframe,
    options,
    autoScrollEnabled,
    goToLatestSignal,
    onRenderError,
    onAutoScrollChange,
}: FootprintLightweightChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const overlayRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const ma9SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const ma21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const programmaticMoveRef = useRef(false);
    const didInitialFitRef = useRef(false);
    const userInteractingRef = useRef(false);
    const autoScrollRef = useRef(true);

    const [autoScroll, setAutoScroll] = useState(true);

    const devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const candleTimes = useMemo(() => candles.map((candle) => Math.round(candle.time / 1000)), [candles]);

    const formatTimeLabel = useMemo(() => {
        const formatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
        return (time: Time): string => {
            const timestamp = typeof time === "number" ? time * 1000 : (time as number) * 1000;
            return formatter.format(new Date(timestamp));
        };
    }, []);

    useEffect(() => {
        if (typeof autoScrollEnabled === "boolean") {
            setAutoScroll(autoScrollEnabled);
        }
    }, [autoScrollEnabled]);

    useEffect(() => {
        autoScrollRef.current = autoScroll;
    }, [autoScroll]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let chart: IChartApi | null = null;
        let overlayCanvas: HTMLCanvasElement | null = null;

        try {
            chart = createChart(container, {
                autoSize: true,
                layout: {
                    background: { color: "#0b0d12" },
                    textColor: "#e5e7eb",
                },
                grid: {
                    vertLines: { color: "#1f2937", style: 1 },
                    horzLines: { color: "#1f2937", style: 1 },
                },
                crosshair: {
                    mode: 1,
                },
                timeScale: {
                    borderColor: "#1f2937",
                    secondsVisible: false,
                    timeVisible: true,
                    tickMarkFormatter: (time) => formatTimeLabel(time as Time),
                },
                rightPriceScale: {
                    borderColor: "#1f2937",
                    mode: options.scale === "log" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
                },
            });

            const candleSeries = chart.addCandlestickSeries({
                upColor: "#34d399",
                downColor: "#f87171",
                borderVisible: false,
                wickUpColor: "#34d399",
                wickDownColor: "#f87171",
            });

            const ma9Series = chart.addLineSeries({
                color: "#60a5fa",
                lineWidth: 2,
                lastValueVisible: false,
                priceLineVisible: false,
            });

            const ma21Series = chart.addLineSeries({
                color: "#fbbf24",
                lineWidth: 2,
                lastValueVisible: false,
                priceLineVisible: false,
            });

            overlayCanvas = document.createElement("canvas");
            overlayCanvas.style.position = "absolute";
            overlayCanvas.style.inset = "0";
            overlayCanvas.style.pointerEvents = "none";
            overlayCanvas.style.zIndex = "2";
            overlayRef.current = overlayCanvas;
            container.appendChild(overlayCanvas);

            chartRef.current = chart;
            candleSeriesRef.current = candleSeries;
            ma9SeriesRef.current = ma9Series;
            ma21SeriesRef.current = ma21Series;

            const resize = () => {
                const { clientWidth, clientHeight } = container;
                chart!.applyOptions({ width: clientWidth, height: clientHeight });
                overlayCanvas!.width = clientWidth * devicePixelRatio;
                overlayCanvas!.height = clientHeight * devicePixelRatio;
                overlayCanvas!.style.width = `${clientWidth}px`;
                overlayCanvas!.style.height = `${clientHeight}px`;
            };

            const resizeObserver = new ResizeObserver(() => resize());
            resizeObserver.observe(container);
            resize();

            const handleUserInteraction = () => {
                userInteractingRef.current = true;
                if (autoScrollRef.current) {
                    setAutoScroll(false);
                    onAutoScrollChange?.(false);
                }
            };

            const handleUserInteractionEnd = () => {
                userInteractingRef.current = false;
            };

            container.addEventListener("wheel", handleUserInteraction, { passive: true });
            container.addEventListener("mousedown", handleUserInteraction);
            container.addEventListener("touchstart", handleUserInteraction, { passive: true });
            container.addEventListener("mouseup", handleUserInteractionEnd);
            container.addEventListener("mouseleave", handleUserInteractionEnd);
            container.addEventListener("touchend", handleUserInteractionEnd);

            return () => {
                resizeObserver.disconnect();
                container.removeEventListener("wheel", handleUserInteraction);
                container.removeEventListener("mousedown", handleUserInteraction);
                container.removeEventListener("touchstart", handleUserInteraction);
                container.removeEventListener("mouseup", handleUserInteractionEnd);
                container.removeEventListener("mouseleave", handleUserInteractionEnd);
                container.removeEventListener("touchend", handleUserInteractionEnd);
                if (overlayCanvas?.parentElement === container) {
                    container.removeChild(overlayCanvas);
                }
                chart?.remove();
                overlayRef.current = null;
                candleSeriesRef.current = null;
                ma9SeriesRef.current = null;
                ma21SeriesRef.current = null;
                chartRef.current = null;
            };
        } catch (error) {
            console.error("Footprint chart initialization error", error);
            onRenderError?.(error as Error);
            if (overlayCanvas?.parentElement === container) {
                container.removeChild(overlayCanvas);
            }
            if (chart) {
                chart.remove();
            }
            overlayRef.current = null;
            candleSeriesRef.current = null;
            ma9SeriesRef.current = null;
            ma21SeriesRef.current = null;
            chartRef.current = null;
        }
    }, [devicePixelRatio, formatTimeLabel, onAutoScrollChange, onRenderError, options.scale]);

    useEffect(() => {
        const candleSeries = candleSeriesRef.current;
        const chart = chartRef.current;
        if (!candleSeries || !chart) return;

        candleSeries.setData(
            candles.map((candle) => ({
                time: Math.round(candle.time / 1000),
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            })),
        );

        const timeScale = chart.timeScale();

        if (!didInitialFitRef.current && candles.length > 0) {
            programmaticMoveRef.current = true;
            timeScale.fitContent();
            requestAnimationFrame(() => {
                programmaticMoveRef.current = false;
            });
            didInitialFitRef.current = true;
        } else if (autoScroll && !userInteractingRef.current) {
            programmaticMoveRef.current = true;
            timeScale.scrollToRealTime();
            requestAnimationFrame(() => {
                programmaticMoveRef.current = false;
            });
        }
    }, [autoScroll, candles]);

    useEffect(() => {
        didInitialFitRef.current = false;
    }, [timeframe]);

    useEffect(() => {
        if (!ma9SeriesRef.current) return;
        ma9SeriesRef.current.setData(ma9.map((point) => ({ time: point.time, value: point.value })));
    }, [ma9]);

    useEffect(() => {
        if (!ma21SeriesRef.current) return;
        ma21SeriesRef.current.setData(ma21.map((point) => ({ time: point.time, value: point.value })));
    }, [ma21]);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        chart.applyOptions({
            rightPriceScale: {
                borderColor: "#1f2937",
                mode: options.scale === "log" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
            },
        });
    }, [options.scale]);

    useEffect(() => {
        if (!chartRef.current) return;
        if (typeof goToLatestSignal === "undefined") return;

        const timeScale = chartRef.current.timeScale();
        programmaticMoveRef.current = true;
        timeScale.scrollToRealTime();
        requestAnimationFrame(() => {
            programmaticMoveRef.current = false;
        });
        if (!autoScroll) {
            setAutoScroll(true);
            onAutoScrollChange?.(true);
        }
    }, [autoScroll, goToLatestSignal, onAutoScrollChange]);

    useEffect(() => {
        setAutoScroll((prev) => {
            if (!prev) {
                onAutoScrollChange?.(true);
            }
            return true;
        });
    }, [onAutoScrollChange, timeframe]);

    const drawOverlay = useCallback(() => {
        try {
            const chart = chartRef.current;
            const overlay = overlayRef.current;
            const candleSeries = candleSeriesRef.current;
            if (!chart || !overlay || !candleSeries) return;

            const ctx = overlay.getContext("2d");
            if (!ctx) return;

            const width = overlay.width / devicePixelRatio;
            const height = overlay.height / devicePixelRatio;

            const timeScale = chart.timeScale();
            const priceScale = candleSeries.priceScale();

            ctx.resetTransform();
            ctx.scale(devicePixelRatio, devicePixelRatio);
            ctx.clearRect(0, 0, width, height);

            if (!candles.length) return;

            const times = candleTimes;
            const spacingCandidates: number[] = [];
            for (let index = 0; index < times.length - 1; index += 1) {
                const current = timeScale.timeToCoordinate(times[index]);
                const next = timeScale.timeToCoordinate(times[index + 1]);
                if (current !== null && next !== null) {
                    spacingCandidates.push(Math.abs(next - current));
                }
            }
            const medianSpacing = spacingCandidates.length
                ? spacingCandidates.sort((a, b) => a - b)[Math.floor(spacingCandidates.length / 2)]
                : 12;

            const clusters = candles.flatMap((c) => c.clusters);
            const maxClusterVolume = clusters.length
                ? Math.max(...clusters.map((cluster) => cluster.totalVolume))
                : 1;
            const maxClusterDelta = clusters.length
                ? Math.max(...clusters.map((cluster) => Math.abs(cluster.delta)))
                : 1;

            const clusterColor = (cluster: FootprintCandle["clusters"][number]): string => {
                const total = cluster.totalVolume || cluster.askVolume + cluster.bidVolume;
                if (options.mode === "bid-ask") {
                    const askRatio = total > 0 ? cluster.askVolume / total : 0.5;
                    const bidRatio = 1 - askRatio;
                    const r = Math.round(80 + askRatio * 140);
                    const g = Math.round(80 + bidRatio * 140);
                    return `rgb(${r}, ${g}, 120)`;
                }
                if (options.mode === "delta") {
                    const intensity = Math.min(Math.abs(cluster.delta) / maxClusterDelta, 1);
                    const alpha = 0.25 + intensity * 0.6;
                    return cluster.delta >= 0
                        ? `rgba(52, 211, 153, ${alpha.toFixed(3)})`
                        : `rgba(248, 113, 113, ${alpha.toFixed(3)})`;
                }
                const intensity = Math.min(total / maxClusterVolume, 1);
                return `rgba(129, 140, 248, ${(0.2 + intensity * 0.7).toFixed(3)})`;
            };

            const pricePositions = clusters
                .map((cluster) => cluster.price)
                .filter((price, index, arr) => arr.indexOf(price) === index)
                .sort((a, b) => b - a);
            const priceDiffs: number[] = [];
            pricePositions.forEach((price, index) => {
                const next = pricePositions[index + 1];
                if (typeof next === "number") {
                    priceDiffs.push(Math.abs(price - next));
                }
            });
            const medianPriceStep = priceDiffs.length
                ? priceDiffs.sort((a, b) => a - b)[Math.floor(priceDiffs.length / 2)]
                : 0;

            const priceStep = Math.max(medianPriceStep || 0, 1) * Math.max(options.rowSizeTicks, 1);
            const referencePrice = pricePositions[0] ?? candles[0].close ?? candles[0].open ?? 0;
            const stepHeight =
                referencePrice !== undefined
                    ? priceScale.priceToCoordinate(referencePrice + priceStep)
                    : priceScale.priceToCoordinate(priceStep);
            const zeroHeight = priceScale.priceToCoordinate(referencePrice) ?? 0;
            const cellHeight = Math.max(Math.abs((stepHeight ?? zeroHeight ?? 0) - (zeroHeight ?? 0)), 8);

            candles.forEach((candle, index) => {
                const currentTime = Math.round(candle.time / 1000);
                const x = timeScale.timeToCoordinate(currentTime);
                if (x === null) return;
                const nextTime = candles[index + 1]?.time;
                const prevTime = candles[index - 1]?.time;
                const nextX = typeof nextTime === "number" ? timeScale.timeToCoordinate(Math.round(nextTime / 1000)) : null;
                const prevX = typeof prevTime === "number" ? timeScale.timeToCoordinate(Math.round(prevTime / 1000)) : null;
                const spacing =
                    nextX !== null && prevX !== null
                        ? Math.min(Math.abs(nextX - x), Math.abs(x - prevX))
                        : medianSpacing;
                const widthPx = getCandleWidth(spacing || medianSpacing, options.candleSize);

                candle.clusters.forEach((cluster) => {
                    const y = priceScale.priceToCoordinate(cluster.price);
                    if (y === null || y === undefined) return;
                    const imbalance = cluster.totalVolume > 0
                        ? (Math.abs(cluster.askVolume - cluster.bidVolume) / cluster.totalVolume) * 100
                        : 0;

                    ctx.fillStyle = clusterColor(cluster);
                    ctx.fillRect(x - widthPx / 2, y - cellHeight / 2, widthPx, cellHeight);

                    if (options.highlightImbalances && imbalance >= 60) {
                        ctx.strokeStyle = "#fcd34d";
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x - widthPx / 2, y - cellHeight / 2, widthPx, cellHeight);
                    }

                    if (options.showNumbers) {
                        ctx.fillStyle = "#e5e7eb";
                        ctx.font = "10px Inter, system-ui, -apple-system, sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        const label =
                            options.mode === "volume"
                                ? `${cluster.totalVolume.toFixed(0)}`
                                : `${cluster.askVolume.toFixed(0)} / ${cluster.bidVolume.toFixed(0)}`;
                        ctx.fillText(label, x, y);
                    }
                });
            });

            const profileWidth = Math.min(140, Math.max(84, width * 0.18));
            const profileX = width - profileWidth - 6;
            const maxProfileVolume = volumeProfile.length
                ? Math.max(...volumeProfile.map((level) => level.volume))
                : 1;
            volumeProfile.forEach((level) => {
                const y = priceScale.priceToCoordinate(level.price);
                const nextY = priceScale.priceToCoordinate(level.price - (priceStep || 1));
                if (y === null || nextY === null || y === undefined || nextY === undefined) return;
                const barHeight = Math.max(Math.abs(y - nextY), 6);
                const widthRatio = Math.min(level.volume / maxProfileVolume, 1);
                const barWidth = widthRatio * profileWidth;

                ctx.fillStyle = "rgba(99, 102, 241, 0.35)";
                ctx.fillRect(profileX + (profileWidth - barWidth), y - barHeight / 2, barWidth, barHeight);

                if (options.showNumbers && barWidth > 40) {
                    ctx.fillStyle = "#c7d2fe";
                    ctx.font = "10px Inter, system-ui, -apple-system, sans-serif";
                    ctx.textAlign = "right";
                    ctx.fillText(level.volume.toFixed(0), profileX + profileWidth - 4, y);
                }
            });

            const maxDepth = domDepth.length
                ? Math.max(...domDepth.map((depth) => Math.max(depth.bidSize, depth.askSize)))
                : 1;
            const depthWidth = Math.min(80, Math.max(48, width * 0.12));
            const depthX = 8;
            domDepth.forEach((level) => {
                const y = priceScale.priceToCoordinate(level.price);
                const nextY = priceScale.priceToCoordinate(level.price - (priceStep || 1));
                if (y === null || nextY === null || y === undefined || nextY === undefined) return;
                const blockHeight = Math.max(Math.abs(y - nextY), 6);
                const bidRatio = Math.min(level.bidSize / maxDepth, 1);
                const askRatio = Math.min(level.askSize / maxDepth, 1);

                if (bidRatio > 0) {
                    ctx.fillStyle = "rgba(52, 211, 153, 0.35)";
                    ctx.fillRect(depthX + depthWidth * (1 - bidRatio), y - blockHeight / 2, depthWidth * bidRatio, blockHeight);
                }
                if (askRatio > 0) {
                    ctx.fillStyle = "rgba(248, 113, 113, 0.35)";
                    ctx.fillRect(depthX, y - blockHeight / 2, depthWidth * askRatio, blockHeight);
                }
            });
        } catch (error) {
            console.error("Footprint overlay draw error", error);
        }
    }, [candles, candleTimes, devicePixelRatio, domDepth, options.candleSize, options.highlightImbalances, options.mode, options.rowSizeTicks, options.showNumbers, volumeProfile]);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        const handleLogicalRange = (range: LogicalRange | null) => {
            drawOverlay();
            if (!range) return;

            if (programmaticMoveRef.current) return;

            const lastIndex = candles.length - 1;
            if (lastIndex < 0) return;
            const tooFarFromEnd = range.to < lastIndex - 0.5;
            if (tooFarFromEnd && autoScroll) {
                setAutoScroll(false);
                onAutoScrollChange?.(false);
            }
        };

        chart.timeScale().subscribeVisibleLogicalRangeChange(handleLogicalRange);

        return () => {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleLogicalRange);
        };
    }, [autoScroll, candles.length, drawOverlay, onAutoScrollChange]);

    useEffect(() => {
        if (!chartRef.current) return;
        drawOverlay();

        const handleVisibleChange = () => drawOverlay();
        chartRef.current.timeScale().subscribeVisibleTimeRangeChange(handleVisibleChange);

        return () => {
            chartRef.current?.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleChange);
        };
    }, [drawOverlay]);

    return <div ref={containerRef} className="relative h-full w-full" />;
}
