import { NextRequest, NextResponse } from "next/server";

import { getEntitlements } from "@/lib/entitlements/rules";
import { getPlanFromRequest } from "@/lib/entitlements/resolvePlan";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
    const plan = getPlanFromRequest(request);
    const entitlements = getEntitlements(plan);

    return NextResponse.json({
        status: "OK",
        ...entitlements,
    });
}
