import { NextResponse } from "next/server";

import { getMockStockProfile } from "@/src/features/stock-profile-v2/contract/mock";

export const revalidate = 300;

export async function GET(
    request: Request,
    { params }: { params: { symbol: string } },
) {
    const symbol = params.symbol?.toUpperCase() ?? "UNKNOWN";
    const { searchParams } = new URL(request.url);
    const statement = searchParams.get("statement") ?? "income";
    const period = searchParams.get("period") ?? "annual";

    const profile = getMockStockProfile(symbol);
    const match = profile.financialStatements.find(
        (item) => item.statement === statement && item.period === period,
    );

    if (!match) {
        return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    return NextResponse.json(match, {
        headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
    });
}
