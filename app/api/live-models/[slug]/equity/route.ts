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

const DEFAULT_LIMIT = 2000;
const MIN_LIMIT = 1;
const MAX_LIMIT = 5000;

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

const parseLimit = (raw: string | null) => {
    if (!raw) {
        return DEFAULT_LIMIT;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_LIMIT;
    }
    return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, Math.floor(parsed)));
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

    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
    const { slug } = context.params;
    let query = supabasePublic
        .from("model_equity_points")
        .select("ts, equity")
        .eq("model_slug", slug);

    if (windowParam !== "all") {
        const cutoff = new Date(Date.now() - WINDOW_MS[windowParam]).toISOString();
        query = query.gte("ts", cutoff).order("ts", { ascending: true }).limit(limit);
    } else {
        query = query.order("ts", { ascending: false }).limit(limit);
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

    const rows = windowParam === "all" ? (data ?? []).slice().reverse() : data ?? [];
    const points = rows.map((row) => ({
        ts: new Date(row.ts).toISOString(),
        equity: Number(row.equity),
    }));

    return NextResponse.json({
        model_slug: slug,
        window: windowParam,
        limit,
        updated_at: new Date().toISOString(),
        points,
    });
}
