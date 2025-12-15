import 'server-only';

const SEC_BASE_URL = 'https://data.sec.gov';
const SEC_FILES_FALLBACK = 'https://www.sec.gov';
const SEC_USER_AGENT = process.env.SEC_USER_AGENT;

export type SecRecentFilings = {
    filings: SecFiling[];
    ticker?: string;
    cik?: string;
};

export type SecFiling = {
    formType?: string;
    filedAt?: string;
    periodEnd?: string;
    accessionNumber?: string;
    primaryDocument?: string;
    link?: string;
    description?: string;
    companyName?: string;
};

type SecTickerEntry = {
    cik_str: number;
    ticker: string;
    title?: string;
};

type SecSubmissions = {
    cik?: string;
    ticker?: string;
    name?: string;
    filings?: {
        recent?: {
            accessionNumber?: string[];
            filingDate?: string[];
            form?: string[];
            primaryDocument?: string[];
            isInlineXBRL?: number[];
            reportDate?: string[];
        };
    };
};

export type SecCompanyFacts = {
    cik?: string;
    ticker?: string;
    entityName?: string;
    facts?: Record<
        string,
        Record<
            string,
            {
                units?: Record<
                    string,
                    {
                        end?: string;
                        fy?: number;
                        fp?: string;
                        form?: string;
                        val?: number;
                        frame?: string;
                    }[]
                >;
            }
        >
    >;
};

const cikCache = new Map<string, string>();
let tickerMapCache: Map<string, string> | null = null;
let tickerMapFetchedAt: number | null = null;
let tickerMapPromise: Promise<Map<string, string>> | null = null;

const TICKER_MAP_TTL_MS = 24 * 60 * 60 * 1000;

async function secFetch<T>(path: string, ttlSeconds = 1800): Promise<T> {
    if (!SEC_USER_AGENT) {
        throw new Error('SEC_USER_AGENT is not configured');
    }

    const url = path.startsWith('http') ? path : `${SEC_BASE_URL}${path}`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': SEC_USER_AGENT,
            Accept: 'application/json',
        },
        next: { revalidate: ttlSeconds },
        signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
        const snippet = await res.text().catch(() => '');
        throw new Error(`SEC fetch failed for ${path}: ${res.status} ${res.statusText} - ${snippet.slice(0, 120)}`);
    }

    return (await res.json()) as T;
}

/**
 * Retrieve and cache a ticker-to-CIK map with TTL and in-flight deduplication.
 */
async function getTickerToCikMap(): Promise<Map<string, string>> {
    const now = Date.now();
    if (tickerMapCache && tickerMapFetchedAt && now - tickerMapFetchedAt < TICKER_MAP_TTL_MS) {
        return tickerMapCache;
    }

    if (tickerMapPromise) {
        return tickerMapPromise;
    }

    tickerMapPromise = (async () => {
        let data: Record<string, SecTickerEntry> | undefined;

        try {
            data = await secFetch<Record<string, SecTickerEntry>>('/files/company_tickers.json', 86400);
        } catch (err) {
            // Fallback to canonical SEC files host if the data subdomain path fails.
            data = await secFetch<Record<string, SecTickerEntry>>(
                `${SEC_FILES_FALLBACK}/files/company_tickers.json`,
                86400
            );
        }

        if (!data) {
            throw new Error('Unable to load SEC ticker map');
        }

        const map = tickerMapCache ?? new Map<string, string>();
        map.clear();
        Object.values(data).forEach((entry) => {
            if (!entry?.ticker) return;
            const cik = String(entry.cik_str ?? '').padStart(10, '0');
            map.set(entry.ticker.toUpperCase(), cik);
            cikCache.set(entry.ticker.toUpperCase(), cik);
        });

        tickerMapCache = map;
        tickerMapFetchedAt = Date.now();
        return map;
    })();

    try {
        return await tickerMapPromise;
    } finally {
        tickerMapPromise = null;
    }
}

/**
 * Fetch recent SEC filings for a given ticker.
 */
export async function getRecentSecFilings(ticker: string): Promise<SecRecentFilings> {
    const map = await getTickerToCikMap();
    const cik = map.get(ticker.toUpperCase());
    if (!cik) {
        throw new Error(`No CIK found for ticker ${ticker}`);
    }

    const submissions = await secFetch<SecSubmissions>(`/submissions/CIK${cik}.json`, 3600);
    const recent = submissions?.filings?.recent;
    const forms = recent?.form || [];
    const accessionNumbers = recent?.accessionNumber || [];
    const filingDates = recent?.filingDate || [];
    const periodDates = recent?.reportDate || [];
    const primaryDocs = recent?.primaryDocument || [];

    const filings: SecFiling[] = forms.map((form, idx) => {
        const accession = accessionNumbers[idx];
        const doc = primaryDocs[idx];
        const cikNoPad = (submissions?.cik || cik).replace(/^0+/, '');
        const link = accession && doc
            ? `https://www.sec.gov/Archives/edgar/data/${cikNoPad}/${accession.replace(/-/g, '')}/${doc}`
            : undefined;
        return {
            formType: form,
            filedAt: filingDates[idx],
            periodEnd: periodDates[idx],
            accessionNumber: accession,
            primaryDocument: doc,
            link,
            description: submissions?.name,
            companyName: submissions?.name,
        };
    });

    const filtered = filings.filter((f) => f.formType === '10-K' || f.formType === '10-Q').slice(0, 12);

    return {
        filings: filtered,
        ticker: submissions?.ticker ?? ticker.toUpperCase(),
        cik,
    };
}

/**
 * Retrieve SEC company facts (XBRL) for a ticker when available.
 */
export async function getSecCompanyFacts(ticker: string): Promise<SecCompanyFacts | undefined> {
    const map = await getTickerToCikMap();
    const cik = map.get(ticker.toUpperCase());
    if (!cik) return undefined;

    try {
        return await secFetch<SecCompanyFacts>(`/api/xbrl/companyfacts/CIK${cik}.json`, 10_800);
    } catch (err) {
        // As a fallback, try the legacy host in case of CDN hiccups.
        return secFetch<SecCompanyFacts>(`${SEC_FILES_FALLBACK}/api/xbrl/companyfacts/CIK${cik}.json`, 10_800).catch(
            () => undefined
        );
    }
}
