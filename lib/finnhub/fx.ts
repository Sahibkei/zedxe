import { fetchJSON } from '@/lib/actions/finnhub.actions';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

const rateCache = new Map<string, number>();

export async function getFxRate(from: string, to: string): Promise<number> {
    const base = from?.trim().toUpperCase();
    const quote = to?.trim().toUpperCase();

    if (!base || !quote) return 1;
    if (base === quote) return 1;

    const cacheKey = `${base}->${quote}`;
    if (rateCache.has(cacheKey)) {
        return rateCache.get(cacheKey) as number;
    }

    const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';
    if (!token) {
        console.warn('getFxRate: FINNHUB API key missing');
        return 1;
    }

    try {
        type FinnhubFxResponse = { base?: string; quote?: Record<string, number> };
        const url = `${FINNHUB_BASE_URL}/forex/rates?base=${encodeURIComponent(base)}&token=${token}`;
        const data = await fetchJSON<FinnhubFxResponse>(url, 600);
        const rate = data?.quote?.[quote];
        if (typeof rate === 'number' && rate > 0) {
            rateCache.set(cacheKey, rate);
            return rate;
        }
        console.warn(`getFxRate: missing quote for ${quote} using base ${base}`);
    } catch (error) {
        console.warn('getFxRate: error fetching rate', { from: base, to: quote, error });
    }

    return 1;
}
