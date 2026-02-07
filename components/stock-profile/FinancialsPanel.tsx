"use client";

import { useMemo, useState } from "react";

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

const buildDefaultChartTitle = (symbol: string, statementLabel: string) => `${symbol} - ${statementLabel} - Selected Metrics`;

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
    const [mobileChartOpen, setMobileChartOpen] = useState(true);
    const [chartTitleByStatement, setChartTitleByStatement] = useState<Record<StatementKey, string>>({
        income: "",
        balanceSheet: "",
        cashFlow: "",
    });
    const [seriesColorsByStatement, setSeriesColorsByStatement] = useState<Record<StatementKey, Record<string, string>>>({
        income: {},
        balanceSheet: {},
        cashFlow: {},
    });

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
            const baseIds = prev[periodKey]
                ? new Set(prev[periodKey])
                : activeGrid?.rows?.length
                    ? collectExpandableIds(activeGrid.rows)
                    : new Set<string>();

            if (baseIds.has(rowId)) {
                baseIds.delete(rowId);
            } else {
                baseIds.add(rowId);
            }

            return { ...prev, [periodKey]: baseIds };
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

    const activeStatementLabel = statementTabs.find((tab) => tab.key === statement)?.label || "Statement";
    const visiblePeriodCount = (activeGrid?.columns || []).filter((column) => column.type !== "ttm").length;
    const periodLabel = effectivePeriodMode === "annual"
        ? `FY (${visiblePeriodCount || 0}Y)`
        : `FQ (${visiblePeriodCount || 0}Q)`;

    const defaultChartTitle = buildDefaultChartTitle(profile.finnhubSymbol, activeStatementLabel);
    const activeChartTitle = chartTitleByStatement[statement] || defaultChartTitle;
    const activeSeriesColors = seriesColorsByStatement[statement] || {};

    const handleTitleChange = (title: string) => {
        setChartTitleByStatement((prev) => ({
            ...prev,
            [statement]: title,
        }));
    };

    const handleSeriesColorChange = (seriesId: string, color: string) => {
        setSeriesColorsByStatement((prev) => ({
            ...prev,
            [statement]: {
                ...(prev[statement] || {}),
                [seriesId]: color,
            },
        }));
    };

    const toggleRowSelect = (row: StatementRow) => {
        const selectable = hasRowNumbers(row, activeColumnKeys);
        if (!selectable) return;

        const current = selectedByStatement[statement] || [];
        const exists = current.includes(row.id);

        if (!exists && current.length >= MAX_SERIES) {
            setSelectionMessage(`You can chart up to ${MAX_SERIES} metrics at once.`);
            return;
        }

        setSelectionMessage(null);
        setSelectedByStatement((prev) => {
            const prevCurrent = prev[statement] || [];
            const prevExists = prevCurrent.includes(row.id);
            const next = prevExists ? prevCurrent.filter((id) => id !== row.id) : [...prevCurrent, row.id];
            return {
                ...prev,
                [statement]: next,
            };
        });
    };

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:items-start">
            <div className="space-y-4">
                <div className="rounded-xl border border-border/80 bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">Financial Statements</h3>
                            <p className="mt-1 text-xs text-muted-foreground">Select numeric rows to add them to the chart builder.</p>
                        </div>
                        <span className="rounded-md border border-border/70 bg-muted/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {periodLabel}
                        </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="inline-flex flex-wrap rounded-lg border border-border/70 bg-muted/15 p-1">
                            {statementTabs.map((tab) => {
                                const active = statement === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setStatement(tab.key)}
                                        className={cn(
                                            "rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition",
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

                        <div className="inline-flex rounded-lg border border-border/70 bg-muted/15 p-1 text-xs">
                            <button
                                type="button"
                                onClick={() => setPeriodMode("annual")}
                                className={cn(
                                    "rounded-md px-2.5 py-1 font-semibold uppercase tracking-[0.12em] transition",
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
                                    "rounded-md px-2.5 py-1 font-semibold uppercase tracking-[0.12em] transition",
                                    effectivePeriodMode === "quarterly"
                                        ? "bg-primary/20 text-foreground"
                                        : "text-muted-foreground hover:bg-muted/20",
                                    !hasQuarterly && "cursor-not-allowed opacity-50"
                                )}
                            >
                                FQ
                            </button>
                        </div>

                        <span className="text-[11px] text-muted-foreground">Displays up to 10 periods when available.</span>
                    </div>

                    <div className="mt-3 rounded-lg border border-border/70 bg-muted/10 p-2.5 lg:hidden">
                        <button
                            type="button"
                            onClick={() => setMobileChartOpen((prev) => !prev)}
                            className="w-full text-left text-xs font-semibold uppercase tracking-[0.12em] text-foreground"
                        >
                            {mobileChartOpen ? "Hide chart builder" : "Show chart builder"} ({selectedSeries.length})
                        </button>
                        {mobileChartOpen ? (
                            <div className="mt-3">
                                <ChartBuilder
                                    columns={activeGrid?.columns || []}
                                    series={selectedSeries}
                                    currency={activeGrid?.currency || profile.company.currency || "USD"}
                                    symbol={profile.finnhubSymbol}
                                    statementLabel={activeStatementLabel}
                                    periodLabel={periodLabel}
                                    title={activeChartTitle}
                                    onTitleChange={handleTitleChange}
                                    seriesColors={activeSeriesColors}
                                    onSeriesColorChange={handleSeriesColorChange}
                                />
                            </div>
                        ) : null}
                    </div>

                    {selectionMessage ? (
                        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                            {selectionMessage}
                        </div>
                    ) : null}

                    <div className="mt-3">
                        <FinancialsTable
                            grid={activeGrid}
                            fallbackCurrency={profile.company.currency}
                            selectedIds={new Set(validSelectedIds)}
                            expandedIds={expandedIds}
                            onToggleExpand={toggleExpand}
                            onToggleSelect={toggleRowSelect}
                        />
                    </div>
                </div>
            </div>

            <div className="hidden lg:block lg:sticky lg:top-24">
                <ChartBuilder
                    columns={activeGrid?.columns || []}
                    series={selectedSeries}
                    currency={activeGrid?.currency || profile.company.currency || "USD"}
                    symbol={profile.finnhubSymbol}
                    statementLabel={activeStatementLabel}
                    periodLabel={periodLabel}
                    title={activeChartTitle}
                    onTitleChange={handleTitleChange}
                    seriesColors={activeSeriesColors}
                    onSeriesColorChange={handleSeriesColorChange}
                />
            </div>
        </div>
    );
}
