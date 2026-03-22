import "server-only";

import { createHmac } from "node:crypto";
import { envServer } from "@/src/lib/env/server";

export type ZapiSignedPlanId = "free" | "plus" | "pro";
type ZapiPlanId = "public" | ZapiSignedPlanId | "scale";

type ZapiAuthStatusPayload = {
    authMode: string;
    subject: string;
    email?: string;
    displayName?: string;
    plan: ZapiPlanId;
    limits: {
        requestsPerHour: number;
        remainingThisHour: number;
        resetAt: string;
    };
    allowedRegimes: string[];
    features: string[];
};

export type ZapiAccessSnapshot = {
    configured: boolean;
    missingConfig: string[];
    token: string | null;
    requestPlan: ZapiSignedPlanId;
    status: ZapiAuthStatusPayload | null;
    error: string | null;
};

const DEFAULT_ISSUER = "zedxe";
const DEFAULT_AUDIENCE = "zapi-api";

type ZapiPlanDefaults = {
    requestsPerHour: number;
    allowedRegimes: string[];
    features: string[];
};

const PLAN_DEFAULTS: Record<ZapiSignedPlanId, ZapiPlanDefaults> = {
    free: {
        requestsPerHour: 100,
        allowedRegimes: ["sec_edgar"],
        features: ["US data only", "Last 5 years of history", "Rate-limited to protect overall app stability"],
    },
    plus: {
        requestsPerHour: 500,
        allowedRegimes: ["sec_edgar"],
        features: ["US data only", "Higher rate limit for recurring usage", "Excel plugin access path marked as coming soon"],
    },
    pro: {
        requestsPerHour: 2000,
        allowedRegimes: ["sec_edgar", "companies_house", "india_placeholder", "edinet"],
        features: ["Full API access", "Higher production rate limit", "Region unlocks follow live regime readiness"],
    },
};

function normalizeSignedPlan(value?: string | null): ZapiSignedPlanId {
    if (value === "plus" || value === "pro") {
        return value;
    }
    return "free";
}

function parseEmailList(value?: string): Set<string> {
    return new Set(
        (value ?? "")
            .split(",")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
    );
}

const DEFAULT_SIGNED_PLAN = normalizeSignedPlan(envServer.ZAPI_DEFAULT_SIGNED_PLAN);
const PLUS_EMAILS = parseEmailList(envServer.ZAPI_PLUS_EMAILS);
const PRO_EMAILS = parseEmailList(envServer.ZAPI_PRO_EMAILS);

function encodeBase64Url(input: string | Buffer): string {
    const value = typeof input === "string" ? Buffer.from(input) : input;
    return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function signSiteJwt(input: { sub: string; email?: string; name?: string; plan: ZapiSignedPlanId }): string | null {
    const secret = envServer.ZAPI_JWT_SECRET;
    if (!secret) {
        return null;
    }

    const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = encodeBase64Url(
        JSON.stringify({
            sub: input.sub,
            email: input.email,
            name: input.name,
            plan: input.plan,
            iss: envServer.ZAPI_JWT_ISSUER ?? DEFAULT_ISSUER,
            aud: envServer.ZAPI_JWT_AUDIENCE ?? DEFAULT_AUDIENCE,
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
        })
    );
    const signingInput = `${header}.${payload}`;
    const signature = encodeBase64Url(createHmac("sha256", secret).update(signingInput).digest());

    return `${signingInput}.${signature}`;
}

async function fetchAuthStatus(token: string): Promise<ZapiAuthStatusPayload> {
    if (!envServer.ZAPI_BASE_URL) {
        throw new Error("ZAPI_BASE_URL is not configured on the main site.");
    }

    const url = new URL("/v1/auth/status", envServer.ZAPI_BASE_URL);
    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
    });

    if (!response.ok) {
        let message = `${response.status} ${response.statusText}`;
        try {
            const payload = (await response.json()) as { message?: string };
            if (payload?.message) {
                message = payload.message;
            }
        } catch {
            // Keep HTTP fallback message.
        }
        throw new Error(message);
    }

    return (await response.json()) as ZapiAuthStatusPayload;
}

function resolveSignedPlan(user: { email?: string | null }): ZapiSignedPlanId {
    const email = user.email?.trim().toLowerCase();
    if (email && PRO_EMAILS.has(email)) {
        return "pro";
    }
    if (email && PLUS_EMAILS.has(email)) {
        return "plus";
    }
    return DEFAULT_SIGNED_PLAN;
}

export function getZapiPlanDefaults(plan: ZapiSignedPlanId): ZapiPlanDefaults {
    return PLAN_DEFAULTS[plan];
}

export async function getZapiAccessSnapshot(user: {
    id: string;
    email?: string | null;
    name?: string | null;
}): Promise<ZapiAccessSnapshot> {
    const missingConfig: string[] = [];

    if (!envServer.ZAPI_BASE_URL) {
        missingConfig.push("ZAPI_BASE_URL");
    }
    if (!envServer.ZAPI_JWT_SECRET) {
        missingConfig.push("ZAPI_JWT_SECRET");
    }

    const requestPlan = resolveSignedPlan(user);
    const token = signSiteJwt({
        sub: user.id,
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        plan: requestPlan,
    });

    if (missingConfig.length > 0 || !token) {
        return {
            configured: false,
            missingConfig,
            token: null,
            requestPlan,
            status: null,
            error: null,
        };
    }

    try {
        const status = await fetchAuthStatus(token);
        return {
            configured: true,
            missingConfig: [],
            token,
            requestPlan,
            status,
            error: null,
        };
    } catch (error) {
        return {
            configured: true,
            missingConfig: [],
            token,
            requestPlan,
            status: null,
            error: error instanceof Error ? error.message : "Unable to load Zapi access status.",
        };
    }
}
