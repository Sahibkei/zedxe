export interface StockProfileData {
    symbol: string;
    name: string;
    exchange?: string;
    sector?: string;
    industry?: string;
    website?: string;
    description?: string;
    currency?: string;
    ceo?: string;
    employees?: number;
    hqCity?: string;
    hqState?: string;
    hqCountry?: string;
    marketCap?: number;
    beta?: number;
    avgVolume?: number;
    range52wLow?: number;
    range52wHigh?: number;
    dividendYield?: number;
    metrics?: {
        pe?: number;
        pb?: number;
        ps?: number;
        evToEbitda?: number;
        debtToEquity?: number;
        currentRatio?: number;
        dividendYieldPercent?: number;
    };
}

export interface FinancialStatement {
    period: "annual" | "quarter";
    statement: "income" | "balance" | "cashflow";
    columns: string[];
    rows: Array<{ key: string; label: string; values: (number | null)[]; group?: string }>;
    currency?: string;
}

export interface QuoteData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    lastTradeAt?: string;
}

export interface MarketDataProvider {
    getProfile(symbol: string): Promise<StockProfileData>;
    getFinancialStatement(
        symbol: string,
        statement: FinancialStatement["statement"],
        period: FinancialStatement["period"],
        limit?: number,
    ): Promise<FinancialStatement>;
    getQuote(symbol: string): Promise<QuoteData>;
}
