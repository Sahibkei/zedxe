import { z } from "zod";

import { auth } from "@/lib/better-auth/auth";
import { verifyTurnstile } from "@/lib/security/turnstile";
import type { SignInFormData } from "@/lib/types/auth";
import { AppError } from "@/lib/server/auth/errors";

const signInSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    turnstileToken: z.string().nullable().optional(),
});

export type SignInResult = {
    data: unknown;
};

export const signIn = async (payload: SignInFormData, ip?: string | null): Promise<SignInResult> => {
    const parsed = signInSchema.safeParse(payload);
    if (!parsed.success) {
        throw new AppError(400, "invalid_payload", "Invalid sign-in payload.", parsed.error.flatten());
    }

    const { email, password, turnstileToken } = parsed.data;
    const verification = await verifyTurnstile(turnstileToken ?? null, ip);
    if (!verification.ok) {
        const status = verification.code === "turnstile_misconfigured" ? 500 : 403;
        const message =
            verification.code === "turnstile_missing"
                ? "Verification is required."
                : verification.code === "turnstile_misconfigured"
                  ? "Verification service misconfigured."
                  : "Verification failed.";
        throw new AppError(status, verification.code ?? "turnstile_failed", message, {
            turnstileVerified: false,
            cfErrors: verification.cfErrors,
        });
    }

    const response = await auth.api.signInEmail({ body: { email, password } });
    if (response instanceof Response) {
        throw new AppError(500, "internal_error", "Unexpected server error");
    }
    if (!response || ("error" in response && response.error)) {
        const errorMessage = typeof response?.error === "string" ? response.error : "";
        const normalized = errorMessage.toLowerCase();
        const isInvalid =
            normalized.includes("invalid") || normalized.includes("credential") || normalized.includes("password");
        if (isInvalid) {
            throw new AppError(401, "auth_invalid_credentials", "Invalid email or password");
        }
        throw new AppError(500, "internal_error", "Unexpected server error");
    }

    return { data: response };
};
