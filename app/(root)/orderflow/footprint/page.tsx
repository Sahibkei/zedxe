"use client";

// NOTE: Rewritten in Phase 4 stabilisation to avoid client-side crashes.
// Simplified footprint view (no drag pan/zoom) plus local error boundary.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import VolumeProfile, { VolumeProfileLevel } from "@/app/(root)/orderflow/_components/volume-profile";
import {
    buildFootprintBars,
    BuildFootprintResult,
    FootprintBar,
    inferPriceStepFromTrades,
    RowSizeMode,
} from "@/app/(root)/orderflow/_utils/footprint";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ORDERFLOW_BUCKET_PRESETS,
    ORDERFLOW_DEFAULT_SYMBOL,
    ORDERFLOW_SYMBOL_OPTIONS,
    ORDERFLOW_WINDOW_PRESETS,
} from "@/lib/constants";
import { NormalizedTrade, useOrderflowStream } from "@/hooks/useOrderflowStream";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/utils/formatters";

const TIMEFRAME_OPTIONS = ["5s", "15s", "30s", "1m", "5m", "15m"] as const;
const MODE_OPTIONS = ["Bid x Ask", "Delta", "Volume"] as const;
type FootprintMode = (typeof MODE_OPTIONS)[number];

type TimeframeOption = (typeof TIMEFRAME_OPTIONS)[number];

const parseTimeframeSeconds = (value: TimeframeOption): number => {
    const unit = value.slice(-1);
    const numeric = Number(value.slice(0, -1));
    if (!Number.isFinite(numeric)) return 15;
    return unit === "m" ? numeric * 60 : numeric;
};

class FootprintErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("FootprintPage error", error, info);
    }

    render() {
        if (this.state.error) {
            return (
                <div className="flex h-full items-center justify-center text-sm text-red-400">
                    Footprint chart failed to render. Please reload the page or try again later.
                </div>
            );
        }

        return this.props.children;
    }
}

const buildVolumeProfileLevels = (
    trades: NormalizedTrade[],
    priceStep: number,
): { levels: VolumeProfileLevel[]; referencePrice: number | null } => {
    if (!trades.length) return { levels: [], referencePrice: null };

    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const referencePrice = sortedTrades[sortedTrades.length - 1]?.price ?? null;
    if (!referencePrice) return { levels: [], referencePrice: null };

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
        const imbalancePercent = totalVolume > 0 ? (Math.abs(volume.buyVolume - volume.sellVolume) / totalVolume) * 100 : 0;
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

    return { levels, referencePrice };
};

const FootprintPageInner = () => {
    const defaultWindowSeconds = ORDERFLOW_WINDOW_PRESETS[1]?.value ?? ORDERFLOW_WINDOW_PRESETS[0].value;
    const defaultBucketSeconds = ORDERFLOW_BUCKET_PRESETS[1]?.value ?? ORDERFLOW_BUCKET_PRESETS[0].value;

    const [selectedSymbol, setSelectedSymbol] = useState<string>(ORDERFLOW_DEFAULT_SYMBOL);
    const [windowSeconds, setWindowSeconds] = useState<number>(defaultWindowSeconds);
    const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>("15s");
    const [bucketSizeSeconds, setBucketSizeSeconds] = useState<number>(defaultBucketSeconds);
    const [mode, setMode] = useState<FootprintMode>("Bid x Ask");
    const [showNumbers, setShowNumbers] = useState(true);
    const [highlightImbalances, setHighlightImbalances] = useState(true);
    const [viewRange, setViewRange] = useState<{ start: number; end: number } | null>(null);
    const [domainStart, setDomainStart] = useState<number | null>(null);
    const [domainEnd, setDomainEnd] = useState<number | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [userHasInteracted, setUserHasInteracted] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const panStartXRef = useRef<number | null>(null);
    const panStartViewRangeRef = useRef<{ start: number; end: number } | null>(null);

    const { windowedTrades } = useOrderflowStream({ symbol: selectedSymbol, windowSeconds });

    useEffect(() => {
        setBucketSizeSeconds(parseTimeframeSeconds(selectedTimeframe));
    }, [selectedTimeframe]);

    const inferredPriceStep = useMemo(() => {
        if (windowedTrades.length === 0) return 0;
        const inferred = inferPriceStepFromTrades(windowedTrades);
        const referencePrice = windowedTrades[windowedTrades.length - 1]?.price ?? 0;
        const fallback = referencePrice > 0 ? Math.max(referencePrice * 0.0005, 0.01) : 0;
        return inferred > 0 ? inferred : fallback;
    }, [windowedTrades]);

    const rowSize: RowSizeMode = useMemo(
        () => (mode === "Volume" ? { type: "atr-auto", period: 14 } : { type: "tick", priceStep: inferredPriceStep || 0 }),
        [mode, inferredPriceStep],
    );

    const { bars: footprintBars, priceStepUsed }: BuildFootprintResult = useMemo(() => {
        if (windowedTrades.length === 0) return { bars: [], priceStepUsed: 0 };
        const referenceTimestamp = Date.now();
        return buildFootprintBars(windowedTrades, {
            windowSeconds,
            bucketSizeSeconds,
            referenceTimestamp,
            priceStep: inferredPriceStep || undefined,
            rowSize,
        });
    }, [windowedTrades, windowSeconds, bucketSizeSeconds, inferredPriceStep, rowSize]);

    const { levels: profileLevels, referencePrice } = useMemo(
        () => buildVolumeProfileLevels(windowedTrades, priceStepUsed),
        [windowedTrades, priceStepUsed],
    );

    useEffect(() => {
        if (!footprintBars.length) {
            setDomainStart(null);
            setDomainEnd(null);
            return;
        }

        const start = Math.min(...footprintBars.map((bar) => bar.bucketStart));
        const end = Math.max(...footprintBars.map((bar) => bar.bucketEnd));
        setDomainStart(start);
        setDomainEnd(end);
    }, [footprintBars]);

    const clampViewRange = useCallback(
        (start: number, end: number) => {
            if (domainStart === null || domainEnd === null) return null;
            const span = end - start;
            let clampedStart = start;
            let clampedEnd = end;

            if (clampedStart < domainStart) {
                clampedStart = domainStart;
                clampedEnd = domainStart + span;
            }

            if (clampedEnd > domainEnd) {
                clampedEnd = domainEnd;
                clampedStart = domainEnd - span;
            }

            return { start: clampedStart, end: clampedEnd };
        },
        [domainEnd, domainStart],
    );

    useEffect(() => {
        if (!domainStart || !domainEnd) {
            setViewRange(null);
            return;
        }

        const windowMs = windowSeconds * 1000;
        const end = domainEnd;
        const start = Math.max(end - windowMs, domainStart);
        const defaultRange = { start, end };

        if (!userHasInteracted) {
            setViewRange(defaultRange);
            return;
        }

        if (!viewRange) {
            setViewRange(defaultRange);
            return;
        }

        const clamped = clampViewRange(viewRange.start, viewRange.end);
        if (clamped && (clamped.start !== viewRange.start || clamped.end !== viewRange.end)) {
            setViewRange(clamped);
        }
    }, [clampViewRange, domainStart, domainEnd, userHasInteracted, viewRange, windowSeconds]);

    useEffect(() => {
        setUserHasInteracted(false);
    }, [selectedSymbol, windowSeconds, bucketSizeSeconds]);

    const barsToRender = useMemo(() => {
        if (!footprintBars.length) return [];
        if (!viewRange) return footprintBars;
        return footprintBars.filter((bar) => !(bar.bucketEnd < viewRange.start || bar.bucketStart > viewRange.end));
    }, [footprintBars, viewRange]);

    const maxVolume = useMemo(
        () => Math.max(...barsToRender.map((bar) => bar.totalVolume), 0),
        [barsToRender],
    );
    const maxDelta = useMemo(
        () => Math.max(...barsToRender.map((bar) => Math.abs(bar.totalDelta)), 0),
        [barsToRender],
    );

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (event.button !== 0 || !viewRange || domainStart === null || domainEnd === null) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsPanning(true);
        panStartXRef.current = event.clientX;
        panStartViewRangeRef.current = viewRange;
        canvas.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isPanning || !panStartViewRangeRef.current || domainStart === null || domainEnd === null) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const canvasWidth = canvas.clientWidth;
        if (canvasWidth <= 0) return;

        const panStartX = panStartXRef.current ?? event.clientX;
        const dx = event.clientX - panStartX;
        const spanMs = panStartViewRangeRef.current.end - panStartViewRangeRef.current.start;
        const msPerPixel = spanMs / canvasWidth;
        const deltaMs = -dx * msPerPixel;

        let start = panStartViewRangeRef.current.start + deltaMs;
        let end = panStartViewRangeRef.current.end + deltaMs;
        const clamped = clampViewRange(start, end);
        if (!clamped) return;

        setViewRange(clamped);
        setUserHasInteracted(true);
    };

    const handlePointerEnd = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (isPanning) {
            setIsPanning(false);
            panStartXRef.current = null;
            panStartViewRangeRef.current = null;
            canvasRef.current?.releasePointerCapture?.(event.pointerId);
        }
    };

    const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
        if (!viewRange || domainStart === null || domainEnd === null) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        event.preventDefault();

        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;

        const t = (event.clientX - rect.left) / rect.width;
        const currentSpan = viewRange.end - viewRange.start;
        const cursorTime = viewRange.start + t * currentSpan;
        const zoomFactor = event.deltaY < 0 ? 0.8 : 1.25;

        const maxSpan = domainEnd - domainStart;
        const minSpan = windowSeconds * 1000 * 0.2;
        let newSpan = currentSpan * zoomFactor;
        newSpan = Math.min(Math.max(newSpan, minSpan), maxSpan);

        let start = cursorTime - newSpan * t;
        let end = cursorTime + newSpan * (1 - t);

        const clamped = clampViewRange(start, end);
        if (!clamped) return;

        setViewRange(clamped);
        setUserHasInteracted(true);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const parent = canvas.parentElement;
        const width = parent?.clientWidth ?? 960;
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

        if (!footprintBars.length || !domainStart || !domainEnd) {
            context.fillStyle = "#9ca3af";
            context.font = "14px Inter, system-ui, -apple-system, sans-serif";
            context.fillText("Waiting for footprint data…", 16, height / 2);
            return;
        }

        const effectiveRange = viewRange ?? { start: domainStart, end: domainEnd };
        const span = Math.max(effectiveRange.end - effectiveRange.start, 1);

        const paddingX = 48;
        const paddingY = 28;
        const chartWidth = width - paddingX * 2;
        const chartHeight = height - paddingY * 2;

        if (!barsToRender.length) {
            context.fillStyle = "#9ca3af";
            context.font = "14px Inter, system-ui, -apple-system, sans-serif";
            context.fillText("Waiting for footprint data…", 16, height / 2);
            return;
        }

        const minPrice = Math.min(...barsToRender.map((bar) => bar.low));
        const maxPrice = Math.max(...barsToRender.map((bar) => bar.high));
        const priceRange = Math.max(maxPrice - minPrice, 1e-6);

        const candleSpacing = chartWidth / Math.max(barsToRender.length, 1);
        const bodyWidth = Math.max(candleSpacing * 0.6, 6);

        const priceDiffs: number[] = [];
        barsToRender.forEach((bar) => {
            bar.cells.forEach((cell, index) => {
                const next = bar.cells[index + 1];
                if (!next) return;
                const diff = Math.abs(cell.price - next.price);
                if (diff > 0) priceDiffs.push(diff);
            });
        });
        const cellStep = priceDiffs.length
            ? priceDiffs.sort((a, b) => a - b)[Math.floor(priceDiffs.length / 2)]
            : priceRange / Math.max(barsToRender[0].cells.length || 1, 12);

        const cellHeight = Math.max((cellStep / priceRange) * chartHeight * 0.9, 8);

        const yForPrice = (price: number) => paddingY + (1 - (price - minPrice) / priceRange) * chartHeight;

        context.strokeStyle = "#1f2937";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(paddingX, paddingY);
        context.lineTo(paddingX, paddingY + chartHeight);
        context.lineTo(paddingX + chartWidth, paddingY + chartHeight);
        context.stroke();

        const drawCell = (x: number, y: number, widthPx: number, cell: FootprintBar["cells"][number]) => {
            const total = cell.totalVolume;
            const delta = cell.buyVolume - cell.sellVolume;
            let fill = "#374151";
            if (mode === "Bid x Ask") {
                const buyRatio = total > 0 ? cell.buyVolume / total : 0.5;
                const sellRatio = 1 - buyRatio;
                const g = Math.min(255, Math.round(80 + buyRatio * 140));
                const r = Math.min(255, Math.round(80 + sellRatio * 140));
                fill = `rgb(${r}, ${g}, 120)`;
            } else if (mode === "Delta") {
                const intensity = maxDelta > 0 ? Math.min(Math.abs(delta) / maxDelta, 1) : 0;
                fill = delta >= 0 ? `rgba(52, 211, 153, ${0.25 + intensity * 0.65})` : `rgba(248, 113, 113, ${0.25 + intensity * 0.65})`;
            } else {
                const intensity = maxVolume > 0 ? Math.min(total / maxVolume, 1) : 0;
                fill = `rgba(129, 140, 248, ${0.2 + intensity * 0.7})`;
            }

            context.fillStyle = fill;
            context.fillRect(x - widthPx / 2, y - cellHeight / 2, widthPx, cellHeight);

            if (highlightImbalances && cell.imbalancePercent >= 60) {
                context.strokeStyle = "#fcd34d";
                context.lineWidth = 1;
                context.strokeRect(x - widthPx / 2, y - cellHeight / 2, widthPx, cellHeight);
            }

            if (showNumbers) {
                context.fillStyle = "#e5e7eb";
                context.font = "10px Inter, system-ui, -apple-system, sans-serif";
                context.textAlign = "center";
                context.textBaseline = "middle";
                const label = mode === "Volume" ? formatNumber(total) : `${formatNumber(cell.buyVolume)} / ${formatNumber(cell.sellVolume)}`;
                context.fillText(label, x, y);
            }
        };

        barsToRender.forEach((bar) => {
            const barMid = (bar.bucketStart + bar.bucketEnd) / 2;
            const t = Math.min(Math.max((barMid - effectiveRange.start) / span, 0), 1);
            const x = paddingX + t * chartWidth;
            const openY = yForPrice(bar.open);
            const closeY = yForPrice(bar.close);
            const highY = yForPrice(bar.high);
            const lowY = yForPrice(bar.low);

            const bullish = bar.close >= bar.open;
            const color = bullish ? "#34d399" : "#f87171";

            context.strokeStyle = color;
            context.beginPath();
            context.moveTo(x, highY);
            context.lineTo(x, lowY);
            context.stroke();

            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(openY - closeY), 2);

            context.fillStyle = color;
            context.fillRect(x - bodyWidth / 2, bodyY, bodyWidth, bodyHeight);

            bar.cells.forEach((cell) => {
                const cellY = yForPrice(cell.price);
                drawCell(x, cellY, bodyWidth, cell);
            });
        });
    }, [barsToRender, domainEnd, domainStart, highlightImbalances, maxDelta, maxVolume, mode, showNumbers, viewRange]);

    const windowMinutes = Math.max(1, Math.round(windowSeconds / 60));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Orderflow</p>
                    <h1 className="text-2xl font-semibold text-white">Footprint Heatmap</h1>
                    <p className="text-sm text-gray-400">Live trades for {selectedSymbol.toUpperCase()} · Last {windowMinutes}m</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                    <Link href="/orderflow" className="text-emerald-400 hover:text-emerald-300">
                        Back to Orderflow dashboard
                    </Link>
                </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Symbol</p>
                    <Select value={selectedSymbol} onValueChange={(value) => setSelectedSymbol(value)}>
                        <SelectTrigger className="w-full bg-gray-900 text-white">
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

                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Window</p>
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

                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Bucket size</p>
                    <div className="flex flex-wrap gap-2">
                        {TIMEFRAME_OPTIONS.map((option) => (
                            <Button
                                key={option}
                                size="sm"
                                variant={option === selectedTimeframe ? "default" : "outline"}
                                className={cn("min-w-[3.5rem]", option === selectedTimeframe && "bg-emerald-600")}
                                onClick={() => setSelectedTimeframe(option)}
                            >
                                {option}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2 lg:col-span-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Mode</p>
                    <div className="flex flex-wrap items-center gap-2">
                        {MODE_OPTIONS.map((option) => (
                            <Button
                                key={option}
                                size="sm"
                                variant={option === mode ? "default" : "outline"}
                                className={cn("min-w-[3.5rem]", option === mode && "bg-emerald-600")}
                                onClick={() => setMode(option)}
                            >
                                {option}
                            </Button>
                        ))}
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={showNumbers}
                                onChange={(event) => setShowNumbers(event.target.checked)}
                                className="h-4 w-4 rounded border-gray-700 bg-gray-900"
                            />
                            Show numbers
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                checked={highlightImbalances}
                                onChange={(event) => setHighlightImbalances(event.target.checked)}
                                className="h-4 w-4 rounded border-gray-700 bg-gray-900"
                            />
                            Highlight imbalances
                        </label>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
                        <div className="flex items-center justify-between pb-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500">Footprint Heatmap</p>
                                <h3 className="text-lg font-semibold text-white">
                                    {selectedSymbol.toUpperCase()} · {mode}
                                </h3>
                            </div>
                            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                                {footprintBars.length} buckets · {windowSeconds}s window
                            </span>
                        </div>
                        <div
                            className="relative h-[520px] overflow-hidden rounded-lg border border-gray-900 bg-black/20"
                            onWheel={handleWheel}
                        >
                            <canvas
                                ref={canvasRef}
                                className="h-full w-full"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerEnd}
                                onPointerLeave={handlePointerEnd}
                            />
                        </div>
                    </div>
                </div>

                <VolumeProfile levels={profileLevels} priceStep={priceStepUsed} referencePrice={referencePrice} />
            </div>
        </div>
    );
};

export default function FootprintPage() {
    return (
        <FootprintErrorBoundary>
            <FootprintPageInner />
        </FootprintErrorBoundary>
    );
}

