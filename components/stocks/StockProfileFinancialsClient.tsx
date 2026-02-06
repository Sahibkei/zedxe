"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

import type { FinancialStatement } from "@/src/server/market-data/provider";
import StockProfileFinancialsTable from "@/components/stocks/StockProfileFinancialsTable";

const fetchFinancialStatement = async (
    symbol: string,
    statement: FinancialStatement["statement"],
    period: FinancialStatement["period"],
) => {
    const url = `/api/stocks/${symbol}/financials?statement=${statement}&period=${period}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error("Financial statement unavailable");
    }
    return res.json() as Promise<FinancialStatement>;
};

const StockProfileFinancialsClient = ({
    symbol,
    initialStatement,
}: {
    symbol: string;
    initialStatement: FinancialStatement | null;
}) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialPeriod = (searchParams.get("period") as FinancialStatement["period"]) || "annual";
    const urlStatement = searchParams.get("statement");
    const initialStatementKey = (["income", "balance", "cashflow"].includes(urlStatement ?? "")
        ? (urlStatement as FinancialStatement["statement"])
        : initialStatement?.statement) || "income";

    const [period, setPeriod] = useState<FinancialStatement["period"]>(initialPeriod);
    const [statement, setStatement] = useState<FinancialStatement["statement"]>(initialStatementKey);

    const { data, isLoading, error } = useQuery({
        queryKey: ["financial-statement", symbol, statement, period],
        queryFn: () => fetchFinancialStatement(symbol, statement, period),
        initialData: initialStatement?.statement === statement && initialStatement?.period === period ? initialStatement : undefined,
    });

    const updateUrl = (nextStatement: FinancialStatement["statement"], nextPeriod: FinancialStatement["period"]) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("statement", nextStatement);
        params.set("period", nextPeriod);
        router.replace(`?${params.toString()}`);
    };

    const handlePeriodChange = (nextPeriod: FinancialStatement["period"]) => {
        setPeriod(nextPeriod);
        updateUrl(statement, nextPeriod);
    };

    const handleStatementChange = (nextStatement: FinancialStatement["statement"]) => {
        setStatement(nextStatement);
        updateUrl(nextStatement, period);
    };

    const label = useMemo(
        () => (period === "annual" ? "Annual Statements" : "Quarterly Statements"),
        [period],
    );

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-5 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Financial Statements</p>
                        <h2 className="mt-2 text-lg font-semibold text-slate-100">{label}</h2>
                    </div>
                    <span className="rounded-full border border-[#1c2432] bg-[#0b0f14] px-3 py-1 text-xs font-mono text-slate-400">
                        {symbol}
                    </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                    Review the latest filings across income, balance sheet, and cash flow.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <button
                        type="button"
                        onClick={() => handlePeriodChange("annual")}
                        className={`rounded-full border px-3 py-1 ${
                            period === "annual"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                : "border-[#1c2432] text-slate-400"
                        }`}
                    >
                        FY
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePeriodChange("quarter")}
                        className={`rounded-full border px-3 py-1 ${
                            period === "quarter"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                : "border-[#1c2432] text-slate-400"
                        }`}
                    >
                        Quarterly
                    </button>
                </div>
            </div>

            <StockProfileFinancialsTable
                symbol={symbol}
                statement={statement}
                onStatementChange={handleStatementChange}
                data={data ?? null}
                isLoading={isLoading}
                error={error ? (error as Error).message : undefined}
            />
        </div>
    );
};

export default StockProfileFinancialsClient;
