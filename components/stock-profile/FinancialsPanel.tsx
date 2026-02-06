"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StatementGrid, StatementRow, StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";

import ChartBuilder from "@/components/stock-profile/ChartBuilder";
import FinancialsTable, { collectExpandableIds, flattenRows } from "@/components/stock-profile/FinancialsTable";

type StatementKey = "income" | "balanceSheet" | "cashFlow";
type PeriodMode = "annual" | "quarterly";

const MAX_SERIES = 8;

const statementTabs: Array<{ key: StatementKey; label: string }> = [
    { key: "income", label: "Income Statement" },
    { key: "balanceSheet", label: "Balance Sheet" },
    { key: "cashFlow", label: "Cash Flow Statement" },
];

type FinancialsPanelProps = {
    profile: StockProfileV2Model;
};

const hasRowNumbers = (row: StatementRow, columnKeys: string[]) => {
    let numericCount = 0;
    for (const key of columnKeys) {
        const value = row.valuesByColumnKey[key];
        if (typeof value === "number" && Number.isFinite(value)) {
            numericCount += 1;
            if (numericCount >= 2) return true;
        }
    }
    return false;
};

export default function FinancialsPanel({ profile }: FinancialsPanelProps) {
    const [statement, setStatement] = useState<StatementKey>("income");
    const [periodMode, setPeriodMode] = useState<PeriodMode>("annual");
    const [expandedByPanel, setExpandedByPanel] = useState<Record<string, Set<string>>>({});
    const [selectedByStatement, setSelectedByStatement] = useState<Record<StatementKey, string[]>>({
        income: [],
        balanceSheet: [],
        cashFlow: [],
    });
    const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
    const [chartOpen, setChartOpen] = useState(false);

    const annualStatements = profile.financials.statements;
    const quarterlyStatements = profile.financials.statements?.quarterly;
    const hasQuarterly = Boolean(quarterlyStatements?.[statement]?.columns?.length);
    const effectivePeriodMode: PeriodMode = periodMode === "quarterly" && !hasQuarterly ? "annual" : periodMode;

    const activeGrid: StatementGrid | undefined =
        effectivePeriodMode === "quarterly"
            ? quarterlyStatements?.[statement]
            : annualStatements?.[statement];

    const periodKey = `${statement}-${effectivePeriodMode}`;
    const expandedIds = expandedByPanel[periodKey] || (activeGrid?.rows?.length ? collectExpandableIds(activeGrid.rows) : new Set<string>());

    const toggleExpand = (rowId: string) => {
        setExpandedByPanel((prev) => {
            const existing = new Set(expandedIds);
            if (existing.has(rowId)) {
                existing.delete(rowId);
            } else {
                existing.add(rowId);
            }
            return { ...prev, [periodKey]: existing };
        });
    };

    const flattenMap = useMemo(() => {
        const map = new Map<string, StatementRow>();
        if (!activeGrid?.rows?.length) return map;
        flattenRows(activeGrid.rows).forEach((row) => {
            map.set(row.id, row);
        });
        return map;
    }, [activeGrid]);

    const activeColumnKeys = useMemo(() => activeGrid?.columns.map((column) => column.key) || [], [activeGrid]);

    const currentSelectedIds = selectedByStatement[statement] || [];
    const validSelectedIds = currentSelectedIds.filter((id) => {
        const row = flattenMap.get(id);
        return row ? hasRowNumbers(row, activeColumnKeys) : false;
    });

    const selectedSeries = validSelectedIds
        .map((id) => flattenMap.get(id))
        .filter((row): row is StatementRow => Boolean(row))
        .map((row) => ({
            id: row.id,
            label: row.label,
            valueType: row.valueType,
            valuesByColumnKey: row.valuesByColumnKey,
        }));

    const toggleRowSelect = (row: StatementRow) => {
        const selectable = hasRowNumbers(row, activeColumnKeys);
        if (!selectable) return;

        setSelectionMessage(null);
        setSelectedByStatement((prev) => {
            const current = prev[statement] || [];
            const exists = current.includes(row.id);
            if (exists) {
                return {
                    ...prev,
                    [statement]: current.filter((id) => id !== row.id),
                };
            }

            if (current.length >= MAX_SERIES) {
                setSelectionMessage(`You can chart up to ${MAX_SERIES} metrics at once.`);
                return prev;
            }

            return {
                ...prev,
                [statement]: [...current, row.id],
            };
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">Financial Statements</h3>
                    <p className="text-sm text-muted-foreground">Select numeric rows to add them to Chart Builder.</p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="border-border/70 bg-[#0b111a] text-foreground"
                    onClick={() => setChartOpen(true)}
                >
                    Chart ({selectedSeries.length})
                </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex flex-wrap rounded-xl border border-border/70 bg-[#0b111a] p-1">
                    {statementTabs.map((tab) => {
                        const active = statement === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setStatement(tab.key)}
                                className={cn(
                                    "rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
                                    active
                                        ? "bg-primary/20 text-foreground"
                                        : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                                )}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="inline-flex rounded-xl border border-border/70 bg-[#0b111a] p-1 text-xs">
                    <button
                        type="button"
                        onClick={() => setPeriodMode("annual")}
                        className={cn(
                            "rounded-lg px-2.5 py-1 font-semibold uppercase tracking-wide transition",
                            effectivePeriodMode === "annual"
                                ? "bg-primary/20 text-foreground"
                                : "text-muted-foreground hover:bg-muted/20"
                        )}
                    >
                        FY
                    </button>
                    <button
                        type="button"
                        onClick={() => hasQuarterly && setPeriodMode("quarterly")}
                        disabled={!hasQuarterly}
                        className={cn(
                            "rounded-lg px-2.5 py-1 font-semibold uppercase tracking-wide transition",
                            effectivePeriodMode === "quarterly"
                                ? "bg-primary/20 text-foreground"
                                : "text-muted-foreground hover:bg-muted/20",
                            !hasQuarterly && "cursor-not-allowed opacity-50"
                        )}
                    >
                        FQ
                    </button>
                </div>
            </div>

            {selectionMessage ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    {selectionMessage}
                </div>
            ) : null}

            <FinancialsTable
                grid={activeGrid}
                fallbackCurrency={profile.company.currency}
                selectedIds={new Set(validSelectedIds)}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
                onToggleSelect={toggleRowSelect}
            />

            <ChartBuilder
                open={chartOpen}
                onOpenChange={setChartOpen}
                columns={activeGrid?.columns || []}
                series={selectedSeries}
                currency={activeGrid?.currency || profile.company.currency || "USD"}
            />
        </div>
    );
}

