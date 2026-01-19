import { NextRequest } from "next/server";

import { PLANS, type Plan } from "@/lib/entitlements/plans";

const isPlan = (value: string | null | undefined): value is Plan =>
    value === "free" || value === "pro";

export const getPlanFromRequest = (req: NextRequest): Plan => {
    const forcedPlan = process.env.ZEDXE_FORCE_PLAN;
    if (isPlan(forcedPlan)) {
        return forcedPlan;
    }

    if (process.env.VERCEL_ENV !== "production") {
        const planParam = req.nextUrl.searchParams.get("plan");
        if (isPlan(planParam)) {
            return planParam;
        }
    }

    return PLANS[0];
};
