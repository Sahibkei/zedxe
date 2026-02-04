"use client";

import { useEffect, useMemo, useState } from "react";
import type { StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";
import { cn } from "@/lib/utils";
import { FinancialStatementTable, collectExpandableIds } from "./components/FinancialStatementTable";
import FinancialSummaryTable from "@/src/components/finance/FinancialSummaryTable";

export default function StockFinancialStatementsSection({ profile }: { profile: StockProfileV2Model }) {
    const [financialView, setFinancialView] = useState<"summary" | "income" | "balance" | "cashflow">("summary");
    const [expandedState, setExpandedState] = useState<Record<string, Set<string>>>({});
    const statements = profile.financials.statements;

    const financialOptions = useMemo(
        () => [
            { key: "summary", label: "Summary" },
            { key: "income", label: "Income" },
            { key: "balance", label: "Balance Sheet" },
            { key: "cashflow", label: "Cash Flow" },
        ],
        []
    );

    const activeGrid =
        financialView === "income"
            ? statements?.income
            : financialView === "balance"
              ? statements?.balanceSheet
              : financialView === "cashflow"
                ? statements?.cashFlow
                : undefined;

    useEffect(() => {
        setExpandedState({});
    }, [profile.finnhubSymbol]);

    useEffect(() => {
        if (!activeGrid) return;
        setExpandedState((prev) => {
            if (prev[financialView]) return prev;
            return { ...prev, [financialView]: collectExpandableIds(activeGrid.rows) };
        });
    }, [activeGrid, financialView]);

    const handleToggleRow = (rowId: string) => {
        setExpandedState((prev) => {
            const current = prev[financialView]
                ? new Set(prev[financialView])
                : collectExpandableIds(activeGrid?.rows || []);

            if (current.has(rowId)) {
                current.delete(rowId);
            } else {
                current.add(rowId);
            }

            return { ...prev, [financialView]: current };
        });
    };

    const currentExpanded = expandedState[financialView];

    return (
        <div className="space-y-4">
            <p className="text-xs text-slate-400">
                Values are in reported currency; figures shown in compact format (K/M/B/T).
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <div
                    className="inline-flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 text-sm"
                    role="tablist"
                    aria-label="Financial statements"
                >
                    {financialOptions.map((option) => {
                        const isActive = financialView === option.key;
                        return (
                            <button
                                key={option.key}
                                onClick={() => setFinancialView(option.key as typeof financialView)}
                                className={cn(
                                    "rounded-xl px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                                    isActive
                                        ? "bg-primary/10 text-slate-100 shadow-sm ring-1 ring-primary/50"
                                        : "text-slate-400 hover:bg-white/10 hover:text-slate-100"
                                )}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {financialView === "summary" ? (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-100">Annual (last 5)</p>
                        <FinancialSummaryTable
                            rows={profile.financials.annual}
                            title="Annual"
                            fallbackCurrency={profile.company.currency}
                        />
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-100">Quarterly (recent)</p>
                        <FinancialSummaryTable
                            rows={profile.financials.quarterly}
                            title="Quarterly"
                            fallbackCurrency={profile.company.currency}
                        />
                    </div>
                </div>
            ) : (
                <FinancialStatementTable
                    grid={activeGrid}
                    fallbackCurrency={profile.company.currency}
                    expanded={currentExpanded}
                    onToggleRow={handleToggleRow}
                />
            )}
        </div>
    );
}
