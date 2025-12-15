import 'server-only';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export type FinnhubFinancialReport = {
    accessNumber?: string;
    symbol?: string;
    cik?: string;
    year?: number;
    quarter?: number;
    form?: string;
    startDate?: string;
    endDate?: string;
    filedDate?: string;
    acceptedDate?: string;
    report?: {
        ic?: FinnhubReportedItem[];
        bs?: FinnhubReportedItem[];
        cf?: FinnhubReportedItem[];
    };
    currency?: string;
};

export type FinnhubReportedItem = {
    concept?: string;
    label?: string;
    unit?: string;
    value?: number;
};

export type FinnhubFinancialsReportedResponse = {
    data?: FinnhubFinancialReport[];
};

export type FinnhubProfile2Response = {
    country?: string;
    currency?: string;
    exchange?: string;
    ipo?: string;
    marketCapitalization?: number;
    name?: string;
    phone?: string;
    shareOutstanding?: number;
    ticker?: string;
    weburl?: string;
    logo?: string;
    finnhubIndustry?: string;
};

export type FinnhubMetricResponse = {
    metric?: Record<string, number | string | null | undefined>;
};

export type FinnhubQuoteResponse = {
    c?: number; // current price
    dp?: number; // change percent
};

type FinnhubFetchOptions = {
    ttlSeconds?: number;
};

export async function finnhubFetch<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined>,
    opts?: FinnhubFetchOptions
): Promise<T> {
    const token = process.env.FINNHUB_API_KEY;
    if (!token) {
        throw new Error('FINNHUB_API_KEY is not configured');
    }

    const searchParams = new URLSearchParams();
    searchParams.set('token', token);
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value === undefined) return;
        searchParams.set(key, String(value));
    });

    const url = `${FINNHUB_BASE_URL}/${path}?${searchParams.toString()}`;
    const res = await fetch(url, {
        // Avoid caching errors too long; allow caller to control via revalidate
        next: { revalidate: opts?.ttlSeconds ?? 300 },
        signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
        const snippet = await res.text().catch(() => '');
        throw new Error(`Finnhub fetch failed for ${path}: ${res.status} ${res.statusText} - ${snippet.slice(0, 120)}`);
    }

    return (await res.json()) as T;
}

export async function getFinnhubProfile(symbol: string) {
    return finnhubFetch<FinnhubProfile2Response>('stock/profile2', { symbol }, { ttlSeconds: 1800 });
}

export async function getFinnhubMetrics(symbol: string) {
    return finnhubFetch<FinnhubMetricResponse>('stock/metric', { symbol, metric: 'all' }, { ttlSeconds: 900 });
}

export async function getFinnhubFinancials(symbol: string, freq: 'annual' | 'quarterly') {
    return finnhubFetch<FinnhubFinancialsReportedResponse>('stock/financials-reported', { symbol, freq }, { ttlSeconds: 900 });
}

export async function getFinnhubQuote(symbol: string) {
    return finnhubFetch<FinnhubQuoteResponse>('quote', { symbol }, { ttlSeconds: 60 });
}
