"use client";

import { useEffect, useRef } from "react";

import { createChart, IChartApi, ISeriesApi } from "lightweight-charts";

import { FootprintCandle } from "@/lib/orderflow/lightweightFeed";

export interface FootprintLightweightChartProps {
    candles: FootprintCandle[];
    onRenderError?: (error: Error) => void;
}

export default function FootprintLightweightChart({ candles, onRenderError }: FootprintLightweightChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let chart: IChartApi | null = null;

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
                crosshair: { mode: 1 },
                timeScale: {
                    borderColor: "#1f2937",
                    secondsVisible: false,
                    timeVisible: true,
                },
                rightPriceScale: { borderColor: "#1f2937" },
            });

            const candleSeries = chart.addCandlestickSeries({
                upColor: "#34d399",
                downColor: "#f87171",
                borderVisible: false,
                wickUpColor: "#34d399",
                wickDownColor: "#f87171",
            });

            chartRef.current = chart;
            candleSeriesRef.current = candleSeries;

            const resizeObserver = new ResizeObserver(() => {
                if (!container || !chart) return;
                const { clientWidth, clientHeight } = container;
                chart.applyOptions({ width: clientWidth, height: clientHeight });
            });

            resizeObserver.observe(container);

            return () => {
                resizeObserver.disconnect();
                chart.remove();
                chartRef.current = null;
                candleSeriesRef.current = null;
            };
        } catch (error) {
            console.error("Failed to initialise footprint chart", error);
            onRenderError?.(error as Error);
            if (chart) {
                chart.remove();
            }
        }
    }, [onRenderError]);

    useEffect(() => {
        const candleSeries = candleSeriesRef.current;
        if (!candleSeries) return;

        candleSeries.setData(
            candles.map((candle) => ({
                time: Math.round(candle.timeMs / 1000),
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            })),
        );

        if (chartRef.current && candles.length > 0) {
            chartRef.current.timeScale().fitContent();
        }
    }, [candles]);

    return <div ref={containerRef} className="h-full w-full" />;
}
