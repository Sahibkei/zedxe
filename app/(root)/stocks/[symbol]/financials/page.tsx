import StockProfileFinancialsClient from "@/components/stocks/StockProfileFinancialsClient";
import { redirect } from "next/navigation";

import { canonicalizeSymbol } from "@/src/lib/symbol";
import { finnhubProvider } from "@/src/server/market-data/finnhub-provider";
import type { FinancialStatement } from "@/src/server/market-data/provider";

const StockFinancialsPage = async ({
    params,
    searchParams,
}: {
    params: Promise<{ symbol: string }>;
    searchParams?: Promise<{ period?: string; statement?: string }>;
}) => {
    const { symbol } = await params;
    const canonicalSymbol = canonicalizeSymbol(symbol);
    if (symbol !== canonicalSymbol) {
        redirect(`/stocks/${canonicalSymbol}/financials`);
    }
    const resolvedSearch = await searchParams;
    const periodParam = resolvedSearch?.period === "quarter" ? "quarter" : "annual";
    const statementParam = ["income", "balance", "cashflow"].includes(resolvedSearch?.statement ?? "")
        ? (resolvedSearch?.statement as FinancialStatement["statement"])
        : "income";

    let initialStatement: FinancialStatement | null = null;
    try {
        initialStatement = await finnhubProvider.getFinancialStatement(canonicalSymbol, statementParam, periodParam, 8);
    } catch {
        initialStatement = null;
    }

    return (
        <div className="space-y-6" role="tabpanel" id="financials-panel">
            <StockProfileFinancialsClient symbol={canonicalSymbol} initialStatement={initialStatement} />
        </div>
    );
};

export default StockFinancialsPage;
