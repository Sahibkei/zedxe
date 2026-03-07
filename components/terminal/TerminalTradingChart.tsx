"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { UTCTimestamp } from "lightweight-charts";
import { cn } from "@/lib/utils";

export type ChartMode = "candles" | "line" | "percent";

export type HistoryPoint = {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number | null;
};

type TerminalTradingChartProps = {
    points: HistoryPoint[];
    symbol: string;
    displayName: string;
    currency: string | null;
    range: string;
    mode: ChartMode;
    theme: "dark" | "light";
};

type HoverSnapshot = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    displayValue: number;
    changePct: number;
    volume: number | null;
};

const formatCompactNumber = (value: number | null) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "--";
    return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: value >= 1_000_000 ? 2 : 1,
    }).format(value);
};

const formatAxisValue = (value: number, mode: ChartMode) => {
    if (mode === "percent") return `${value.toFixed(2)}%`;
    return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: value >= 1000 ? 2 : 4,
    });
};

const formatHoverTime = (unixSeconds: number, range: string) => {
    const date = new Date(unixSeconds * 1000);

    if (range === "1D") {
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    }

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const normalizeChartTime = (
    value:
        | number
        | string
        | {
              year: number;
              month: number;
              day: number;
          }
) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") return Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 1000);
    return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 1000);
};

const getPrecision = (points: HistoryPoint[]) => {
    const close = points[points.length - 1]?.c ?? 0;
    if (close >= 1) return 2;
    return 4;
};

const toSnapshot = (point: HistoryPoint, baseClose: number, mode: ChartMode): HoverSnapshot => {
    const displayValue = mode === "percent" ? ((point.c - baseClose) / baseClose) * 100 : point.c;
    return {
        time: point.t,
        open: point.o,
        high: point.h,
        low: point.l,
        close: point.c,
        displayValue,
        changePct: baseClose > 0 ? ((point.c - baseClose) / baseClose) * 100 : 0,
        volume: point.v,
    };
};

export default function TerminalTradingChart({
    points,
    symbol,
    displayName,
    currency,
    range,
    mode,
    theme,
}: TerminalTradingChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const chartRef = useRef<{ remove: () => void; timeScale: () => { fitContent: () => void } } | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const [hoverSnapshot, setHoverSnapshot] = useState<HoverSnapshot | null>(null);

    const baseClose = points[0]?.c ?? 1;
    const latestSnapshot = useMemo(() => {
        const latestPoint = points[points.length - 1];
        return latestPoint ? toSnapshot(latestPoint, baseClose, mode) : null;
    }, [baseClose, mode, points]);

    const activeSnapshot = hoverSnapshot ?? latestSnapshot;

    const palette = useMemo(
        () =>
            theme === "dark"
                ? {
                      chartBg: "#0a1220",
                      text: "#dfe7f5",
                      grid: "rgba(134, 151, 173, 0.12)",
                      scale: "#24364f",
                      up: "#22c55e",
                      down: "#ef5350",
                      line: "#4ea1ff",
                      areaTop: "rgba(78, 161, 255, 0.34)",
                      areaBottom: "rgba(78, 161, 255, 0.03)",
                      percentTop: "rgba(20, 184, 166, 0.30)",
                      percentBottom: "rgba(20, 184, 166, 0.03)",
                      percentLine: "#14b8a6",
                      crosshair: "rgba(226, 232, 240, 0.38)",
                      crosshairBadge: "#11243b",
                      volumeUp: "rgba(34, 197, 94, 0.45)",
                      volumeDown: "rgba(239, 83, 80, 0.45)",
                  }
                : {
                      chartBg: "#f8fbff",
                      text: "#102034",
                      grid: "rgba(81, 101, 126, 0.12)",
                      scale: "#c7d4e2",
                      up: "#0f9f63",
                      down: "#d04a3c",
                      line: "#0b74de",
                      areaTop: "rgba(11, 116, 222, 0.24)",
                      areaBottom: "rgba(11, 116, 222, 0.02)",
                      percentTop: "rgba(13, 148, 136, 0.22)",
                      percentBottom: "rgba(13, 148, 136, 0.02)",
                      percentLine: "#0d9488",
                      crosshair: "rgba(15, 23, 42, 0.24)",
                      crosshairBadge: "#dbe7f3",
                      volumeUp: "rgba(15, 159, 99, 0.32)",
                      volumeDown: "rgba(208, 74, 60, 0.32)",
                  },
        [theme]
    );

    useEffect(() => {
        setHoverSnapshot(null);
    }, [mode, points, range, symbol]);

    useEffect(() => {
        let disposed = false;

        const setupChart = async () => {
            const container = containerRef.current;
            if (!container || points.length < 2) return;

            const charts = await import("lightweight-charts");
            if (disposed) return;

            const { createChart, CrosshairMode, ColorType } = charts;
            const precision = getPrecision(points);
            const minMove = 1 / 10 ** precision;

            const chart = createChart(container, {
                width: Math.max(container.clientWidth, 100),
                height: Math.max(container.clientHeight, 100),
                layout: {
                    background: {
                        type: ColorType.Solid,
                        color: palette.chartBg,
                    },
                    textColor: palette.text,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: 12,
                },
                grid: {
                    vertLines: { color: palette.grid },
                    horzLines: { color: palette.grid },
                },
                crosshair: {
                    mode: CrosshairMode.Normal,
                    vertLine: {
                        color: palette.crosshair,
                        labelBackgroundColor: palette.crosshairBadge,
                        style: 2,
                    },
                    horzLine: {
                        color: palette.crosshair,
                        labelBackgroundColor: palette.crosshairBadge,
                        style: 2,
                    },
                },
                rightPriceScale: {
                    borderColor: palette.scale,
                },
                timeScale: {
                    borderColor: palette.scale,
                    rightOffset: 8,
                    barSpacing: range === "1D" ? 14 : range === "1M" ? 10 : 8,
                    minBarSpacing: 0.6,
                    timeVisible: range === "1D",
                    secondsVisible: false,
                },
                handleScroll: {
                    mouseWheel: true,
                    pressedMouseMove: true,
                    horzTouchDrag: true,
                    vertTouchDrag: true,
                },
                handleScale: {
                    mouseWheel: true,
                    pinch: true,
                    axisPressedMouseMove: {
                        time: true,
                        price: true,
                    },
                    axisDoubleClickReset: true,
                },
                localization: {
                    priceFormatter: (value: number) => formatAxisValue(value, mode),
                },
            });

            chartRef.current = chart;
            const pointMap = new Map(points.map((point) => [point.t, point]));

            if (mode === "candles") {
                const candleSeries = chart.addCandlestickSeries({
                    upColor: palette.up,
                    downColor: palette.down,
                    borderUpColor: palette.up,
                    borderDownColor: palette.down,
                    wickUpColor: palette.up,
                    wickDownColor: palette.down,
                    lastValueVisible: true,
                    priceLineVisible: true,
                    priceFormat: {
                        type: "price",
                        precision,
                        minMove,
                    },
                });

                candleSeries.priceScale().applyOptions({
                    scaleMargins: {
                        top: 0.08,
                        bottom: 0.24,
                    },
                });

                candleSeries.setData(
                    points.map((point) => ({
                        time: point.t as UTCTimestamp,
                        open: point.o,
                        high: point.h,
                        low: point.l,
                        close: point.c,
                    }))
                );

                const volumeSeries = chart.addHistogramSeries({
                    priceFormat: {
                        type: "volume",
                    },
                    priceScaleId: "",
                    lastValueVisible: false,
                    priceLineVisible: false,
                });

                volumeSeries.priceScale().applyOptions({
                    scaleMargins: {
                        top: 0.78,
                        bottom: 0,
                    },
                });

                volumeSeries.setData(
                    points.map((point, index) => {
                        const previousClose = index > 0 ? points[index - 1]?.c ?? point.o : point.o;
                        return {
                            time: point.t as UTCTimestamp,
                            value: point.v ?? 0,
                            color: point.c >= previousClose ? palette.volumeUp : palette.volumeDown,
                        };
                    })
                );
            } else {
                const series = chart.addAreaSeries({
                    lineColor: mode === "percent" ? palette.percentLine : palette.line,
                    lineWidth: 2,
                    topColor: mode === "percent" ? palette.percentTop : palette.areaTop,
                    bottomColor: mode === "percent" ? palette.percentBottom : palette.areaBottom,
                    lastValueVisible: true,
                    priceLineVisible: true,
                    crosshairMarkerRadius: 4,
                    priceFormat: {
                        type: "price",
                        precision: 2,
                        minMove: 0.01,
                    },
                });

                series.setData(
                    points.map((point) => ({
                        time: point.t as UTCTimestamp,
                        value: mode === "percent" ? ((point.c - baseClose) / baseClose) * 100 : point.c,
                    }))
                );
            }

            chart.subscribeCrosshairMove((param) => {
                if (disposed || !param.time) {
                    startTransition(() => setHoverSnapshot(null));
                    return;
                }

                const point = pointMap.get(normalizeChartTime(param.time));
                startTransition(() => {
                    setHoverSnapshot(point ? toSnapshot(point, baseClose, mode) : null);
                });
            });

            const applySize = () => {
                if (disposed) return;
                chart.applyOptions({
                    width: Math.max(container.clientWidth, 100),
                    height: Math.max(container.clientHeight, 100),
                });
            };

            applySize();
            resizeObserverRef.current = new ResizeObserver(applySize);
            resizeObserverRef.current.observe(container);
            chart.timeScale().fitContent();
        };

        void setupChart();

        return () => {
            disposed = true;
            resizeObserverRef.current?.disconnect();
            resizeObserverRef.current = null;
            chartRef.current?.remove();
            chartRef.current = null;
        };
    }, [baseClose, mode, palette, points, range, symbol]);

    return (
        <div className="terminal-market-chart">
            <div
                className={cn("terminal-market-chart-surface", theme === "light" && "terminal-market-chart-surface-light")}
                style={{ backgroundColor: palette.chartBg }}
            >
                <div className="terminal-market-chart-overlay">
                    <div className="terminal-market-chart-legend">
                        <div className="terminal-market-chart-symbols">
                            <span className="terminal-market-chart-ticker">{symbol.replace("^", "")}</span>
                            <span className="terminal-market-chart-name">{displayName}</span>
                            <span className="terminal-market-chart-mode">{mode === "candles" ? "Candles" : mode === "line" ? "Line" : "% Change"}</span>
                        </div>
                        <div className="terminal-market-chart-metrics">
                            <span>T {activeSnapshot ? formatHoverTime(activeSnapshot.time, range) : "--"}</span>
                            <span>{mode === "percent" ? "Pct" : "Px"} {activeSnapshot ? formatAxisValue(activeSnapshot.displayValue, mode) : "--"}</span>
                            <span>O {activeSnapshot ? formatAxisValue(activeSnapshot.open, "candles") : "--"}</span>
                            <span>H {activeSnapshot ? formatAxisValue(activeSnapshot.high, "candles") : "--"}</span>
                            <span>L {activeSnapshot ? formatAxisValue(activeSnapshot.low, "candles") : "--"}</span>
                            <span>C {activeSnapshot ? formatAxisValue(activeSnapshot.close, "candles") : "--"}</span>
                            <span className={cn(activeSnapshot ? (activeSnapshot.changePct >= 0 ? "terminal-up" : "terminal-down") : "")}>
                                {activeSnapshot ? `${activeSnapshot.changePct >= 0 ? "+" : ""}${activeSnapshot.changePct.toFixed(2)}%` : "--"}
                            </span>
                            <span>Vol {formatCompactNumber(activeSnapshot?.volume ?? null)}</span>
                        </div>
                    </div>
                    <div className="terminal-market-chart-actions">
                        <div className="terminal-market-chart-hint">Drag to pan, wheel to zoom, double-click price/time scale to reset</div>
                        <button
                            type="button"
                            className="terminal-market-chart-reset"
                            onClick={() => chartRef.current?.timeScale().fitContent()}
                        >
                            Reset view
                        </button>
                    </div>
                </div>
                <div ref={containerRef} className="terminal-market-chart-canvas" aria-label={`${displayName} price chart`} />
            </div>
            <div className="terminal-market-chart-footer">
                <span>{currency ? `Currency: ${currency}` : "Currency unavailable"}</span>
                <span>{mode === "candles" ? "Volume bars shown below candles" : "Clean trend mode"}</span>
            </div>
        </div>
    );
}
