import { z } from "zod";

import { NextRequest, NextResponse } from "next/server";

type ProbabilityEvent = "end" | "touch";

type ProbabilityRequest = {
    symbol: string;
    timeframe: string;
    horizon: number;
    lookback: number;
    targetX: number;
    event: ProbabilityEvent;
};

type ProbabilityResponse = {
    mode: "mock" | "service";
    as_of: string;
    symbol: string;
    timeframe: string;
    horizon: number;
    lookback: number;
    targetX: number;
    event: ProbabilityEvent;
    p_up_ge_x: number;
    p_dn_ge_x: number;
    p_within_pm_x: number;
    meta?: {
        note?: string;
    };
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_SYMBOLS = ["EURUSD", "XAUUSD", "US500"] as const;
const VALID_EVENTS = ["end", "touch"] as const;

const requestSchema = z.object({
    symbol: z.enum(VALID_SYMBOLS),
    timeframe: z.string().min(1),
    horizon: z.number().min(1),
    lookback: z.number().min(50),
    targetX: z.number().min(1),
    event: z.enum(VALID_EVENTS),
});

const serviceResponseSchema = z.object({
    as_of: z.string().optional(),
    p_up_ge_x: z.number(),
    p_dn_ge_x: z.number(),
    p_within_pm_x: z.number(),
    meta: z
        .object({
            note: z.string().optional(),
            source: z.string().optional(),
            version: z.string().optional(),
        })
        .strict()
        .optional(),
});

const clampProbability = (value: number, min = 0.01, max = 0.99) =>
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

const buildAsOf = () => new Date(Date.now() - 5 * 60 * 1000).toISOString();

const buildMockResponse = (
    request: ProbabilityRequest,
    note?: string
): ProbabilityResponse => {
    const seed = hashSeed(
        `${request.symbol}|${request.timeframe}|${request.horizon}|${request.lookback}|${request.event}`
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

    return {
        mode: "mock",
        as_of: buildAsOf(),
        symbol: request.symbol,
        timeframe: request.timeframe,
        horizon: request.horizon,
        lookback: request.lookback,
        targetX: request.targetX,
        event: request.event,
        p_up_ge_x: up,
        p_dn_ge_x: down,
        p_within_pm_x: within,
        meta: note ? { note } : undefined,
    };
};

export async function POST(request: NextRequest) {
    let body: ProbabilityRequest | undefined;

    try {
        const parsedBody = await request.json();
        const parsed = requestSchema.safeParse(parsedBody);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid request payload", where: "probability" },
                { status: 400 }
            );
        }
        body = parsed.data;
    } catch (error) {
        return NextResponse.json(
            { error: "Invalid JSON payload", where: "probability" },
            { status: 400 }
        );
    }

    try {
        const requestPayload = body;
        const { symbol, timeframe, horizon, lookback, targetX, event } =
            requestPayload;

        if (event === "touch") {
            const json = NextResponse.json(
                buildMockResponse(
                    requestPayload,
                    "Touch event not implemented yet"
                )
            );
            json.headers.set("Cache-Control", "no-store");
            return json;
        }

        const serviceUrl = process.env.PROB_SERVICE_URL;
        if (serviceUrl) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            try {
                const response = await fetch(
                    `${serviceUrl.replace(/\/$/, "")}/v1/probability/query`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(requestPayload),
                        signal: controller.signal,
                    }
                );

                if (!response.ok) {
                    throw new Error(`Service returned ${response.status}`);
                }

                const data = await response.json();
                const parsed = serviceResponseSchema.safeParse(data);
                if (!parsed.success) {
                    throw new Error("Service returned invalid payload");
                }

                const json = NextResponse.json({
                    mode: "service",
                    as_of: parsed.data.as_of ?? buildAsOf(),
                    symbol,
                    timeframe,
                    horizon,
                    lookback,
                    targetX,
                    event,
                    p_up_ge_x: parsed.data.p_up_ge_x,
                    p_dn_ge_x: parsed.data.p_dn_ge_x,
                    p_within_pm_x: parsed.data.p_within_pm_x,
                    meta: parsed.data.meta?.note
                        ? { note: parsed.data.meta.note }
                        : undefined,
                });
                json.headers.set("Cache-Control", "no-store");
                return json;
            } catch (error) {
                console.error("[probability] service failed", {
                    error: String(error),
                });
                const json = NextResponse.json(
                    buildMockResponse(
                        requestPayload,
                        "Service unavailable, showing mock"
                    )
                );
                json.headers.set("Cache-Control", "no-store");
                return json;
            } finally {
                clearTimeout(timeout);
            }
        }

        const json = NextResponse.json(
            buildMockResponse(requestPayload, "Mocked (no service configured)")
        );
        json.headers.set("Cache-Control", "no-store");
        return json;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("POST /api/probability/query error", error);
        const json = NextResponse.json(
            {
                error: "Failed to query probability",
                detail: message,
                where: "probability",
            },
            { status: 502 }
        );
        json.headers.set("Cache-Control", "no-store");
        return json;
    }
}
