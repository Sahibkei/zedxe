import { NextRequest, NextResponse } from "next/server";

import { supabasePublic } from "@/lib/supabasePublic";

const WINDOW_OPTIONS = ["24h", "72h", "7d", "30d", "all"] as const;

type WindowOption = (typeof WINDOW_OPTIONS)[number];

const WINDOW_MS: Record<Exclude<WindowOption, "all">, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "72h": 72 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const parseWindow = (raw: string | null): WindowOption | null => {
    if (!raw) {
        return "72h";
    }
    if (WINDOW_OPTIONS.includes(raw as WindowOption)) {
        return raw as WindowOption;
    }
    return null;
};

export async function GET(
    request: NextRequest,
    context: { params: { slug: string } }
) {
    const windowParam = parseWindow(request.nextUrl.searchParams.get("window"));
    if (!windowParam) {
        return NextResponse.json(
            {
                error: "Invalid window parameter",
                allowed: WINDOW_OPTIONS,
            },
            { status: 400 }
        );
    }

    const { slug } = context.params;
    let query = supabasePublic
        .from("model_equity_points")
        .select("ts, equity")
        .eq("model_slug", slug)
        .order("ts", { ascending: true });

    if (windowParam !== "all") {
        const cutoff = new Date(Date.now() - WINDOW_MS[windowParam]).toISOString();
        query = query.gte("ts", cutoff);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json(
            {
                error: "Failed to load equity points",
            },
            { status: 500 }
        );
    }

    const points = (data ?? []).map((row) => ({
        ts: new Date(row.ts).toISOString(),
        equity: Number(row.equity),
    }));

    return NextResponse.json({
        model_slug: slug,
        window: windowParam,
        updated_at: new Date().toISOString(),
        points,
    });
}
