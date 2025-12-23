'use server';

import type { SignInFormData, SignUpFormData } from "@/lib/types/auth";
import { headers } from "next/headers";
import { AppError } from "@/lib/server/auth/errors";
import { signIn } from "@/lib/server/auth/signIn";
import { signUp } from "@/lib/server/auth/signUp";

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
        const forwardedFor = requestHeaders.get("x-forwarded-for");
        const payload = await signUp(
            {
                email,
                password,
                fullName,
                country,
                investmentGoals,
                riskTolerance,
                preferredIndustry,
                turnstileToken,
            },
            forwardedFor ?? undefined,
        );

        return { ok: true, data: payload.data, debug: payload.debug };
    } catch (e) {
        if (e instanceof AppError) {
            return {
                ok: false,
                status: e.status,
                code: e.code,
                message: e.message,
                debug: e.details,
            };
        }
        if (e instanceof Response) {
            const parsed = await safeParseJson(e);
            return {
                ok: false,
                status: e.status,
                code: parsed?.code ?? parsed?.error ?? "internal_error",
                message: parsed?.message ?? "Unexpected server error",
                debug: parsed?.debug,
            };
        }
        console.error('Sign up failed', e)
        return { ok: false, status: 500, code: "internal_error", message: "Unexpected server error" }
    }
}

export const signInWithEmail = async ({ email, password, turnstileToken }: SignInFormData) => {
    try {
        const requestHeaders = await headers();
        const forwardedFor = requestHeaders.get("x-forwarded-for");
        const payload = await signIn({ email, password, turnstileToken }, forwardedFor ?? undefined);
        return { ok: true, data: payload.data };
    } catch (e) {
        if (e instanceof AppError) {
            return { ok: false, status: e.status, code: e.code, message: e.message, debug: e.details };
        }
        if (e instanceof Response) {
            const parsed = await safeParseJson(e);
            return {
                ok: false,
                status: e.status,
                code: parsed?.code ?? parsed?.error ?? "internal_error",
                message: parsed?.message ?? "Unexpected server error",
                debug: parsed?.debug,
            };
        }
        console.error('Sign in failed', e)
        return { ok: false, status: 500, code: "internal_error", message: "Unexpected server error" }
    }
}
