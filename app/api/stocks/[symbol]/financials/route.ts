import { NextResponse } from "next/server";

import { canonicalizeSymbol } from "@/src/lib/symbol";
import { finnhubProvider } from "@/src/server/market-data/finnhub-provider";

export const revalidate = 21600;

export async function GET(
    request: Request,
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
    const { searchParams } = new URL(request.url);
    const statementParam = searchParams.get("statement") ?? "income";
    const periodParam = searchParams.get("period") ?? "annual";
    const statement = ["income", "balance", "cashflow"].includes(statementParam)
        ? (statementParam as "income" | "balance" | "cashflow")
        : null;
    const period = ["annual", "quarter"].includes(periodParam)
        ? (periodParam as "annual" | "quarter")
        : null;

    if (!statement || !period) {
        return NextResponse.json(
            { error: "Invalid statement or period." },
            { status: 400 },
        );
    }

    try {
        const data = await finnhubProvider.getFinancialStatement(symbol, statement, period, 10);
        return NextResponse.json(data, {
            headers: {
                "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Statement not available" },
            { status: 503 },
        );
    }
}
