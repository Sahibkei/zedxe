import type { AnalyzeRequest, AnalyzeResponse, ChainResponse, ExpiriesResponse } from './types';

const parseErrorMessage = async (response: Response) => {
    try {
        const payload = (await response.json()) as { error?: string };
        return payload.error ?? response.statusText;
    } catch (error) {
        return response.statusText || 'Request failed';
    }
};

export async function fetchExpiries(symbol: string, signal?: AbortSignal): Promise<ExpiriesResponse> {
    const response = await fetch(`/api/options/expiries?symbol=${encodeURIComponent(symbol)}`, {
        cache: 'no-store',
        signal,
    });

    if (!response.ok) {
        const message = await parseErrorMessage(response);
        throw new Error(message || 'Unable to load expiries');
    }

    return (await response.json()) as ExpiriesResponse;
}

export async function fetchOptionChain(symbol: string, expiry: string, signal?: AbortSignal): Promise<ChainResponse> {
    const response = await fetch(
        `/api/options/chain?symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`,
        {
            cache: 'no-store',
            signal,
        }
    );

    if (!response.ok) {
        const message = await parseErrorMessage(response);
        throw new Error(message || 'Unable to load option chain');
    }

    return (await response.json()) as ChainResponse;
}

export async function analyzeOptions(body: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResponse> {
    const response = await fetch('/api/options/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal,
    });

    if (!response.ok) {
        const message = await parseErrorMessage(response);
        throw new Error(message || 'Unable to analyze option chain');
    }

    return (await response.json()) as AnalyzeResponse;
}
