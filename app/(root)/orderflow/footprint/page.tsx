"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import OrderflowChart from "@/app/(root)/orderflow/_components/orderflow-chart";
import VolumeProfile, { VolumeProfileLevel } from "@/app/(root)/orderflow/_components/volume-profile";
import { bucketTrades } from "@/app/(root)/orderflow/_utils/bucketing";
import { buildFootprintBars, FootprintBar, inferPriceStepFromTrades } from "@/app/(root)/orderflow/_utils/footprint";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ORDERFLOW_DEFAULT_SYMBOL,
    ORDERFLOW_SYMBOL_OPTIONS,
    ORDERFLOW_WINDOW_PRESETS,
} from "@/lib/constants";
import { NormalizedTrade, useOrderflowStream } from "@/hooks/useOrderflowStream";
import { usePersistOrderflowTrades } from "@/hooks/usePersistOrderflowTrades";
import { cn } from "@/lib/utils";

type FootprintMode = "Bid x Ask" | "Delta" | "Volume";

type FootprintHit = {
    bar: FootprintBar;
    barIndex: number;
    cell: FootprintBar["cells"][number];
    x: number;
    y: number;
    width: number;
    height: number;
};

type HoveredCell = FootprintHit & {
    tooltipX: number;
    tooltipY: number;
};

const TIMEFRAME_OPTIONS = ["5s", "15s", "30s", "1m", "5m", "15m"] as const;
const MODE_OPTIONS: FootprintMode[] = ["Bid x Ask", "Delta", "Volume"];
const DEFAULT_TIMEFRAME: (typeof TIMEFRAME_OPTIONS)[number] = "15s";

const parseTimeframeToSeconds = (value: (typeof TIMEFRAME_OPTIONS)[number]) => {
    const unit = value.slice(-1);
    const numeric = Number(value.slice(0, -1));

    if (!Number.isFinite(numeric)) return 15;
    if (unit === "m") return numeric * 60;
    return numeric;
};

const FootprintPage = () => {
    const defaultWindowSeconds = ORDERFLOW_WINDOW_PRESETS[1]?.value ?? ORDERFLOW_WINDOW_PRESETS[0].value;
    const defaultTimeframeSeconds = parseTimeframeToSeconds(DEFAULT_TIMEFRAME);

    const [selectedSymbol, setSelectedSymbol] = useState<string>(ORDERFLOW_DEFAULT_SYMBOL);
    const [selectedTimeframe, setSelectedTimeframe] = useState<(typeof TIMEFRAME_OPTIONS)[number]>(DEFAULT_TIMEFRAME);
    const [timeframeSeconds, setTimeframeSeconds] = useState<number>(defaultTimeframeSeconds);
    const [windowSeconds, setWindowSeconds] = useState<number>(defaultWindowSeconds);
    const [mode, setMode] = useState<FootprintMode>("Bid x Ask");
    const [showNumbers, setShowNumbers] = useState(true);
    const [highlightImbalances, setHighlightImbalances] = useState(true);
    const [historyTrades, setHistoryTrades] = useState<NormalizedTrade[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const { trades: liveTrades, windowedTrades: liveWindowedTrades } = useOrderflowStream({
        symbol: selectedSymbol,
        windowSeconds,
    });

    usePersistOrderflowTrades(selectedSymbol, liveTrades, true);

    useEffect(() => {
        setTimeframeSeconds(parseTimeframeToSeconds(selectedTimeframe));
    }, [selectedTimeframe]);

    useEffect(() => {
        let isCancelled = false;

        const fetchHistory = async () => {
            setLoadingHistory(true);
            try {
                const params = new URLSearchParams({
                    symbol: selectedSymbol,
                    windowSeconds: String(windowSeconds),
                    maxPoints: "5000",
                });

                const response = await fetch(`/api/orderflow/history?${params.toString()}`);
                if (!response.ok) {
                    throw new Error(`Failed to load history (${response.status})`);
                }

                const data = await response.json();
                if (isCancelled) return;

                const fetchedTrades: NormalizedTrade[] = Array.isArray(data?.trades)
                    ? data.trades
                          .map((trade: NormalizedTrade) => ({
                              timestamp: Number(trade.timestamp),
                              price: Number(trade.price),
                              quantity: Number(trade.quantity),
                              side: trade.side === "sell" ? "sell" : "buy",
                          }))
                          .filter(
                              (trade) =>
                                  Number.isFinite(trade.timestamp) &&
                                  Number.isFinite(trade.price) &&
                                  Number.isFinite(trade.quantity),
                          )
                    : [];

                setHistoryTrades(fetchedTrades);
            } catch (fetchError) {
                console.error("Failed to fetch orderflow history", fetchError);
                if (!isCancelled) {
                    setHistoryTrades([]);
                }
            } finally {
                if (!isCancelled) {
                    setLoadingHistory(false);
                }
            }
        };

        fetchHistory();

        return () => {
            isCancelled = true;
        };
    }, [selectedSymbol, windowSeconds]);

    const combinedTrades = useMemo(() => {
        const allTrades = [...historyTrades, ...liveWindowedTrades];
        const uniqueTrades = new Map<string, NormalizedTrade>();

        allTrades.forEach((trade) => {
            const key = `${trade.timestamp}-${trade.side}-${trade.price}-${trade.quantity}`;
            uniqueTrades.set(key, trade);
        });

        return Array.from(uniqueTrades.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [historyTrades, liveWindowedTrades]);

    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const effectiveTrades = useMemo(
        () => combinedTrades.filter((trade) => trade.timestamp >= windowStart),
        [combinedTrades, windowStart],
    );

    const effectiveBuckets = useMemo(
        () => bucketTrades(effectiveTrades, windowSeconds, timeframeSeconds, now),
        [effectiveTrades, windowSeconds, timeframeSeconds, now],
    );

    const priceStep = useMemo(() => {
        if (effectiveTrades.length === 0) return 0;

        const inferred = inferPriceStepFromTrades(effectiveTrades);
        const referencePrice = effectiveTrades[effectiveTrades.length - 1]?.price ?? 0;
        const fallbackStep = referencePrice > 0 ? Math.max(referencePrice * 0.0005, 0.01) : 0;

        return inferred > 0 ? inferred : fallbackStep;
    }, [effectiveTrades]);

    const footprintBars = useMemo<FootprintBar[]>(() => {
        if (effectiveTrades.length === 0) return [];

        return buildFootprintBars(effectiveTrades, {
            windowSeconds,
            bucketSizeSeconds: timeframeSeconds,
            referenceTimestamp: now,
            priceStep: priceStep || undefined,
        });
    }, [effectiveTrades, windowSeconds, timeframeSeconds, now, priceStep]);

    const volumeProfile = useMemo(() => {
        if (effectiveTrades.length === 0) {
            return { levels: [] as VolumeProfileLevel[], priceStep: 0, referencePrice: null };
        }

        const sortedTrades = [...effectiveTrades].sort((a, b) => a.timestamp - b.timestamp);
        const referencePrice = sortedTrades[sortedTrades.length - 1]?.price ?? null;
        if (!referencePrice) {
            return { levels: [] as VolumeProfileLevel[], priceStep: 0, referencePrice: null };
        }

        const step = priceStep > 0 ? priceStep : Math.max(referencePrice * 0.0005, 0.01);
        const levelsPerSide = 6;
        const centerIndex = Math.max(Math.round(referencePrice / step), 1);
        const startIndex = Math.max(centerIndex - levelsPerSide, 1);
        const endIndex = centerIndex + levelsPerSide;

        const aggregation = new Map<number, { buyVolume: number; sellVolume: number }>();

        sortedTrades.forEach((trade) => {
            const levelIndex = Math.round(trade.price / step);
            if (levelIndex < startIndex - 1 || levelIndex > endIndex + 1) return;
            const levelPrice = levelIndex * step;
            const existing = aggregation.get(levelPrice) ?? { buyVolume: 0, sellVolume: 0 };

            if (trade.side === "buy") {
                existing.buyVolume += trade.quantity;
            } else {
                existing.sellVolume += trade.quantity;
            }

            aggregation.set(levelPrice, existing);
        });

        const levels: VolumeProfileLevel[] = [];
        for (let index = startIndex; index <= endIndex; index += 1) {
            const price = index * step;
            const volume = aggregation.get(price) ?? { buyVolume: 0, sellVolume: 0 };
            const totalVolume = volume.buyVolume + volume.sellVolume;
            const imbalancePercent =
                totalVolume > 0 ? (Math.abs(volume.buyVolume - volume.sellVolume) / totalVolume) * 100 : 0;
            const dominantSide = totalVolume === 0 ? null : volume.buyVolume >= volume.sellVolume ? "buy" : "sell";

            levels.push({
                price,
                buyVolume: volume.buyVolume,
                sellVolume: volume.sellVolume,
                totalVolume,
                imbalancePercent,
                dominantSide,
            });
        }

        return { levels, priceStep: step, referencePrice };
    }, [effectiveTrades, priceStep]);

    const hasData = footprintBars.length > 0 || effectiveBuckets.some((bucket) => bucket.totalVolume > 0);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const footprintContainerRef = useRef<HTMLDivElement | null>(null);
    const hitCellsRef = useRef<FootprintHit[]>([]);
    const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const render = () => {
            hitCellsRef.current = [];

            const parent = canvas.parentElement;
            const width = parent?.clientWidth ?? 800;
            const height = parent?.clientHeight ?? 520;
            const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            context.resetTransform();
            context.scale(dpr, dpr);

            context.fillStyle = "#0b0d12";
            context.fillRect(0, 0, width, height);

            if (!footprintBars.length) {
                setHoveredCell(null);
                context.fillStyle = "#9ca3af";
                context.font = "14px Inter, system-ui, -apple-system, sans-serif";
                context.fillText("Waiting for footprint data…", 16, height / 2);
                return;
            }

            const paddingX = 40;
            const paddingY = 20;
            const chartWidth = width - paddingX * 2;
            const chartHeight = height - paddingY * 2;

            const minPrice = Math.min(...footprintBars.map((bar) => bar.low));
            const maxPrice = Math.max(...footprintBars.map((bar) => bar.high));
            const priceRange = Math.max(maxPrice - minPrice, 1e-6);

            const candleSpacing = chartWidth / Math.max(footprintBars.length, 1);
            const bodyWidth = Math.max(candleSpacing * 0.55, 6);

            const yForPrice = (price: number) =>
                paddingY + (1 - (price - minPrice) / priceRange) * chartHeight;

            const inferredCellStep = (() => {
                if (priceStep > 0) return priceStep;
                const diffs: number[] = [];
                footprintBars.forEach((bar) => {
                    for (let index = 1; index < bar.cells.length; index += 1) {
                        const diff = Math.abs(bar.cells[index].price - bar.cells[index - 1].price);
                        if (diff > 0) {
                            diffs.push(diff);
                        }
                    }
                });
                if (diffs.length) {
                    const sorted = diffs.sort((a, b) => a - b);
                    return sorted[Math.floor(sorted.length / 2)];
                }
                return priceRange / Math.max(footprintBars[0]?.cells.length || 1, 12);
            })();

            const maxCellVolume = Math.max(
                ...footprintBars.flatMap((bar) => bar.cells.map((cell) => cell.totalVolume)),
                0,
            );
            const maxCellDelta = Math.max(
                ...footprintBars.flatMap((bar) =>
                    bar.cells.map((cell) => Math.abs(cell.buyVolume - cell.sellVolume)),
                ),
                0,
            );

            context.strokeStyle = "#1f2937";
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(paddingX, paddingY);
            context.lineTo(paddingX, paddingY + chartHeight);
            context.lineTo(paddingX + chartWidth, paddingY + chartHeight);
            context.stroke();

            const formatVolume = (value: number) => {
                if (Math.abs(value) >= 1000) return value.toFixed(0);
                if (Math.abs(value) >= 1) return value.toFixed(2);
                return value.toPrecision(2);
            };

            footprintBars.forEach((bar, index) => {
                const x = paddingX + index * candleSpacing + candleSpacing / 2;
                const openY = yForPrice(bar.open);
                const closeY = yForPrice(bar.close);
                const highY = yForPrice(bar.high);
                const lowY = yForPrice(bar.low);

                const bullish = bar.close > bar.open;
                const bearish = bar.close < bar.open;
                const wickColor = bullish ? "#34d399" : bearish ? "#f87171" : "#9ca3af";

                context.strokeStyle = wickColor;
                context.beginPath();
                context.moveTo(x, highY);
                context.lineTo(x, lowY);
                context.stroke();

                const bodyX = x - bodyWidth / 2;
                const bodyY = Math.min(openY, closeY);
                const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

                context.fillStyle = "#111827";
                context.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);

                bar.cells.forEach((cell) => {
                    const halfStep = inferredCellStep > 0 ? inferredCellStep / 2 : priceRange / 40;
                    const cellTop = yForPrice(cell.price + halfStep);
                    const cellBottom = yForPrice(cell.price - halfStep);
                    const cellHeight = Math.max(cellBottom - cellTop, 3);
                    const cellWidth = bodyWidth;
                    const cellX = x - cellWidth / 2;

                    const totalVolume = cell.totalVolume;
                    const delta = cell.buyVolume - cell.sellVolume;
                    const volumeRatio = maxCellVolume > 0 ? Math.min(totalVolume / maxCellVolume, 1) : 0;
                    const deltaRatio = maxCellDelta > 0 ? Math.min(Math.abs(delta) / maxCellDelta, 1) : 0;

                    if (mode === "Bid x Ask") {
                        const sellWidth = totalVolume > 0 ? (cell.sellVolume / totalVolume) * cellWidth : cellWidth / 2;
                        const buyWidth = cellWidth - sellWidth;
                        const sharedAlpha = 0.2 + volumeRatio * 0.65;

                        context.fillStyle = `rgba(248, 113, 113, ${sharedAlpha})`;
                        context.fillRect(cellX, cellTop, sellWidth, cellHeight);
                        context.fillStyle = `rgba(52, 211, 153, ${sharedAlpha})`;
                        context.fillRect(cellX + sellWidth, cellTop, buyWidth, cellHeight);
                    } else if (mode === "Volume") {
                        const alpha = 0.15 + volumeRatio * 0.75;
                        context.fillStyle = `rgba(59, 130, 246, ${alpha})`;
                        context.fillRect(cellX, cellTop, cellWidth, cellHeight);
                    } else {
                        const alpha = 0.2 + deltaRatio * 0.7;
                        context.fillStyle = delta >= 0
                            ? `rgba(52, 211, 153, ${alpha})`
                            : `rgba(248, 113, 113, ${alpha})`;
                        context.fillRect(cellX, cellTop, cellWidth, cellHeight);
                    }

                    if (highlightImbalances && cell.imbalancePercent >= 60) {
                        context.strokeStyle = cell.dominantSide === "buy" ? "#10b981" : "#f43f5e";
                        context.lineWidth = 1;
                        context.strokeRect(cellX, cellTop, cellWidth, cellHeight);
                    }

                    if (showNumbers) {
                        context.fillStyle = "#e5e7eb";
                        context.font = "10px Inter, system-ui, -apple-system, sans-serif";
                        let label = formatVolume(totalVolume);

                        if (mode === "Bid x Ask") {
                            label = `${formatVolume(cell.sellVolume)} | ${formatVolume(cell.buyVolume)}`;
                        } else if (mode === "Delta") {
                            const deltaLabel = formatVolume(Math.abs(delta));
                            label = `${delta >= 0 ? "+" : "-"}${deltaLabel}`;
                        }

                        context.fillText(label, cellX + 4, cellBottom - 4);
                    }

                    hitCellsRef.current.push({
                        bar,
                        barIndex: index,
                        cell,
                        x: cellX,
                        y: cellTop,
                        width: cellWidth,
                        height: cellHeight,
                    });
                });
            });
        };

        render();

        window.addEventListener("resize", render);
        return () => {
            window.removeEventListener("resize", render);
        };
    }, [footprintBars, highlightImbalances, mode, priceStep, showNumbers]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = footprintContainerRef.current;

        if (!canvas || !container) return;

        const handleMove = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const hit = hitCellsRef.current.find(
                (cell) => x >= cell.x && x <= cell.x + cell.width && y >= cell.y && y <= cell.y + cell.height,
            );

            if (hit) {
                setHoveredCell({
                    ...hit,
                    tooltipX: event.clientX - containerRect.left,
                    tooltipY: event.clientY - containerRect.top,
                });
            } else {
                setHoveredCell(null);
            }
        };

        const handleLeave = () => setHoveredCell(null);

        canvas.addEventListener("mousemove", handleMove);
        canvas.addEventListener("mouseleave", handleLeave);

        return () => {
            canvas.removeEventListener("mousemove", handleMove);
            canvas.removeEventListener("mouseleave", handleLeave);
        };
    }, [footprintBars.length]);

    return (
        <section className="space-y-6 px-4 py-6 md:px-6 min-w-0">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-400">Orderflow</p>
                    <h1 className="text-3xl font-bold text-white">Footprint – {selectedSymbol.toUpperCase()}</h1>
                    <p className="text-gray-400">Full candlestick + footprint view using live orderflow.</p>
                </div>
                <Link href="/orderflow" className="self-start md:self-auto">
                    <Button variant="ghost" className="text-sm text-emerald-200 hover:text-emerald-100">
                        ← Back to Orderflow
                    </Button>
                </Link>
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Symbol</span>
                        <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                            <SelectTrigger size="sm" className="min-w-[140px] text-white">
                                <SelectValue placeholder="Select symbol" />
                            </SelectTrigger>
                            <SelectContent>
                                {ORDERFLOW_SYMBOL_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Window</span>
                        <div className="flex flex-wrap gap-2">
                            {ORDERFLOW_WINDOW_PRESETS.map((preset) => (
                                <Button
                                    key={preset.value}
                                    size="sm"
                                    variant={preset.value === windowSeconds ? "default" : "outline"}
                                    className={cn("min-w-[3.5rem]", preset.value === windowSeconds && "bg-emerald-600")}
                                    onClick={() => setWindowSeconds(preset.value)}
                                >
                                    {preset.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Timeframe</span>
                        <div className="flex flex-wrap gap-2">
                            {TIMEFRAME_OPTIONS.map((option) => (
                                <Button
                                    key={option}
                                    size="sm"
                                    variant={option === selectedTimeframe ? "default" : "outline"}
                                    className={cn("min-w-[3rem]", option === selectedTimeframe && "bg-emerald-600")}
                                    onClick={() => setSelectedTimeframe(option)}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-gray-500">Mode</span>
                        <div className="flex flex-wrap gap-2">
                            {MODE_OPTIONS.map((option) => (
                                <Button
                                    key={option}
                                    size="sm"
                                    variant={option === mode ? "default" : "outline"}
                                    className={cn("min-w-[4.5rem]", option === mode && "bg-emerald-600")}
                                    onClick={() => setMode(option)}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                            type="checkbox"
                            checked={showNumbers}
                            onChange={(event) => setShowNumbers(event.target.checked)}
                            className="h-4 w-4 rounded border-gray-700 bg-[#0f1115] text-emerald-500 focus:ring-emerald-500"
                        />
                        Show numbers
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                            type="checkbox"
                            checked={highlightImbalances}
                            onChange={(event) => setHighlightImbalances(event.target.checked)}
                            className="h-4 w-4 rounded border-gray-700 bg-[#0f1115] text-emerald-500 focus:ring-emerald-500"
                        />
                        Highlight imbalances
                    </label>

                    {loadingHistory && (
                        <span className="rounded-full bg-gray-900 px-3 py-1 text-xs text-gray-300">Syncing history…</span>
                    )}
                </div>
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[3fr_1fr] min-w-0">
                <div className="space-y-4 min-w-0">
                    <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
                        <div className="flex items-center justify-between pb-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500">Footprint</p>
                                <h3 className="text-lg font-semibold text-white">Footprint Heatmap</h3>
                                <p className="text-xs text-gray-400">
                                    Live footprint cells stacked inside each candle. Colors respond to {mode.toLowerCase()} mode
                                    and the imbalance toggle.
                                </p>
                            </div>
                            <span className="rounded-full bg-gray-900 px-3 py-1 text-xs text-gray-300">
                                {footprintBars.length} buckets
                            </span>
                        </div>
                        <div
                            ref={footprintContainerRef}
                            className="relative h-[520px] w-full rounded-lg border border-gray-900/80 bg-[#0b0d12]"
                        >
                            <canvas ref={canvasRef} className="h-full w-full" />

                            {hoveredCell && (
                                <div
                                    className="pointer-events-none absolute z-10 w-64 rounded-lg border border-emerald-800/60 bg-[#0f1115] p-3 text-xs text-gray-200 shadow-lg shadow-black/40"
                                    style={{
                                        left: hoveredCell.tooltipX + 12,
                                        top: hoveredCell.tooltipY + 12,
                                    }}
                                >
                                    <div className="flex items-center justify-between text-[11px] text-emerald-200">
                                        <span>
                                            {new Date(hoveredCell.bar.bucketStart).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                second: "2-digit",
                                            })}
                                        </span>
                                        <span className="text-gray-400">{timeframeSeconds}s bar</span>
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-white">
                                        Price {hoveredCell.cell.price.toFixed(2)}
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                                        <div>
                                            <p className="text-gray-400">Buy Volume</p>
                                            <p className="text-emerald-300 font-semibold">
                                                {hoveredCell.cell.buyVolume.toFixed(2)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Sell Volume</p>
                                            <p className="text-rose-300 font-semibold">
                                                {hoveredCell.cell.sellVolume.toFixed(2)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Delta</p>
                                            <p className="font-semibold">
                                                {(hoveredCell.cell.buyVolume - hoveredCell.cell.sellVolume).toFixed(2)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Total</p>
                                            <p className="font-semibold">{hoveredCell.cell.totalVolume.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-[11px] text-gray-400">
                                        Trades: {hoveredCell.cell.tradesCount ?? 0} • Bar #{hoveredCell.barIndex + 1}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 text-sm text-gray-400 shadow-lg shadow-black/20">
                        <p>
                            Timeframe {selectedTimeframe} • Bar size {timeframeSeconds}s • Showing numbers:{" "}
                            <span className="font-semibold text-white">{showNumbers ? "On" : "Off"}</span> • Highlight
                            imbalances: <span className="font-semibold text-white">{highlightImbalances ? "On" : "Off"}</span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                            Current mode: <span className="text-emerald-200">{mode}</span>. Cell fills and labels respond to
                            these toggles in real time so you can quickly scan for pressure at each price level.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <VolumeProfile
                        levels={volumeProfile.levels}
                        priceStep={volumeProfile.priceStep}
                        referencePrice={volumeProfile.referencePrice}
                    />
                    <div className="rounded-xl border border-dashed border-gray-800 bg-[#0f1115] p-4 text-sm text-gray-400 shadow-lg shadow-black/20">
                        <p className="text-white font-semibold">Mini Volume Profile (coming from Phase 4 component)</p>
                        <p className="mt-1">Side panel reserved for mini-profile reuse and per-price metrics.</p>
                        <p className="mt-2 text-xs text-gray-500">
                            This column mirrors the existing mini volume profile placement and will share data sources in
                            the next phase.
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
                <div className="flex items-center justify-between pb-3">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Volume Over Time</p>
                        <h3 className="text-lg font-semibold text-white">Volume over time (Buy vs Sell stacked)</h3>
                    </div>
                    {!hasData && <span className="text-xs text-gray-400">Waiting for trades…</span>}
                </div>
                {hasData ? (
                    <OrderflowChart buckets={effectiveBuckets} />
                ) : (
                    <div className="rounded-lg border border-dashed border-gray-800 bg-[#0b0d12] p-6 text-center text-sm text-gray-400">
                        Stacked Buy vs Sell volume chart – coming in a later phase.
                    </div>
                )}
            </div>
        </section>
    );
};

export default FootprintPage;

