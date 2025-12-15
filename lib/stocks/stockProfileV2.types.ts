import { FinnhubFinancialReport, FinnhubFinancialsReportedResponse } from './providers/finnhub';
import { SecFiling, SecRecentFilings } from './providers/sec';

type StatusLevel = 'info' | 'warning' | 'error';

export type ProviderStatus = {
    source: 'finnhub' | 'sec';
    level: StatusLevel;
    message: string;
};

export type StockMetricSet = {
    pe?: number;
    pb?: number;
    ps?: number;
    evToEbitda?: number;
    debtToEquity?: number;
    currentRatio?: number;
    dividendYieldPercent?: number;
};

export type StockFinancialRow = {
    label: string; // FY 2024, Q3 2024
    endDate?: string;
    revenue?: number;
    grossProfit?: number;
    operatingIncome?: number;
    netIncome?: number;
    eps?: number;
    operatingCashFlow?: number;
    currency?: string;
};

export type FilingInfo = SecFiling;

export type StockProfileV2Model = {
    symbolRaw: string;
    tvSymbol: string;
    finnhubSymbol: string;
    secTicker: string;
    company: {
        name?: string;
        website?: string;
        country?: string;
        industry?: string;
        exchange?: string;
        marketCap?: number;
        ipo?: string;
        currency?: string;
        description?: string;
    };
    price?: {
        current?: number;
        changePercent?: number;
    };
    metrics: StockMetricSet;
    financials: {
        annual: StockFinancialRow[];
        quarterly: StockFinancialRow[];
    };
    filings: FilingInfo[];
    providerStatus: ProviderStatus[];
    providerErrors?: string[];
};

export type FinancialsMapperInput = {
    financials?: FinnhubFinancialsReportedResponse;
    limit?: number;
    frequency: 'annual' | 'quarterly';
};

export type FinancialsMapperFn = (input: FinancialsMapperInput) => StockFinancialRow[];

export type FilingsMapperFn = (filings?: SecRecentFilings) => FilingInfo[];

export type RatioMapperFn = (metrics?: Record<string, number | string | null | undefined>) => StockMetricSet;

export type ProfileMapperFn = (profile?: FinnhubFinancialReport) => StockProfileV2Model['company'];
