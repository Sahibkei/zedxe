import type {
    BalanceSheetRow,
    CashFlowRow,
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
            price,
            change,
            changePct,
            status: seed % 2 === 0 ? 'Live' : 'Delayed',
        },
        overview: {
            description: `${safeSymbol} delivers cloud-native financial infrastructure and digital commerce tooling for enterprise clients across global markets. The company focuses on subscription software, data analytics, and embedded payments.`,
            sector: pick(sectors, seed),
            industry: pick(industries, seed + 4),
            highlights: [
                `${safeSymbol} platform supports ${20 + (seed % 15)}M+ daily transactions.`,
                `Recurring revenue mix at ${(62 + (seed % 12)).toFixed(0)}%.`,
                `Global footprint across ${18 + (seed % 10)} countries.`,
                `Top ${(seed % 5) + 3} customer verticals by revenue.`,
            ],
        },
        financials: {
            incomeStatement,
            balanceSheet,
            cashFlow,
        },
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
            website: `https://www.${safeSymbol.toLowerCase()}.com`,
        },
    };
};
