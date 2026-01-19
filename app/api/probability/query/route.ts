import { z } from "zod";

import { NextRequest, NextResponse } from "next/server";

import { fetchTimeSeries, Timeframe } from "@/lib/market/twelvedata";
import {
    EVENTS,
    TIMEFRAMES,
    normalizeSymbol,
    symbolSchema,
} from "@/lib/probability/validation";
import { getPipSize } from "@/lib/probability/scaling";
import { parseAsOf } from "@/lib/probability/time";
import { computeTouchNow } from "@/lib/probability/touch";

type ProbabilityEvent = "end" | "touch";

type ProbabilityPayload = {
    symbol: string;
    timeframe: Timeframe;
    horizonBars: number;
    lookbackBars: number;
    targetX: number;
    event: ProbabilityEvent;
};

type ProbabilityResponse = {
    status: "OK" | "MOCKED";
    message?: string;
    meta: {
        symbol: string;
        timeframe: Timeframe;
        horizonBars: number;
        requestedLookbackBars: number;
        effectiveLookbackBars: number;
        targetX: number;
        event: ProbabilityEvent;
        asOf: string;
        dataSource: "twelvedata" | "mock";
        wasClamped?: boolean;
        clampReason?: string;
    };
    prob: {
        up_ge_x: number;
        down_ge_x: number;
        within_pm_x: number;
        both_touch?: number;
    };
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TWELVEDATA_MAX_POINTS = 5000;
const OUTPUT_PAD = 5;


const requestSchema = z
    .object({
        symbol: symbolSchema,
        timeframe: z.enum(TIMEFRAMES),
        horizonBars: z.number().int().min(1).max(500),
        lookbackBars: z.number().int().min(50).max(5000),
        targetX: z.number().int().min(1).max(500),
        event: z.enum(EVENTS).default("end"),
    })
    .strict();

const clampProbability = (value: number, min = 0.0, max = 1.0) =>
    Math.min(max, Math.max(min, value));

const hashSeed = (input: string) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

const mulberry32 = (seed: number) => {
    let t = seed;
    return () => {
        t += 0x6d2b79f5;
        let x = t;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
};

const erf = (value: number) => {
    const sign = value >= 0 ? 1 : -1;
    const x = Math.abs(value);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const t = 1 / (1 + p * x);
    const y =
        1 -
        (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
            Math.exp(-x * x);
    return sign * y;
};

const normalCdf = (value: number) => 0.5 * (1 + erf(value / Math.SQRT2));

const ewmaVolatility = (returns: number[], lambda = 0.94) => {
    if (returns.length === 0) {
        return 0;
    }
    let variance = returns[0] * returns[0];
    for (let i = 1; i < returns.length; i += 1) {
        const r = returns[i];
        variance = lambda * variance + (1 - lambda) * r * r;
    }
    return Math.sqrt(variance);
};


const buildMockProbabilities = (request: ProbabilityPayload) => {
    const seed = hashSeed(
        `${request.symbol}|${request.timeframe}|${request.horizonBars}|${request.lookbackBars}|${request.event}`
    );
    const random = mulberry32(seed);
    const rUp = random();
    const rDown = random();
    const rWithin = random();
    const baseUp = 0.35 + rUp * 0.35;
    const baseDown = 0.35 + rDown * 0.35;
    const aUp = 0.06 + rUp * 0.08;
    const aDown = 0.06 + rDown * 0.08;
    const difficulty = request.targetX / (request.targetX + 18);

    let up = clampProbability(
        baseUp * Math.exp(-aUp * request.targetX) * (1 - 0.15 * difficulty),
        0.01,
        0.8
    );
    let down = clampProbability(
        baseDown * Math.exp(-aDown * request.targetX) * (1 - 0.15 * difficulty),
        0.01,
        0.8
    );
    const tailSum = up + down;
    if (tailSum > 0.95) {
        const scale = 0.95 / tailSum;
        up = clampProbability(up * scale, 0.01, 0.8);
        down = clampProbability(down * scale, 0.01, 0.8);
    }

    const within = clampProbability(
        1 - (up + down) + (rWithin - 0.5) * 0.01,
        0.01,
        0.98
    );

    return { up, down, within };
};


export async function GET() {
    return NextResponse.json({
        status: "OK",
        message: "Use POST /api/probability/query to request probabilities.",
    });
}

export async function POST(request: NextRequest) {
    let parsedBody: unknown;
    try {
        parsedBody = await request.json();
    } catch (error) {
        return NextResponse.json(
            { error: "Invalid JSON payload", where: "probability" },
            { status: 400 }
        );
    }

    const normalizedPayload =
        parsedBody && typeof parsedBody === "object"
            ? {
                  symbol: (parsedBody as Record<string, unknown>).symbol,
                  timeframe: (parsedBody as Record<string, unknown>).timeframe,
                  horizonBars:
                      (parsedBody as Record<string, unknown>).horizonBars ??
                      (parsedBody as Record<string, unknown>).horizon,
                  lookbackBars:
                      (parsedBody as Record<string, unknown>).lookbackBars ??
                      (parsedBody as Record<string, unknown>).lookback,
                  targetX: (parsedBody as Record<string, unknown>).targetX,
                  event:
                      (parsedBody as Record<string, unknown>).event ?? "end",
              }
            : parsedBody;

    const parsed = requestSchema.safeParse(normalizedPayload);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid request payload", where: "probability" },
            { status: 400 }
        );
    }

    const payload: ProbabilityPayload = {
        ...parsed.data,
        symbol: normalizeSymbol(parsed.data.symbol),
    };

    if (
        payload.event === "touch" &&
        process.env.NEXT_PUBLIC_FEATURE_PROB_TOUCH !== "1"
    ) {
        return NextResponse.json(
            {
                status: "ERROR",
                error: {
                    code: "FEATURE_DISABLED",
                    message: "Touch event is not enabled.",
                },
            },
            { status: 400 }
        );
    }

    if (!process.env.TWELVEDATA_API_KEY) {
        const mock = buildMockProbabilities(payload);
        const response: ProbabilityResponse = {
            status: "MOCKED",
            message: "API unavailable",
            meta: {
                symbol: payload.symbol,
                timeframe: payload.timeframe,
                horizonBars: payload.horizonBars,
                requestedLookbackBars: payload.lookbackBars,
                effectiveLookbackBars: payload.lookbackBars,
                targetX: payload.targetX,
                event: payload.event,
                asOf: new Date().toISOString(),
                dataSource: "mock",
            },
            prob: {
                up_ge_x: mock.up,
                down_ge_x: mock.down,
                within_pm_x: mock.within,
                ...(payload.event === "touch"
                    ? { both_touch: Math.min(mock.up, mock.down) * 0.5 }
                    : {}),
            },
        };
        return NextResponse.json(response);
    }

    const requestedOutputsize =
        payload.lookbackBars + payload.horizonBars + OUTPUT_PAD;
    const outputsize = Math.min(requestedOutputsize, TWELVEDATA_MAX_POINTS);
    const maxLookbackGivenClamp = Math.max(
        0,
        outputsize - payload.horizonBars - OUTPUT_PAD
    );
    const clampedLookbackBars = Math.min(
        payload.lookbackBars,
        maxLookbackGivenClamp
    );
    const timeSeries = await fetchTimeSeries({
        symbol: payload.symbol,
        timeframe: payload.timeframe,
        outputsize,
    });

    if (!timeSeries.ok) {
        return NextResponse.json(
            {
                error: "Failed to fetch candles",
                detail: timeSeries.error.message,
                where: "twelvedata",
            },
            { status: 502 }
        );
    }

    const candles = timeSeries.candles;
    const entryIndex = candles.length - 2;
    if (entryIndex <= 0) {
        return NextResponse.json(
            {
                error: "Insufficient data to compute probabilities",
                where: "twelvedata",
            },
            { status: 502 }
        );
    }

    const maxLookbackFromCandles = Math.max(
        0,
        candles.length - payload.horizonBars - 1
    );
    const effectiveLookbackBars = Math.min(
        clampedLookbackBars,
        Math.max(1, maxLookbackFromCandles)
    );

    const wasClamped = effectiveLookbackBars < payload.lookbackBars;
    const clampReason = wasClamped
        ? clampedLookbackBars < payload.lookbackBars
            ? "outputsize_limit"
            : "insufficient_candles"
        : undefined;

    const lookbackStart = entryIndex - effectiveLookbackBars;
    if (lookbackStart < 0) {
        return NextResponse.json(
            {
                error: "Insufficient data to compute lookback window",
                where: "twelvedata",
            },
            { status: 502 }
        );
    }

    const maxStartIndex = entryIndex - payload.horizonBars;
    if (maxStartIndex < lookbackStart) {
        return NextResponse.json(
            {
                error: "Insufficient data to compute horizon window",
                where: "twelvedata",
            },
            { status: 502 }
        );
    }

    if (payload.event === "touch") {
        const touchResult = computeTouchNow({
            candles,
            lookbackStart,
            maxStartIndex,
            horizonBars: payload.horizonBars,
            targetX: payload.targetX,
            symbol: payload.symbol,
        });

        if (!touchResult.sampleCount) {
            return NextResponse.json(
                {
                    error: "Insufficient data to compute probabilities",
                    where: "twelvedata",
                },
                { status: 502 }
            );
        }

        const response: ProbabilityResponse = {
            status: "OK",
            meta: {
                symbol: payload.symbol,
                timeframe: payload.timeframe,
                horizonBars: payload.horizonBars,
                requestedLookbackBars: payload.lookbackBars,
                effectiveLookbackBars,
                targetX: payload.targetX,
                event: payload.event,
                asOf: parseAsOf(candles[entryIndex].datetime),
                dataSource: "twelvedata",
                wasClamped,
                clampReason,
            },
            prob: {
                up_ge_x: touchResult.up_ge_x,
                down_ge_x: touchResult.down_ge_x,
                within_pm_x: touchResult.within_pm_x,
                both_touch: touchResult.both_touch,
            },
        };

        return NextResponse.json(response);
    }

    const closes = candles.map((candle) => candle.close);
    const windowCloses = closes.slice(lookbackStart, entryIndex + 1);
    if (windowCloses.length < 2) {
        return NextResponse.json(
            {
                error: "Not enough candles for volatility calculation",
                where: "twelvedata",
            },
            { status: 502 }
        );
    }

    const logReturns: number[] = [];
    for (let i = 1; i < windowCloses.length; i += 1) {
        const prev = windowCloses[i - 1];
        const current = windowCloses[i];
        if (prev > 0 && current > 0) {
            logReturns.push(Math.log(current / prev));
        }
    }

    const sigma1 = ewmaVolatility(logReturns);
    const sigmaH = Math.max(sigma1 * Math.sqrt(payload.horizonBars), 1e-12);

    const entryPrice = closes[entryIndex];
    const targetPriceMove = payload.targetX * getPipSize(payload.symbol);

    const rUp = Math.log((entryPrice + targetPriceMove) / entryPrice);
    const rDn =
        entryPrice <= targetPriceMove
            ? Number.NEGATIVE_INFINITY
            : Math.log((entryPrice - targetPriceMove) / entryPrice);

    const zUp = rUp / sigmaH;
    const zDn = rDn / sigmaH;

    const pUp = clampProbability(1 - normalCdf(zUp));
    const pDn = clampProbability(normalCdf(zDn));
    const pWithin = clampProbability(1 - pUp - pDn);

    const response: ProbabilityResponse = {
        status: "OK",
        meta: {
            symbol: payload.symbol,
            timeframe: payload.timeframe,
            horizonBars: payload.horizonBars,
            requestedLookbackBars: payload.lookbackBars,
            effectiveLookbackBars,
            targetX: payload.targetX,
            event: payload.event,
            asOf: parseAsOf(candles[entryIndex].datetime),
            dataSource: "twelvedata",
            wasClamped,
            clampReason,
        },
        prob: {
            up_ge_x: pUp,
            down_ge_x: pDn,
            within_pm_x: pWithin,
        },
    };

    return NextResponse.json(response);
}
