const COINGECKO_API_BASE =
    process.env.COINGECKO_API_BASE ?? "https://api.coingecko.com/api/v3";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

function getCoinGeckoHeaders(): HeadersInit {
    const headers: HeadersInit = {};

    if (!COINGECKO_API_KEY) return headers;

    const isProApi = COINGECKO_API_BASE.includes("pro-api.coingecko.com");

    if (isProApi) {
        // Pro plan
        headers["x-cg-pro-api-key"] = COINGECKO_API_KEY;
    } else {
        // Demo / public plan
        headers["x-cg-demo-api-key"] = COINGECKO_API_KEY;
    }

    return headers;
}

export async function coingeckoFetch<T>(
    path: string,
    searchParams?: Record<string, string | number | boolean | undefined>,
    options?: { revalidateSeconds?: number }
): Promise<T> {
    const url = new URL(path, COINGECKO_API_BASE);

    if (searchParams) {
        for (const [key, value] of Object.entries(searchParams)) {
            if (value !== undefined) {
                url.searchParams.set(key, String(value));
            }
        }
    }

    const isProApi = COINGECKO_API_BASE.includes("pro-api.coingecko.com");
    if (!isProApi && COINGECKO_API_KEY) {
        url.searchParams.set('x_cg_demo_api_key', COINGECKO_API_KEY);
    }

    const res = await fetch(url.toString(), {
        headers: getCoinGeckoHeaders(),
        next: { revalidate: options?.revalidateSeconds ?? 300 },
    });

    if (!res.ok) {
        // Log details for server logs, but throw a generic error to the page
        let body: unknown;
        try {
            body = await res.json();
        } catch {
            body = await res.text();
        }

        console.error("CoinGecko error", {
            url: url.toString(),
            status: res.status,
            statusText: res.statusText,
            body,
        });

        throw new Error('CoinGecko request failed');
    }

    return res.json() as Promise<T>;
}
