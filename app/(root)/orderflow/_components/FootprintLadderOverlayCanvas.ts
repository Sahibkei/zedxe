import type { CandlestickData, IChartApi, ISeriesApi, UTCTimestamp } from "@/utils/lightweight-charts-loader";

type LadderMode = "bidAsk" | "delta" | "volume";

type FootprintLevel = { price: number; bid: number; ask: number; total: number };

type FootprintGetter = (tSec: number) => { levels: FootprintLevel[]; buyTotal: number; sellTotal: number } | null;

const normalizeToCandleSec = (time: UTCTimestamp | number | string | { timestamp?: number } | { time?: number }) => {
    if (typeof time === "number") {
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

type DrawOptions = {
    chart: IChartApi;
    series: ISeriesApi;
    canvas: HTMLCanvasElement;
    getCandles: () => CandlestickData[];
    getFootprintForCandle: FootprintGetter;
    priceStep: number;
    mode: LadderMode;
    showNumbers: boolean;
    highlightImbalances: boolean;
    imbalanceRatio?: number;
};

export function drawFootprintLadderOverlay(options: DrawOptions) {
    const {
        chart,
        series,
        canvas,
        getCandles,
        getFootprintForCandle,
        priceStep,
        mode,
        showNumbers,
        highlightImbalances,
        imbalanceRatio = 3,
    } = options;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return;

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.max(Math.floor(width * dpr), 1);
        canvas.height = Math.max(Math.floor(height * dpr), 1);
        canvas.style.width = `${Math.max(width, 0)}px`;
        canvas.style.height = `${Math.max(height, 0)}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    ctx.fillText("LADDER OVERLAY ACTIVE", 8, height - 8);

    const candles = getCandles();
    if (!candles.length || !Number.isFinite(priceStep) || priceStep <= 0) {
        ctx.restore();
        return;
    }

    const timeScale = chart.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (!range) {
        ctx.restore();
        return;
    }

    const fromIndex = Math.max(0, Math.floor(range.from));
    const toIndex = Math.min(candles.length - 1, Math.ceil(range.to));
    if (toIndex < fromIndex) {
        ctx.restore();
        return;
    }

    const visibleCount = Math.max(toIndex - fromIndex + 1, 1);
    const approxBarSpacing = width / Math.max(visibleCount, 1);

    if (!Number.isFinite(approxBarSpacing) || approxBarSpacing < 6) {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "12px Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText("Zoom in to see footprint", 12, 18);
        ctx.restore();
        return;
    }

    const ladderWidth = Math.min(Math.max(approxBarSpacing * (mode === "bidAsk" ? 1.4 : 1.0), 40), 120);
    const halfWidth = mode === "bidAsk" ? ladderWidth / 2 : ladderWidth / 2;
    const candleHalfWidth = Math.min(Math.max(approxBarSpacing * 0.25, 2), 10);
    const gap = Math.max(approxBarSpacing * 0.1, 2);
    const padding = 6;
    const imbalance = Math.max(1.01, imbalanceRatio || 0);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let markerDrawn = false;

    for (let index = fromIndex; index <= toIndex; index += 1) {
        const candle = candles[index];
        if (!candle) continue;
        const x = timeScale.timeToCoordinate(candle.time as UTCTimestamp);
        if (x == null) continue;

        const footprintKey = normalizeToCandleSec(candle.time as number);
        const footprint = footprintKey != null ? getFootprintForCandle(footprintKey) : null;

        const markerY = series.priceToCoordinate((candle.high + candle.low) / 2 || candle.close || candle.open);
        if (!markerDrawn && markerY != null) {
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            ctx.fillRect(x - 2, markerY - 2, 4, 4);
            markerDrawn = true;
        }

        if (!footprint || !footprint.levels.length) continue;

        let maxVolume = 0;
        for (const level of footprint.levels) {
            if (level.total > maxVolume) maxVolume = level.total;
        }
        if (maxVolume <= 0) continue;

        let left = x + candleHalfWidth + gap;
        if (left + ladderWidth > width - padding) {
            left = x - candleHalfWidth - gap - ladderWidth;
        }
        const right = left + ladderWidth;
        if (left < padding || right > width - padding) {
            continue;
        }

        for (const level of footprint.levels) {
            const y = series.priceToCoordinate(level.price);
            const yNext = series.priceToCoordinate(level.price + priceStep);
            if (y == null || yNext == null) continue;
            const top = Math.min(y, yNext);
            const rowHeight = Math.max(1, Math.abs(y - yNext));
            if (rowHeight < 2) continue;

            drawLevel(ctx, {
                left,
                top,
                rowHeight,
                halfWidth,
                ladderWidth,
                level,
                maxVolume,
                mode,
                showNumbers,
                highlightImbalances,
                imbalance,
            });
        }
    }

    ctx.restore();
}

type DrawLevelParams = {
    left: number;
    top: number;
    rowHeight: number;
    halfWidth: number;
    ladderWidth: number;
    level: FootprintLevel;
    maxVolume: number;
    mode: LadderMode;
    showNumbers: boolean;
    highlightImbalances: boolean;
    imbalance: number;
};

const drawLevel = (ctx: CanvasRenderingContext2D, params: DrawLevelParams) => {
    const { left, top, rowHeight, halfWidth, ladderWidth, level, maxVolume, mode, showNumbers, highlightImbalances, imbalance } =
        params;

    const centerX = left + ladderWidth / 2;
    const bidVolume = level.bid;
    const askVolume = level.ask;
    const totalVolume = level.total;
    const delta = askVolume - bidVolume;

    const intensity = maxVolume > 0 ? Math.min(1, totalVolume / maxVolume) : 0;
    const baseAlpha = 0.18 + 0.6 * intensity;

    ctx.lineWidth = 1;

    if (mode === "bidAsk") {
        const bidLeft = left;
        const askLeft = left + halfWidth;

        ctx.fillStyle = `rgba(239, 68, 68, ${baseAlpha})`;
        ctx.fillRect(bidLeft, top, halfWidth, rowHeight);

        ctx.fillStyle = `rgba(16, 185, 129, ${baseAlpha})`;
        ctx.fillRect(askLeft, top, halfWidth, rowHeight);

        if (highlightImbalances && bidVolume > 0 && askVolume >= bidVolume * imbalance) {
            ctx.strokeStyle = "rgba(96, 165, 250, 0.95)";
            ctx.strokeRect(askLeft + 0.5, top + 0.5, halfWidth - 1, rowHeight - 1);
        } else if (highlightImbalances && askVolume > 0 && bidVolume >= askVolume * imbalance) {
            ctx.strokeStyle = "rgba(239, 68, 68, 0.95)";
            ctx.strokeRect(bidLeft + 0.5, top + 0.5, halfWidth - 1, rowHeight - 1);
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
        ctx.fillStyle = delta >= 0 ? `rgba(16, 185, 129, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;
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
};
