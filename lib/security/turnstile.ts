type TurnstileVerificationResult = {
    ok: boolean;
    error?: string;
};

type TurnstileResponse = {
    success: boolean;
    "error-codes"?: string[];
};

export const getTurnstileIp = (req: Request): string | null => {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const parsed = forwardedFor.split(",")[0]?.trim();
        if (parsed) return parsed;
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    return null;
};

export const verifyTurnstileToken = async (
    token: string | null,
    remoteIp?: string | null,
): Promise<TurnstileVerificationResult> => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    const isProduction = process.env.NODE_ENV === "production";

    if (!secret) {
        if (!isProduction) return { ok: true };
        return { ok: false, error: "Turnstile misconfigured" };
    }

    if (!token) {
        return { ok: false, error: "Missing Turnstile token" };
    }

    try {
        const body = new URLSearchParams();
        body.append("secret", secret);
        body.append("response", token);
        if (remoteIp) {
            body.append("remoteip", remoteIp);
        }

        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });

        if (!response.ok) {
            console.error("Turnstile verification failed", response.status);
            return { ok: false, error: "Turnstile verification failed" };
        }

        const payload = (await response.json()) as TurnstileResponse;
        if (!payload.success) {
            console.error("Turnstile verification unsuccessful", payload["error-codes"]);
            return { ok: false, error: "Human verification failed" };
        }

        return { ok: true };
    } catch (error) {
        console.error("Turnstile verification error", error);
        return { ok: false, error: "Turnstile verification failed" };
    }
};
