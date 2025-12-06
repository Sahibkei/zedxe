import { fetchJSON } from '@/lib/actions/finnhub.actions';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

const rateCache = new Map<string, { rate: number; fetchedAt: number }>();

const FX_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const normalize = (value?: string) => value?.trim().toUpperCase() || '';

const getCachedRate = (key: string) => {
    const cached = rateCache.get(key);
    if (!cached) return null;
    const isFresh = Date.now() - cached.fetchedAt < FX_CACHE_TTL_MS;
    return isFresh ? cached.rate : null;
};

const setCachedRate = (key: string, rate: number) => {
    rateCache.set(key, { rate, fetchedAt: Date.now() });
};

export async function getFxRateLatest(from: string, to: string): Promise<number> {
    const base = normalize(from);
    const quote = normalize(to);

    if (!base || !quote) return 1;
    if (base === quote) return 1;

    const cacheKey = `${base}->${quote}`;
    const cached = getCachedRate(cacheKey);
    if (cached) return cached;

    const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';
    if (!token) {
        console.warn('getFxRateLatest: FINNHUB API key missing');
        return 1;
    }

    try {
        type FinnhubFxResponse = { base?: string; quote?: Record<string, number> };
        const url = `${FINNHUB_BASE_URL}/forex/rates?base=${encodeURIComponent(base)}&token=${token}`;
        const data = await fetchJSON<FinnhubFxResponse>(url, 60);
        const rate = data?.quote?.[quote];
        if (typeof rate === 'number' && rate > 0) {
            setCachedRate(cacheKey, rate);
            return rate;
        }
        console.warn(`getFxRateLatest: missing quote for ${quote} using base ${base}`);
    } catch (error) {
        console.warn('getFxRateLatest: error fetching rate', { from: base, to: quote, error });
    }

    return 1;
}

export async function getFxRate(from: string, to: string): Promise<number> {
    return getFxRateLatest(from, to);
}
