import { NextResponse } from "next/server";

import { canonicalizeSymbol } from "@/src/lib/symbol";
import { finnhubProvider } from "@/src/server/market-data/finnhub-provider";

export const revalidate = 5;

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
        const quote = await finnhubProvider.getQuote(symbol);
        return NextResponse.json(quote, {
            headers: {
                "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Quote unavailable" },
            { status: 503 },
        );
    }
}
