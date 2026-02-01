export type FetchRetryOptions = {
    timeoutMs?: number;
    retries?: number;
    backoffBaseMs?: number;
};

type FetchJsonResult<T> =
    | { ok: true; data: T; status: number; headers: Headers }
    | { ok: false; error: string; status?: number };

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeoutSignal = (timeoutMs: number, baseSignal?: AbortSignal) => {
    if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
        const timeoutSignal = AbortSignal.timeout(timeoutMs);
        if (!baseSignal) {
            return { signal: timeoutSignal, cleanup: () => undefined };
        }
        const controller = new AbortController();
        const abort = () => controller.abort();
        baseSignal.addEventListener("abort", abort);
        timeoutSignal.addEventListener("abort", abort);
        return {
            signal: controller.signal,
            cleanup: () => {
                baseSignal.removeEventListener("abort", abort);
                timeoutSignal.removeEventListener("abort", abort);
            },
        };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abort = () => controller.abort();
    if (baseSignal) {
        baseSignal.addEventListener("abort", abort);
    }
    return {
        signal: controller.signal,
        cleanup: () => {
            clearTimeout(timeout);
            if (baseSignal) {
                baseSignal.removeEventListener("abort", abort);
            }
        },
    };
};

const isRetryableStatus = (status: number) =>
    status === 429 || status === 502 || status === 503 || status === 504;

const computeBackoffMs = (attempt: number, base: number) => {
    const jitter = Math.random() * 0.2 + 0.9;
    return Math.round(base * 2 ** attempt * jitter);
};

const parseRetryAfterMs = (headers: Headers) => {
    const retryAfter = headers.get("retry-after");
    if (!retryAfter) return null;
    const parsed = Number(retryAfter);
    if (Number.isFinite(parsed)) {
        return parsed * 1000;
    }
    const date = new Date(retryAfter);
    if (!Number.isNaN(date.getTime())) {
        return Math.max(0, date.getTime() - Date.now());
    }
    return null;
};

/**
 * Fetch JSON with timeout and retry/backoff support.
 * @param url - Request URL.
 * @param init - Fetch init options.
 * @param options - Timeout and retry configuration.
 * @returns Parsed JSON response or error details.
 */
export const fetchJsonWithTimeout = async <T>(
    url: string,
    init: RequestInit = {},
    options: FetchRetryOptions = {}
): Promise<FetchJsonResult<T>> => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retries = options.retries ?? DEFAULT_RETRIES;
    const backoffBaseMs = options.backoffBaseMs ?? DEFAULT_BACKOFF_MS;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const { signal, cleanup } = withTimeoutSignal(timeoutMs, init.signal);
        try {
            const response = await fetch(url, { ...init, signal });
            if (!response.ok) {
                if (isRetryableStatus(response.status) && attempt < retries) {
                    const retryAfterMs = parseRetryAfterMs(response.headers);
                    const delayMs = retryAfterMs ?? computeBackoffMs(attempt, backoffBaseMs);
                    await sleep(delayMs);
                    continue;
                }
                return {
                    ok: false,
                    error: `HTTP ${response.status}`,
                    status: response.status,
                };
            }
            const data = (await response.json()) as T;
            return { ok: true, data, status: response.status, headers: response.headers };
        } catch (error) {
            if (attempt < retries) {
                const delayMs = computeBackoffMs(attempt, backoffBaseMs);
                await sleep(delayMs);
                continue;
            }
            return {
                ok: false,
                error: `Fetch error: ${String(error)}`,
            };
        } finally {
            cleanup();
        }
    }

    return { ok: false, error: "Failed to fetch JSON." };
};

/**
 * Sleep for a specified duration.
 * @param ms - Milliseconds to wait.
 * @returns Promise that resolves after the delay.
 */
export const delay = async (ms: number) => sleep(ms);
