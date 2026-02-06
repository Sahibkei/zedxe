export type StockProfileHeader = {
    symbol: string;
    name: string;
    exchange?: string;
    price: number | null;
    change: number | null;
    changePct: number | null;
    status: 'Live' | 'Delayed' | 'Unavailable';
};

export type StockProfileOverview = {
    description: string;
    sector: string;
    industry: string;
    highlights: string[];
    sections: { title: string; description: string }[];
};

export type IncomeStatementRow = {
    year: string;
    revenue: number;
    grossProfit: number;
    operatingIncome: number;
    netIncome: number;
    eps: number;
};

export type BalanceSheetRow = {
    year: string;
    assets: number;
    liabilities: number;
    cash: number;
    debt: number;
};

export type CashFlowRow = {
    year: string;
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
    freeCashFlow: number;
};

export type StockProfileFinancials = {
    incomeStatement: IncomeStatementRow[];
    balanceSheet: BalanceSheetRow[];
    cashFlow: CashFlowRow[];
};

export type FinancialStatement = {
    statement: "income" | "balance" | "cashflow";
    period: "annual" | "quarterly";
    currency: string;
    columns: { label: string; date: string }[];
    rows: {
        key: string;
        label: string;
        section?: string;
        indent?: number;
        format: "number" | "percent" | "ratio";
        values: (number | null)[];
        selectable?: boolean;
    }[];
};

export type StockProfileRatio = {
    label: string;
    value: string;
};

export type StockProfileEarnings = {
    quarter: string;
    eps: string;
    revenue: string;
    surprise: string;
};

export type StockProfileFiling = {
    type: string;
    title: string;
    date: string;
    url: string;
};

export type StockProfileKeyStat = {
    label: string;
    value: string;
};

export type StockProfileAbout = {
    headquarters: string;
    employees: string;
    website: string;
};

export type StockProfileV2 = {
    header: StockProfileHeader;
    overview: StockProfileOverview;
    financials: StockProfileFinancials;
    financialStatements: FinancialStatement[];
    ratios: StockProfileRatio[];
    earnings: StockProfileEarnings;
    filings: StockProfileFiling[];
    keyStats: StockProfileKeyStat[];
    about: StockProfileAbout;
};
