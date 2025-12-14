export type CurrencyCode = string;

export type DataQualityStatus = "good" | "partial" | "missing";

export interface QuoteHeader {
    symbol: string;
    companyName: string;
    price: number;
    change?: number | null;
    changePercent?: number | null;
    marketCap?: number | null;
    volume?: number | null;
    averageVolume?: number | null;
    beta?: number | null;
    fiftyTwoWeekHigh?: number | null;
    fiftyTwoWeekLow?: number | null;
    currency: CurrencyCode;
    exchange: string;
    asOf: string;
    dataSource?: string;
}

export interface HeadquartersLocation {
    city?: string;
    state?: string;
    country?: string;
}

export interface CompanyProfile {
    companyName: string;
    ticker: string;
    description?: string;
    sector?: string;
    industry?: string;
    employees?: number | null;
    headquarters?: HeadquartersLocation;
    website?: string;
    ceo?: string | null;
    foundedYear?: number | null;
    exchange?: string;
    currency?: CurrencyCode;
    dataSource?: string;
}

export interface StatementPeriodMeta {
    fiscalYear: number;
    fiscalQuarter?: string;
    periodEnd: string;
    currency: CurrencyCode;
    source: string;
    audited?: boolean;
    restated?: boolean;
}

export interface IncomeStatement extends StatementPeriodMeta {
    revenue?: number | null;
    grossProfit?: number | null;
    operatingIncome?: number | null;
    netIncome?: number | null;
    ebitda?: number | null;
    dilutedEPS?: number | null;
}

export interface BalanceSheet extends StatementPeriodMeta {
    totalAssets?: number | null;
    totalLiabilities?: number | null;
    totalEquity?: number | null;
    cashAndEquivalents?: number | null;
    longTermDebt?: number | null;
}

export interface CashFlow extends StatementPeriodMeta {
    operatingCashFlow?: number | null;
    investingCashFlow?: number | null;
    financingCashFlow?: number | null;
    freeCashFlow?: number | null;
}

export interface FinancialStatementGroup {
    incomeStatement: IncomeStatement[];
    balanceSheet: BalanceSheet[];
    cashFlow: CashFlow[];
}

export interface FinancialStatements {
    annual: FinancialStatementGroup;
    quarterly?: FinancialStatementGroup;
}

export interface RatioPeriodMeta {
    fiscalYear: number;
    fiscalQuarter?: string;
    periodEnd?: string;
    source?: string;
}

export interface ValuationRatios extends RatioPeriodMeta {
    priceToEarnings?: number | null;
    forwardPE?: number | null;
    priceToSales?: number | null;
    priceToBook?: number | null;
    evToEbitda?: number | null;
    dividendYield?: number | null;
}

export interface ProfitabilityRatios extends RatioPeriodMeta {
    grossMargin?: number | null;
    operatingMargin?: number | null;
    netMargin?: number | null;
    returnOnEquity?: number | null;
    returnOnAssets?: number | null;
    returnOnInvestedCapital?: number | null;
}

export interface LeverageRatios extends RatioPeriodMeta {
    debtToEquity?: number | null;
    debtToAssets?: number | null;
    interestCoverage?: number | null;
}

export interface LiquidityRatios extends RatioPeriodMeta {
    currentRatio?: number | null;
    quickRatio?: number | null;
    cashRatio?: number | null;
}

export interface Ratios {
    valuation: ValuationRatios[];
    profitability: ProfitabilityRatios[];
    leverage: LeverageRatios[];
    liquidity: LiquidityRatios[];
}

export interface EarningsSummaryPeriod {
    period: string;
    fiscalYear: number;
    fiscalQuarter?: string;
    periodEnd: string;
    currency: CurrencyCode;
    epsActual?: number | null;
    epsEstimate?: number | null;
    revenue?: number | null;
    surprisePercent?: number | null;
    yoyRevenueGrowthPercent?: number | null;
    yoyEpsGrowthPercent?: number | null;
    source?: string;
}

export interface EarningsSummary {
    latestQuarter: EarningsSummaryPeriod;
    latestAnnual: EarningsSummaryPeriod;
}

export type FilingType = "10-Q" | "10-K" | "8-K" | "S-1" | "other";

export interface FilingLink {
    type?: FilingType;
    url: string;
    title?: string;
    filingDate: string;
    periodEnd?: string;
    source?: string;
}

export interface Filings {
    latest10Q: FilingLink;
    latest10K?: FilingLink;
    otherFilings?: FilingLink[];
}

export interface PresentationDeck {
    url?: string;
    title?: string;
    date?: string;
    thumbnailUrl?: string;
    source?: string;
}

export interface Meta {
    symbol: string;
    exchange: string;
    currency: CurrencyCode;
    lastUpdated: string;
    dataQuality: {
        quote: DataQualityStatus;
        companyProfile: DataQualityStatus;
        financials: DataQualityStatus;
        ratios: DataQualityStatus;
        earnings: DataQualityStatus;
        filings: DataQualityStatus;
        presentationDeck: DataQualityStatus;
    };
    sources?: string[];
    notes?: string[];
}

export interface StockProfileV2 {
    quote: QuoteHeader;
    companyProfile: CompanyProfile;
    financialStatements: FinancialStatements;
    ratios: Ratios;
    earnings: EarningsSummary;
    filings: Filings;
    presentationDeck?: PresentationDeck;
    meta: Meta;
}
