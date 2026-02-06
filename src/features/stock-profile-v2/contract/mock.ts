import type {
    BalanceSheetRow,
    CashFlowRow,
    FinancialStatement,
    IncomeStatementRow,
    StockProfileV2,
} from './types';

const sectors = [
    'Technology',
    'Financial Services',
    'Healthcare',
    'Consumer Cyclical',
    'Industrials',
    'Energy',
];

const industries = [
    'Software Infrastructure',
    'Semiconductors',
    'Banks - Diversified',
    'Medical Devices',
    'Internet Retail',
    'Asset Management',
];

const headquarters = ['New York, NY', 'San Francisco, CA', 'Austin, TX', 'Seattle, WA', 'Chicago, IL'];

const filingTypes = ['10-K', '10-Q', '8-K'];

const hashSymbol = (symbol: string) =>
    Math.abs(
        symbol
            .toUpperCase()
            .split('')
            .reduce((acc, char) => acc * 31 + char.charCodeAt(0), 7),
    );

const pick = <T,>(items: T[], seed: number) => items[seed % items.length];

const makeNumber = (seed: number, min: number, max: number) => {
    const range = max - min;
    return min + (seed % range);
};

const buildIncomeRows = (seed: number): IncomeStatementRow[] => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, index) => {
        const year = (currentYear - 4 + index).toString();
        const revenue = makeNumber(seed + index * 11, 52000, 182000);
        const grossProfit = Math.round(revenue * 0.58);
        const operatingIncome = Math.round(revenue * 0.28);
        const netIncome = Math.round(revenue * 0.22);
        const eps = Number((2.5 + (seed % 7) * 0.3 + index * 0.2).toFixed(2));
        return { year, revenue, grossProfit, operatingIncome, netIncome, eps };
    }).reverse();
};

const buildBalanceRows = (seed: number): BalanceSheetRow[] => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, index) => {
        const year = (currentYear - 4 + index).toString();
        const assets = makeNumber(seed + index * 13, 120000, 420000);
        const liabilities = Math.round(assets * 0.46);
        const cash = Math.round(assets * 0.18);
        const debt = Math.round(assets * 0.22);
        return { year, assets, liabilities, cash, debt };
    }).reverse();
};

const buildCashFlowRows = (seed: number): CashFlowRow[] => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, index) => {
        const year = (currentYear - 4 + index).toString();
        const operatingCashFlow = makeNumber(seed + index * 17, 18000, 62000);
        const investingCashFlow = -Math.round(operatingCashFlow * 0.35);
        const financingCashFlow = -Math.round(operatingCashFlow * 0.12);
        const freeCashFlow = Math.round(operatingCashFlow * 0.68);
        return { year, operatingCashFlow, investingCashFlow, financingCashFlow, freeCashFlow };
    }).reverse();
};

const buildStatementColumns = (years: string[]) =>
    years.map((year) => ({
        label: `FY${year}`,
        date: `${year}-12-31`,
    }));

const buildIncomeStatement = (seed: number): FinancialStatement => {
    const rows = buildIncomeRows(seed);
    const years = rows.map((row) => row.year);
    return {
        statement: "income",
        period: "annual",
        currency: "USD",
        columns: buildStatementColumns(years),
        rows: [
            { key: "revenue", label: "Revenue", section: "Revenue", format: "number", selectable: true, values: rows.map((row) => row.revenue) },
            { key: "subscription_revenue", label: "Subscription Revenue", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.68)) },
            { key: "services_revenue", label: "Services Revenue", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.32)) },
            { key: "cost_of_revenue", label: "Cost of Revenue", section: "Cost of Revenue", format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.42)) },
            { key: "gross_profit", label: "Gross Profit", format: "number", selectable: true, values: rows.map((row) => row.grossProfit) },
            { key: "research_dev", label: "Research & Development", section: "Operating Expenses", format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.12)) },
            { key: "sales_marketing", label: "Sales & Marketing", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.09)) },
            { key: "general_admin", label: "General & Administrative", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.08)) },
            { key: "total_opex", label: "Total Operating Expenses", format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.3)) },
            { key: "operating_income", label: "Operating Income", format: "number", selectable: true, values: rows.map((row) => row.operatingIncome) },
            { key: "interest_income", label: "Interest Income", section: "Other", format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.015)) },
            { key: "interest_expense", label: "Interest Expense", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.01)) },
            { key: "other_income", label: "Other Income (Expense)", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.005)) },
            { key: "pre_tax_income", label: "Pre-Tax Income", format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.26)) },
            { key: "income_tax", label: "Income Tax", section: "Taxes", format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.04)) },
            { key: "net_income", label: "Net Income", format: "number", selectable: true, values: rows.map((row) => row.netIncome) },
            { key: "ebitda", label: "EBITDA", section: "Per Share", format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue * 0.3)) },
            { key: "eps_basic", label: "EPS (Basic)", format: "ratio", selectable: true, values: rows.map((row) => row.eps) },
            { key: "eps_diluted", label: "EPS (Diluted)", indent: 1, format: "ratio", selectable: true, values: rows.map((row) => Number((row.eps * 0.98).toFixed(2))) },
            { key: "shares_outstanding", label: "Weighted Avg Shares", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.revenue / 6)) },
        ],
    };
};

const buildBalanceStatement = (seed: number): FinancialStatement => {
    const rows = buildBalanceRows(seed);
    const years = rows.map((row) => row.year);
    return {
        statement: "balance",
        period: "annual",
        currency: "USD",
        columns: buildStatementColumns(years),
        rows: [
            { key: "cash", label: "Cash & Equivalents", section: "Assets", format: "number", selectable: true, values: rows.map((row) => row.cash) },
            { key: "short_term_investments", label: "Short-Term Investments", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.assets * 0.08)) },
            { key: "receivables", label: "Accounts Receivable", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.assets * 0.1)) },
            { key: "inventory", label: "Inventory", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.assets * 0.05)) },
            { key: "other_current_assets", label: "Other Current Assets", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.assets * 0.04)) },
            { key: "total_current_assets", label: "Total Current Assets", format: "number", selectable: true, values: rows.map((row) => Math.round(row.assets * 0.47)) },
            { key: "property_equipment", label: "Property, Plant & Equipment", section: "Non-Current Assets", format: "number", selectable: true, values: rows.map((row) => Math.round(row.assets * 0.2)) },
            { key: "goodwill", label: "Goodwill", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.assets * 0.08)) },
            { key: "intangibles", label: "Intangible Assets", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.assets * 0.06)) },
            { key: "other_non_current_assets", label: "Other Non-Current Assets", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.assets * 0.05)) },
            { key: "total_assets", label: "Total Assets", format: "number", selectable: true, values: rows.map((row) => row.assets) },
            { key: "accounts_payable", label: "Accounts Payable", section: "Liabilities", format: "number", selectable: true, values: rows.map((row) => Math.round(row.liabilities * 0.2)) },
            { key: "accrued_expenses", label: "Accrued Expenses", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.liabilities * 0.12)) },
            { key: "short_term_debt", label: "Short-Term Debt", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.debt * 0.35)) },
            { key: "total_current_liabilities", label: "Total Current Liabilities", format: "number", selectable: true, values: rows.map((row) => Math.round(row.liabilities * 0.55)) },
            { key: "long_term_debt", label: "Long-Term Debt", section: "Long-Term Liabilities", format: "number", selectable: true, values: rows.map((row) => row.debt) },
            { key: "other_liabilities", label: "Other Long-Term Liabilities", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.liabilities * 0.18)) },
            { key: "total_liabilities", label: "Total Liabilities", format: "number", selectable: true, values: rows.map((row) => row.liabilities) },
            { key: "common_stock", label: "Common Stock", section: "Equity", format: "number", selectable: true, values: rows.map((row) => Math.round((row.assets - row.liabilities) * 0.25)) },
            { key: "retained_earnings", label: "Retained Earnings", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round((row.assets - row.liabilities) * 0.6)) },
            { key: "accumulated_oci", label: "Accumulated OCI", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round((row.assets - row.liabilities) * 0.1)) },
            { key: "shareholder_equity", label: "Total Equity", format: "number", selectable: true, values: rows.map((row) => row.assets - row.liabilities) },
        ],
    };
};

const buildCashFlowStatement = (seed: number): FinancialStatement => {
    const rows = buildCashFlowRows(seed);
    const years = rows.map((row) => row.year);
    return {
        statement: "cashflow",
        period: "annual",
        currency: "USD",
        columns: buildStatementColumns(years),
        rows: [
            { key: "net_income", label: "Net Income", section: "Operating", format: "number", selectable: true, values: rows.map((row) => Math.round(row.operatingCashFlow * 0.75)) },
            { key: "depreciation", label: "Depreciation & Amortization", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.operatingCashFlow * 0.18)) },
            { key: "stock_comp", label: "Stock-Based Compensation", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.operatingCashFlow * 0.1)) },
            { key: "change_working_capital", label: "Change in Working Capital", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.operatingCashFlow * -0.05)) },
            { key: "operating_cash_flow", label: "Operating Cash Flow", format: "number", selectable: true, values: rows.map((row) => row.operatingCashFlow) },
            { key: "capex", label: "Capital Expenditures", section: "Investing", format: "number", selectable: true, values: rows.map((row) => Math.round(row.operatingCashFlow * -0.25)) },
            { key: "acquisitions", label: "Acquisitions", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.operatingCashFlow * -0.07)) },
            { key: "investing_cash_flow", label: "Investing Cash Flow", format: "number", selectable: true, values: rows.map((row) => row.investingCashFlow) },
            { key: "debt_issuance", label: "Debt Issuance (Repayment)", section: "Financing", format: "number", selectable: true, values: rows.map((row) => Math.round(row.operatingCashFlow * 0.04)) },
            { key: "share_buybacks", label: "Share Repurchases", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.operatingCashFlow * -0.08)) },
            { key: "dividends", label: "Dividends Paid", indent: 1, format: "number", selectable: true, values: rows.map((row) => Math.round(row.operatingCashFlow * -0.03)) },
            { key: "financing_cash_flow", label: "Financing Cash Flow", format: "number", selectable: true, values: rows.map((row) => row.financingCashFlow) },
            { key: "net_change_cash", label: "Net Change in Cash", section: "Summary", format: "number", selectable: true, values: rows.map((row) => Math.round(row.operatingCashFlow + row.investingCashFlow + row.financingCashFlow)) },
            { key: "free_cash_flow", label: "Free Cash Flow", format: "number", selectable: true, values: rows.map((row) => row.freeCashFlow) },
        ],
    };
};

export const getMockStockProfile = (symbol: string): StockProfileV2 => {
    const safeSymbol = symbol.toUpperCase();
    const seed = hashSymbol(safeSymbol);
    const price = Number((makeNumber(seed, 85, 320) + (seed % 100) / 100).toFixed(2));
    const change = Number((((seed % 200) - 100) / 50).toFixed(2));
    const changePct = Number(((change / price) * 100).toFixed(2));

    const incomeStatement = buildIncomeRows(seed);
    const balanceSheet = buildBalanceRows(seed + 3);
    const cashFlow = buildCashFlowRows(seed + 7);

    return {
        header: {
            symbol: safeSymbol,
            name: `${safeSymbol} Holdings`,
            exchange: "NASDAQ",
            price,
            change,
            changePct,
            status: seed % 2 === 0 ? 'Live' : 'Delayed',
        },
        overview: {
            description: "No company description available yet.",
            sector: pick(sectors, seed),
            industry: pick(industries, seed + 4),
            highlights: [],
            sections: [],
        },
        financials: {
            incomeStatement,
            balanceSheet,
            cashFlow,
        },
        financialStatements: [
            buildIncomeStatement(seed),
            buildBalanceStatement(seed + 3),
            buildCashFlowStatement(seed + 7),
        ],
        ratios: [
            { label: 'P/E', value: `${(14 + (seed % 12)).toFixed(1)}x` },
            { label: 'P/S', value: `${(4 + (seed % 6) * 0.5).toFixed(1)}x` },
            { label: 'P/B', value: `${(2 + (seed % 5) * 0.4).toFixed(1)}x` },
            { label: 'ROE', value: `${(12 + (seed % 8) * 1.2).toFixed(1)}%` },
            { label: 'Gross Margin', value: `${(55 + (seed % 10) * 0.6).toFixed(1)}%` },
            { label: 'Net Margin', value: `${(18 + (seed % 8) * 0.5).toFixed(1)}%` },
            { label: 'Debt/Equity', value: `${(0.3 + (seed % 6) * 0.1).toFixed(2)}` },
        ],
        earnings: {
            quarter: 'Q2 2024',
            eps: `${(1.12 + (seed % 5) * 0.08).toFixed(2)}`,
            revenue: `$${(8.2 + (seed % 8) * 0.4).toFixed(1)}B`,
            surprise: `${seed % 2 === 0 ? '+' : '-'}${(1.4 + (seed % 4) * 0.3).toFixed(1)}%`,
        },
        filings: Array.from({ length: 4 }, (_, index) => {
            const type = filingTypes[(seed + index) % filingTypes.length];
            const year = 2024 - index;
            return {
                type,
                title: `${safeSymbol} ${type} Filing`,
                date: `${year}-0${(index % 3) + 1}-15`,
                url: 'https://www.sec.gov/edgar/searchedgar/companysearch.html',
            };
        }),
        keyStats: [
            { label: 'Market Cap', value: `$${(220 + (seed % 300)).toFixed(1)}B` },
            { label: '52W Range', value: `$${(90 + (seed % 20)).toFixed(0)} - $${(280 + (seed % 40)).toFixed(0)}` },
            { label: 'Avg Volume', value: `${(12 + (seed % 18)).toFixed(1)}M` },
            { label: 'Beta', value: `${(0.8 + (seed % 6) * 0.1).toFixed(2)}` },
            { label: 'Div Yield', value: `${(0.8 + (seed % 5) * 0.2).toFixed(2)}%` },
        ],
        about: {
            headquarters: pick(headquarters, seed),
            employees: `${(3800 + (seed % 4000)).toLocaleString('en-US')}`,
            website: "",
        },
    };
};
