export interface CompanyProfile {
    name: string;
    ticker: string;
    cik?: string;
    exchange?: string;
    sector?: string;
    industry?: string;
    website?: string;
    description?: string;
    headquartersCity?: string;
    headquartersCountry?: string;
    employees?: number;
    ceo?: string;
    country?: string;
    currency?: string;
    marketCap?: number;
}

export interface FinancialStatementEntry {
    /** Date formatted as YYYY-MM-DD */
    fiscalDate: string;
    fiscalYear: string;
    revenue?: number;
    grossProfit?: number;
    operatingIncome?: number;
    netIncome?: number;
    eps?: number;
    freeCashFlow?: number;
}

export interface RatioGroup {
    pe?: number;
    pb?: number;
    ps?: number;
    evToEbitda?: number;
    debtToEquity?: number;
    currentRatio?: number;
    /** Stored as FRACTION (e.g., 0.009 for 0.9%) */
    dividendYield?: number;
}

export interface EarningsSnapshot {
    period: string;
    eps?: number;
    consensusEps?: number;
    /** Stored as FRACTION (e.g., 0.054 for 5.4%) */
    surprisePercent?: number;
    revenue?: number;
    /** Stored as FRACTION (e.g., 0.069 for 6.9%) */
    revenueYoYPercent?: number;
}

export interface QuoteSnapshot {
    price?: number;
    change?: number;
    changePercent?: number;
    asOf?: number;
    currency?: string;
}

export interface FilingItem {
    formType: string;
    /** Date formatted as YYYY-MM-DD */
    filingDate: string;
    /** Date formatted as YYYY-MM-DD */
    periodEnd: string;
    cik?: string | number;
    accessionNumber?: string;
    primaryDocument?: string;
    url?: string;
}

export interface FilingsSummary {
    latest10Q?: FilingItem;
    latest10K?: FilingItem;
    recent?: FilingItem[];
}

export interface PresentationSummary {
    latestDeck?: {
        title: string;
        publishedDate: string;
        url: string;
    };
}

export interface StockProfileV2Model {
    companyProfile: CompanyProfile;
    chartSymbol: string;
    financialsAnnual: FinancialStatementEntry[];
    financialsQuarterly: FinancialStatementEntry[];
    ratios: RatioGroup;
    quote?: QuoteSnapshot;
    earningsLatestQuarter?: EarningsSnapshot;
    earningsLatestAnnual?: EarningsSnapshot;
    filings: FilingsSummary;
    presentation?: PresentationSummary;
    sources?: {
        finnhubAvailable: boolean;
        secAvailable: boolean;
        finnhubError?: string;
        secError?: string;
    };
}
