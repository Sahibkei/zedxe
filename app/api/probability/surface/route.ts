import { z } from "zod";

import { NextRequest, NextResponse } from "next/server";

import { fetchTimeSeries, Timeframe } from "@/lib/market/twelvedata";
import { scaleMoveToXUnits } from "@/lib/probability/scaling";
import { parseAsOf } from "@/lib/probability/time";
import {
    clampNumber,
    EVENTS,
    MAX_HORIZON_BARS,
    MAX_LOOKBACK_BARS,
    MAX_TARGET_X,
    MIN_HORIZON_BARS,
    MIN_LOOKBACK_BARS,
    MIN_TARGET_X,
    TIMEFRAMES,
    normalizeSymbol,
    symbolSchema,
} from "@/lib/probability/validation";

const TWELVEDATA_MAX_POINTS = 5000;
const OUTPUT_PAD = 5;
const DEFAULT_TARGET_XS = [5, 10, 15, 20, 25] as const;

const requestSchema = z
    .object({
        symbol: symbolSchema,
        timeframe: z.enum(TIMEFRAMES),
        horizonBars: z.number().int(),
        lookbackBars: z.number().int(),
        event: z.enum(EVENTS),
    })
    .strict();

type SurfaceResponse = {
    status: "OK";
    meta: {
        asOf: string;
        dataSource: "twelvedata";
        symbol: string;
        timeframe: Timeframe;
        event: "end";
        requestedLookbackBars: number;
        effectiveLookbackBars: number;
        requestedHorizonBars: number;
        effectiveHorizonBars: number;
        requestedTargetXs: number[];
        effectiveTargetXs: number[];
        wasClamped: boolean;
        wasTargetXsClamped: boolean;
        sampleCount: number;
    };
    surface: {
        xs: number[];
        up: number[];
        down: number[];
        within: number[];
    };
};

const errorResponse = (
    status: number,
    code: "BAD_REQUEST" | "VALIDATION_ERROR" | "SERVER_ERROR",
    message: string,
    details?: Record<string, unknown>
) =>
    NextResponse.json(
        {
            status: "ERROR",
            error: {
                code,
                message,
                ...(details ? { details } : {}),
            },
        },
        { status }
    );

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
    let parsedBody: unknown;
    try {
        parsedBody = await request.json();
    } catch (error) {
        return errorResponse(400, "BAD_REQUEST", "Invalid JSON payload");
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
                  event: (parsedBody as Record<string, unknown>).event,
                  targetXs: (parsedBody as Record<string, unknown>).targetXs,
              }
            : parsedBody;

    const parsed = requestSchema.safeParse(normalizedPayload);
    if (!parsed.success) {
        return errorResponse(400, "VALIDATION_ERROR", "Invalid request payload", {
            issues: parsed.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
    }

    const requestedHorizonBars = parsed.data.horizonBars;
    const requestedLookbackBars = parsed.data.lookbackBars;
    const effectiveHorizonBars = clampNumber(
        requestedHorizonBars,
        MIN_HORIZON_BARS,
        MAX_HORIZON_BARS
    );
    const safeLookbackBars = clampNumber(
        requestedLookbackBars,
        MIN_LOOKBACK_BARS,
        MAX_LOOKBACK_BARS
    );

    let wasClamped =
        effectiveHorizonBars !== requestedHorizonBars ||
        safeLookbackBars !== requestedLookbackBars;

    const rawTargetXs =
        normalizedPayload && typeof normalizedPayload === "object"
            ? (normalizedPayload as Record<string, unknown>).targetXs
            : undefined;

    let requestedTargetXs: number[] = [...DEFAULT_TARGET_XS];
    let effectiveTargetXs: number[] = [...DEFAULT_TARGET_XS];
    let wasTargetXsClamped = false;

    if (rawTargetXs !== undefined) {
        if (!Array.isArray(rawTargetXs)) {
            return errorResponse(
                400,
                "VALIDATION_ERROR",
                "targetXs must be an array"
            );
        }
        if (rawTargetXs.length < 1 || rawTargetXs.length > 25) {
            return errorResponse(
                400,
                "VALIDATION_ERROR",
                "targetXs must include 1 to 25 values"
            );
        }

        const filteredTargets = rawTargetXs.filter(
            (value): value is number =>
                typeof value === "number" &&
                Number.isFinite(value) &&
                Number.isInteger(value)
        );

        if (!filteredTargets.length) {
            return errorResponse(
                400,
                "VALIDATION_ERROR",
                "targetXs must include at least one valid integer"
            );
        }

        requestedTargetXs = [...filteredTargets];
        const clampedTargets = filteredTargets.map((value) => {
            const clamped = clampNumber(value, MIN_TARGET_X, MAX_TARGET_X);
            if (clamped !== value) {
                wasTargetXsClamped = true;
            }
            return clamped;
        });

        effectiveTargetXs = Array.from(new Set(clampedTargets)).sort(
            (a, b) => a - b
        );

        if (!effectiveTargetXs.length) {
            return errorResponse(
                400,
                "VALIDATION_ERROR",
                "targetXs must include at least one usable value"
            );
        }
    }

    const payload = {
        ...parsed.data,
        symbol: normalizeSymbol(parsed.data.symbol),
    };

    const requestedOutputsize =
        safeLookbackBars + effectiveHorizonBars + OUTPUT_PAD;
    const outputsize = Math.min(requestedOutputsize, TWELVEDATA_MAX_POINTS);
    const maxLookbackGivenClamp = Math.max(
        0,
        outputsize - effectiveHorizonBars - OUTPUT_PAD
    );
    const clampedLookbackBars = Math.min(
        safeLookbackBars,
        maxLookbackGivenClamp
    );

    const timeSeries = await fetchTimeSeries({
        symbol: payload.symbol,
        timeframe: payload.timeframe,
        outputsize,
    });

    if (!timeSeries.ok) {
        return errorResponse(502, "SERVER_ERROR", "Failed to fetch candles", {
            detail: timeSeries.error.message,
        });
    }

    const candles = timeSeries.candles;
    const entryIndex = candles.length - 2;
    if (entryIndex <= 0) {
        return errorResponse(
            502,
            "SERVER_ERROR",
            "Insufficient data to compute probabilities"
        );
    }

    const maxLookbackFromCandles = Math.max(
        0,
        candles.length - effectiveHorizonBars - 1
    );
    const effectiveLookbackBars = Math.min(
        clampedLookbackBars,
        Math.max(1, maxLookbackFromCandles)
    );
    if (effectiveLookbackBars < 1) {
        return errorResponse(
            502,
            "SERVER_ERROR",
            "Insufficient data to compute lookback window"
        );
    }

    if (effectiveLookbackBars !== requestedLookbackBars) {
        wasClamped = true;
    }

    const lookbackStart = entryIndex - effectiveLookbackBars;
    if (lookbackStart < 0) {
        return errorResponse(
            502,
            "SERVER_ERROR",
            "Insufficient data to compute lookback window"
        );
    }

    const closes = candles.map((candle) => candle.close);
    const maxStartIndex = entryIndex - effectiveHorizonBars;
    if (maxStartIndex < lookbackStart) {
        return errorResponse(
            502,
            "SERVER_ERROR",
            "Insufficient data to compute horizon window"
        );
    }

    const moves: number[] = [];
    for (let i = lookbackStart; i <= maxStartIndex; i += 1) {
        const movePrice = closes[i + effectiveHorizonBars] - closes[i];
        moves.push(scaleMoveToXUnits(movePrice, payload.symbol));
    }

    const sampleCount = moves.length;
    if (!sampleCount) {
        return errorResponse(
            502,
            "SERVER_ERROR",
            "Insufficient data to compute probabilities"
        );
    }

    const upCounts = Array(effectiveTargetXs.length).fill(0);
    const downCounts = Array(effectiveTargetXs.length).fill(0);
    const withinCounts = Array(effectiveTargetXs.length).fill(0);

    for (const move of moves) {
        for (let i = 0; i < effectiveTargetXs.length; i += 1) {
            const target = effectiveTargetXs[i];
            if (move >= target) {
                upCounts[i] += 1;
            }
            if (move <= -target) {
                downCounts[i] += 1;
            }
            if (Math.abs(move) <= target) {
                withinCounts[i] += 1;
            }
        }
    }

    const response: SurfaceResponse = {
        status: "OK",
        meta: {
            asOf: parseAsOf(candles[entryIndex].datetime),
            dataSource: "twelvedata",
            symbol: payload.symbol,
            timeframe: payload.timeframe,
            event: "end",
            requestedLookbackBars,
            effectiveLookbackBars,
            requestedHorizonBars,
            effectiveHorizonBars,
            requestedTargetXs,
            effectiveTargetXs,
            wasClamped,
            wasTargetXsClamped,
            sampleCount,
        },
        surface: {
            xs: effectiveTargetXs,
            up: upCounts.map((count) => count / sampleCount),
            down: downCounts.map((count) => count / sampleCount),
            within: withinCounts.map((count) => count / sampleCount),
        },
    };

    return NextResponse.json(response, {
        headers: {
            "Cache-Control": "s-maxage=15, stale-while-revalidate=60",
        },
    });
}
