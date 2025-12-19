type SafeFetchOptions = {
    timeoutMs?: number;
    signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 10000;

const buildErrorMessage = (prefix: string, status: number, text: string) => {
    const snippet = text.slice(0, 200).replace(/\s+/g, ' ').trim();
    return `${prefix} (status ${status})${snippet ? `: ${snippet}` : ''}`;
};

export async function safeFetchJson<T>(url: string, init: RequestInit = {}, options: SafeFetchOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const signals = [init.signal, options.signal].filter(Boolean) as AbortSignal[];

    const abortHandler = () => controller.abort();
    signals.forEach((signal) => {
        if (signal.aborted) {
            controller.abort();
        } else {
            signal.addEventListener('abort', abortHandler);
        }
    });

    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        const text = await response.text();
        const contentType = response.headers.get('content-type') ?? '';

        if (!response.ok) {
            throw new Error(buildErrorMessage('Request failed', response.status, text));
        }

        if (!contentType.toLowerCase().includes('application/json')) {
            throw new Error(buildErrorMessage('Expected JSON response', response.status, text));
        }

        try {
            return JSON.parse(text) as T;
        } catch (error) {
            throw new Error(buildErrorMessage('Failed to parse JSON response', response.status, text));
        }
    } finally {
        clearTimeout(timeout);
        signals.forEach((signal) => signal.removeEventListener('abort', abortHandler));
    }
}
