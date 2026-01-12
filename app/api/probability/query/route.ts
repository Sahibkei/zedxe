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

const VALID_SYMBOLS = new Set(["EURUSD", "XAUUSD", "US500"]);
const VALID_EVENTS = new Set<ProbabilityEvent>(["end", "touch"]);

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

const parseNumber = (value: unknown) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

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
        body = (await request.json()) as ProbabilityRequest;
    } catch (error) {
        return NextResponse.json(
            { error: "Invalid JSON payload", where: "probability" },
            { status: 400 }
        );
    }

    try {
        const symbol = typeof body?.symbol === "string" ? body.symbol : "";
        const timeframe =
            typeof body?.timeframe === "string" ? body.timeframe : "";
        const horizon = parseNumber(body?.horizon);
        const lookback = parseNumber(body?.lookback);
        const targetX = parseNumber(body?.targetX);
        const event =
            typeof body?.event === "string"
                ? (body.event as ProbabilityEvent)
                : null;

        if (!symbol || !VALID_SYMBOLS.has(symbol)) {
            return NextResponse.json(
                { error: "symbol is required", where: "probability" },
                { status: 400 }
            );
        }

        if (!timeframe) {
            return NextResponse.json(
                { error: "timeframe is required", where: "probability" },
                { status: 400 }
            );
        }

        if (horizon === null || horizon < 1) {
            return NextResponse.json(
                { error: "horizon must be >= 1", where: "probability" },
                { status: 400 }
            );
        }

        if (lookback === null || lookback < 50) {
            return NextResponse.json(
                { error: "lookback must be >= 50", where: "probability" },
                { status: 400 }
            );
        }

        if (targetX === null || targetX < 1) {
            return NextResponse.json(
                { error: "targetX must be >= 1", where: "probability" },
                { status: 400 }
            );
        }

        if (!event || !VALID_EVENTS.has(event)) {
            return NextResponse.json(
                { error: "event must be end or touch", where: "probability" },
                { status: 400 }
            );
        }

        const requestPayload: ProbabilityRequest = {
            symbol,
            timeframe,
            horizon,
            lookback,
            targetX,
            event,
        };

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

                const data = (await response.json()) as Partial<ProbabilityResponse>;

                if (
                    !isFiniteNumber(data.p_up_ge_x) ||
                    !isFiniteNumber(data.p_dn_ge_x) ||
                    !isFiniteNumber(data.p_within_pm_x)
                ) {
                    throw new Error("Service returned invalid payload");
                }

                const json = NextResponse.json({
                    mode: "service",
                    as_of:
                        typeof data.as_of === "string"
                            ? data.as_of
                            : buildAsOf(),
                    symbol,
                    timeframe,
                    horizon,
                    lookback,
                    targetX,
                    event,
                    p_up_ge_x: data.p_up_ge_x,
                    p_dn_ge_x: data.p_dn_ge_x,
                    p_within_pm_x: data.p_within_pm_x,
                    meta: data.meta,
                });
                json.headers.set("Cache-Control", "no-store");
                return json;
            } catch (error) {
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
