import type {
    AnalyzeRequest,
    AnalyzeResponse,
    ChainResponse,
    ExpiriesResponse,
    OptionChainRequest,
    OptionChainResponse,
    OptionPriceSource,
    OptionSide,
    OptionSurfaceResponse,
    RiskNeutralDistributionResponse,
    ScenarioAnalysisResponse,
    ScenarioPriceSource,
    SingleOptionAnalyticsResponse,
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

export async function fetchOptionChain(symbol: string, expiry: string, signal?: AbortSignal): Promise<ChainResponse>;
export async function fetchOptionChain(
    params: OptionChainRequest,
    options?: { signal?: AbortSignal }
): Promise<OptionChainResponse>;
const buildOptionChainSearch = (params: OptionChainRequest) => {
    const search = new URLSearchParams({
        symbol: params.symbol,
        expiry: params.expiry,
    });
    if (params.r !== undefined) search.set('r', String(params.r));
    if (params.q !== undefined) search.set('q', String(params.q));
    if (params.priceSource) search.set('priceSource', params.priceSource);
    if (params.bandPct !== undefined) search.set('bandPct', String(params.bandPct));
    if (params.ivSource) search.set('ivSource', params.ivSource);
    return search;
};

export async function fetchOptionChain(
    symbolOrParams: string | OptionChainRequest,
    expiryOrOptions?: string | { signal?: AbortSignal },
    signalMaybe?: AbortSignal
): Promise<ChainResponse | OptionChainResponse> {
    const isLegacy = typeof symbolOrParams === 'string';
    const params = isLegacy ? { symbol: symbolOrParams, expiry: expiryOrOptions as string } : symbolOrParams;
    const options = isLegacy ? { signal: signalMaybe } : expiryOrOptions;

    return safeFetchJson<ChainResponse | OptionChainResponse>(
        `/api/options/chain?${buildOptionChainSearch(params).toString()}`,
        {
            cache: 'no-store',
            signal: options?.signal,
        },
        { timeoutMs: 10000 }
    );
}

export async function fetchOptionChainV2(
    params: OptionChainRequest,
    options?: { signal?: AbortSignal }
): Promise<OptionChainResponse> {
    return safeFetchJson<OptionChainResponse>(
        `/api/options/chain?${buildOptionChainSearch(params).toString()}`,
        {
            cache: 'no-store',
            signal: options?.signal,
        },
        { timeoutMs: 10000 }
    );
}

export async function fetchOptionSurface(
    params: {
        symbol: string;
        expiries: string[];
        r: number;
        q: number;
        priceSource: OptionPriceSource;
    },
    options?: { signal?: AbortSignal }
): Promise<OptionSurfaceResponse> {
    const search = new URLSearchParams({
        symbol: params.symbol,
        expiries: params.expiries.join(','),
        r: String(params.r),
        q: String(params.q),
        priceSource: params.priceSource,
    });

    return safeFetchJson<OptionSurfaceResponse>(
        `/api/options/surface?${search.toString()}`,
        {
            cache: 'no-store',
            signal: options?.signal,
        },
        { timeoutMs: 12000 }
    );
}

export type SmileResponse = {
    symbol: string;
    expiry: string;
    spot: number;
    tYears: number;
    ivSource: 'mid' | 'yahoo';
    updatedAt: string;
    points: Array<{
        strike: number;
        side: OptionSide;
        iv: number | null;
        iv_mid?: number | null;
        iv_yahoo?: number | null;
        mid?: number | null;
        bid?: number | null;
        ask?: number | null;
        last?: number | null;
    }>;
};

export async function fetchOptionSmile(
    params: {
        symbol: string;
        expiry: string;
        r: number;
        q: number;
        ivSource: 'mid' | 'yahoo';
        side?: 'call' | 'put' | 'both';
    },
    options?: { signal?: AbortSignal }
): Promise<SmileResponse> {
    const search = new URLSearchParams({
        symbol: params.symbol,
        expiry: params.expiry,
        r: String(params.r),
        q: String(params.q),
        ivSource: params.ivSource,
    });
    if (params.side) {
        search.set('side', params.side);
    }

    return safeFetchJson<SmileResponse>(
        `/api/options/smile?${search.toString()}`,
        {
            cache: 'no-store',
            signal: options?.signal,
        },
        { timeoutMs: 12000 }
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

/**
 * Fetch analytics for a single option contract.
 */
export async function fetchSingleOptionAnalytics(
    symbol: string,
    expiry: string,
    type: OptionSide,
    strike: number,
    r: number,
    q: number,
    priceSource: OptionPriceSource = 'mid',
    options?: { signal?: AbortSignal }
): Promise<SingleOptionAnalyticsResponse> {
    const params = new URLSearchParams({
        symbol,
        expiry,
        type,
        strike: String(strike),
        r: String(r),
        q: String(q),
        priceSource,
    });

    return safeFetchJson<SingleOptionAnalyticsResponse>(
        `/api/options/single?${params.toString()}`,
        {
            cache: 'no-store',
            signal: options?.signal,
        },
        { timeoutMs: 12000 }
    );
}

/**
 * Fetch scenario analysis grids for a single option contract.
 */
export async function fetchScenarioAnalysis(
    params: {
        symbol: string;
        expiry: string;
        type: OptionSide;
        strike: number;
        r: number;
        q: number;
        priceSource: ScenarioPriceSource;
        horizonDays: number;
        spotMinPct: number;
        spotMaxPct: number;
        spotStepPct: number;
        ivMinPct: number;
        ivMaxPct: number;
        ivStepPct: number;
    },
    options?: { signal?: AbortSignal }
): Promise<ScenarioAnalysisResponse> {
    const search = new URLSearchParams({
        symbol: params.symbol,
        expiry: params.expiry,
        type: params.type,
        strike: String(params.strike),
        r: String(params.r),
        q: String(params.q),
        priceSource: params.priceSource,
        horizonDays: String(params.horizonDays),
        spotMinPct: String(params.spotMinPct),
        spotMaxPct: String(params.spotMaxPct),
        spotStepPct: String(params.spotStepPct),
        ivMinPct: String(params.ivMinPct),
        ivMaxPct: String(params.ivMaxPct),
        ivStepPct: String(params.ivStepPct),
    });

    return safeFetchJson<ScenarioAnalysisResponse>(
        `/api/options/scenario?${search.toString()}`,
        {
            cache: 'no-store',
            signal: options?.signal,
        },
        { timeoutMs: 12000 }
    );
}
