import { z } from "zod";

import { auth } from "@/lib/better-auth/auth";
import { inngest } from "@/lib/inngest/client";
import { verifyTurnstile } from "@/lib/security/turnstile";
import type { SignUpFormData } from "@/lib/types/auth";
import { AppError } from "@/lib/server/auth/errors";

const signUpSchema = z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    country: z.string().optional(),
    investmentGoals: z.string().optional(),
    riskTolerance: z.string().optional(),
    preferredIndustry: z.string().optional(),
    turnstileToken: z.string().nullable().optional(),
});

const isDuplicateError = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const anyError = error as { code?: unknown; name?: unknown; message?: unknown };
    const code = typeof anyError.code === "string" || typeof anyError.code === "number" ? String(anyError.code) : "";
    const name = typeof anyError.name === "string" ? anyError.name : "";
    const message = typeof anyError.message === "string" ? anyError.message : "";

    if (code === "11000") return true;
    if (name === "MongoServerError" && message.includes("E11000")) return true;
    if (code === "P2002") return true;
    return message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique");
};

export type SignUpResult = {
    data: unknown;
    debug?: {
        turnstileVerified: boolean;
        cfErrors?: string[];
    };
};

export const signUp = async (payload: SignUpFormData, ip?: string | null): Promise<SignUpResult> => {
    const parsed = signUpSchema.safeParse(payload);
    if (!parsed.success) {
        throw new AppError(400, "invalid_payload", "Invalid sign-up payload.", {
            turnstileVerified: false,
            validation: parsed.error.flatten(),
        });
    }

    const {
        email,
        password,
        fullName,
        country,
        investmentGoals,
        riskTolerance,
        preferredIndustry,
        turnstileToken,
    } = parsed.data;

    const verification = await verifyTurnstile(turnstileToken ?? null, ip);
    const debugInfo = {
        turnstileVerified: verification.ok,
        cfErrors: verification.cfErrors,
    };
    if (!verification.ok) {
        const status = verification.code === "turnstile_misconfigured" ? 500 : 403;
        const message =
            verification.code === "turnstile_missing"
                ? "Verification is required."
                : verification.code === "turnstile_misconfigured"
                  ? "Verification service misconfigured."
                  : "Verification failed.";
        throw new AppError(status, verification.code ?? "turnstile_failed", message, {
            ...debugInfo,
        });
    }

    try {
        const response = await auth.api.signUpEmail({
            body: { email, password, name: fullName },
        });
        if (response instanceof Response) {
            throw new AppError(500, "internal_error", "Unexpected server error");
        }
        if (!response?.user || ("error" in response && response.error)) {
            const rawError = response?.error;
            const structuredCode =
                typeof rawError === "object" && rawError && "code" in rawError
                    ? (rawError as { code?: string }).code
                    : undefined;
            const errorMessage = typeof rawError === "string" ? rawError : "";
            const normalized = errorMessage.toLowerCase();
            const isEmailTaken =
                structuredCode === "USER_ALREADY_EXISTS" ||
                normalized.includes("exist") ||
                normalized.includes("taken");
            if (isEmailTaken) {
                throw new AppError(409, "email_taken", "Email already in use", debugInfo);
            }
            throw new AppError(500, "internal_error", "Unexpected server error", debugInfo);
        }

        await inngest.send({
            name: "app/user.created",
            data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry },
        });

        const result: SignUpResult = { data: response };
        if (process.env.NODE_ENV !== "production") {
            result.debug = debugInfo;
        }
        return result;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        if (isDuplicateError(error)) {
            throw new AppError(409, "email_taken", "Email already in use", debugInfo);
        }
        throw new AppError(500, "internal_error", "Unexpected server error", {
            ...debugInfo,
            errName: error instanceof Error ? error.name : undefined,
            errMessage: error instanceof Error ? error.message : undefined,
        });
    }
};
