"use client";

import { useEffect, useMemo, useState, type HTMLAttributes } from "react";

import { FootprintBar, FootprintTimeframe } from "@/lib/footprint/types";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/formatters";

type FootprintMode = "bidask" | "delta" | "volume";

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
const IMBALANCE_RATIO = 1.5;

const FOOTPRINT_THEME = {
    positive: "16,185,129", // emerald-500
    negative: "244,63,94", // rose-500
    neutral: "148,163,184", // slate-400
};

const colorWithAlpha = (rgb: string, alpha: number) => `rgba(${rgb}, ${alpha})`;

const getDeltaBackground = (delta: number, maxAbsDelta: number) => {
    if (!maxAbsDelta) return "transparent";
    const intensity = Math.min(1, Math.abs(delta) / maxAbsDelta);
    const alpha = 0.08 + intensity * 0.35;
    const rgb = delta >= 0 ? FOOTPRINT_THEME.positive : FOOTPRINT_THEME.negative;
    return colorWithAlpha(rgb, alpha);
};

const getVolumeBackground = (volume: number, maxVolume: number) => {
    if (!maxVolume) return "transparent";
    const intensity = Math.min(1, volume / maxVolume);
    const alpha = 0.06 + intensity * 0.35;
    return colorWithAlpha(FOOTPRINT_THEME.neutral, alpha);
};

const formatCompactNumber = (value: number) =>
    value >= 1000 ? formatNumber(value, 0) : formatNumber(value, value >= 100 ? 0 : 2);

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
        totalVolume: Number(bar.totalVolume),
        cells: Array.isArray(bar.cells)
            ? bar.cells.map((cell) => ({
                  price: Number(cell.price),
                  bidVolume: Number(cell.bidVolume),
                  askVolume: Number(cell.askVolume),
                  totalVolume: Number(cell.totalVolume),
                  delta: Number(cell.delta),
                  tradesCount: Number(cell.tradesCount),
              }))
            : [],
    }));

export function FootprintPanel({ symbol, timeframe }: FootprintPanelProps) {
    const [currentTimeframe, setCurrentTimeframe] = useState<FootprintTimeframe>(timeframe);
    const [bars, setBars] = useState<FootprintBar[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [mode, setMode] = useState<FootprintMode>("bidask");
    const [showNumbers, setShowNumbers] = useState(true);
    const [highlightImbalances, setHighlightImbalances] = useState(true);

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
                        <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    {([
                                        { key: "bidask", label: "Bid x Ask" },
                                        { key: "delta", label: "Delta" },
                                        { key: "volume", label: "Volume" },
                                    ] as const).map((option) => (
                                        <button
                                            key={option.key}
                                            type="button"
                                            onClick={() => setMode(option.key)}
                                            className={cn(
                                                "rounded-full border px-3 py-1 text-xs transition-colors",
                                                mode === option.key
                                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                                                    : "border-gray-800 text-gray-300 hover:border-emerald-700 hover:text-emerald-200",
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>

                                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-800 px-2 py-1 text-xs text-gray-300 hover:border-emerald-700">
                                    <input
                                        type="checkbox"
                                        checked={showNumbers}
                                        onChange={(event) => setShowNumbers(event.target.checked)}
                                        className="h-3.5 w-3.5 accent-emerald-500"
                                    />
                                    Show numbers
                                </label>

                                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-800 px-2 py-1 text-xs text-gray-300 hover:border-emerald-700">
                                    <input
                                        type="checkbox"
                                        checked={highlightImbalances}
                                        onChange={(event) => setHighlightImbalances(event.target.checked)}
                                        className="h-3.5 w-3.5 accent-emerald-500"
                                    />
                                    Highlight imbalances
                                </label>

                                {isRefreshing && (
                                    <span className="rounded-full bg-gray-800 px-3 py-1 text-[11px] text-gray-300">Refreshing…</span>
                                )}
                            </div>

                            <div className="h-full w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden pr-1">
                                <div className="flex h-full min-w-0 items-stretch gap-3">
                                    {visibleBars.map((bar) => {
                                        const cellsDescending = [...bar.cells].sort((a, b) => b.price - a.price);
                                        const totalTrades = bar.cells.reduce((sum, cell) => sum + (cell.tradesCount || 0), 0);
                                        const maxAbsDelta = Math.max(...bar.cells.map((cell) => Math.abs(cell.delta)), 0);
                                        const maxVolume = Math.max(...bar.cells.map((cell) => cell.totalVolume), 0);
                                        const deltaPositive = bar.delta >= 0;

                                        const cellBackground = (cellDelta: number, cellVolume: number) => {
                                            if (mode === "volume") return getVolumeBackground(cellVolume, maxVolume);
                                            return getDeltaBackground(mode === "delta" ? cellDelta : cellDelta, maxAbsDelta);
                                        };

                                        const renderCellContent = (cell: (typeof bar.cells)[number]) => {
                                            const highlight =
                                                highlightImbalances &&
                                                ((cell.askVolume >= IMBALANCE_RATIO * (cell.bidVolume || 0.0001) &&
                                                    cell.askVolume > 0) ||
                                                    (cell.bidVolume >= IMBALANCE_RATIO * (cell.askVolume || 0.0001) &&
                                                        cell.bidVolume > 0));

                                            const background = cellBackground(cell.delta, cell.totalVolume);

                                            if (mode === "bidask") {
                                                return (
                                                    <div
                                                        key={cell.price}
                                                        className={cn(
                                                            "flex items-stretch gap-2 rounded-sm border border-gray-800/70 bg-gray-950/30",
                                                            highlight ? "ring-1 ring-amber-400/60" : "",
                                                        )}
                                                        style={{ background }}
                                                    >
                                                        <div className="w-14 shrink-0 pl-1 text-right text-[10px] text-muted-foreground">
                                                            {cell.price}
                                                        </div>
                                                        <div className="flex w-full items-center divide-x divide-gray-800/60">
                                                            <div className="flex-1 px-2 py-1 text-right text-[11px] font-medium text-rose-200">
                                                                {showNumbers ? formatCompactNumber(cell.bidVolume) : ""}
                                                            </div>
                                                            <div className="flex-1 px-2 py-1 text-right text-[11px] font-medium text-emerald-200">
                                                                {showNumbers ? formatCompactNumber(cell.askVolume) : ""}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            const metricValue = mode === "delta" ? cell.delta : cell.totalVolume;

                                            return (
                                                <div
                                                    key={cell.price}
                                                    className={cn(
                                                        "flex items-center gap-2 rounded-sm border border-gray-800/70 bg-gray-950/30 px-2 py-1",
                                                        highlight ? "ring-1 ring-amber-400/60" : "",
                                                    )}
                                                    style={{ background }}
                                                >
                                                    <div className="w-14 shrink-0 text-right text-[10px] text-muted-foreground">{cell.price}</div>
                                                    <div
                                                        className={cn(
                                                            "flex-1 text-right text-[11px] font-semibold",
                                                            mode === "delta"
                                                                ? cell.delta >= 0
                                                                    ? "text-emerald-200"
                                                                    : "text-rose-200"
                                                                : "text-gray-100",
                                                        )}
                                                    >
                                                        {showNumbers ? formatCompactNumber(metricValue) : ""}
                                                    </div>
                                                </div>
                                            );
                                        };

                                        return (
                                            <div
                                                key={`${bar.symbol}-${bar.startTime}`}
                                                className="flex min-w-[190px] max-w-[190px] flex-col rounded-lg border border-gray-800 bg-[#0f1115] px-3 py-2"
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

                                                <div className="mt-3 flex-1 overflow-hidden rounded-md border border-gray-900/60 bg-gray-950/40">
                                                    <div className="flex items-center justify-between border-b border-gray-900/70 px-2 py-1 text-[10px] text-muted-foreground">
                                                        <span>Price</span>
                                                        <span>
                                                            Mode: <span className="text-white">{mode === "bidask" ? "Bid x Ask" : mode === "delta" ? "Delta" : "Volume"}</span>
                                                        </span>
                                                    </div>
                                                    <div className="h-full max-h-[210px] overflow-y-auto px-1 py-2 pr-2">
                                                        <div className="flex flex-col gap-1">
                                                            {cellsDescending.map((cell) => renderCellContent(cell))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-2 flex items-center justify-between rounded-md bg-gray-900/60 px-2 py-1 text-[11px]">
                                                    <div className="flex flex-col">
                                                        <span className="text-muted-foreground">Vol</span>
                                                        <span className="font-semibold text-white">{formatNumber(bar.totalVolume)}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end text-right">
                                                        <span className="text-muted-foreground">Δ</span>
                                                        <span className={cn("font-semibold", deltaPositive ? "text-emerald-300" : "text-rose-300")}>{formatNumber(bar.delta)}</span>
                                                    </div>
                                                </div>
                                                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                                    <span>{totalTrades} trades</span>
                                                    <span>
                                                        O {bar.open} · H {bar.high} · L {bar.low} · C {bar.close}
                                                    </span>
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
