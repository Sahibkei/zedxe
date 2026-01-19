import { Candle } from "@/lib/market/twelvedata";
import { getPipSize } from "@/lib/probability/scaling";

type TouchMoves = {
    upMoves: number[];
    downMoves: number[];
};

type TouchNowResult = {
    up_ge_x: number;
    down_ge_x: number;
    within_pm_x: number;
    both_touch: number;
    sampleCount: number;
};

type TouchSurfaceResult = {
    xs: number[];
    up: number[];
    down: number[];
    within: number[];
    sampleCount: number;
};

const computeTouchMoves = ({
    candles,
    lookbackStart,
    maxStartIndex,
    horizonBars,
}: {
    candles: Candle[];
    lookbackStart: number;
    maxStartIndex: number;
    horizonBars: number;
}): TouchMoves => {
    const upMoves: number[] = [];
    const downMoves: number[] = [];

    for (let i = lookbackStart; i <= maxStartIndex; i += 1) {
        const start = candles[i]?.close;
        if (!Number.isFinite(start)) {
            continue;
        }
        let maxHigh = Number.NEGATIVE_INFINITY;
        let minLow = Number.POSITIVE_INFINITY;
        for (let j = i + 1; j <= i + horizonBars; j += 1) {
            const candle = candles[j];
            if (!candle) {
                break;
            }
            if (candle.high > maxHigh) {
                maxHigh = candle.high;
            }
            if (candle.low < minLow) {
                minLow = candle.low;
            }
        }
        if (!Number.isFinite(maxHigh) || !Number.isFinite(minLow)) {
            continue;
        }
        upMoves.push(maxHigh - start);
        downMoves.push(start - minLow);
    }

    return { upMoves, downMoves };
};

export const computeTouchNow = ({
    candles,
    lookbackStart,
    maxStartIndex,
    horizonBars,
    targetX,
    symbol,
}: {
    candles: Candle[];
    lookbackStart: number;
    maxStartIndex: number;
    horizonBars: number;
    targetX: number;
    symbol: string;
}): TouchNowResult => {
    const { upMoves, downMoves } = computeTouchMoves({
        candles,
        lookbackStart,
        maxStartIndex,
        horizonBars,
    });

    const sampleCount = Math.min(upMoves.length, downMoves.length);
    if (!sampleCount) {
        return {
            up_ge_x: 0,
            down_ge_x: 0,
            within_pm_x: 0,
            both_touch: 0,
            sampleCount: 0,
        };
    }

    const threshold = targetX * getPipSize(symbol);
    let upCount = 0;
    let downCount = 0;
    let withinCount = 0;
    let bothCount = 0;

    for (let i = 0; i < sampleCount; i += 1) {
        const upMove = upMoves[i];
        const downMove = downMoves[i];
        const upTouch = upMove >= threshold;
        const downTouch = downMove >= threshold;
        if (upTouch) {
            upCount += 1;
        }
        if (downTouch) {
            downCount += 1;
        }
        if (!upTouch && !downTouch) {
            withinCount += 1;
        }
        if (upTouch && downTouch) {
            bothCount += 1;
        }
    }

    return {
        up_ge_x: upCount / sampleCount,
        down_ge_x: downCount / sampleCount,
        within_pm_x: withinCount / sampleCount,
        both_touch: bothCount / sampleCount,
        sampleCount,
    };
};

export const computeTouchSurface = ({
    candles,
    lookbackStart,
    maxStartIndex,
    horizonBars,
    targetXs,
    symbol,
}: {
    candles: Candle[];
    lookbackStart: number;
    maxStartIndex: number;
    horizonBars: number;
    targetXs: number[];
    symbol: string;
}): TouchSurfaceResult => {
    const { upMoves, downMoves } = computeTouchMoves({
        candles,
        lookbackStart,
        maxStartIndex,
        horizonBars,
    });

    const sampleCount = Math.min(upMoves.length, downMoves.length);
    const xs = [...targetXs];
    const up = Array(xs.length).fill(0);
    const down = Array(xs.length).fill(0);
    const within = Array(xs.length).fill(0);

    if (!sampleCount || !xs.length) {
        return {
            xs,
            up,
            down,
            within,
            sampleCount: 0,
        };
    }

    const pipSize = getPipSize(symbol);
    const thresholds = xs.map((x) => x * pipSize);

    for (let i = 0; i < sampleCount; i += 1) {
        const upMove = upMoves[i];
        const downMove = downMoves[i];
        for (let j = 0; j < thresholds.length; j += 1) {
            const threshold = thresholds[j];
            const upTouch = upMove >= threshold;
            const downTouch = downMove >= threshold;
            if (upTouch) {
                up[j] += 1;
            }
            if (downTouch) {
                down[j] += 1;
            }
            if (!upTouch && !downTouch) {
                within[j] += 1;
            }
        }
    }

    return {
        xs,
        up: up.map((count) => count / sampleCount),
        down: down.map((count) => count / sampleCount),
        within: within.map((count) => count / sampleCount),
        sampleCount,
    };
};
