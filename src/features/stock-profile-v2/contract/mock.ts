import { StockProfileV2 } from "./types";

export function makeMockStockProfileV2(symbol: string): StockProfileV2 {
    const normalized = symbol.toUpperCase();
    const asOf = "2024-12-31T16:00:00Z";

    return {
        quote: {
            symbol: normalized,
            companyName: "Mock Industries Inc.",
            price: 142.37,
            change: 1.21,
            changePercent: 0.86,
            marketCap: 125_000_000_000,
            volume: 18_200_000,
            averageVolume: 16_500_000,
            beta: 1.05,
            fiftyTwoWeekHigh: 155.32,
            fiftyTwoWeekLow: 98.44,
            currency: "USD",
            exchange: "NASDAQ",
            asOf,
            dataSource: "mock",
        },
        companyProfile: {
            companyName: "Mock Industries Inc.",
            ticker: normalized,
            description: "Diversified technology and services company used for contract prototyping.",
            sector: "Technology",
            industry: "Software - Infrastructure",
            employees: 48000,
            headquarters: { city: "San Francisco", state: "CA", country: "USA" },
            website: "https://example.com",
            ceo: "Alexis Jordan",
            foundedYear: 1998,
            exchange: "NASDAQ",
            currency: "USD",
            dataSource: "mock",
        },
        financialStatements: {
            annual: {
                incomeStatement: [2024, 2023, 2022, 2021, 2020].map((year, idx) => ({
                    fiscalYear: year,
                    periodEnd: `${year}-12-31`,
                    currency: "USD",
                    source: "mock",
                    revenue: 48_500_000_000 - idx * 2_000_000_000,
                    grossProfit: 32_000_000_000 - idx * 1_500_000_000,
                    operatingIncome: 12_500_000_000 - idx * 800_000_000,
                    netIncome: 9_800_000_000 - idx * 600_000_000,
                    ebitda: 15_000_000_000 - idx * 700_000_000,
                    dilutedEPS: 6.12 - idx * 0.3,
                })),
                balanceSheet: [2024, 2023, 2022, 2021, 2020].map((year, idx) => ({
                    fiscalYear: year,
                    periodEnd: `${year}-12-31`,
                    currency: "USD",
                    source: "mock",
                    totalAssets: 110_000_000_000 - idx * 4_000_000_000,
                    totalLiabilities: 62_000_000_000 - idx * 2_500_000_000,
                    totalEquity: 48_000_000_000 - idx * 1_500_000_000,
                    cashAndEquivalents: 12_500_000_000 - idx * 600_000_000,
                    longTermDebt: 18_000_000_000 - idx * 500_000_000,
                })),
                cashFlow: [2024, 2023, 2022, 2021, 2020].map((year, idx) => ({
                    fiscalYear: year,
                    periodEnd: `${year}-12-31`,
                    currency: "USD",
                    source: "mock",
                    operatingCashFlow: 13_500_000_000 - idx * 700_000_000,
                    investingCashFlow: -4_200_000_000 + idx * 200_000_000,
                    financingCashFlow: -6_000_000_000 + idx * 150_000_000,
                    freeCashFlow: 7_200_000_000 - idx * 500_000_000,
                })),
            },
            quarterly: {
                incomeStatement: ["2024-Q4", "2024-Q3", "2024-Q2", "2024-Q1", "2023-Q4", "2023-Q3", "2023-Q2", "2023-Q1"].map(
                    (period, idx) => {
                        const [year, quarter] = period.split("-");
                        const periodEnd =
                            quarter === "Q4"
                                ? `${year}-12-31`
                                : quarter === "Q3"
                                  ? `${year}-09-30`
                                  : quarter === "Q2"
                                    ? `${year}-06-30`
                                    : `${year}-03-31`;

                        return {
                            fiscalYear: Number(year),
                            fiscalQuarter: quarter,
                            periodEnd,
                            currency: "USD",
                            source: "mock",
                            revenue: 12_000_000_000 - idx * 250_000_000,
                            grossProfit: 8_000_000_000 - idx * 180_000_000,
                            operatingIncome: 3_100_000_000 - idx * 120_000_000,
                            netIncome: 2_400_000_000 - idx * 90_000_000,
                            ebitda: 3_800_000_000 - idx * 140_000_000,
                            dilutedEPS: 1.55 - idx * 0.05,
                        };
                    }
                ),
                balanceSheet: ["2024-Q4", "2024-Q3", "2024-Q2", "2024-Q1", "2023-Q4", "2023-Q3", "2023-Q2", "2023-Q1"].map(
                    (period, idx) => {
                        const [year, quarter] = period.split("-");
                        const periodEnd =
                            quarter === "Q4"
                                ? `${year}-12-31`
                                : quarter === "Q3"
                                  ? `${year}-09-30`
                                  : quarter === "Q2"
                                    ? `${year}-06-30`
                                    : `${year}-03-31`;

                        return {
                            fiscalYear: Number(year),
                            fiscalQuarter: quarter,
                            periodEnd,
                            currency: "USD",
                            source: "mock",
                            totalAssets: 110_500_000_000 - idx * 700_000_000,
                            totalLiabilities: 62_300_000_000 - idx * 500_000_000,
                            totalEquity: 48_200_000_000 - idx * 300_000_000,
                            cashAndEquivalents: 12_600_000_000 - idx * 120_000_000,
                            longTermDebt: 18_200_000_000 - idx * 90_000_000,
                        };
                    }
                ),
                cashFlow: ["2024-Q4", "2024-Q3", "2024-Q2", "2024-Q1", "2023-Q4", "2023-Q3", "2023-Q2", "2023-Q1"].map(
                    (period, idx) => {
                        const [year, quarter] = period.split("-");
                        const periodEnd =
                            quarter === "Q4"
                                ? `${year}-12-31`
                                : quarter === "Q3"
                                  ? `${year}-09-30`
                                  : quarter === "Q2"
                                    ? `${year}-06-30`
                                    : `${year}-03-31`;

                        return {
                            fiscalYear: Number(year),
                            fiscalQuarter: quarter,
                            periodEnd,
                            currency: "USD",
                            source: "mock",
                            operatingCashFlow: 3_500_000_000 - idx * 120_000_000,
                            investingCashFlow: -1_050_000_000 + idx * 40_000_000,
                            financingCashFlow: -1_500_000_000 + idx * 35_000_000,
                            freeCashFlow: 1_900_000_000 - idx * 85_000_000,
                        };
                    }
                ),
            },
        },
        ratios: {
            valuation: [2024, 2023, 2022, 2021, 2020].map((year, idx) => ({
                fiscalYear: year,
                periodEnd: `${year}-12-31`,
                source: "mock",
                priceToEarnings: 23.1 - idx * 1.2,
                forwardPE: 21.8 - idx * 1.1,
                priceToSales: 6.4 - idx * 0.4,
                priceToBook: 3.2 - idx * 0.2,
                evToEbitda: 14.5 - idx * 0.7,
                dividendYield: 0.75 + idx * 0.05,
            })),
            profitability: [2024, 2023, 2022, 2021, 2020].map((year, idx) => ({
                fiscalYear: year,
                periodEnd: `${year}-12-31`,
                source: "mock",
                grossMargin: 0.66 - idx * 0.01,
                operatingMargin: 0.26 - idx * 0.01,
                netMargin: 0.20 - idx * 0.01,
                returnOnEquity: 0.21 - idx * 0.01,
                returnOnAssets: 0.11 - idx * 0.005,
                returnOnInvestedCapital: 0.18 - idx * 0.008,
            })),
            leverage: [2024, 2023, 2022, 2021, 2020].map((year, idx) => ({
                fiscalYear: year,
                periodEnd: `${year}-12-31`,
                source: "mock",
                debtToEquity: 0.38 + idx * 0.02,
                debtToAssets: 0.22 + idx * 0.01,
                interestCoverage: 12.5 - idx * 0.7,
            })),
            liquidity: [2024, 2023, 2022, 2021, 2020].map((year, idx) => ({
                fiscalYear: year,
                periodEnd: `${year}-12-31`,
                source: "mock",
                currentRatio: 1.85 - idx * 0.05,
                quickRatio: 1.55 - idx * 0.05,
                cashRatio: 0.85 - idx * 0.04,
            })),
        },
        earnings: {
            latestQuarter: {
                period: "2024 Q4",
                fiscalYear: 2024,
                fiscalQuarter: "Q4",
                periodEnd: "2024-12-31",
                currency: "USD",
                epsActual: 1.62,
                epsEstimate: 1.55,
                revenue: 12_100_000_000,
                surprisePercent: 4.5,
                yoyRevenueGrowthPercent: 8.4,
                yoyEpsGrowthPercent: 10.2,
                source: "mock",
            },
            latestAnnual: {
                period: "FY 2024",
                fiscalYear: 2024,
                periodEnd: "2024-12-31",
                currency: "USD",
                epsActual: 6.12,
                epsEstimate: 6.0,
                revenue: 48_500_000_000,
                surprisePercent: 2.0,
                yoyRevenueGrowthPercent: 6.5,
                yoyEpsGrowthPercent: 5.1,
                source: "mock",
            },
        },
        filings: {
            latest10Q: {
                type: "10-Q",
                url: "https://www.sec.gov/Archives/edgar/data/0000000000/mock-10q.pdf",
                title: `${normalized} Q4 2024 10-Q`,
                filingDate: "2025-02-10",
                periodEnd: "2024-12-31",
                source: "mock",
            },
            latest10K: {
                type: "10-K",
                url: "https://www.sec.gov/Archives/edgar/data/0000000000/mock-10k.pdf",
                title: `${normalized} FY 2024 10-K`,
                filingDate: "2025-02-25",
                periodEnd: "2024-12-31",
                source: "mock",
            },
            otherFilings: [
                {
                    type: "8-K",
                    url: "https://www.sec.gov/Archives/edgar/data/0000000000/mock-8k.pdf",
                    title: `${normalized} Press Release 8-K`,
                    filingDate: "2025-01-15",
                    periodEnd: "2024-12-31",
                    source: "mock",
                },
            ],
        },
        presentationDeck: {
            url: "https://example.com/mock-earnings-deck.pdf",
            title: `${normalized} Q4 2024 Earnings Deck`,
            date: "2025-02-11",
            thumbnailUrl: "https://placehold.co/320x180/png",
            source: "mock",
        },
        meta: {
            symbol: normalized,
            exchange: "NASDAQ",
            currency: "USD",
            lastUpdated: asOf,
            dataQuality: {
                quote: "good",
                companyProfile: "good",
                financials: "good",
                ratios: "good",
                earnings: "good",
                filings: "good",
                presentationDeck: "partial",
            },
            sources: ["mock"],
            notes: ["Static mock data for UI development; replace with live data sources."],
        },
    };
}
