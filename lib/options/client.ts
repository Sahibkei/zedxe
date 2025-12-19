import type {
    AnalyzeRequest,
    AnalyzeResponse,
    ChainResponse,
    ExpiriesResponse,
    RiskNeutralDistributionResponse,
} from './types';
import { safeFetchJson } from './safeFetchJson';

export async function fetchExpiries(symbol: string, signal?: AbortSignal): Promise<ExpiriesResponse> {
    return safeFetchJson<ExpiriesResponse>(
        `/api/options/expiries?symbol=${encodeURIComponent(symbol)}`,
        {
            cache: 'no-store',
            signal,
        },
        { timeoutMs: 10000 }
    );
}

export async function fetchOptionChain(symbol: string, expiry: string, signal?: AbortSignal): Promise<ChainResponse> {
    return safeFetchJson<ChainResponse>(
        `/api/options/chain?symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`,
        {
            cache: 'no-store',
            signal,
        },
        { timeoutMs: 10000 }
    );
}

export async function analyzeOptions(body: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResponse> {
    return safeFetchJson<AnalyzeResponse>(
        '/api/options/analyze',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            cache: 'no-store',
            signal,
        },
        { timeoutMs: 12000 }
    );
}

/**
 * Fetch a risk-neutral distribution surface for a symbol and expiry.
 */
export async function fetchRiskNeutralDistribution(
    symbol: string,
    expiry: string,
    r: number,
    q: number,
    signal?: AbortSignal
): Promise<RiskNeutralDistributionResponse> {
    const params = new URLSearchParams({
        symbol,
        expiry,
        r: String(r),
        q: String(q),
        method: 'lognormal',
    });

    return safeFetchJson<RiskNeutralDistributionResponse>(
        `/api/options/rnd?${params.toString()}`,
        {
            cache: 'no-store',
            signal,
        },
        { timeoutMs: 12000 }
    );
}
