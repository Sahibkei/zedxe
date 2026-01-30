import { z } from "zod";

import { NextRequest, NextResponse } from "next/server";

import {
    barsPerDay,
    computeVolMomoAnalysis,
    fetchBinanceCandles,
    type VolMomoInterval,
    type VolMomoMode,
} from "@/lib/models/vol-momo";
import {
    buildVolMomoCacheKey,
    getCachedVolMomoAnalysis,
    setCachedVolMomoAnalysis,
} from "@/lib/models/vol-momo-cache";

const INTERVALS = ["5m", "15m", "1h", "4h", "1d"] as const;
const MODES = ["quantile", "sigma"] as const;

const DEFAULTS = {
    symbol: "BTC",
    interval: "1h" as VolMomoInterval,
    lookbackDays: 180,
    k: 20,
    bins: 6,
    minSamples: 25,
    mode: "quantile" as VolMomoMode,
    horizon: "5d",
};

const querySchema = z
    .object({
        symbol: z.string().optional(),
        interval: z.enum(INTERVALS).optional(),
        lookbackDays: z.coerce.number().int().optional(),
        k: z.coerce.number().int().optional(),
        bins: z.coerce.number().int().optional(),
        minSamples: z.coerce.number().int().optional(),
        mode: z.enum(MODES).optional(),
        horizon: z.string().optional(),
        hBars: z.coerce.number().int().optional(),
    })
    .strict();

const errorResponse = (
    status: number,
    code: "BAD_REQUEST" | "SERVER_ERROR" | "INSUFFICIENT_DATA",
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

const parseHorizonBars = (params: {
    horizon?: string;
    hBars?: number;
    interval: VolMomoInterval;
}) => {
    if (params.hBars && Number.isFinite(params.hBars)) {
        return Math.max(1, Math.floor(params.hBars));
    }
    const raw = params.horizon ?? DEFAULTS.horizon;
    const match = /^\s*(\d+(?:\.\d+)?)\s*d\s*$/i.exec(raw);
    const days = match ? Number(match[1]) : Number(raw);
    if (!Number.isFinite(days) || days <= 0) {
        return Math.max(1, Math.round(barsPerDay(params.interval)));
    }
    return Math.max(1, Math.round(days * barsPerDay(params.interval)));
};

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Handle Volatility × Momentum grid requests.
 * @param request - Incoming GET request.
 * @returns Vol-Momo analysis payload.
 */
export async function GET(request: NextRequest) {
    const paramsObject = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(paramsObject);
    if (!parsed.success) {
        return errorResponse(400, "BAD_REQUEST", "Invalid query parameters", {
            issues: parsed.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
    }

    const interval = parsed.data.interval ?? DEFAULTS.interval;
    const symbol = normalizeSymbol(parsed.data.symbol ?? DEFAULTS.symbol);
    const lookbackDays = Math.max(30, Math.min(365, parsed.data.lookbackDays ?? DEFAULTS.lookbackDays));
    const k = Math.max(2, Math.min(200, parsed.data.k ?? DEFAULTS.k));
    const bins = Math.max(3, Math.min(20, parsed.data.bins ?? DEFAULTS.bins));
    const minSamples = Math.max(5, Math.min(500, parsed.data.minSamples ?? DEFAULTS.minSamples));
    const mode = parsed.data.mode ?? DEFAULTS.mode;
    const hBars = parseHorizonBars({
        horizon: parsed.data.horizon,
        hBars: parsed.data.hBars,
        interval,
    });
    const lookbackBars = Math.round(lookbackDays * barsPerDay(interval));
    const requiredCandles = lookbackBars + k + hBars + 2;

    const cacheKey = buildVolMomoCacheKey([
        symbol,
        interval,
        lookbackDays,
        k,
        bins,
        minSamples,
        mode,
        hBars,
    ]);
    const cached = getCachedVolMomoAnalysis(cacheKey);
    if (cached) {
        return NextResponse.json({
            ...cached.response,
            meta: {
                ...cached.response.meta,
                cacheHit: true,
            },
        });
    }

    const endTime = Date.now();
    const extraDays = Math.ceil((k + hBars + 2) / barsPerDay(interval));
    const startTime = endTime - (lookbackDays + extraDays) * 24 * 60 * 60 * 1000;

    const candleResult = await fetchBinanceCandles({
        symbol: `${symbol}USDT`,
        interval,
        startTime,
        endTime,
        requiredCandles,
    });

    if (!candleResult.ok) {
        const status =
            candleResult.status === 429 || candleResult.status === 503 ? 503 : 502;
        return errorResponse(status, "SERVER_ERROR", "Failed to fetch candles", {
            details: candleResult.error,
            meta: candleResult.meta,
        });
    }

    const analysisResult = computeVolMomoAnalysis({
        candles: candleResult.candles,
        interval,
        lookbackDays,
        k,
        bins,
        minSamples,
        mode,
        hBars,
        symbol,
        source: "binance",
    });

    if (!analysisResult.ok) {
        return errorResponse(400, "INSUFFICIENT_DATA", analysisResult.error);
    }

    analysisResult.analysis.response.meta = {
        ...analysisResult.analysis.response.meta,
        cacheHit: false,
        candlesFetched: candleResult.meta.candlesFetched,
        requestsMade: candleResult.meta.requestsMade,
        fetchStartTime: candleResult.meta.startTime,
        fetchEndTime: candleResult.meta.endTime,
    };

    setCachedVolMomoAnalysis(cacheKey, analysisResult.analysis);

    return NextResponse.json(analysisResult.analysis.response);
}
