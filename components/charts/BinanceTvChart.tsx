"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export const BINANCE_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

export type BinanceInterval = (typeof BINANCE_INTERVALS)[number];

export type BinanceConnectionStatus =
    | "idle"
    | "loading"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "disconnected"
    | "error";

type Props = {
    symbol?: string;
    interval: BinanceInterval;
    height?: number;
    className?: string;
    onConnectionStatusChange?: (status: BinanceConnectionStatus) => void;
    onLastPriceChange?: (lastPrice: number | null, previousClose: number | null) => void;
};

type Layout = {
    cssWidth: number;
    cssHeight: number;
    dpr: number;
    plotLeft: number;
    plotTop: number;
    plotWidth: number;
    plotHeight: number;
    plotRight: number;
    plotBottom: number;
    priceLeft: number;
    timeTop: number;
};

type Dirty = { grid: boolean; series: boolean; overlay: boolean };
type Viewport = { barSpacing: number; rightOffset: number };
type Hover = { active: boolean; index: number; mouseX: number; y: number };

type Derived = {
    candles: Candle[];
    layout: Layout;
    firstVisibleIndex: number;
    lastVisibleIndex: number;
    firstVisibleFloat: number;
    barSpacing: number;
    minPrice: number;
    maxPrice: number;
    indexToX: (index: number) => number;
    xToIndex: (x: number) => number;
    priceToY: (price: number) => number;
    yToPrice: (y: number) => number;
};

const PRICE_AXIS = 70;
const TIME_AXIS = 24;
const PAD = { top: 12, right: 12, bottom: 8, left: 12 };
const BAR_SPACING_DEFAULT = 8;
const BAR_SPACING_MIN = 3;
const BAR_SPACING_MAX = 25;
const HISTORY_LIMIT = 1000;

const STATUS_LABEL: Record<BinanceConnectionStatus, string> = {
    idle: "Idle",
    loading: "Loading",
    connecting: "Connecting",
    connected: "Connected",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
    error: "Error",
};

const C = {
    bg: "#070d16",
    plot: "#0a111c",
    axis: "#08101a",
    border: "#223047",
    grid: "#1b2738",
    text: "#d3deee",
    textMuted: "#8ea1bf",
    up: "#00d395",
    down: "#ff6b6b",
    cross: "#91a8c8",
    labelBg: "#1b2a40",
    labelText: "#e4ecf8",
    hud: "rgba(8,16,28,.92)",
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const fmtPrice = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtAxisTime = (ts: number, interval: BinanceInterval) =>
    new Date(ts).toLocaleString(
        undefined,
        interval === "1d" ? { month: "short", day: "2-digit" } : { hour: "2-digit", minute: "2-digit", hour12: false },
    );
const fmtCrossTime = (ts: number, interval: BinanceInterval) =>
    new Date(ts).toLocaleString(
        undefined,
        interval === "1d"
            ? { year: "numeric", month: "short", day: "2-digit" }
            : { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false },
    );

const parseRest = (raw: unknown): Candle[] => {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((entry) => {
            if (!Array.isArray(entry)) return null;
            const t = Number(entry[0]);
            const o = Number(entry[1]);
            const h = Number(entry[2]);
            const l = Number(entry[3]);
            const c = Number(entry[4]);
            const v = Number(entry[5]);
            if (![t, o, h, l, c, v].every(Number.isFinite)) return null;
            return { t, o, h, l, c, v } satisfies Candle;
        })
        .filter((c): c is Candle => c !== null)
        .sort((a, b) => a.t - b.t);
};

const parseWs = (raw: unknown): Candle | null => {
    if (!raw || typeof raw !== "object" || !("k" in raw) || !raw.k || typeof raw.k !== "object") return null;
    const k = raw.k as Record<string, unknown>;
    const t = Number(k.t);
    const o = Number(k.o);
    const h = Number(k.h);
    const l = Number(k.l);
    const c = Number(k.c);
    const v = Number(k.v);
    if (![t, o, h, l, c, v].every(Number.isFinite)) return null;
    return { t, o, h, l, c, v };
};

const makeLayout = (cssWidth: number, cssHeight: number, dpr: number): Layout => {
    const w = Math.max(1, cssWidth);
    const h = Math.max(1, cssHeight);
    const plotLeft = PAD.left;
    const plotTop = PAD.top;
    const plotWidth = Math.max(40, w - PAD.left - PAD.right - PRICE_AXIS);
    const plotHeight = Math.max(40, h - PAD.top - PAD.bottom - TIME_AXIS);
    const plotRight = plotLeft + plotWidth;
    const plotBottom = plotTop + plotHeight;
    return { cssWidth: w, cssHeight: h, dpr, plotLeft, plotTop, plotWidth, plotHeight, plotRight, plotBottom, priceLeft: plotRight, timeTop: plotBottom };
};

const resizeCanvas = (canvas: HTMLCanvasElement, w: number, h: number, dpr: number) => {
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
};

const clear = (ctx: CanvasRenderingContext2D, layout: Layout) => {
    ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
    ctx.clearRect(0, 0, layout.cssWidth, layout.cssHeight);
};

const derive = (candles: Candle[], layout: Layout, viewport: Viewport): Derived => {
    const barSpacing = clamp(viewport.barSpacing, BAR_SPACING_MIN, BAR_SPACING_MAX);
    viewport.barSpacing = barSpacing;

    const visibleBars = Math.max(1, Math.floor(layout.plotWidth / barSpacing));
    const maxOffset = Math.max(0, candles.length - visibleBars);
    const rightOffset = clamp(viewport.rightOffset, 0, maxOffset);
    viewport.rightOffset = rightOffset;

    const visibleBarsFloat = layout.plotWidth / barSpacing;
    const firstVisibleFloat = candles.length - visibleBarsFloat - rightOffset;
    const firstVisibleIndex = Math.max(0, Math.floor(candles.length - visibleBars - rightOffset));
    const lastVisibleIndex = candles.length ? clamp(Math.ceil(firstVisibleFloat + visibleBarsFloat), 0, candles.length - 1) : -1;

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = firstVisibleIndex; i <= lastVisibleIndex; i += 1) {
        const c = candles[i];
        if (!c) continue;
        min = Math.min(min, c.l);
        max = Math.max(max, c.h);
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        const fallback = candles[candles.length - 1]?.c ?? 0;
        min = fallback - 1;
        max = fallback + 1;
    }

    const range = max - min;
    const pad = range > Number.EPSILON ? range * 0.05 : Math.max(Math.abs(max) * 0.001, 0.5);
    const minPrice = min - pad;
    const maxPrice = max + pad;
    const safeRange = Math.max(maxPrice - minPrice, Number.EPSILON);

    return {
        candles,
        layout,
        firstVisibleIndex,
        lastVisibleIndex,
        firstVisibleFloat,
        barSpacing,
        minPrice,
        maxPrice,
        indexToX: (index) => layout.plotLeft + (index - firstVisibleFloat) * barSpacing + barSpacing / 2,
        xToIndex: (x) => firstVisibleFloat + (x - layout.plotLeft) / barSpacing - 0.5,
        priceToY: (price) => layout.plotTop + ((maxPrice - price) / safeRange) * layout.plotHeight,
        yToPrice: (y) => maxPrice - ((y - layout.plotTop) / Math.max(layout.plotHeight, Number.EPSILON)) * safeRange,
    };
};

export default function BinanceTvChart({
    symbol = "BTCUSDT",
    interval,
    height = 560,
    className,
    onConnectionStatusChange,
    onLastPriceChange,
}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const bgRef = useRef<HTMLCanvasElement | null>(null);
    const seriesRef = useRef<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<HTMLCanvasElement | null>(null);

    const candlesRef = useRef<Candle[]>([]);
    const layoutRef = useRef<Layout | null>(null);
    const viewportRef = useRef<Viewport>({ barSpacing: BAR_SPACING_DEFAULT, rightOffset: 0 });
    const hoverRef = useRef<Hover>({ active: false, index: -1, mouseX: 0, y: 0 });
    const dragRef = useRef({ active: false, startX: 0, startOffset: 0 });

    const dirtyRef = useRef<Dirty>({ grid: true, series: true, overlay: true });
    const rafRef = useRef<number | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    const abortRef = useRef<AbortController | null>(null);

    const symbolRef = useRef(symbol);
    const intervalRef = useRef(interval);
    const statusRef = useRef<BinanceConnectionStatus>("idle");
    const statusCbRef = useRef(onConnectionStatusChange);
    const lastCbRef = useRef(onLastPriceChange);

    const [status, setStatus] = useState<BinanceConnectionStatus>("idle");
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [retryToken, setRetryToken] = useState(0);

    useEffect(() => {
        symbolRef.current = symbol;
        intervalRef.current = interval;
        dirtyRef.current.grid = true;
        dirtyRef.current.overlay = true;
    }, [symbol, interval]);

    useEffect(() => {
        statusCbRef.current = onConnectionStatusChange;
    }, [onConnectionStatusChange]);

    useEffect(() => {
        lastCbRef.current = onLastPriceChange;
    }, [onLastPriceChange]);

    const emitLast = useCallback(() => {
        const arr = candlesRef.current;
        const last = arr[arr.length - 1] ?? null;
        const prev = arr[arr.length - 2] ?? null;
        lastCbRef.current?.(last?.c ?? null, prev?.c ?? null);
    }, []);

    const draw = useCallback(() => {
        const layout = layoutRef.current;
        const bg = bgRef.current;
        const series = seriesRef.current;
        const overlay = overlayRef.current;
        if (!layout || !bg || !series || !overlay) return;

        const bgCtx = bg.getContext("2d");
        const seriesCtx = series.getContext("2d");
        const overlayCtx = overlay.getContext("2d");
        if (!bgCtx || !seriesCtx || !overlayCtx) return;

        const d = derive(candlesRef.current, layout, viewportRef.current);
        const dirty = dirtyRef.current;

        if (dirty.grid) {
            clear(bgCtx, layout);
            bgCtx.fillStyle = C.bg;
            bgCtx.fillRect(0, 0, layout.cssWidth, layout.cssHeight);
            bgCtx.fillStyle = C.plot;
            bgCtx.fillRect(layout.plotLeft, layout.plotTop, layout.plotWidth, layout.plotHeight);
            bgCtx.fillStyle = C.axis;
            bgCtx.fillRect(layout.priceLeft, layout.plotTop, PRICE_AXIS, layout.plotHeight);
            bgCtx.fillRect(layout.plotLeft, layout.timeTop, layout.plotWidth + PRICE_AXIS, TIME_AXIS);

            bgCtx.strokeStyle = C.border;
            bgCtx.lineWidth = 1;
            bgCtx.beginPath();
            bgCtx.moveTo(Math.round(layout.priceLeft) + 0.5, layout.plotTop);
            bgCtx.lineTo(Math.round(layout.priceLeft) + 0.5, layout.plotBottom);
            bgCtx.moveTo(layout.plotLeft, Math.round(layout.timeTop) + 0.5);
            bgCtx.lineTo(layout.plotRight + PRICE_AXIS, Math.round(layout.timeTop) + 0.5);
            bgCtx.stroke();

            bgCtx.strokeStyle = C.grid;
            bgCtx.fillStyle = C.textMuted;
            bgCtx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            bgCtx.textBaseline = "middle";

            for (let i = 0; i <= 5; i += 1) {
                const r = i / 5;
                const y = layout.plotTop + r * layout.plotHeight;
                const ya = Math.round(y) + 0.5;
                bgCtx.beginPath();
                bgCtx.moveTo(layout.plotLeft, ya);
                bgCtx.lineTo(layout.plotRight, ya);
                bgCtx.stroke();
                const price = d.maxPrice - (d.maxPrice - d.minPrice) * r;
                bgCtx.fillText(fmtPrice(price), layout.priceLeft + 6, Math.round(y));
            }

            if (d.candles.length > 0 && d.lastVisibleIndex >= d.firstVisibleIndex) {
                const barsPerLine = Math.max(1, Math.round(130 / d.barSpacing));
                const start = Math.ceil(d.firstVisibleIndex / barsPerLine) * barsPerLine;
                bgCtx.textBaseline = "top";
                for (let i = start; i <= d.lastVisibleIndex; i += barsPerLine) {
                    const candle = d.candles[i];
                    if (!candle) continue;
                    const x = d.indexToX(i);
                    if (x < layout.plotLeft || x > layout.plotRight) continue;
                    bgCtx.beginPath();
                    bgCtx.moveTo(Math.round(x) + 0.5, layout.plotTop);
                    bgCtx.lineTo(Math.round(x) + 0.5, layout.plotBottom);
                    bgCtx.stroke();
                    const text = fmtAxisTime(candle.t, intervalRef.current);
                    const tw = bgCtx.measureText(text).width;
                    const tx = clamp(x - tw / 2, layout.plotLeft + 4, layout.plotRight - tw - 4);
                    bgCtx.fillText(text, tx, layout.timeTop + 6);
                }
            }
        }

        if (dirty.series) {
            clear(seriesCtx, layout);
            seriesCtx.save();
            seriesCtx.beginPath();
            seriesCtx.rect(layout.plotLeft, layout.plotTop, layout.plotWidth, layout.plotHeight);
            seriesCtx.clip();

            const bw = Math.max(1, Math.floor(d.barSpacing * 0.72));
            for (let i = d.firstVisibleIndex; i <= d.lastVisibleIndex; i += 1) {
                const c = d.candles[i];
                if (!c) continue;
                const x = d.indexToX(i);
                if (x + bw < layout.plotLeft || x - bw > layout.plotRight) continue;
                const oy = d.priceToY(c.o);
                const hy = d.priceToY(c.h);
                const ly = d.priceToY(c.l);
                const cy = d.priceToY(c.c);
                const color = c.c >= c.o ? C.up : C.down;

                seriesCtx.strokeStyle = color;
                seriesCtx.lineWidth = 1;
                seriesCtx.beginPath();
                seriesCtx.moveTo(Math.round(x) + 0.5, hy);
                seriesCtx.lineTo(Math.round(x) + 0.5, ly);
                seriesCtx.stroke();

                const top = Math.min(oy, cy);
                const h = Math.abs(cy - oy);
                const left = Math.round(x - bw / 2);
                seriesCtx.fillStyle = color;
                if (h < 1.2) seriesCtx.fillRect(left, Math.round(top), bw, 1);
                else seriesCtx.fillRect(left, top, bw, h);
            }
            seriesCtx.restore();
        }

        if (dirty.overlay) {
            clear(overlayCtx, layout);
            const hover = hoverRef.current;
            let hoverIndex = hover.index;
            if (hover.active && d.candles.length > 0) {
                hoverIndex = clamp(Math.round(d.xToIndex(hover.mouseX)), 0, d.candles.length - 1);
                hoverRef.current.index = hoverIndex;
            }

            const hudCandle = hover.active && hoverIndex >= 0 ? d.candles[hoverIndex] : d.candles[d.candles.length - 1];
            const hudPrev = hudCandle && hoverIndex > 0 ? d.candles[hoverIndex - 1] : d.candles[d.candles.length - 2];

            overlayCtx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
            overlayCtx.textBaseline = "middle";

            if (hudCandle) {
                const delta = hudPrev ? hudCandle.c - hudPrev.c : 0;
                const deltaPct = hudPrev && hudPrev.c !== 0 ? (delta / hudPrev.c) * 100 : 0;
                const hudText = `${symbolRef.current.toUpperCase()} ${intervalRef.current}  O ${fmtPrice(hudCandle.o)}  H ${fmtPrice(hudCandle.h)}  L ${fmtPrice(hudCandle.l)}  C ${fmtPrice(hudCandle.c)}  ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(2)}%)  ${STATUS_LABEL[statusRef.current]}`;
                const w = overlayCtx.measureText(hudText).width + 16;
                overlayCtx.fillStyle = C.hud;
                overlayCtx.fillRect(layout.plotLeft + 8, layout.plotTop + 8, w, 24);
                overlayCtx.fillStyle = C.text;
                overlayCtx.fillText(hudText, layout.plotLeft + 16, layout.plotTop + 20);
            }

            if (hover.active && hoverIndex >= 0 && hoverIndex < d.candles.length) {
                const candle = d.candles[hoverIndex];
                const x = d.indexToX(hoverIndex);
                const y = clamp(hover.y, layout.plotTop, layout.plotBottom);
                if (x >= layout.plotLeft && x <= layout.plotRight) {
                    overlayCtx.save();
                    overlayCtx.strokeStyle = C.cross;
                    overlayCtx.setLineDash([5, 5]);
                    overlayCtx.beginPath();
                    overlayCtx.moveTo(Math.round(x) + 0.5, layout.plotTop);
                    overlayCtx.lineTo(Math.round(x) + 0.5, layout.plotBottom);
                    overlayCtx.moveTo(layout.plotLeft, Math.round(y) + 0.5);
                    overlayCtx.lineTo(layout.plotRight, Math.round(y) + 0.5);
                    overlayCtx.stroke();
                    overlayCtx.restore();

                    const priceText = fmtPrice(d.yToPrice(y));
                    overlayCtx.fillStyle = C.labelBg;
                    overlayCtx.fillRect(layout.priceLeft + 3, y - 9, PRICE_AXIS - 6, 18);
                    overlayCtx.fillStyle = C.labelText;
                    overlayCtx.fillText(priceText, layout.priceLeft + 8, y);

                    const timeText = fmtCrossTime(candle.t, intervalRef.current);
                    const tw = overlayCtx.measureText(timeText).width + 14;
                    const tx = clamp(x - tw / 2, layout.plotLeft + 2, layout.plotRight - tw - 2);
                    overlayCtx.fillStyle = C.labelBg;
                    overlayCtx.fillRect(tx, layout.timeTop + 2, tw, TIME_AXIS - 4);
                    overlayCtx.fillStyle = C.labelText;
                    overlayCtx.fillText(timeText, tx + 7, layout.timeTop + TIME_AXIS / 2);
                }
            }
        }

        dirty.grid = false;
        dirty.series = false;
        dirty.overlay = false;
    }, []);

    const markDirty = useCallback(
        (next: Partial<Dirty>) => {
            dirtyRef.current.grid ||= Boolean(next.grid);
            dirtyRef.current.series ||= Boolean(next.series);
            dirtyRef.current.overlay ||= Boolean(next.overlay);
            if (rafRef.current !== null) return;
            rafRef.current = window.requestAnimationFrame(() => {
                rafRef.current = null;
                draw();
            });
        },
        [draw],
    );

    const setConnStatus = useCallback(
        (next: BinanceConnectionStatus) => {
            if (statusRef.current === next) return;
            statusRef.current = next;
            setStatus(next);
            statusCbRef.current?.(next);
            markDirty({ overlay: true });
        },
        [markDirty],
    );

    useEffect(() => {
        const container = containerRef.current;
        const bg = bgRef.current;
        const series = seriesRef.current;
        const overlay = overlayRef.current;
        if (!container || !bg || !series || !overlay) return;

        const applySize = (w: number, h: number, dpr: number) => {
            const layout = makeLayout(w, h, dpr);
            layoutRef.current = layout;
            resizeCanvas(bg, layout.cssWidth, layout.cssHeight, layout.dpr);
            resizeCanvas(series, layout.cssWidth, layout.cssHeight, layout.dpr);
            resizeCanvas(overlay, layout.cssWidth, layout.cssHeight, layout.dpr);
            markDirty({ grid: true, series: true, overlay: true });
        };

        const applyEntry = (entry?: ResizeObserverEntry) => {
            const dpr = window.devicePixelRatio || 1;
            if (!entry) {
                const rect = container.getBoundingClientRect();
                applySize(rect.width, rect.height, dpr);
                return;
            }

            const withDevice = entry as ResizeObserverEntry & { devicePixelContentBoxSize?: ReadonlyArray<ResizeObserverSize> };
            const dp = withDevice.devicePixelContentBoxSize?.[0];
            if (dp) {
                applySize(dp.inlineSize / dpr, dp.blockSize / dpr, dpr);
                return;
            }

            const box = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : entry.contentBoxSize;
            if (box) {
                applySize(box.inlineSize, box.blockSize, dpr);
                return;
            }

            applySize(entry.contentRect.width, entry.contentRect.height, dpr);
        };

        const observer = new ResizeObserver((entries) => {
            applyEntry(entries[entries.length - 1]);
        });

        applyEntry();
        try {
            observer.observe(container, { box: "device-pixel-content-box" });
        } catch {
            observer.observe(container);
        }

        return () => observer.disconnect();
    }, [markDirty]);

    useEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;

        const point = (event: MouseEvent | WheelEvent) => {
            const rect = overlay.getBoundingClientRect();
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        };

        const onDown = (event: MouseEvent) => {
            const layout = layoutRef.current;
            if (!layout) return;
            const p = point(event);
            const inside = p.x >= layout.plotLeft && p.x <= layout.plotRight && p.y >= layout.plotTop && p.y <= layout.plotBottom;
            if (!inside) return;
            dragRef.current.active = true;
            dragRef.current.startX = p.x;
            dragRef.current.startOffset = viewportRef.current.rightOffset;
            overlay.style.cursor = "grabbing";
        };

        const onUp = () => {
            if (!dragRef.current.active) return;
            dragRef.current.active = false;
            overlay.style.cursor = "crosshair";
        };

        const onMove = (event: MouseEvent) => {
            const layout = layoutRef.current;
            if (!layout) return;
            const p = point(event);

            if (dragRef.current.active) {
                const visibleBars = Math.max(1, Math.floor(layout.plotWidth / viewportRef.current.barSpacing));
                const maxOffset = Math.max(0, candlesRef.current.length - visibleBars);
                const dx = p.x - dragRef.current.startX;
                viewportRef.current.rightOffset = clamp(dragRef.current.startOffset + dx / viewportRef.current.barSpacing, 0, maxOffset);
                markDirty({ grid: true, series: true, overlay: true });
                return;
            }

            const inside = p.x >= layout.plotLeft && p.x <= layout.plotRight && p.y >= layout.plotTop && p.y <= layout.plotBottom;
            if (!inside || candlesRef.current.length === 0) {
                if (hoverRef.current.active) {
                    hoverRef.current.active = false;
                    markDirty({ overlay: true });
                }
                return;
            }

            const d = derive(candlesRef.current, layout, viewportRef.current);
            hoverRef.current.active = true;
            hoverRef.current.index = clamp(Math.round(d.xToIndex(p.x)), 0, candlesRef.current.length - 1);
            hoverRef.current.mouseX = p.x;
            hoverRef.current.y = p.y;
            markDirty({ overlay: true });
        };

        const onLeave = () => {
            if (dragRef.current.active || !hoverRef.current.active) return;
            hoverRef.current.active = false;
            markDirty({ overlay: true });
        };

        const onWheel = (event: WheelEvent) => {
            const layout = layoutRef.current;
            if (!layout || candlesRef.current.length === 0) return;
            event.preventDefault();

            const p = point(event);
            const anchorX = clamp(p.x, layout.plotLeft, layout.plotRight);
            const current = viewportRef.current.barSpacing;
            const next = clamp(current * (event.deltaY < 0 ? 1.12 : 0.88), BAR_SPACING_MIN, BAR_SPACING_MAX);
            if (Math.abs(next - current) < 0.001) return;

            const count = candlesRef.current.length;
            const oldVisible = layout.plotWidth / current;
            const oldFirst = count - oldVisible - viewportRef.current.rightOffset;
            const anchorIndex = oldFirst + (anchorX - layout.plotLeft) / current - 0.5;

            const newVisible = layout.plotWidth / next;
            const newFirst = anchorIndex - (anchorX - layout.plotLeft) / next + 0.5;
            const newVisibleBars = Math.max(1, Math.floor(layout.plotWidth / next));
            const maxOffset = Math.max(0, count - newVisibleBars);

            viewportRef.current.barSpacing = next;
            viewportRef.current.rightOffset = clamp(count - newVisible - newFirst, 0, maxOffset);
            markDirty({ grid: true, series: true, overlay: true });
        };

        overlay.addEventListener("mousedown", onDown);
        overlay.addEventListener("mousemove", onMove);
        overlay.addEventListener("mouseleave", onLeave);
        overlay.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("mouseup", onUp);

        return () => {
            overlay.removeEventListener("mousedown", onDown);
            overlay.removeEventListener("mousemove", onMove);
            overlay.removeEventListener("mouseleave", onLeave);
            overlay.removeEventListener("wheel", onWheel);
            window.removeEventListener("mouseup", onUp);
        };
    }, [markDirty]);

    useEffect(() => {
        let cancelled = false;

        const closeSocket = () => {
            if (!wsRef.current) return;
            wsRef.current.onopen = null;
            wsRef.current.onmessage = null;
            wsRef.current.onerror = null;
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        };

        const clearReconnect = () => {
            if (!reconnectRef.current) return;
            clearTimeout(reconnectRef.current);
            reconnectRef.current = null;
        };

        const scheduleReconnect = (connect: () => void) => {
            reconnectAttemptRef.current += 1;
            const delay = Math.min(30_000, 1_000 * 2 ** (reconnectAttemptRef.current - 1));
            setConnStatus("reconnecting");
            clearReconnect();
            reconnectRef.current = setTimeout(() => {
                if (!cancelled) connect();
            }, delay);
        };

        const connectWs = () => {
            if (cancelled) return;
            const url = `wss://stream.binance.com:9443/ws/${symbolRef.current.toLowerCase()}@kline_${intervalRef.current}`;
            setConnStatus(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");
            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                if (cancelled) return;
                reconnectAttemptRef.current = 0;
                setConnStatus("connected");
            };

            ws.onmessage = (event) => {
                if (cancelled) return;
                let payload: unknown;
                try {
                    payload = JSON.parse(event.data);
                } catch {
                    return;
                }

                const candle = parseWs(payload);
                if (!candle) return;
                const arr = candlesRef.current;
                const last = arr[arr.length - 1];
                let appended = false;

                if (!last || candle.t > last.t) {
                    arr.push(candle);
                    appended = true;
                } else if (candle.t === last.t) {
                    arr[arr.length - 1] = candle;
                } else {
                    return;
                }

                emitLast();
                markDirty({ series: true, overlay: true, grid: appended });
            };

            ws.onerror = () => {
                if (!cancelled) setConnStatus("disconnected");
            };

            ws.onclose = () => {
                if (cancelled) return;
                setConnStatus("disconnected");
                scheduleReconnect(connectWs);
            };
        };

        const loadHistory = async () => {
            setFetchError(null);
            setConnStatus("loading");
            candlesRef.current = [];
            hoverRef.current.active = false;
            viewportRef.current.rightOffset = 0;
            markDirty({ grid: true, series: true, overlay: true });

            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            try {
                const url = `https://api.binance.com/api/v3/klines?symbol=${symbolRef.current.toUpperCase()}&interval=${intervalRef.current}&limit=${HISTORY_LIMIT}`;
                const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
                if (!res.ok) throw new Error(`History request failed (${res.status})`);
                const data = parseRest((await res.json()) as unknown);
                if (!data.length) throw new Error("No candle data received from Binance.");
                if (cancelled) return;

                candlesRef.current = data;
                emitLast();
                markDirty({ grid: true, series: true, overlay: true });
                reconnectAttemptRef.current = 0;
                connectWs();
            } catch (error) {
                if (cancelled || (error as Error).name === "AbortError") return;
                closeSocket();
                clearReconnect();
                setConnStatus("error");
                setFetchError((error as Error).message || "Failed to load candles.");
                lastCbRef.current?.(null, null);
                markDirty({ overlay: true });
            }
        };

        closeSocket();
        clearReconnect();
        loadHistory();

        return () => {
            cancelled = true;
            closeSocket();
            clearReconnect();
            abortRef.current?.abort();
        };
    }, [emitLast, markDirty, retryToken, setConnStatus]);

    useEffect(() => {
        markDirty({ grid: true, overlay: true });
    }, [status, markDirty]);

    useEffect(() => {
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            abortRef.current?.abort();
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            wsRef.current?.close();
        };
    }, []);

    return (
        <div
            className={cn(
                "relative w-full overflow-hidden rounded-2xl border border-slate-700/70 bg-[#070d16] shadow-[0_20px_60px_-35px_rgba(0,0,0,0.8)]",
                className,
            )}
            style={{ height }}
        >
            <div ref={containerRef} className="relative h-full w-full touch-none select-none">
                <canvas ref={bgRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                <canvas ref={seriesRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                <canvas ref={overlayRef} className="absolute inset-0 h-full w-full cursor-crosshair" />
            </div>

            {fetchError ? (
                <div className="absolute inset-0 z-20 grid place-items-center bg-[#070d16]/90 px-4">
                    <div className="max-w-sm rounded-xl border border-rose-500/50 bg-[#111a28] p-5 text-center">
                        <p className="text-sm font-semibold text-rose-300">Failed to load Binance candles</p>
                        <p className="mt-2 text-xs text-slate-300">{fetchError}</p>
                        <button
                            type="button"
                            onClick={() => setRetryToken((v) => v + 1)}
                            className="mt-4 rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-700"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full border border-slate-600/70 bg-[#0f1728]/80 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                {STATUS_LABEL[status]}
            </div>
        </div>
    );
}
