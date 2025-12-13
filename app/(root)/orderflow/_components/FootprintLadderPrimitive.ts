import type { CandlestickData, UTCTimestamp } from "@/utils/lightweight-charts-loader";

type LadderMode = "bidAsk" | "delta" | "volume";

type FootprintLevel = { price: number; bid: number; ask: number; total: number };

type FootprintGetter = (tSec: number) => { levels: FootprintLevel[]; buyTotal: number; sellTotal: number } | null;

type PrimitiveOptions = {
    priceStep: number;
    mode: LadderMode;
    showNumbers: boolean;
    highlightImbalances: boolean;
    imbalanceRatio: number;
};

type RendererTarget = {
    useBitmapCoordinateSpace(
        scope: (
            params: {
                context: CanvasRenderingContext2D;
                horizontalPixelRatio: number;
                verticalPixelRatio: number;
                bitmapSize: { width: number; height: number };
            },
        ) => void,
    ): void;
};

type PaneRenderer = {
    draw(target: RendererTarget): void;
    drawBackground?: (target: RendererTarget) => void;
    hitTest?: () => null;
};

type PaneView = {
    renderer: () => PaneRenderer | null;
};

const normalizeToCandleSec = (time: UTCTimestamp | number | string | { timestamp?: number } | { time?: number }) => {
    if (typeof time === "number") {
        // treat timestamps over 1e12 as ms
        return time > 1e12 ? Math.floor(time / 1000) : Math.floor(time);
    }
    if (typeof time === "string") {
        const parsed = Number(time);
        if (Number.isFinite(parsed)) return parsed > 1e12 ? Math.floor(parsed / 1000) : Math.floor(parsed);
        return null;
    }
    if (typeof time === "object" && time) {
        const candidate = (time as { timestamp?: number }).timestamp ?? (time as { time?: number }).time;
        if (typeof candidate === "number") {
            return candidate > 1e12 ? Math.floor(candidate / 1000) : Math.floor(candidate);
        }
    }
    return null;
};

export class FootprintLadderPrimitive {
    private chart: any;
    private series: any;
    private getFootprintForCandle: FootprintGetter;
    private getCandles: () => CandlestickData[];
    private options: PrimitiveOptions;
    private paneView: PaneView;
    private renderer: PaneRenderer;
    private requestUpdate: (() => void) | null = null;
    private pendingUpdate = false;

    constructor(params: {
        chart: any;
        series: any;
        getFootprintForCandle: FootprintGetter;
        getCandles: () => CandlestickData[];
        priceStep: number;
        mode: LadderMode;
        showNumbers: boolean;
        highlightImbalances: boolean;
        imbalanceRatio?: number;
    }) {
        this.chart = params.chart;
        this.series = params.series;
        this.getFootprintForCandle = params.getFootprintForCandle;
        this.getCandles = params.getCandles;
        this.options = {
            priceStep: params.priceStep,
            mode: params.mode,
            showNumbers: params.showNumbers,
            highlightImbalances: params.highlightImbalances,
            imbalanceRatio: params.imbalanceRatio ?? 3,
        };

        this.renderer = {
            draw: (target: RendererTarget) => {
                this.draw(target);
            },
            hitTest: () => null,
        };

        this.paneView = {
            renderer: () => this.renderer,
        };
    }

    attached?(params: { chart?: any; series?: any; requestUpdate?: () => void }): void {
        if (params.chart) this.chart = params.chart;
        if (params.series) this.series = params.series;
        if (params.requestUpdate) this.requestUpdate = params.requestUpdate;
    }

    detached?(): void {
        this.requestUpdate = null;
        this.pendingUpdate = false;
    }

    paneViews(): readonly PaneView[] {
        return [this.paneView];
    }

    updateAllViews(): void {
        this.invalidate();
    }

    updateOptions(options: Partial<PrimitiveOptions>): void {
        this.options = { ...this.options, ...options };
        this.invalidate();
    }

    invalidate(): void {
        if (this.requestUpdate) {
            if (this.pendingUpdate) return;
            this.pendingUpdate = true;
            requestAnimationFrame(() => {
                this.pendingUpdate = false;
                this.requestUpdate?.();
            });
            return;
        }

        // Fallback: lightweight hint without moving the viewport.
        try {
            this.chart?.applyOptions?.({});
        } catch (err) {
            console.warn("Footprint ladder invalidate fallback failed", err);
        }
    }

    private draw(target: RendererTarget) {
        if (!this.chart || !this.series) return;
        const priceStep = this.options.priceStep;
        if (!Number.isFinite(priceStep) || priceStep <= 0) return;

        const timeScale: any = this.chart.timeScale?.();
        const range = timeScale?.getVisibleLogicalRange?.();
        const candles = this.getCandles();
        if (!candles.length || !range) return;

        const fromIndex = Math.max(0, Math.floor(range.from));
        const toIndex = Math.min(candles.length - 1, Math.ceil(range.to));
        if (toIndex < fromIndex) return;

        // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook; lightweight-charts drawing API
        target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio, verticalPixelRatio, bitmapSize }) => {
            const canvasWidth = bitmapSize.width / horizontalPixelRatio;
            const visibleCount = Math.max(toIndex - fromIndex + 1, 1);
            const approxBarSpacing = canvasWidth / Math.max(visibleCount + 2, 1);

            if (!Number.isFinite(approxBarSpacing) || approxBarSpacing < 5) return;

            const ladderWidth = approxBarSpacing * (this.options.mode === "bidAsk" ? 0.85 : 0.6);
            const halfWidth = this.options.mode === "bidAsk" ? ladderWidth / 2 : ladderWidth / 2;
            const candleHalfWidth = Math.min(Math.max(approxBarSpacing * 0.25, 2), 8);
            const gap = Math.max(approxBarSpacing * 0.08, 2);
            const padding = 4;

            ctx.save();
            ctx.scale(horizontalPixelRatio, verticalPixelRatio);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            let lastMarker: { x: number; y: number } | null = null;

            for (let index = fromIndex; index <= toIndex; index += 1) {
                const candle = candles[index];
                if (!candle) continue;
                const x = timeScale?.timeToCoordinate?.(candle.time as UTCTimestamp);
                if (x == null) continue;

                const footprintKey = normalizeToCandleSec(candle.time as number);
                const footprint = footprintKey != null ? this.getFootprintForCandle(footprintKey) : null;

                const markerY = this.series.priceToCoordinate?.(
                    (candle.high + candle.low) / 2 || candle.close || candle.open,
                );
                if (markerY != null) {
                    lastMarker = { x, y: markerY };
                }

                if (!footprint || !footprint.levels.length) continue;

                let maxVolume = 0;
                for (const level of footprint.levels) {
                    if (level.total > maxVolume) maxVolume = level.total;
                }
                if (maxVolume <= 0) continue;

                let left = x + candleHalfWidth + gap;
                if (left + ladderWidth > canvasWidth - padding) {
                    left = x - candleHalfWidth - gap - ladderWidth;
                }
                const right = left + ladderWidth;
                if (left < padding || right > canvasWidth - padding) {
                    continue;
                }

                for (const level of footprint.levels) {
                    const y = this.series.priceToCoordinate?.(level.price);
                    const yNext = this.series.priceToCoordinate?.(level.price + priceStep);
                    if (y == null || yNext == null) continue;
                    const top = Math.min(y, yNext);
                    const rowHeight = Math.max(1, Math.abs(y - yNext));
                    if (rowHeight < 2) continue;

                    this.drawLevel(ctx, {
                        left,
                        top,
                        rowHeight,
                        halfWidth,
                        ladderWidth,
                        level,
                        maxVolume,
                    });
                }
            }

            if (lastMarker) {
                ctx.fillStyle = "rgba(255,255,255,0.05)";
                ctx.fillRect(lastMarker.x - 2, lastMarker.y - 2, 4, 4);
            }

            ctx.restore();
        });
    }

    private drawLevel(
        ctx: CanvasRenderingContext2D,
        params: {
            left: number;
            top: number;
            rowHeight: number;
            halfWidth: number;
            ladderWidth: number;
            level: FootprintLevel;
            maxVolume: number;
        },
    ) {
        const { left, top, rowHeight, halfWidth, ladderWidth, level, maxVolume } = params;
        const { mode, showNumbers, highlightImbalances } = this.options;
        const imbalanceRatio = Math.max(1.01, this.options.imbalanceRatio || 0);

        const centerX = left + ladderWidth / 2;

        const bidVolume = level.bid;
        const askVolume = level.ask;
        const totalVolume = level.total;
        const delta = askVolume - bidVolume;

        const intensity = maxVolume > 0 ? Math.min(1, totalVolume / maxVolume) : 0;
        const baseAlpha = 0.15 + 0.65 * intensity;

        ctx.lineWidth = 1;

        if (mode === "bidAsk") {
            const bidLeft = left;
            const askLeft = left + halfWidth;

            // Bid (left)
            ctx.fillStyle = `rgba(239, 68, 68, ${baseAlpha})`;
            ctx.fillRect(bidLeft, top, halfWidth, rowHeight);
            // Ask (right)
            ctx.fillStyle = `rgba(52, 211, 153, ${baseAlpha})`;
            ctx.fillRect(askLeft, top, halfWidth, rowHeight);

            if (highlightImbalances && bidVolume > 0 && askVolume >= bidVolume * imbalanceRatio) {
                ctx.strokeStyle = "rgba(52, 211, 153, 0.9)";
                ctx.strokeRect(askLeft, top + 0.5, halfWidth, rowHeight - 1);
            } else if (highlightImbalances && askVolume > 0 && bidVolume >= askVolume * imbalanceRatio) {
                ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
                ctx.strokeRect(bidLeft, top + 0.5, halfWidth, rowHeight - 1);
            }

            if (showNumbers && rowHeight >= 10 && halfWidth >= 7) {
                const fontSize = Math.min(Math.max(9, rowHeight - 2), 14);
                ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
                ctx.fillStyle = "#e5e7eb";
                ctx.fillText(Math.round(bidVolume).toString(), bidLeft + halfWidth / 2, top + rowHeight / 2);
                ctx.fillText(Math.round(askVolume).toString(), askLeft + halfWidth / 2, top + rowHeight / 2);
            }
        } else if (mode === "delta") {
            const alpha = baseAlpha + 0.1;
            ctx.fillStyle = delta >= 0 ? `rgba(52, 211, 153, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;
            ctx.fillRect(centerX - halfWidth, top, halfWidth * 2, rowHeight);

            if (showNumbers && rowHeight >= 10 && halfWidth * 2 >= 12) {
                const fontSize = Math.min(Math.max(9, rowHeight - 2), 14);
                ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
                ctx.fillStyle = "#e5e7eb";
                ctx.fillText(Math.round(delta).toString(), centerX, top + rowHeight / 2);
            }
        } else {
            const alpha = baseAlpha + 0.05;
            ctx.fillStyle = `rgba(96, 165, 250, ${alpha})`;
            ctx.fillRect(centerX - halfWidth, top, halfWidth * 2, rowHeight);

            if (showNumbers && rowHeight >= 10 && halfWidth * 2 >= 12) {
                const fontSize = Math.min(Math.max(9, rowHeight - 2), 14);
                ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
                ctx.fillStyle = "#e5e7eb";
                ctx.fillText(Math.round(totalVolume).toString(), centerX, top + rowHeight / 2);
            }
        }
    }
}
