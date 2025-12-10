"use client";

import { useEffect, useMemo, useState, type HTMLAttributes } from "react";

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
                            <div className="h-full w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden pr-1">
                                <div className="flex h-full min-w-0 items-stretch gap-3">
                                    {visibleBars.map((bar) => {
                                        const totalTrades = bar.cells.reduce((sum, cell) => sum + (cell.tradesCount || 0), 0);
                                        const totalVolume = bar.totalAskVolume + bar.totalBidVolume;
                                        const deltaPositive = bar.delta >= 0;

                                        return (
                                            <div
                                                key={`${bar.symbol}-${bar.startTime}`}
                                                className="flex min-w-[170px] max-w-[170px] flex-col rounded-lg border border-gray-800 bg-[#0f1115] px-3 py-2"
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
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
