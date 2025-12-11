"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type HTMLAttributes,
    type MouseEvent,
    type TouchEvent,
} from "react";

import { FootprintBar, FootprintTimeframe } from "@/lib/footprint/types";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/formatters";

type CardProps = HTMLAttributes<HTMLDivElement>;
type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;

const Card = ({ className, ...props }: CardProps) => (
    <div
        className={cn(
            "w-full max-w-full min-w-0 h-[360px] rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20 flex flex-col overflow-hidden",
            className,
        )}
        {...props}
    />
);

const CardHeader = ({ className, ...props }: CardProps) => <div className={cn("space-y-1 pb-3", className)} {...props} />;

const CardContent = ({ className, ...props }: CardProps) => (
    <div className={cn("flex-1 flex flex-col overflow-hidden min-w-0", className)} {...props} />
);

const CardTitle = ({ className, ...props }: CardTitleProps) => (
    <h3 className={cn("text-base font-semibold", className)} {...props} />
);

interface FootprintPanelProps {
    symbol: string;
    timeframe: FootprintTimeframe;
}

const TIMEFRAME_OPTIONS: FootprintTimeframe[] = ["5s", "15s", "30s", "1m", "5m", "15m"];
const MAX_BARS = 30;
const REFRESH_INTERVAL_MS = 5000;

const DEFAULT_CANDLE_WIDTH = 170;
const MIN_CANDLE_WIDTH = 90;
const MAX_CANDLE_WIDTH = 320;
const CONTENT_GAP = 12;
const AUTO_FOLLOW_THRESHOLD_PX = 16;

const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const parseBars = (bars: FootprintBar[]): FootprintBar[] =>
    bars.map((bar) => ({
        ...bar,
        startTime: Number(bar.startTime),
        endTime: Number(bar.endTime),
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        totalAskVolume: Number(bar.totalAskVolume),
        totalBidVolume: Number(bar.totalBidVolume),
        delta: Number(bar.delta),
        cells: Array.isArray(bar.cells)
            ? bar.cells.map((cell) => ({
                  price: Number(cell.price),
                  bidVolume: Number(cell.bidVolume),
                  askVolume: Number(cell.askVolume),
                  tradesCount: Number(cell.tradesCount),
              }))
            : [],
    }));

export function FootprintPanel({ symbol, timeframe }: FootprintPanelProps) {
    const [currentTimeframe, setCurrentTimeframe] = useState<FootprintTimeframe>(timeframe);
    const [bars, setBars] = useState<FootprintBar[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
    const [autoFollow, setAutoFollow] = useState(true);
    const [candleWidth, setCandleWidth] = useState(DEFAULT_CANDLE_WIDTH);
    const [isDragging, setIsDragging] = useState(false);

    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<{ startX: number; scrollLeft: number } | null>(null);
    const scrollRatioRef = useRef<number | null>(null);

    useEffect(() => {
        setCurrentTimeframe(timeframe);
        setBars([]);
        setHasLoaded(false);
    }, [symbol, timeframe]);

    useEffect(() => {
        let isCancelled = false;
        let controller = new AbortController();

        const fetchFootprint = async () => {
            controller.abort();
            controller = new AbortController();

            setLoading(true);
            try {
                const params = new URLSearchParams({ symbol, timeframe: currentTimeframe });
                const response = await fetch(`/api/footprint?${params.toString()}`, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Failed to load footprint (${response.status})`);
                }

                const data = await response.json();
                if (isCancelled) return;

                const parsedBars: FootprintBar[] = Array.isArray(data?.bars) ? parseBars(data.bars) : [];
                setBars(parsedBars);
                setHasLoaded(true);
            } catch (error) {
                if ((error as Error).name === "AbortError") return;
                console.error("Failed to fetch footprint", error);
                if (!isCancelled) {
                    setBars([]);
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        const runFetch = () => {
            if (!isCancelled) {
                fetchFootprint();
            }
        };

        runFetch();
        const interval = setInterval(runFetch, REFRESH_INTERVAL_MS);

        return () => {
            isCancelled = true;
            controller.abort();
            clearInterval(interval);
        };
    }, [currentTimeframe, symbol]);

    const visibleBars = useMemo(() => bars.slice(-MAX_BARS), [bars]);

    const isInitialLoading = loading && !hasLoaded;
    const isRefreshing = loading && hasLoaded;

    useEffect(() => {
        setHoveredBarIndex(null);
    }, [visibleBars.length]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || !autoFollow) return;

        const maxScroll = Math.max(container.scrollWidth - container.clientWidth, 0);
        container.scrollLeft = maxScroll;
    }, [autoFollow, visibleBars.length, candleWidth]);

    const clampCandleWidth = (value: number) => Math.min(Math.max(value, MIN_CANDLE_WIDTH), MAX_CANDLE_WIDTH);

    const handleZoom = (delta: number) => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollLeft, scrollWidth, clientWidth } = container;
        const denominator = Math.max(scrollWidth - clientWidth, 1);
        const ratio = scrollLeft / denominator;
        scrollRatioRef.current = ratio;

        setCandleWidth((previous) => clampCandleWidth(previous + delta));
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        if (scrollRatioRef.current !== null) {
            const ratio = scrollRatioRef.current;
            scrollRatioRef.current = null;

            const maxScroll = Math.max(container.scrollWidth - container.clientWidth, 0);
            container.scrollLeft = maxScroll * ratio;
        }
    }, [candleWidth]);

    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const distanceFromRight = container.scrollWidth - container.clientWidth - container.scrollLeft;
        if (distanceFromRight > AUTO_FOLLOW_THRESHOLD_PX && autoFollow) {
            setAutoFollow(false);
        }
    };

    const startDrag = (clientX: number) => {
        const container = scrollContainerRef.current;
        if (!container) return;

        dragStateRef.current = {
            startX: clientX,
            scrollLeft: container.scrollLeft,
        };
        setIsDragging(true);
    };

    const endDrag = () => {
        dragStateRef.current = null;
        setIsDragging(false);
    };

    const handleDragMove = (clientX: number) => {
        const container = scrollContainerRef.current;
        const dragState = dragStateRef.current;
        if (!container || !dragState) return;

        const deltaX = clientX - dragState.startX;
        container.scrollLeft = dragState.scrollLeft - deltaX;
    };

    const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
        startDrag(event.clientX);
    };

    const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        event.preventDefault();
        handleDragMove(event.clientX);
    };

    const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0];
        if (!touch) return;
        startDrag(touch.clientX);
    };

    const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const touch = event.touches[0];
        if (!touch) return;

        handleDragMove(touch.clientX);
    };

    const scrollToLatest = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const maxScroll = Math.max(container.scrollWidth - container.clientWidth, 0);
        container.scrollLeft = maxScroll;
        setAutoFollow(true);
    };

    const hoveredBar = hoveredBarIndex === null ? null : visibleBars[hoveredBarIndex] ?? null;

    const contentWidth = Math.max(
        visibleBars.length * (candleWidth + CONTENT_GAP) - CONTENT_GAP,
        0,
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle className="text-sm text-emerald-400">FOOTPRINT</CardTitle>
                        <p className="text-lg font-semibold">{symbol.toUpperCase()} footprint</p>
                        <p className="text-xs text-muted-foreground">Volume split by price level and aggressor side.</p>
                    </div>
                    {isRefreshing && (
                        <span className="mt-1 rounded-full bg-gray-800 px-3 py-1 text-[11px] text-gray-300">
                            Refreshing…
                        </span>
                    )}
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                    {TIMEFRAME_OPTIONS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setCurrentTimeframe(option)}
                            className={cn(
                                "rounded-full border px-3 py-1 text-xs transition-colors",
                                option === currentTimeframe
                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                                    : "border-gray-800 text-gray-300 hover:border-emerald-700 hover:text-emerald-200",
                            )}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </CardHeader>

            <CardContent>
                <div className="flex-1 min-w-0 overflow-hidden rounded-lg border border-gray-900/80 bg-[#0b0d12] p-3 shadow-inner shadow-black/10">
                    {isInitialLoading ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Loading footprint…
                        </div>
                    ) : visibleBars.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            No footprint data available.
                        </div>
                    ) : (
                        <div className="flex h-full min-h-0 flex-col overflow-hidden">
                            <div className="flex items-center justify-between pb-2 text-xs text-gray-300">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={scrollToLatest}
                                        className={cn(
                                            "rounded-full border px-3 py-1 text-[11px] transition-colors",
                                            autoFollow
                                                ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                                                : "border-gray-800 text-gray-300 hover:border-emerald-700 hover:text-emerald-200",
                                        )}
                                    >
                                        {autoFollow ? "Live (following)" : "Go to latest"}
                                    </button>
                                    {!autoFollow && (
                                        <span className="rounded-full bg-gray-900 px-2 py-1 text-[11px] text-gray-300">
                                            Explore mode
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleZoom(-12)}
                                        className="h-7 w-7 rounded border border-gray-800 bg-[#0f1115] text-white transition hover:border-emerald-700 hover:text-emerald-200"
                                        aria-label="Zoom out"
                                    >
                                        −
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCandleWidth(DEFAULT_CANDLE_WIDTH)}
                                        className="h-7 rounded border border-gray-800 bg-[#0f1115] px-2 text-[11px] text-gray-200 transition hover:border-emerald-700 hover:text-emerald-200"
                                    >
                                        Reset
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleZoom(12)}
                                        className="h-7 w-7 rounded border border-gray-800 bg-[#0f1115] text-white transition hover:border-emerald-700 hover:text-emerald-200"
                                        aria-label="Zoom in"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div
                                ref={scrollContainerRef}
                                className={cn(
                                    "relative h-full w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden pr-1 select-none",
                                    isDragging ? "cursor-grabbing" : "cursor-grab",
                                )}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={endDrag}
                                onMouseUp={endDrag}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={endDrag}
                                onScroll={handleScroll}
                            >
                                <div
                                    className="flex h-full min-h-0 items-stretch gap-3"
                                    style={{ minWidth: "100%", width: contentWidth }}
                                >
                                    {visibleBars.map((bar, index) => {
                                        const totalTrades = bar.cells.reduce((sum, cell) => sum + (cell.tradesCount || 0), 0);
                                        const totalVolume = bar.totalAskVolume + bar.totalBidVolume;
                                        const deltaPositive = bar.delta >= 0;
                                        const isHovered = hoveredBarIndex === index;

                                        return (
                                            <div
                                                key={`${bar.symbol}-${bar.startTime}`}
                                                style={{ width: candleWidth }}
                                                className={cn(
                                                    "flex flex-col rounded-lg border bg-[#0f1115] px-3 py-2 transition-colors",
                                                    "border-gray-800",
                                                    "hover:border-emerald-700",
                                                    isHovered && "border-emerald-600 shadow-lg shadow-emerald-500/10",
                                                )}
                                                onMouseEnter={() => setHoveredBarIndex(index)}
                                                onMouseLeave={() => setHoveredBarIndex(null)}
                                            >
                                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                    <span className="font-medium text-white">{formatTime(bar.startTime)}</span>
                                                    <span className={cn("font-semibold", deltaPositive ? "text-emerald-300" : "text-rose-300")}>
                                                        Δ {formatNumber(bar.delta)}
                                                    </span>
                                                </div>
                                                <div className="mt-1 text-[10px] text-muted-foreground">
                                                    {formatTime(bar.endTime)} ({bar.timeframe})
                                                </div>

                                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-200">
                                                    <div className="rounded-md bg-gray-900/60 p-2">
                                                        <p className="text-[10px] text-muted-foreground">Ask</p>
                                                        <p className="text-emerald-300 font-semibold">{formatNumber(bar.totalAskVolume)}</p>
                                                    </div>
                                                    <div className="rounded-md bg-gray-900/60 p-2">
                                                        <p className="text-[10px] text-muted-foreground">Bid</p>
                                                        <p className="text-rose-300 font-semibold">{formatNumber(bar.totalBidVolume)}</p>
                                                    </div>
                                                    <div className="col-span-2 rounded-md bg-gray-900/60 p-2">
                                                        <p className="text-[10px] text-muted-foreground">OHLC</p>
                                                        <p className="font-semibold text-white">
                                                            O {bar.open} · H {bar.high} · L {bar.low} · C {bar.close}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                                                    <span>{totalTrades} trades</span>
                                                    <span className="text-white">Vol {formatNumber(totalVolume)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-3 rounded-lg border border-gray-900/60 bg-[#0f1115] px-3 py-2 text-xs text-gray-300">
                                {hoveredBar ? (
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="text-emerald-200">{formatTime(hoveredBar.startTime)}</span>
                                        <span>Close {hoveredBar.close}</span>
                                        <span>High {hoveredBar.high}</span>
                                        <span>Low {hoveredBar.low}</span>
                                        <span>Volume {formatNumber(hoveredBar.totalAskVolume + hoveredBar.totalBidVolume)}</span>
                                    </div>
                                ) : (
                                    <span className="text-gray-500">Hover a bar to inspect values. Drag horizontally to pan.</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
