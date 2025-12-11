"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import VolumeProfile, { VolumeProfileLevel } from "@/app/(root)/orderflow/_components/volume-profile";
import {
    buildFootprintBars,
    type BuildFootprintResult,
    type FootprintBar,
    type FootprintCell,
    type RowSizeMode,
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
import { useOrderflowStream } from "@/hooks/useOrderflowStream";
import { cn } from "@/lib/utils";

type FootprintMode = "bid-ask" | "delta" | "volume";

type TimeframeOption = "5s" | "15s" | "30s" | "1m" | "5m" | "15m";

const TIMEFRAME_OPTIONS: TimeframeOption[] = ["5s", "15s", "30s", "1m", "5m", "15m"];

const parseTimeframeSeconds = (value: TimeframeOption): number => {
    const unit = value.slice(-1);
    const numeric = Number(value.slice(0, -1));
    if (!Number.isFinite(numeric)) return 15;
    return unit === "m" ? numeric * 60 : numeric;
};

const clampViewRange = (
    requested: { start: number; end: number } | null,
    domainStart: number | null,
    domainEnd: number | null,
): { start: number; end: number } | null => {
    if (domainStart === null || domainEnd === null) return null;
    if (!requested) return { start: domainStart, end: domainEnd };

    let start = Number.isFinite(requested.start) ? requested.start : domainStart;
    let end = Number.isFinite(requested.end) ? requested.end : domainEnd;

    if (start > end) {
        [start, end] = [end, start];
    }

    const minSpan = Math.max((domainEnd - domainStart) * 0.001, 1);
    if (end - start < minSpan) {
        const center = (start + end) / 2;
        start = center - minSpan / 2;
        end = center + minSpan / 2;
    }

    start = Math.max(start, domainStart);
    end = Math.min(end, domainEnd);

    if (start >= end) {
        return { start: domainStart, end: domainEnd };
    }

    return { start, end };
};

const buildVolumeProfileLevels = (
    bars: FootprintBar[],
    priceStep: number,
    _referencePrice: number | null,
): VolumeProfileLevel[] => {
    if (!bars.length || priceStep <= 0) return [];
    const volumeByPrice = new Map<number, { buyVolume: number; sellVolume: number }>();

    bars.forEach((bar) => {
        bar.cells.forEach((cell) => {
            const levelPrice = cell.price;
            const existing = volumeByPrice.get(levelPrice) ?? { buyVolume: 0, sellVolume: 0 };
            existing.buyVolume += cell.buyVolume;
            existing.sellVolume += cell.sellVolume;
            volumeByPrice.set(levelPrice, existing);
        });
    });

    return Array.from(volumeByPrice.entries())
        .map(([price, volumes]) => {
            const totalVolume = volumes.buyVolume + volumes.sellVolume;
            const dominantSide = totalVolume === 0 ? null : volumes.buyVolume >= volumes.sellVolume ? "buy" : "sell";
            const imbalancePercent = totalVolume > 0 ? (Math.abs(volumes.buyVolume - volumes.sellVolume) / totalVolume) * 100 : 0;
            return {
                price,
                buyVolume: volumes.buyVolume,
                sellVolume: volumes.sellVolume,
                totalVolume,
                dominantSide,
                imbalancePercent,
            } satisfies VolumeProfileLevel;
        })
        .sort((a, b) => b.price - a.price);
};

const FootprintPage = () => {
    const defaultWindowSeconds = ORDERFLOW_WINDOW_PRESETS[1]?.value ?? ORDERFLOW_WINDOW_PRESETS[0].value;
    const defaultBucketSeconds = ORDERFLOW_BUCKET_PRESETS[1]?.value ?? ORDERFLOW_BUCKET_PRESETS[0].value;

    const [selectedSymbol, setSelectedSymbol] = useState<string>(ORDERFLOW_DEFAULT_SYMBOL);
    const [windowSeconds, setWindowSeconds] = useState<number>(defaultWindowSeconds);
    const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>("15s");
    const [bucketSizeSeconds, setBucketSizeSeconds] = useState<number>(defaultBucketSeconds);
    const [mode, setMode] = useState<FootprintMode>("bid-ask");
    const [rowSizeMode, setRowSizeMode] = useState<RowSizeMode>("atr-auto");
    const [viewRange, setViewRange] = useState<{ start: number; end: number } | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    const { windowedTrades } = useOrderflowStream({ symbol: selectedSymbol, windowSeconds });

    useEffect(() => {
        setBucketSizeSeconds(parseTimeframeSeconds(selectedTimeframe));
    }, [selectedTimeframe]);

    useEffect(() => {
        const handleResize = () => {
            const container = containerRef.current;
            if (!container) return;
            setContainerSize({ width: container.clientWidth, height: container.clientHeight });
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const footprintResult = useMemo<BuildFootprintResult | null>(() => {
        return buildFootprintBars(windowedTrades, {
            bucketSeconds: bucketSizeSeconds,
            rowSizeMode,
            atrPeriod: 14,
        });
    }, [bucketSizeSeconds, rowSizeMode, windowedTrades]);

    useEffect(() => {
        if (!footprintResult || !footprintResult.domainStart || !footprintResult.domainEnd) return;
        if (viewRange) return;

        const initialSpan = Math.max((footprintResult.domainEnd - footprintResult.domainStart) * 0.5, bucketSizeSeconds * 1000 * 5);
        const tentativeRange = {
            start: Math.max(footprintResult.domainEnd - initialSpan, footprintResult.domainStart),
            end: footprintResult.domainEnd,
        };
        setViewRange(clampViewRange(tentativeRange, footprintResult.domainStart, footprintResult.domainEnd));
    }, [bucketSizeSeconds, footprintResult, viewRange]);

    const visibleRange = useMemo(() => {
        return clampViewRange(viewRange, footprintResult?.domainStart ?? null, footprintResult?.domainEnd ?? null);
    }, [footprintResult?.domainEnd, footprintResult?.domainStart, viewRange]);

    const visibleBars = useMemo<FootprintBar[]>(() => {
        if (!footprintResult || !visibleRange) return [];
        return footprintResult.bars.filter(
            (bar) => bar.endTime >= visibleRange.start && bar.startTime <= visibleRange.end,
        );
    }, [footprintResult, visibleRange]);

    const profileData = useMemo(() => {
        if (!footprintResult) {
            return { levels: [] as VolumeProfileLevel[], referencePrice: null as number | null };
        }
        const lastClose = visibleBars[visibleBars.length - 1]?.close ?? null;
        return {
            levels: buildVolumeProfileLevels(visibleBars, footprintResult.priceStepUsed, lastClose),
            referencePrice: lastClose,
        };
    }, [footprintResult, visibleBars]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        const width = container.clientWidth || 960;
        const height = container.clientHeight || 520;
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        context.resetTransform();
        context.scale(dpr, dpr);

        context.fillStyle = "#0b0d12";
        context.fillRect(0, 0, width, height);

        if (!footprintResult || footprintResult.bars.length === 0) {
            context.fillStyle = "#9ca3af";
            context.font = "14px Inter, system-ui, -apple-system, sans-serif";
            context.fillText("Waiting for footprint data…", 16, height / 2);
            return;
        }

        const domainStart = footprintResult.domainStart;
        const domainEnd = footprintResult.domainEnd;
        const range = clampViewRange(viewRange ?? (domainStart && domainEnd ? { start: domainStart, end: domainEnd } : null), domainStart, domainEnd);
        if (!range) return;

        try {
            setRenderError(null);
            const paddingX = 48;
            const paddingY = 28;
            const chartWidth = Math.max(width - paddingX * 2, 10);
            const chartHeight = Math.max(height - paddingY * 2, 10);

            const barsToDraw = footprintResult.bars.filter(
                (bar) => bar.endTime >= range.start && bar.startTime <= range.end,
            );

            if (!barsToDraw.length) {
                context.fillStyle = "#9ca3af";
                context.font = "14px Inter, system-ui, -apple-system, sans-serif";
                context.fillText("No bars in view. Try panning or zooming.", 16, height / 2);
                return;
            }

            const minPrice = Math.min(...barsToDraw.map((bar) => bar.low));
            const maxPrice = Math.max(...barsToDraw.map((bar) => bar.high));
            const priceRange = Math.max(maxPrice - minPrice, footprintResult.priceStepUsed);
            const rowsApprox = Math.max(priceRange / footprintResult.priceStepUsed, 1);
            const rowHeight = Math.max(chartHeight / rowsApprox, 4);

            const xForTime = (time: number) => paddingX + ((time - range.start) / (range.end - range.start)) * chartWidth;
            const yForPrice = (price: number) => paddingY + (1 - (price - minPrice) / priceRange) * chartHeight;

            context.strokeStyle = "#1f2937";
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(paddingX, paddingY);
            context.lineTo(paddingX, paddingY + chartHeight);
            context.lineTo(paddingX + chartWidth, paddingY + chartHeight);
            context.stroke();

            const maxCellVolume = Math.max(
                ...barsToDraw.flatMap((bar) => bar.cells.map((cell) => cell.totalVolume)),
                0,
            );
            const maxCellDelta = Math.max(
                ...barsToDraw.flatMap((bar) => bar.cells.map((cell) => Math.abs(cell.delta))),
                0,
            );

            const drawCell = (x: number, cell: FootprintCell, bodyWidth: number) => {
                const total = cell.totalVolume;
                const delta = cell.delta;
                let fill = "#374151";
                if (mode === "bid-ask") {
                    const buyRatio = total > 0 ? cell.buyVolume / total : 0.5;
                    const sellRatio = 1 - buyRatio;
                    const g = Math.min(255, Math.round(80 + buyRatio * 140));
                    const r = Math.min(255, Math.round(80 + sellRatio * 140));
                    fill = `rgb(${r}, ${g}, 120)`;
                } else if (mode === "delta") {
                    const intensity = maxCellDelta > 0 ? Math.min(Math.abs(delta) / maxCellDelta, 1) : 0;
                    fill = delta >= 0 ? `rgba(52, 211, 153, ${0.25 + intensity * 0.65})` : `rgba(248, 113, 113, ${0.25 + intensity * 0.65})`;
                } else {
                    const intensity = maxCellVolume > 0 ? Math.min(total / maxCellVolume, 1) : 0;
                    fill = `rgba(129, 140, 248, ${0.2 + intensity * 0.7})`;
                }

                const y = yForPrice(cell.price);
                context.fillStyle = fill;
                context.fillRect(x - bodyWidth / 2, y - rowHeight / 2, bodyWidth, rowHeight);
            };

            barsToDraw.forEach((bar) => {
                const barMid = (bar.startTime + bar.endTime) / 2;
                const x = xForTime(barMid);
                const candleSpan = chartWidth / Math.max(barsToDraw.length, 1);
                const bodyWidth = Math.max(candleSpan * 0.6, 6);

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

                bar.cells.forEach((cell) => drawCell(x, cell, bodyWidth));
            });
        } catch (error) {
            console.error(error);
            setRenderError(
                "Footprint chart failed to render. Please reload the page or try again later.",
            );
        }
    }, [containerSize.height, containerSize.width, footprintResult, mode, viewRange]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let isDragging = false;
        let startX = 0;
        let startRange: { start: number; end: number } | null = null;

        const getCurrentRange = () =>
            clampViewRange(viewRange, footprintResult?.domainStart ?? null, footprintResult?.domainEnd ?? null) ?? null;

        const handlePointerDown = (event: PointerEvent) => {
            if (!footprintResult) return;
            isDragging = true;
            startX = event.clientX;
            startRange = getCurrentRange();
            canvas.setPointerCapture(event.pointerId);
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (!isDragging || !footprintResult) return;
            const container = containerRef.current;
            if (!container) return;
            const width = container.clientWidth || 1;
            const currentRange = startRange ?? getCurrentRange();
            if (!currentRange) return;
            const deltaX = event.clientX - startX;
            const msPerPixel = (currentRange.end - currentRange.start) / width;
            const shift = deltaX * msPerPixel;
            const updated = { start: currentRange.start - shift, end: currentRange.end - shift };
            const clamped = clampViewRange(updated, footprintResult.domainStart, footprintResult.domainEnd);
            if (clamped) setViewRange(clamped);
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (isDragging) {
                canvas.releasePointerCapture(event.pointerId);
            }
            isDragging = false;
            startRange = null;
        };

        const handleWheel = (event: WheelEvent) => {
            if (!footprintResult) return;
            const domainStart = footprintResult.domainStart;
            const domainEnd = footprintResult.domainEnd;
            if (domainStart === null || domainEnd === null) return;

            event.preventDefault();
            const container = containerRef.current;
            const width = container?.clientWidth ?? 1;
            const currentRange =
                clampViewRange(viewRange ?? { start: domainStart, end: domainEnd }, domainStart, domainEnd) ??
                null;
            if (!currentRange) return;

            const direction = Math.sign(event.deltaY);
            const zoomFactor = direction > 0 ? 1.1 : 0.9;
            const mouseX = event.offsetX;
            const span = currentRange.end - currentRange.start;
            const center = currentRange.start + (mouseX / width) * span;
            const newSpan = Math.max(span * zoomFactor, Math.max((domainEnd - domainStart) * 0.001, 1));
            const newStart = center - (mouseX / width) * newSpan;
            const newEnd = center + (1 - mouseX / width) * newSpan;
            const clamped = clampViewRange({ start: newStart, end: newEnd }, domainStart, domainEnd);
            if (clamped) setViewRange(clamped);
        };

        canvas.addEventListener("pointerdown", handlePointerDown);
        canvas.addEventListener("pointermove", handlePointerMove);
        canvas.addEventListener("pointerup", handlePointerUp);
        canvas.addEventListener("pointerleave", handlePointerUp);
        canvas.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            canvas.removeEventListener("pointerdown", handlePointerDown);
            canvas.removeEventListener("pointermove", handlePointerMove);
            canvas.removeEventListener("pointerup", handlePointerUp);
            canvas.removeEventListener("pointerleave", handlePointerUp);
            canvas.removeEventListener("wheel", handleWheel);
        };
    }, [footprintResult, viewRange]);

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

                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Mode</p>
                    <div className="flex flex-wrap items-center gap-2">
                        {(
                            [
                                { label: "Bid x Ask", value: "bid-ask" },
                                { label: "Delta", value: "delta" },
                                { label: "Volume", value: "volume" },
                            ] as { label: string; value: FootprintMode }[]
                        ).map((option) => (
                            <Button
                                key={option.value}
                                size="sm"
                                variant={option.value === mode ? "default" : "outline"}
                                className={cn("min-w-[3.5rem]", option.value === mode && "bg-emerald-600")}
                                onClick={() => setMode(option.value)}
                            >
                                {option.label}
                            </Button>
                        ))}
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs uppercase tracking-wide text-emerald-300">Row Size</span>
                            <div className="flex gap-2">
                                {(
                                    [
                                        { label: "ATR Auto", value: "atr-auto" },
                                        { label: "Tick", value: "tick" },
                                    ] as { label: string; value: RowSizeMode }[]
                                ).map((option) => (
                                    <Button
                                        key={option.value}
                                        size="sm"
                                        variant={option.value === rowSizeMode ? "default" : "outline"}
                                        className={cn("min-w-[4.5rem]", option.value === rowSizeMode && "bg-emerald-600")}
                                        onClick={() => setRowSizeMode(option.value)}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
                        <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500">Footprint Heatmap</p>
                                <h3 className="text-lg font-semibold text-white">
                                    {selectedSymbol.toUpperCase()} · {mode === "bid-ask" ? "Bid x Ask" : mode === "delta" ? "Delta" : "Volume"}
                                </h3>
                            </div>
                            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                                {footprintResult?.bars.length ?? 0} buckets · {windowSeconds}s window
                            </span>
                        </div>
                        <div ref={containerRef} className="relative h-[520px] overflow-hidden rounded-lg border border-gray-900 bg-black/20">
                            {renderError ? (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4 text-center text-sm text-red-400">
                                    {renderError}
                                </div>
                            ) : null}
                            {!renderError && (!footprintResult || footprintResult.bars.length === 0) ? (
                                <div className="absolute inset-0 z-10 flex items-center justify-center p-4 text-center text-sm text-gray-400">
                                    Waiting for footprint data...
                                </div>
                            ) : null}
                            <canvas ref={canvasRef} className="h-full w-full" />
                        </div>
                    </div>
                </div>

                <VolumeProfile
                    levels={profileData.levels}
                    priceStep={footprintResult?.priceStepUsed ?? 0}
                    referencePrice={profileData.referencePrice}
                />
            </div>
        </div>
    );
};

export default FootprintPage;

