import type { AnalyzeRequest, AnalyzeResponse, ChainResponse, ExpiriesResponse } from './types';
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
