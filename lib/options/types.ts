export type ExpiriesResponse = {
    symbol: string;
    expiries: string[];
};

export type OptionSide = 'call' | 'put';
/** Price source to use when selecting the market premium. */
export type OptionPriceSource = 'mid' | 'bid' | 'ask' | 'last';
/** Price source for scenario analysis (model uses BSM instead of market quotes). */
export type ScenarioPriceSource = 'mid' | 'bid' | 'ask' | 'model';

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

/** Summary statistics for the risk-neutral distribution output. */
export type RiskNeutralDistributionStats = {
    expectedMove: number;
    expectedMoveUpper: number;
    expectedMoveLower: number;
    probabilityAboveSpot: number;
    probabilityBelowSpot: number;
};

/** Grid arrays for prices, PDF, and CDF values. */
export type RiskNeutralDistributionGrid = {
    x: number[];
    pdf: number[];
    cdf: number[];
};

/** API response payload for the risk-neutral distribution endpoint. */
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

/** Black-Scholes greeks for a single option (per-share). */
export type OptionGreeks = {
    delta: number;
    gamma: number;
    vega: number;
    theta: number;
    rho: number;
};

/** API response payload for single-option analytics. */
export type SingleOptionAnalyticsResponse = {
    inputs: {
        symbol: string;
        expiry: string;
        type: OptionSide;
        strike: number;
        r: number;
        q: number;
        priceSource: OptionPriceSource;
        asOf: string;
    };
    contract: {
        symbol: string;
        expiry: string;
        strike: number;
        type: OptionSide;
    };
    spot: {
        spot: number;
        forward: number;
        T: number;
        source?: string;
        asOf?: string;
        alternate?: number | null;
    };
    market: {
        bid: number;
        ask: number;
        last?: number;
        mid: number;
        premium: number;
        spreadAbs: number;
        spreadPct: number;
        volume?: number;
        openInterest?: number;
        vendorIV?: number;
    };
    model: {
        ivUsed: number;
        bsmPrice: number;
        greeks: OptionGreeks;
        probITM: number;
        breakeven: number;
    };
    warnings: string[];
};

export type ScenarioAxis = {
    spotMovesPct: number[];
    ivShiftsPct: number[];
};

export type ScenarioGrid = {
    price: number[][];
    pnl: number[][];
};

export type ScenarioStats = {
    pnlMin: number;
    pnlMax: number;
    pnlBest: {
        spotMovePct: number;
        ivShiftPct: number;
        pnl: number;
    };
    pnlWorst: {
        spotMovePct: number;
        ivShiftPct: number;
        pnl: number;
    };
};

export type ScenarioAnalysisResponse = {
    base: {
        symbol: string;
        expiry: string;
        type: OptionSide;
        strike: number;
        spot: number;
        forward: number;
        basePremium: number;
        baseSigma: number;
        dte: number;
        horizonDays: number;
        tEff: number;
    };
    axes: ScenarioAxis;
    grids: ScenarioGrid;
    stats: ScenarioStats;
    warnings: string[];
};
