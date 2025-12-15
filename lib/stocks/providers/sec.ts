import 'server-only';

const SEC_BASE_URL = 'https://data.sec.gov';
const SEC_USER_AGENT = process.env.SEC_USER_AGENT;

export type SecRecentFilings = {
    filings: SecFiling[];
    ticker?: string;
    cik?: string;
};

export type SecFiling = {
    formType?: string;
    filedAt?: string;
    accessionNumber?: string;
    primaryDocument?: string;
    link?: string;
    description?: string;
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
        };
    };
};

const cikCache = new Map<string, string>();

async function secFetch<T>(path: string, ttlSeconds = 1800): Promise<T> {
    if (!SEC_USER_AGENT) {
        throw new Error('SEC_USER_AGENT is not configured');
    }

    const res = await fetch(`${SEC_BASE_URL}${path}`, {
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

async function getTickerToCikMap(): Promise<Map<string, string>> {
    if (cikCache.size > 0) return cikCache;

    const data = await secFetch<Record<string, SecTickerEntry>>('/files/company_tickers.json', 86400);
    Object.values(data || {}).forEach((entry) => {
        if (!entry?.ticker) return;
        const cik = String(entry.cik_str ?? '').padStart(10, '0');
        cikCache.set(entry.ticker.toUpperCase(), cik);
    });

    return cikCache;
}

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
            accessionNumber: accession,
            primaryDocument: doc,
            link,
            description: submissions?.name,
        };
    });

    const filtered = filings.filter((f) => f.formType === '10-K' || f.formType === '10-Q').slice(0, 12);

    return {
        filings: filtered,
        ticker: submissions?.ticker ?? ticker.toUpperCase(),
        cik,
    };
}
