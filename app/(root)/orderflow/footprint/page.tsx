"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import VolumeProfile from "@/app/(root)/orderflow/_components/volume-profile";
import {
    buildFootprintSnapshot,
    buildVolumeProfile,
    FootprintSnapshot,
    priceToTicks,
    ticksToPrice,
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
const SCALE_OPTIONS = ["Log", "Linear"] as const;
type FootprintMode = (typeof MODE_OPTIONS)[number];
type ScaleMode = (typeof SCALE_OPTIONS)[number];
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

const parsePrecisionFromSymbol = (symbol: string): number | undefined => {
    const [, quote] = symbol.split("/");
    if (!quote) return undefined;
    if (["USDT", "BUSD", "USDC"].includes(quote.toUpperCase())) return 2;
    return undefined;
};

const normaliseTrades = (trades: NormalizedTrade[]) => trades.filter((trade) => Number.isFinite(trade.price));

const scaleValue = (value: number, maxValue: number, mode: ScaleMode) => {
    if (maxValue <= 0) return 0;
    const ratio = Math.min(Math.abs(value) / maxValue, 1);
    if (mode === "Linear") return ratio;
    return Math.log1p(ratio * 9) / Math.log1p(9);
};

const drawBackground = (context: CanvasRenderingContext2D, width: number, height: number) => {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0a0c11");
    gradient.addColorStop(1, "#0c1018");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
};

const renderFootprint = (
    canvas: HTMLCanvasElement,
    snapshot: FootprintSnapshot,
    mode: FootprintMode,
    showNumbers: boolean,
    highlightImbalances: boolean,
    colorScale: ScaleMode,
) => {
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

    drawBackground(context, width, height);

    if (!snapshot.bars.length) {
        context.fillStyle = "#9ca3af";
        context.font = "14px Inter, system-ui, -apple-system, sans-serif";
        context.fillText("Waiting for footprint data…", 16, height / 2);
        return;
    }

    const paddingX = 64;
    const paddingY = 32;
    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingY * 2;

    const minTick = priceToTicks(snapshot.priceMin, snapshot.tickConfig) - snapshot.rowSizeTicks;
    const maxTick = priceToTicks(snapshot.priceMax, snapshot.tickConfig) + snapshot.rowSizeTicks;
    const tickRange = Math.max(maxTick - minTick, snapshot.rowSizeTicks);
    const pixelsPerTick = chartHeight / tickRange;
    const cellHeight = Math.max(pixelsPerTick * snapshot.rowSizeTicks, 8);

    const spacing = chartWidth / Math.max(snapshot.bars.length, 1);
    const bodyWidth = Math.max(spacing * 0.65, 6);

    const yForPrice = (price: number) => {
        const ticks = priceToTicks(price, snapshot.tickConfig);
        return paddingY + (maxTick - ticks) * pixelsPerTick;
    };

    context.strokeStyle = "#1f2937";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(paddingX, paddingY);
    context.lineTo(paddingX, paddingY + chartHeight);
    context.lineTo(paddingX + chartWidth, paddingY + chartHeight);
    context.stroke();

    const maxCellVolume = Math.max(
        ...snapshot.bars.map((bar) => Math.max(...bar.cells.map((cell) => cell.totalVolume), 0)),
        0,
    );
    const maxDelta = Math.max(...snapshot.bars.map((bar) => Math.abs(bar.totalDelta)), 0);

    const drawCell = (
        x: number,
        y: number,
        widthPx: number,
        cell: FootprintSnapshot["bars"][number]["cells"][number],
    ) => {
        const { totalVolume } = cell;
        const delta = cell.buyVolume - cell.sellVolume;
        let fill = "#2c3340";

        if (mode === "Bid x Ask") {
            const buyRatio = totalVolume > 0 ? cell.buyVolume / totalVolume : 0.5;
            const sellRatio = 1 - buyRatio;
            const r = Math.round(90 + sellRatio * 130);
            const g = Math.round(110 + buyRatio * 120);
            fill = `rgb(${r}, ${g}, 140)`;
        } else if (mode === "Delta") {
            const intensity = scaleValue(delta, maxDelta || 1, colorScale);
            fill = delta >= 0 ? `rgba(52, 211, 153, ${0.2 + intensity * 0.7})` : `rgba(248, 113, 113, ${0.2 + intensity * 0.7})`;
        } else {
            const intensity = scaleValue(totalVolume, maxCellVolume || 1, colorScale);
            fill = `rgba(129, 140, 248, ${0.15 + intensity * 0.75})`;
        }

        context.fillStyle = fill;
        context.fillRect(x - widthPx / 2, y - cellHeight / 2, widthPx, cellHeight);

        if (highlightImbalances && cell.imbalancePercent >= 60) {
            context.strokeStyle = "#fcd34d";
            context.lineWidth = 1;
            context.strokeRect(x - widthPx / 2, y - cellHeight / 2, widthPx, cellHeight);
        }

        if (showNumbers) {
            const label =
                mode === "Volume"
                    ? formatNumber(totalVolume)
                    : `${formatNumber(cell.buyVolume)} · ${formatNumber(cell.sellVolume)}`;
            context.fillStyle = "#e5e7eb";
            context.font = "10px Inter, system-ui, -apple-system, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(label, x, y);
        }
    };

    snapshot.bars.forEach((bar, index) => {
        const x = paddingX + spacing * index + spacing / 2;
        const openY = yForPrice(bar.open);
        const closeY = yForPrice(bar.close);
        const highY = yForPrice(bar.high);
        const lowY = yForPrice(bar.low);

        const bullish = bar.close >= bar.open;
        const candleColor = bullish ? "#34d399" : "#f87171";

        context.strokeStyle = candleColor;
        context.beginPath();
        context.moveTo(x, highY);
        context.lineTo(x, lowY);
        context.stroke();

        const bodyY = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(openY - closeY), 2);
        context.fillStyle = candleColor;
        context.fillRect(x - bodyWidth / 2, bodyY, bodyWidth, bodyHeight);

        bar.cells.forEach((cell) => {
            const y = yForPrice(cell.price);
            drawCell(x, y, bodyWidth, cell);
        });
    });

    context.fillStyle = "#6b7280";
    context.font = "10px Inter, system-ui, -apple-system, sans-serif";
    context.textAlign = "right";
    context.textBaseline = "middle";

    const labelStepTicks = snapshot.rowSizeTicks * 2;
    for (let ticks = minTick; ticks <= maxTick; ticks += labelStepTicks) {
        const price = ticksToPrice(ticks, snapshot.tickConfig);
        const y = paddingY + (maxTick - ticks) * pixelsPerTick;
        context.fillText(price.toFixed(snapshot.tickConfig.priceDecimals), paddingX - 8, y);
        context.strokeStyle = "#111827";
        context.beginPath();
        context.moveTo(paddingX, y);
        context.lineTo(paddingX + chartWidth, y);
        context.stroke();
    }
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
    const [colorScale, setColorScale] = useState<ScaleMode>("Log");

    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const { windowedTrades } = useOrderflowStream({ symbol: selectedSymbol, windowSeconds });
    const cleanTrades = useMemo(() => normaliseTrades(windowedTrades), [windowedTrades]);

    useEffect(() => {
        setBucketSizeSeconds(parseTimeframeSeconds(selectedTimeframe));
    }, [selectedTimeframe]);

    const snapshot = useMemo<FootprintSnapshot>(() => {
        const referenceTimestamp = Date.now();
        return buildFootprintSnapshot(cleanTrades, {
            windowSeconds,
            bucketSizeSeconds,
            referenceTimestamp,
            tickSize: undefined,
            priceDecimals: parsePrecisionFromSymbol(selectedSymbol),
        });
    }, [bucketSizeSeconds, cleanTrades, selectedSymbol, windowSeconds]);

    const { levels: profileLevels, referencePrice } = useMemo(
        () => buildVolumeProfile(snapshot, snapshot.lastPrice ?? undefined),
        [snapshot],
    );

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        renderFootprint(canvas, snapshot, mode, showNumbers, highlightImbalances, colorScale);
    }, [snapshot, mode, showNumbers, highlightImbalances, colorScale]);

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
                    <p className="text-xs uppercase tracking-wide text-gray-500">Mode & Display</p>
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
                        <div className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200">
                            <span className="text-xs uppercase tracking-wide text-gray-500">Scale</span>
                            {SCALE_OPTIONS.map((option) => (
                                <Button
                                    key={option}
                                    size="sm"
                                    variant={option === colorScale ? "default" : "ghost"}
                                    className={cn("min-w-[3rem]", option === colorScale && "bg-emerald-600 text-white")}
                                    onClick={() => setColorScale(option)}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
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
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                            Row size: {snapshot.rowSizeTicks} ticks · Precision {snapshot.tickConfig.priceDecimals} dp
                        </span>
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
                                <p className="text-xs text-gray-400">
                                    {snapshot.bars.length} buckets · {bucketSizeSeconds}s bucket · {windowSeconds}s window
                                </p>
                            </div>
                            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
                                {colorScale} scale · ATR auto rows
                            </span>
                        </div>
                        <div className="relative h-[520px] overflow-hidden rounded-lg border border-gray-900 bg-black/20">
                            <canvas ref={canvasRef} className="h-full w-full" />
                        </div>
                    </div>
                </div>

                <VolumeProfile levels={profileLevels} priceStep={snapshot.tickConfig.tickSize} referencePrice={referencePrice} />
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

