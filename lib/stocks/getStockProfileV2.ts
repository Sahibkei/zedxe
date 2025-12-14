import { StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";

export async function getStockProfileV2(symbol: string): Promise<StockProfileV2Model> {
    const upperSymbol = symbol.toUpperCase();
    const chartSymbol = `NASDAQ:${upperSymbol}`;

    // TODO: Replace mocked data with real providers (Finnhub, SEC, OpenBB, etc.)
    const mockData: StockProfileV2Model = {
        companyProfile: {
            name: "Example Corp",
            ticker: upperSymbol,
            exchange: "NASDAQ",
            sector: "Technology",
            industry: "Software - Infrastructure",
            website: "https://www.example.com",
            description: "Example Corp builds cloud-native tools for modern workflows.",
            country: "US",
            currency: "USD",
        },
        chartSymbol,
        financialsAnnual: [
            {
                fiscalDate: "2024-12-31",
                fiscalYear: "2024",
                revenue: 182_500_000_000,
                grossProfit: 98_000_000_000,
                operatingIncome: 58_500_000_000,
                netIncome: 44_200_000_000,
                eps: 6.12,
                freeCashFlow: 45_300_000_000,
            },
            {
                fiscalDate: "2023-12-31",
                fiscalYear: "2023",
                revenue: 170_800_000_000,
                grossProfit: 90_100_000_000,
                operatingIncome: 52_000_000_000,
                netIncome: 40_400_000_000,
                eps: 5.64,
                freeCashFlow: 41_000_000_000,
            },
            {
                fiscalDate: "2022-12-31",
                fiscalYear: "2022",
                revenue: 160_200_000_000,
                grossProfit: 82_500_000_000,
                operatingIncome: 47_500_000_000,
                netIncome: 36_900_000_000,
                eps: 5.05,
                freeCashFlow: 38_700_000_000,
            },
            {
                fiscalDate: "2021-12-31",
                fiscalYear: "2021",
                revenue: 151_000_000_000,
                grossProfit: 78_400_000_000,
                operatingIncome: 42_900_000_000,
                netIncome: 33_200_000_000,
                eps: 4.52,
                freeCashFlow: 35_900_000_000,
            },
            {
                fiscalDate: "2020-12-31",
                fiscalYear: "2020",
                revenue: 138_400_000_000,
                grossProfit: 70_700_000_000,
                operatingIncome: 36_200_000_000,
                netIncome: 29_900_000_000,
                eps: 3.98,
                freeCashFlow: 31_500_000_000,
            },
        ],
        financialsQuarterly: [
            {
                fiscalDate: "2024-09-30",
                fiscalYear: "2024 Q3",
                revenue: 46_200_000_000,
                grossProfit: 24_800_000_000,
                operatingIncome: 14_500_000_000,
                netIncome: 11_200_000_000,
                eps: 1.55,
                freeCashFlow: 11_600_000_000,
            },
            {
                fiscalDate: "2024-06-30",
                fiscalYear: "2024 Q2",
                revenue: 45_300_000_000,
                grossProfit: 24_100_000_000,
                operatingIncome: 14_000_000_000,
                netIncome: 10_800_000_000,
                eps: 1.50,
                freeCashFlow: 11_200_000_000,
            },
            {
                fiscalDate: "2024-03-31",
                fiscalYear: "2024 Q1",
                revenue: 44_900_000_000,
                grossProfit: 23_600_000_000,
                operatingIncome: 13_800_000_000,
                netIncome: 10_500_000_000,
                eps: 1.48,
                freeCashFlow: 10_900_000_000,
            },
            {
                fiscalDate: "2023-12-31",
                fiscalYear: "2023 Q4",
                revenue: 45_600_000_000,
                grossProfit: 23_900_000_000,
                operatingIncome: 13_900_000_000,
                netIncome: 10_400_000_000,
                eps: 1.46,
                freeCashFlow: 10_800_000_000,
            },
        ],
        ratios: {
            pe: 28.4,
            pb: 9.2,
            ps: 7.4,
            evToEbitda: 19.6,
            debtToEquity: 1.12,
            currentRatio: 1.52,
            dividendYield: 0.009,
        },
        earningsLatestQuarter: {
            period: "2024 Q3",
            eps: 1.55,
            consensusEps: 1.47,
            surprisePercent: 5.4,
            revenue: 46_200_000_000,
        },
        earningsLatestAnnual: {
            period: "FY 2024",
            eps: 6.12,
            revenue: 182_500_000_000,
            revenueYoYPercent: 6.9,
        },
        filings: {
            latest10Q: {
                formType: "10-Q",
                filingDate: "2024-10-28",
                periodEnd: "2024-09-30",
                url: "https://www.sec.gov/ixviewer/doc/2024q3",
            },
            latest10K: {
                formType: "10-K",
                filingDate: "2025-02-15",
                periodEnd: "2024-12-31",
                url: "https://www.sec.gov/ixviewer/doc/2024k",
            },
            recent: [
                {
                    formType: "8-K",
                    filingDate: "2024-11-05",
                    periodEnd: "2024-09-30",
                    url: "https://www.sec.gov/ixviewer/doc/2024-8k",
                },
                {
                    formType: "10-Q",
                    filingDate: "2024-10-28",
                    periodEnd: "2024-09-30",
                    url: "https://www.sec.gov/ixviewer/doc/2024q3",
                },
                {
                    formType: "8-K",
                    filingDate: "2024-08-10",
                    periodEnd: "2024-06-30",
                    url: "https://www.sec.gov/ixviewer/doc/2024-8k-q2",
                },
                {
                    formType: "10-Q",
                    filingDate: "2024-07-25",
                    periodEnd: "2024-06-30",
                    url: "https://www.sec.gov/ixviewer/doc/2024q2",
                },
                {
                    formType: "10-K",
                    filingDate: "2025-02-15",
                    periodEnd: "2024-12-31",
                    url: "https://www.sec.gov/ixviewer/doc/2024k",
                },
            ],
        },
        presentation: {
            latestDeck: {
                title: "Q3 2024 Investor Deck",
                publishedDate: "2024-10-20",
                url: "https://www.example.com/investors/deck-q3-2024.pdf",
            },
        },
    };

    return mockData;
}
