"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { StockProfileFinancials } from "@/src/features/stock-profile-v2/contract/types";

const statementOptions = [
    { key: "incomeStatement", label: "Income Statement" },
    { key: "balanceSheet", label: "Balance Sheet" },
    { key: "cashFlow", label: "Cash Flow" },
] as const;

type StatementKey = (typeof statementOptions)[number]["key"];

type StatementRow = Record<string, string | number> & { year: string };

type StatementTable = {
    columns: { key: string; label: string; formatter?: (value: number) => string }[];
    rows: StatementRow[];
};

const formatCurrency = (value: number) =>
    value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    });

const formatNumber = (value: number) => value.toLocaleString("en-US");

const buildTables = (financials: StockProfileFinancials): Record<StatementKey, StatementTable> => ({
    incomeStatement: {
        columns: [
            { key: "revenue", label: "Revenue", formatter: formatCurrency },
            { key: "grossProfit", label: "Gross Profit", formatter: formatCurrency },
            { key: "operatingIncome", label: "Operating Income", formatter: formatCurrency },
            { key: "netIncome", label: "Net Income", formatter: formatCurrency },
            { key: "eps", label: "EPS", formatter: (value) => value.toFixed(2) },
        ],
        rows: financials.incomeStatement,
    },
    balanceSheet: {
        columns: [
            { key: "assets", label: "Total Assets", formatter: formatCurrency },
            { key: "liabilities", label: "Total Liabilities", formatter: formatCurrency },
            { key: "cash", label: "Cash", formatter: formatCurrency },
            { key: "debt", label: "Debt", formatter: formatCurrency },
        ],
        rows: financials.balanceSheet,
    },
    cashFlow: {
        columns: [
            { key: "operatingCashFlow", label: "Operating CF", formatter: formatCurrency },
            { key: "investingCashFlow", label: "Investing CF", formatter: formatCurrency },
            { key: "financingCashFlow", label: "Financing CF", formatter: formatCurrency },
            { key: "freeCashFlow", label: "Free Cash Flow", formatter: formatCurrency },
        ],
        rows: financials.cashFlow,
    },
});

const StockProfileFinancialsTable = ({ financials }: { financials: StockProfileFinancials }) => {
    const [activeStatement, setActiveStatement] = useState<StatementKey>("incomeStatement");
    const tables = useMemo(() => buildTables(financials), [financials]);
    const table = tables[activeStatement];

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#1c2432] pb-4">
                {statementOptions.map((option) => (
                    <button
                        key={option.key}
                        type="button"
                        onClick={() => setActiveStatement(option.key)}
                        className={cn(
                            "rounded-full px-4 py-2 text-xs font-semibold transition",
                            activeStatement === option.key
                                ? "bg-[#10151d] text-slate-100 shadow"
                                : "text-slate-400 hover:bg-[#10151d] hover:text-slate-200",
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <div className="mt-6 overflow-x-auto">
                <table className="min-w-[960px] w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="sticky left-0 z-10 bg-[#0d1117] px-4 py-3">Year</th>
                            {table.columns.map((column) => (
                                <th key={column.key} className="px-4 py-3">
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c2432]">
                        {table.rows.map((row) => (
                            <tr key={`${activeStatement}-${row.year}`} className="text-slate-300">
                                <td className="sticky left-0 bg-[#0d1117] px-4 py-3 font-medium text-slate-200">
                                    {row.year}
                                </td>
                                {table.columns.map((column) => {
                                    const rawValue = row[column.key];
                                    const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
                                    return (
                                        <td key={column.key} className="px-4 py-3">
                                            {Number.isNaN(value)
                                                ? "—"
                                                : column.formatter
                                                  ? column.formatter(value)
                                                  : formatNumber(value)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StockProfileFinancialsTable;
