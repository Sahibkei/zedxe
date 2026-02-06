export type StockProfileHeader = {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePct: number;
    status: 'Live' | 'Delayed';
};

export type StockProfileOverview = {
    description: string;
    sector: string;
    industry: string;
    highlights: string[];
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
    ratios: StockProfileRatio[];
    earnings: StockProfileEarnings;
    filings: StockProfileFiling[];
    keyStats: StockProfileKeyStat[];
    about: StockProfileAbout;
};
