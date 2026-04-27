import "server-only";

import { envServer } from "@/src/lib/env/server";
import type { ZapiSignedPlanId } from "@/lib/zapi/account";

export type ZapiBillingLinks = {
    plusCheckoutUrl: string | null;
    proCheckoutUrl: string | null;
};

export function normalizeBillingPlan(value?: string | null): ZapiSignedPlanId {
    if (value === "plus" || value === "pro") {
        return value;
    }
    return "free";
}

export function getZapiBillingLinks(): ZapiBillingLinks {
    return {
        plusCheckoutUrl: envServer.ZAPI_PLUS_CHECKOUT_URL ?? null,
        proCheckoutUrl: envServer.ZAPI_PRO_CHECKOUT_URL ?? null,
    };
}

export function getZapiCheckoutUrl(plan: ZapiSignedPlanId): string | null {
    if (plan === "plus") {
        return envServer.ZAPI_PLUS_CHECKOUT_URL ?? null;
    }
    if (plan === "pro") {
        return envServer.ZAPI_PRO_CHECKOUT_URL ?? null;
    }
    return null;
}

export function compareBillingPlan(left: ZapiSignedPlanId, right: ZapiSignedPlanId): number {
    const rank: Record<ZapiSignedPlanId, number> = {
        free: 0,
        plus: 1,
        pro: 2,
    };

    return rank[left] - rank[right];
}
