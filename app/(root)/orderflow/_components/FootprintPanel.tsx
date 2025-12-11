"use client";

import { useEffect, useMemo, useState, type HTMLAttributes } from "react";

import { FootprintStreamTimeframe, useBinanceFootprintFeed } from "@/hooks/useBinanceFootprintFeed";
import { FootprintBar } from "@/lib/footprint/types";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/formatters";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    timeframe: FootprintStreamTimeframe | string;
}

const TIMEFRAME_OPTIONS: FootprintStreamTimeframe[] = ["1m", "5m", "15m"];
const MAX_BARS = 30;

const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const parseToSupportedTimeframe = (value: string): FootprintStreamTimeframe => {
    if (value === "5m" || value === "15m") return value;
    return "1m";
};

const buildDemoBars = (symbol: string, timeframe: FootprintStreamTimeframe): FootprintBar[] => {
    const now = Date.now();
    const oneMinute = 60_000;
    const timeframeMs = timeframe === "1m" ? oneMinute : timeframe === "5m" ? 5 * oneMinute : 15 * oneMinute;
    const bars: FootprintBar[] = [];
    let lastClose = 42000;

    for (let index = MAX_BARS - 1; index >= 0; index -= 1) {
        const startTime = now - index * timeframeMs;
        const endTime = startTime + timeframeMs;
        const open = lastClose;
        const close = open + (Math.sin(index) * 50 + (index % 2 === 0 ? 25 : -20));
        const high = Math.max(open, close) + 35;
        const low = Math.min(open, close) - 35;
        const cellCount = 6;
        const cells: FootprintBar["cells"] = [];

        for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
            const price = low + ((high - low) / cellCount) * (cellIndex + 1);
            const askVolume = Math.max(0, 3 + Math.cos(cellIndex + index) * 2);
            const bidVolume = Math.max(0, 3 + Math.sin(cellIndex + index) * 2);
            cells.push({
                price,
                askVolume,
                bidVolume,
                tradesCount: 2 + ((cellIndex + index) % 3),
            });
        }

        const totalAskVolume = cells.reduce((sum, cell) => sum + cell.askVolume, 0);
        const totalBidVolume = cells.reduce((sum, cell) => sum + cell.bidVolume, 0);
        lastClose = close;

        bars.push({
            symbol: symbol.toUpperCase(),
            timeframe,
            startTime,
            endTime,
            open,
            high,
            low,
            close,
            cells,
            totalAskVolume,
            totalBidVolume,
            delta: totalAskVolume - totalBidVolume,
        });
    }

    return bars;
};

export function FootprintPanel({ symbol, timeframe }: FootprintPanelProps) {
    const [currentSymbol, setCurrentSymbol] = useState(symbol);
    const [currentTimeframe, setCurrentTimeframe] = useState<FootprintStreamTimeframe>(
        parseToSupportedTimeframe(timeframe),
    );
    const [isLive, setIsLive] = useState(true);

    useEffect(() => {
        setCurrentSymbol(symbol);
    }, [symbol]);

    useEffect(() => {
        setCurrentTimeframe(parseToSupportedTimeframe(timeframe));
    }, [timeframe]);

    const { candles, isConnected, error } = useBinanceFootprintFeed({
        symbol: currentSymbol,
        timeframe: currentTimeframe,
        isLive,
        maxCandles: 150,
    });

    const visibleBars = useMemo(() => candles.slice(-MAX_BARS), [candles]);
    const fallbackBars = useMemo(
        () => buildDemoBars(currentSymbol, currentTimeframe),
        [currentSymbol, currentTimeframe],
    );

    const showFallback = Boolean(error && process.env.NEXT_PUBLIC_FOOTPRINT_DEMO_MODE === "true");
    const bars = showFallback ? fallbackBars : visibleBars;
    const isWaitingForData = !bars.length && !showFallback;

    const connectionLabel = showFallback
        ? "Demo mode"
        : isConnected
          ? isLive
              ? "Live"
              : "Paused"
          : "Connecting";
    const connectionClassName = cn(
        "rounded-full px-3 py-1 text-[11px] font-semibold",
        showFallback
            ? "bg-amber-500/10 text-amber-200"
            : isConnected
              ? isLive
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-gray-800 text-gray-200"
              : "bg-gray-800 text-gray-200",
    );

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                        <CardTitle className="text-sm text-emerald-400">Footprint (Live Binance)</CardTitle>
                        <p className="text-lg font-semibold">{currentSymbol.toUpperCase()} footprint</p>
                        <p className="text-xs text-muted-foreground">
                            Live trade aggregation into bid/ask footprint bars. Scroll inside the chart to browse history.
                        </p>
                    </div>
                    <span className={connectionClassName}>{connectionLabel}</span>
                </div>

                {error && (
                    <div className="mt-3 rounded-md border border-amber-600/50 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-100">
                        Live Binance feed unavailable. {showFallback ? "Showing demo candles." : "Waiting for connection."}
                    </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Symbol</span>
                        <Select value={currentSymbol} onValueChange={setCurrentSymbol}>
                            <SelectTrigger size="sm" className="min-w-[120px] text-white">
                                <SelectValue placeholder="Select symbol" />
                            </SelectTrigger>
                            <SelectContent>
                                {[
                                    { label: "BTCUSDT", value: "BTCUSDT" },
                                    { label: "ETHUSDT", value: "ETHUSDT" },
                                    { label: "BNBUSDT", value: "BNBUSDT" },
                                ].map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Timeframe</span>
                        <div className="flex flex-wrap gap-2">
                            {TIMEFRAME_OPTIONS.map((option) => (
                                <Button
                                    key={option}
                                    size="sm"
                                    variant={option === currentTimeframe ? "default" : "outline"}
                                    className={cn("min-w-[3.5rem]", option === currentTimeframe && "bg-emerald-600")}
                                    onClick={() => setCurrentTimeframe(option)}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Button
                        size="sm"
                        variant={isLive ? "default" : "outline"}
                        className={cn(
                            "min-w-[5rem]", 
                            isLive ? "bg-emerald-600" : "border-gray-700 text-gray-200 hover:text-white",
                        )}
                        onClick={() => setIsLive((prev) => !prev)}
                    >
                        {isLive ? "Live" : "Paused"}
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                <div className="flex-1 min-w-0 overflow-hidden rounded-lg border border-gray-900/80 bg-[#0b0d12] p-3 shadow-inner shadow-black/10">
                    {isWaitingForData ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            Waiting for trades…
                        </div>
                    ) : bars.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            No footprint data available.
                        </div>
                    ) : (
                        <div className="flex h-full min-h-0 flex-col overflow-hidden">
                            <div className="h-full w-full max-w-full min-w-0 overflow-x-auto overflow-y-hidden pr-1">
                                <div className="flex h-full min-w-0 items-stretch gap-3">
                                    {bars.map((bar) => {
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
