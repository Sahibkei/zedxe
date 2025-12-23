type TurnstileVerificationResult =
    | { ok: true }
    | { ok: false; code: "turnstile_missing" | "turnstile_failed" | "turnstile_misconfigured"; cfErrors?: string[] };

type TurnstileResponse = {
    success: boolean;
    "error-codes"?: string[];
};

const isValidIp = (value: string) => {
    const ipv4 =
        /^(25[0-5]|2[0-4]\d|1?\d{1,2})(\.(25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/;
    const ipv6 =
        /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|([0-9a-fA-F]{1,4}:){1,7}:|:([0-9a-fA-F]{1,4}:){1,7})$/;
    return ipv4.test(value) || ipv6.test(value);
};

export const getTurnstileIp = (req: Request): string | null => {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const parsed = forwardedFor.split(",")[0]?.trim();
        if (parsed && isValidIp(parsed)) return parsed;
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp && isValidIp(realIp.trim())) return realIp.trim();

    return null;
};

export const verifyTurnstileToken = async (
    token: string | null,
    remoteIp?: string | null,
): Promise<TurnstileVerificationResult> => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    const isDevelopment = process.env.NODE_ENV === "development";
    const rawTimeout = Number(process.env.TURNSTILE_TIMEOUT_MS);
    const timeoutMs = Number.isFinite(rawTimeout)
        ? Math.min(5000, Math.max(3000, rawTimeout))
        : 4000;

    if (!secret) {
        if (isDevelopment) return { ok: true };
        return { ok: false, code: "turnstile_misconfigured" };
    }

    if (!token) {
        return { ok: false, code: "turnstile_missing" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const body = new URLSearchParams();
        body.append("secret", secret);
        body.append("response", token);
        if (remoteIp && isValidIp(remoteIp)) {
            body.append("remoteip", remoteIp);
        }

        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
            signal: controller.signal,
        });

        if (!response.ok) {
            console.error("Turnstile verification failed", response.status);
            return { ok: false, code: "turnstile_failed" };
        }

        const payload = (await response.json()) as TurnstileResponse;
        if (!payload.success) {
            const cfErrors = payload["error-codes"];
            const normalized = cfErrors?.map((error) => error.toLowerCase()) ?? [];
            if (normalized.includes("missing-input-secret") || normalized.includes("invalid-input-secret")) {
                console.error("Turnstile misconfigured", cfErrors);
                return { ok: false, code: "turnstile_misconfigured", cfErrors };
            }
            if (normalized.includes("missing-input-response")) {
                console.error("Turnstile missing response", cfErrors);
                return { ok: false, code: "turnstile_missing", cfErrors };
            }
            console.error("Turnstile verification unsuccessful", cfErrors);
            return { ok: false, code: "turnstile_failed", cfErrors };
        }

        return { ok: true };
    } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") {
            console.error("Turnstile verification timeout");
            return { ok: false, code: "turnstile_failed", cfErrors: ["timeout"] };
        }
        console.error("Turnstile verification error", error);
        return { ok: false, code: "turnstile_failed" };
    } finally {
        clearTimeout(timeout);
    }
};
