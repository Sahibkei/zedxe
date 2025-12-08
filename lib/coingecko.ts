const COINGECKO_API_BASE = process.env.COINGECKO_API_BASE ?? "https://api.coingecko.com/api/v3";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

export async function coingeckoFetch<T>(
    path: string,
    searchParams?: Record<string, string | number | undefined>,
    options?: { revalidateSeconds?: number }
): Promise<T> {
    const baseUrl = COINGECKO_API_BASE;
    const url = new URL(path, baseUrl);

    if (searchParams) {
        for (const [key, value] of Object.entries(searchParams)) {
            if (value !== undefined) {
                url.searchParams.set(key, String(value));
            }
        }
    }

    const headers: HeadersInit = {};
    if (COINGECKO_API_KEY) {
        headers["x-cg-pro-api-key"] = COINGECKO_API_KEY;
    }

    const res = await fetch(url.toString(), {
        headers,
        next: { revalidate: options?.revalidateSeconds ?? 300 },
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`CoinGecko error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
}
