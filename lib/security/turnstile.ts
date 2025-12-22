type TurnstileVerificationResult = {
    ok: boolean;
    code?: "turnstile_missing" | "turnstile_failed" | "turnstile_misconfigured";
    cfErrors?: string[];
};

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

const MISCONFIGURED_ERROR_CODES = new Set([
    "missing-input-secret",
    "invalid-input-secret",
    "invalid-or-missing-secret",
]);

const mapErrorCode = (errors?: string[]) => {
    if (!errors?.length) {
        return "turnstile_failed" as const;
    }
    const hasMisconfig = errors.some((code) => MISCONFIGURED_ERROR_CODES.has(code));
    return hasMisconfig ? "turnstile_misconfigured" : "turnstile_failed";
};

export const verifyTurnstile = async (
    token: string | null,
    remoteIp?: string | null,
): Promise<TurnstileVerificationResult> => {
    const secret = (process.env.TURNSTILE_SECRET_KEY || process.env.CF_TURNSTILE_SECRET_KEY || "").trim();

    if (!secret) {
        return { ok: false, code: "turnstile_misconfigured" };
    }

    if (!token) {
        return { ok: false, code: "turnstile_missing" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

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
            return { ok: false, code: "turnstile_failed", cfErrors: [`http_${response.status}`] };
        }

        const payload = (await response.json()) as TurnstileResponse;
        if (!payload.success) {
            const cfErrors = payload["error-codes"];
            console.error("Turnstile verification unsuccessful", cfErrors);
            return { ok: false, code: mapErrorCode(cfErrors), cfErrors };
        }

        return { ok: true };
    } catch (error) {
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        const cfErrors = isAbort ? ["verify_timeout"] : ["verify_error"];
        console.error("Turnstile verification error", error);
        return { ok: false, code: "turnstile_failed", cfErrors };
    } finally {
        clearTimeout(timeout);
    }
};
