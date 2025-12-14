export interface CompanyProfile {
    name: string;
    ticker: string;
    exchange?: string;
    sector?: string;
    industry?: string;
    website?: string;
    description?: string;
    country?: string;
    currency?: string;
}

export interface FinancialStatementEntry {
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
    dividendYield?: number;
}

export interface EarningsSnapshot {
    period: string;
    eps?: number;
    consensusEps?: number;
    surprisePercent?: number;
    revenue?: number;
    revenueYoYPercent?: number;
}

export interface FilingItem {
    formType: string;
    filingDate: string;
    periodEnd: string;
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
    earningsLatestQuarter?: EarningsSnapshot;
    earningsLatestAnnual?: EarningsSnapshot;
    filings: FilingsSummary;
    presentation?: PresentationSummary;
}
