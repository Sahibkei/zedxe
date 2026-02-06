import { NextResponse } from "next/server";

import { canonicalizeSymbol } from "@/src/lib/symbol";
import { finnhubProvider } from "@/src/server/market-data/finnhub-provider";

export const revalidate = 21600;

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ symbol: string }> },
) {
    const { symbol: rawSymbol } = await params;
    let symbol = "UNKNOWN";
    try {
        symbol = canonicalizeSymbol(rawSymbol);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Invalid symbol" },
            { status: 400 },
        );
    }

    try {
        const profile = await finnhubProvider.getProfile(symbol);
        return NextResponse.json(profile, {
            headers: {
                "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Profile unavailable" },
            { status: 503 },
        );
    }
}
