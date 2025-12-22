'use server';

import { auth } from "@/lib/better-auth/auth";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import type { SignInFormData, SignUpFormData } from "@/lib/types/auth";
import { headers } from "next/headers";

export const signUpWithEmail = async ({ email, password, fullName, country, investmentGoals, riskTolerance, preferredIndustry }: SignUpFormData) => {
    try {
        const requestHeaders = await headers();
        const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
        const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
        const origin = requestHeaders.get("origin");
        const baseUrl = origin ?? (host ? `${protocol}://${host}` : "");
        const forwardedFor = requestHeaders.get("x-forwarded-for");

        if (!baseUrl) {
            throw new Error("Missing base URL for sign-up request");
        }

        const response = await fetch(`${baseUrl}/api/auth/sign-up`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
            },
            body: JSON.stringify({
                email,
                password,
                fullName,
                country,
                investmentGoals,
                riskTolerance,
                preferredIndustry,
            }),
        });

        const payload = await response.json();
        if (!response.ok) {
            return { success: false, error: payload?.error ?? "Sign up failed" };
        }

        return { success: true, data: payload?.data ?? payload };
    } catch (e) {
        console.error('Sign up failed', e)
        return { success: false, error: 'Sign up failed' }
    }
}

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
    try {
        const requestHeaders = await headers();
        const rateLimitResponse = await enforceRateLimit(
            new Request("https://local/signin", { headers: requestHeaders }),
            "signin",
        );
        if (rateLimitResponse) {
            return { success: false, error: "Too many requests" };
        }

        const response = await auth.api.signInEmail({ body: { email, password } })

        return { success: true, data: response }
    } catch (e) {
        console.error('Sign in failed', e)
        return { success: false, error: 'Sign in failed' }
    }
}

export const signOut = async () => {
    try {
        await auth.api.signOut({ headers: await headers() });
    } catch (e) {
        console.error('Sign out failed', e)
        return { success: false, error: 'Sign out failed' }
    }
}
