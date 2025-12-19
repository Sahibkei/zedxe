export type ExpiriesResponse = {
    symbol: string;
    expiries: string[];
};

export type OptionSide = 'call' | 'put';

export type OptionContract = {
    symbol: string;
    expiry: string; // YYYY-MM-DD
    strike: number;
    side: OptionSide;
    bid: number;
    ask: number;
    last?: number;
    openInterest?: number;
    volume?: number;
    impliedVol?: number; // optional for now
};

export type ChainResponse = {
    symbol: string;
    spot: number;
    spotTimestamp?: string;
    spotSource?: string;
    spotAlternate?: number;
    expiry: string;
    fetchedAt: string; // ISO
    contracts: OptionContract[];
};

export type AnalyzeRequest = {
    symbol: string;
    expiry: string;
    r: number; // risk-free rate
    q: number; // dividend yield
    filters?: {
        dteMin?: number;
        dteMax?: number;
        maxSpreadPct?: number;
        minOpenInterest?: number;
        moneynessMin?: number;
        moneynessMax?: number;
    };
};

export type AnalyzeResponse = {
    symbol: string;
    spot: number;
    expiry: string;
    dte: number;
    tYears: number;
    r: number;
    q: number;
    priceRule: 'mid' | 'last' | 'mixed';
    filteredCount: number;
    totalCount: number;
};

export type RiskNeutralDistributionStats = {
    expectedMove: number;
    expectedMoveUpper: number;
    expectedMoveLower: number;
    probabilityAboveSpot: number;
    probabilityBelowSpot: number;
};

export type RiskNeutralDistributionGrid = {
    x: number[];
    pdf: number[];
    cdf: number[];
};

export type RiskNeutralDistributionResponse = {
    symbol: string;
    expiry: string;
    spot: number;
    forward: number;
    r: number;
    q: number;
    T: number;
    sigma: number;
    atmStrike: number;
    grid: RiskNeutralDistributionGrid;
    stats: RiskNeutralDistributionStats;
    warnings?: string[];
};
