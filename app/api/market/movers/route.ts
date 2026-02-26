import { NextResponse } from "next/server";
import { getUsTopMovers, type MarketMoversPayload } from "@/lib/market/movers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; payload: MarketMoversPayload }>();

const parseCount = (rawCount: string | null) => {
    const parsed = Number(rawCount ?? "100");
    if (!Number.isFinite(parsed)) return 100;
    return Math.max(10, Math.min(250, Math.floor(parsed)));
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const count = parseCount(searchParams.get("count"));
    const cacheKey = `count:${count}`;

    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.payload);
    }

    try {
        const payload = await getUsTopMovers({ count });
        cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
        return NextResponse.json(payload);
    } catch (error) {
        console.error("[market/movers] fetch failed", error);
        if (cached?.payload) {
            return NextResponse.json(cached.payload);
        }
        return NextResponse.json(
            {
                updatedAt: new Date().toISOString(),
                source: "yahoo",
                gainers: [],
                losers: [],
            } satisfies MarketMoversPayload,
            { status: 502 }
        );
    }
}
