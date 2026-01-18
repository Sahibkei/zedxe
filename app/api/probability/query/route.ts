import { z } from "zod";

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

type ProbabilityEvent = "end" | "touch";

type ProbabilityRequest = {
    symbol: string;
    timeframe: string;
    horizonBars: number;
    lookbackBars: number;
    targetX: number;
    event: ProbabilityEvent;
};

type ProbabilityResponse = {
    meta: {
        symbol: string;
        timeframe: string;
        horizonBars: number;
        lookbackBars: number;
        requestedLookbackBars: number;
        availableBars: number;
        clampedLookback: boolean;
        targetX: number;
        event: ProbabilityEvent;
        as_of: string;
        source: "local";
        pip_size: number;
        point_size: number;
        note?: string;
    };
    prob: {
        up_ge_x: number;
        down_ge_x: number;
        within_pm_x: number;
    };
};

type OhlcBar = {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
};

class ProbabilityError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATA_DIR = path.join(process.cwd(), "data", "ohlc");
const DEFAULT_PIP_SIZE = 0.0001;
const DEFAULT_POINT_SIZE = 0.0001;
const EWMA_LAMBDA = 0.94;
const SIGMA_SCALE = 1.0;
const SYMBOL_REGEX = /^[A-Z0-9_]{2,15}$/;
const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"] as const;

const SYMBOL_META: Record<string, { pip_size: number; point_size: number }> = {
    EURUSD: { pip_size: 0.0001, point_size: 0.00001 },
    XAUUSD: { pip_size: 0.1, point_size: 0.01 },
};

const requestSchema = z
    .object({
        symbol: z.string().min(2).max(15).regex(SYMBOL_REGEX),
        timeframe: z.enum(TIMEFRAMES),
        horizonBars: z.coerce.number().int().min(1),
        lookbackBars: z.coerce.number().int().min(1),
        targetX: z.coerce.number().min(1),
        event: z.enum(["end", "touch"]),
    })
    .strict();

const clamp = (value: number, min = 0, max = 1) =>
    Math.min(max, Math.max(min, value));

/** Error function approximation for normal CDF. */
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

/** Standard normal cumulative distribution function. */
const normalCdf = (value: number) => 0.5 * (1 + erf(value / Math.SQRT2));

/** Normalize request payload shape for the probability computation. */
const normalizeRequest = (payload: unknown): ProbabilityRequest => {
    if (!payload || typeof payload !== "object") {
        throw new ProbabilityError("Invalid JSON payload", 400);
    }
    const data = payload as Record<string, unknown>;
    const rawSymbol =
        typeof data.symbol === "string" ? data.symbol.toUpperCase() : "";
    const rawTimeframe =
        typeof data.timeframe === "string" ? data.timeframe.toUpperCase() : "";
    const horizonBars =
        data.horizonBars ??
        data.horizon ??
        data.horizon_bars ??
        data.horizonBars;
    const lookbackBars =
        data.lookbackBars ??
        data.lookback ??
        data.lookback_bars ??
        data.lookbackBars;

    const parsed = requestSchema.safeParse({
        symbol: rawSymbol,
        timeframe: rawTimeframe,
        horizonBars,
        lookbackBars,
        targetX: data.targetX,
        event: data.event,
    });

    if (!parsed.success) {
        throw new ProbabilityError("Invalid request payload", 400);
    }

    return parsed.data;
};

/** Discover available symbol/timeframe datasets from local CSV files. */
const discoverDatasets = async (): Promise<
    Map<string, Set<string>>
> => {
    const result = new Map<string, Set<string>>();
    const files = await fs.readdir(DATA_DIR);
    for (const file of files) {
        const match = file.match(/^([A-Za-z0-9_]+)_([A-Za-z0-9]+)\.sample\.csv$/);
        if (!match) {
            continue;
        }
        const [, symbol, timeframe] = match;
        const normalizedSymbol = symbol.toUpperCase();
        const normalizedTimeframe = timeframe.toUpperCase();
        if (!result.has(normalizedSymbol)) {
            result.set(normalizedSymbol, new Set());
        }
        result.get(normalizedSymbol)?.add(normalizedTimeframe);
    }
    return result;
};

/** Validate that the requested symbol/timeframe is available locally. */
const ensureDatasetAvailable = async (
    symbol: string,
    timeframe: string
) => {
    const datasets = await discoverDatasets();
    const timeframes = datasets.get(symbol);
    if (!timeframes) {
        throw new ProbabilityError("Unknown symbol", 400);
    }
    if (timeframes.has(timeframe)) {
        return;
    }
    if (
        timeframes.has("M5") &&
        ["M15", "M30", "H1"].includes(timeframe)
    ) {
        return;
    }
    throw new ProbabilityError("symbol/timeframe not available", 400);
};

/** Parse OHLC rows from a CSV string and sort by timestamp. */
const parseCsv = (content: string): OhlcBar[] => {
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
        return [];
    }
    const header = lines[0].split(",").map((value) => value.trim());
    const indices = {
        timestamp: header.indexOf("timestamp"),
        open: header.indexOf("open"),
        high: header.indexOf("high"),
        low: header.indexOf("low"),
        close: header.indexOf("close"),
    };

    if (Object.values(indices).some((index) => index === -1)) {
        throw new ProbabilityError("CSV missing required columns", 500);
    }

    const rows: OhlcBar[] = [];

    for (const line of lines.slice(1)) {
        const parts = line.split(",");
        if (parts.length < header.length) {
            continue;
        }
        const timestamp = new Date(parts[indices.timestamp]);
        const open = Number(parts[indices.open]);
        const high = Number(parts[indices.high]);
        const low = Number(parts[indices.low]);
        const close = Number(parts[indices.close]);

        if (
            !Number.isFinite(open) ||
            !Number.isFinite(high) ||
            !Number.isFinite(low) ||
            !Number.isFinite(close) ||
            Number.isNaN(timestamp.getTime())
        ) {
            continue;
        }

        rows.push({ timestamp, open, high, low, close });
    }

    return rows.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
};

/** Resample M5 bars into higher timeframes using OHLC aggregation. */
const resampleBars = (bars: OhlcBar[], multiple: number): OhlcBar[] => {
    const output: OhlcBar[] = [];
    for (let i = 0; i + multiple <= bars.length; i += multiple) {
        const chunk = bars.slice(i, i + multiple);
        const open = chunk[0].open;
        const close = chunk[chunk.length - 1].close;
        const high = Math.max(...chunk.map((bar) => bar.high));
        const low = Math.min(...chunk.map((bar) => bar.low));
        const timestamp = chunk[chunk.length - 1].timestamp;
        output.push({ timestamp, open, high, low, close });
    }
    return output;
};

/** Load OHLC data from local CSVs, optionally resampling from M5. */
const loadOhlcData = async (
    symbol: string,
    timeframe: string
): Promise<{ bars: OhlcBar[]; derivedFrom?: string }> => {
    const fileName = `${symbol}_${timeframe}.sample.csv`;
    const filePath = path.join(DATA_DIR, fileName);

    try {
        const content = await fs.readFile(filePath, "utf8");
        const bars = parseCsv(content);
        return { bars };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }

    const timeframeMultipliers: Record<string, number> = {
        M15: 3,
        M30: 6,
        H1: 12,
    };

    const multiple = timeframeMultipliers[timeframe];
    if (!multiple) {
        throw new ProbabilityError("symbol/timeframe not available", 404);
    }

    const baseFile = path.join(DATA_DIR, `${symbol}_M5.sample.csv`);
    try {
        const baseContent = await fs.readFile(baseFile, "utf8");
        const baseBars = parseCsv(baseContent);
        const bars = resampleBars(baseBars, multiple);
        return { bars, derivedFrom: "M5" };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new ProbabilityError("symbol/timeframe not available", 404);
        }
        throw error;
    }
};

/** Compute EWMA variance over a return series. */
const computeEwmaVariance = (returns: number[]) => {
    let variance = returns[0] * returns[0];
    for (const value of returns.slice(1)) {
        variance = EWMA_LAMBDA * variance + (1 - EWMA_LAMBDA) * value * value;
    }
    return variance;
};

/**
 * GET handler to describe the POST-only probability endpoint.
 */
export async function GET() {
    return NextResponse.json({
        message: "POST required for probability queries.",
        example: {
            symbol: "EURUSD",
            timeframe: "M15",
            horizonBars: 48,
            lookbackBars: 500,
            targetX: 20,
            event: "end",
        },
    });
}

/**
 * POST handler for END-event probability queries.
 * Computes probabilities from local CSV OHLC data.
 */
export async function POST(request: NextRequest) {
    try {
        let rawPayload: unknown;
        try {
            rawPayload = await request.json();
        } catch (error) {
            throw new ProbabilityError("invalid JSON", 400);
        }
        const body = normalizeRequest(rawPayload);

        if (body.event === "touch") {
            throw new ProbabilityError("touch event not supported", 400);
        }

        await ensureDatasetAvailable(body.symbol, body.timeframe);

        const { bars, derivedFrom } = await loadOhlcData(
            body.symbol,
            body.timeframe
        );

        const entryIndex = bars.length - 2;
        const entry = bars[entryIndex];
        if (bars.length < 23) {
            throw new ProbabilityError("insufficient data length", 422);
        }
        const requestedLookbackBars = body.lookbackBars;
        const maxLookback = Math.max(20, bars.length - 3);
        const lookbackBars = Math.min(requestedLookbackBars, maxLookback);
        const clampedLookback = requestedLookbackBars > lookbackBars;
        const startIndex = entryIndex - lookbackBars;
        const window = bars.slice(startIndex, entryIndex + 1);
        const returns: number[] = [];
        for (let i = 1; i < window.length; i += 1) {
            returns.push(Math.log(window[i].close / window[i - 1].close));
        }

        if (returns.length === 0) {
            throw new ProbabilityError("insufficient return series", 422);
        }

        const variance = computeEwmaVariance(returns);
        const sigma1 = Math.sqrt(variance);
        const sigmaH = sigma1 * Math.sqrt(body.horizonBars) * SIGMA_SCALE;
        if (!Number.isFinite(sigmaH) || sigmaH <= 0) {
            throw new ProbabilityError("invalid volatility", 422);
        }

        const symbolMeta = SYMBOL_META[body.symbol];
        const pipSize = symbolMeta?.pip_size ?? DEFAULT_PIP_SIZE;
        const pointSize = symbolMeta?.point_size ?? DEFAULT_POINT_SIZE;
        const delta = body.targetX * pipSize;
        const rUp = Math.log((entry.close + delta) / entry.close);
        const pUp = clamp(1 - normalCdf(rUp / sigmaH));
        let pDown = 0;
        if (entry.close > delta) {
            const rDown = Math.log((entry.close - delta) / entry.close);
            pDown = clamp(normalCdf(rDown / sigmaH));
        }
        const pWithin = clamp(1 - pUp - pDown);
        const notes: string[] = [];
        if (derivedFrom) {
            notes.push(`Derived from ${derivedFrom} bars`);
        }
        if (!symbolMeta) {
            notes.push("Unknown symbol; using default pip/point sizes");
        }

        const response: ProbabilityResponse = {
            meta: {
                symbol: body.symbol,
                timeframe: body.timeframe,
                horizonBars: body.horizonBars,
                lookbackBars,
                requestedLookbackBars,
                availableBars: bars.length,
                clampedLookback,
                targetX: body.targetX,
                event: body.event,
                as_of: entry.timestamp.toISOString(),
                source: "local",
                pip_size: pipSize,
                point_size: pointSize,
                note: notes.length > 0 ? notes.join(". ") : undefined,
            },
            prob: {
                up_ge_x: pUp,
                down_ge_x: pDown,
                within_pm_x: pWithin,
            },
        };

        const json = NextResponse.json(response);
        json.headers.set("Cache-Control", "no-store");
        return json;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const status =
            error instanceof ProbabilityError ? error.status : 500;
        const json = NextResponse.json(
            {
                error: "Failed to query probability",
                detail: message,
                where: "probability",
            },
            { status }
        );
        json.headers.set("Cache-Control", "no-store");
        return json;
    }
}
