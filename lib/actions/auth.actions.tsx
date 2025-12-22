'use server';

import { auth } from "@/lib/better-auth/auth";
import type { SignInFormData, SignUpFormData } from "@/lib/types/auth";
import { headers } from "next/headers";

const safeParseJson = async (response: Response) => {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        return response.json();
    }
    const text = await response.text();
    return text ? { message: text } : null;
};

export const signUpWithEmail = async ({
    email,
    password,
    fullName,
    country,
    investmentGoals,
    riskTolerance,
    preferredIndustry,
    turnstileToken,
}: SignUpFormData) => {
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
                turnstileToken,
            }),
        });

        const payload = await safeParseJson(response);
        if (!response.ok) {
            return {
                success: false,
                error: payload?.code ?? payload?.error ?? "Sign up failed",
                status: response.status,
                message: payload?.message,
            };
        }

        return { success: true, data: payload?.data ?? payload };
    } catch (e) {
        console.error('Sign up failed', e)
        return { success: false, error: 'Sign up failed' }
    }
}

export const signInWithEmail = async ({ email, password, turnstileToken }: SignInFormData) => {
    try {
        const requestHeaders = await headers();
        const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
        const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
        const origin = requestHeaders.get("origin");
        const baseUrl = origin ?? (host ? `${protocol}://${host}` : "");
        const forwardedFor = requestHeaders.get("x-forwarded-for");

        if (!baseUrl) {
            throw new Error("Missing base URL for sign-in request");
        }

        const response = await fetch(`${baseUrl}/api/auth/sign-in`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
            },
            body: JSON.stringify({
                email,
                password,
                turnstileToken,
            }),
        });

        const payload = await safeParseJson(response);
        if (!response.ok) {
            return {
                success: false,
                error: payload?.code ?? payload?.error ?? "Sign in failed",
                status: response.status,
                message: payload?.message,
            };
        }

        return { success: true, data: payload?.data ?? payload }
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
