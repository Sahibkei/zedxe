"use client";

import { useEffect, useMemo, useState } from "react";
import type { StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";
import { cn, formatMarketCapValue } from "@/lib/utils";
import { formatCompactFinancialValue } from "@/utils/formatters";
import FilingsTable from "@/src/components/finance/FilingsTable";
import { FinancialStatementTable, collectExpandableIds } from "./components/FinancialStatementTable";

const tabList = [
    { key: "overview", label: "Overview" },
    { key: "financials", label: "Financials" },
    { key: "ratios", label: "Key Ratios" },
    { key: "filings", label: "Filings" },
] as const;

type TabKey = (typeof tabList)[number]["key"];

function formatNumber(value?: number, options?: Intl.NumberFormatOptions) {
    if (value === undefined || value === null || Number.isNaN(value)) return "—";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, ...options }).format(value);
}

function formatPercent(value?: number) {
    if (value === undefined || value === null || Number.isNaN(value)) return "—";
    return `${value.toFixed(2)}%`;
}

function OverviewTab({ profile }: { profile: StockProfileV2Model }) {
    const description = profile.company.description || "Business description not available from current provider.";
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <p className="text-sm text-slate-400">Company</p>
                    <p className="text-xl font-semibold text-slate-100">{profile.company.name || profile.finnhubSymbol}</p>
                    {profile.company.website ? (
                        <a
                            href={profile.company.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary underline"
                        >
                            {profile.company.website}
                        </a>
                    ) : (
                        <p className="text-sm text-slate-400">Website not available.</p>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-200">
                    <div>
                        <p className="text-slate-400">Market Cap</p>
                        <p className="font-medium text-slate-100">
                            {profile.company.marketCap ? formatMarketCapValue(profile.company.marketCap) : "—"}
                        </p>
                    </div>
                    <div>
                        <p className="text-slate-400">Industry</p>
                        <p className="font-medium text-slate-100">{profile.company.industry || "—"}</p>
                    </div>
                    <div>
                        <p className="text-slate-400">Country</p>
                        <p className="font-medium text-slate-100">{profile.company.country || "—"}</p>
                    </div>
                    <div>
                        <p className="text-slate-400">Exchange</p>
                        <p className="font-medium text-slate-100">{profile.company.exchange || "—"}</p>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                <p className="text-sm font-medium text-slate-100">Business Overview</p>
                <p className="text-sm leading-relaxed text-slate-400">{description}</p>
            </div>
        </div>
    );
}

function RatioRow({ label, value, isPercent = false }: { label: string; value?: number; isPercent?: boolean }) {
    return (
        <div className="flex items-center justify-between border-b border-white/10 last:border-b-0 py-2 text-sm">
            <span className="text-slate-400">{label}</span>
            <span className="font-medium text-slate-100">{isPercent ? formatPercent(value) : formatNumber(value)}</span>
        </div>
    );
}

function RatiosTab({ profile }: { profile: StockProfileV2Model }) {
    const ratios = profile.metrics;
    return (
        <div className="rounded-lg border border-white/10 divide-y divide-white/10">
            <RatioRow label="P/E" value={ratios.pe} />
            <RatioRow label="P/B" value={ratios.pb} />
            <RatioRow label="P/S" value={ratios.ps} />
            <RatioRow label="EV/EBITDA" value={ratios.evToEbitda} />
            <RatioRow label="Debt/Equity" value={ratios.debtToEquity} />
            <RatioRow label="Current Ratio" value={ratios.currentRatio} />
            <RatioRow label="Dividend Yield" value={ratios.dividendYieldPercent} isPercent />
        </div>
    );
}

function formatFinancialValue(value?: number, currency?: string) {
    return formatCompactFinancialValue(value, currency);
}

function FinancialTable({
    rows,
    title,
    fallbackCurrency,
}: {
    rows: StockProfileV2Model["financials"]["annual"];
    title: string;
    fallbackCurrency?: string;
}) {
    if (!rows || rows.length === 0) {
        return <p className="text-sm text-muted-foreground">No data available.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left">
                        <th className="px-2 py-2">Period</th>
                        <th className="px-2 py-2">Revenue</th>
                        <th className="px-2 py-2">Gross Profit</th>
                        <th className="px-2 py-2">Operating Income</th>
                        <th className="px-2 py-2">Net Income</th>
                        <th className="px-2 py-2">EPS (Diluted)</th>
                        <th className="px-2 py-2">Operating CF</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={`${title}-${row.label}`} className="border-t">
                            <td className="px-2 py-2 font-medium">{row.label}</td>
                            <td className="px-2 py-2">{formatFinancialValue(row.revenue, row.currency ?? fallbackCurrency)}</td>
                            <td className="px-2 py-2">
                                {formatFinancialValue(row.grossProfit, row.currency ?? fallbackCurrency)}
                            </td>
                            <td className="px-2 py-2">
                                {formatFinancialValue(row.operatingIncome, row.currency ?? fallbackCurrency)}
                            </td>
                            <td className="px-2 py-2">
                                {formatFinancialValue(row.netIncome, row.currency ?? fallbackCurrency)}
                            </td>
                            <td className="px-2 py-2">{formatFinancialValue(row.eps, row.currency ?? fallbackCurrency)}</td>
                            <td className="px-2 py-2">
                                {formatFinancialValue(row.operatingCashFlow, row.currency ?? fallbackCurrency)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function FinancialsTab({ profile }: { profile: StockProfileV2Model }) {
    const [financialView, setFinancialView] = useState<'summary' | 'income' | 'balance' | 'cashflow'>("summary");
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
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Annual (last 5)</h3>
                        <FinancialTable
                            rows={profile.financials.annual}
                            title="annual"
                            fallbackCurrency={profile.company.currency}
                        />
                    </div>
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold">Quarterly (recent)</h3>
                        <FinancialTable
                            rows={profile.financials.quarterly}
                            title="quarterly"
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

function FilingsTab({ profile }: { profile: StockProfileV2Model }) {
    const symbol = profile.secTicker || profile.symbolRaw || profile.finnhubSymbol;
    return <FilingsTable symbol={symbol} />;
}

export default function StockProfileTabs({ profile }: { profile: StockProfileV2Model }) {
    const [activeTab, setActiveTab] = useState<TabKey>("overview");
    const companyInfoIncomplete = !profile.company?.name || !profile.company?.website;
    const financialsMissing = profile.financials.annual.length === 0 && profile.financials.quarterly.length === 0;
    const fundamentalsMissing = companyInfoIncomplete || financialsMissing;

    return (
        <div className="space-y-4">
            <div
                className="flex flex-wrap gap-6 border-b border-white/10 text-sm font-medium"
                role="tablist"
                aria-label="Stock profile sections"
            >
                {tabList.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const tabId = `${tab.key}-tab`;
                    const panelId = `${tab.key}-panel`;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "border-b-2 border-transparent pb-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                                isActive
                                    ? "border-primary text-slate-100"
                                    : "text-slate-400 hover:text-slate-100"
                            )}
                            role="tab"
                            type="button"
                            id={tabId}
                            aria-selected={isActive}
                            aria-controls={panelId}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {fundamentalsMissing && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                    We couldn’t load fundamentals for this symbol right now. Please try again.
                </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
                {tabList.map((tab) => {
                    const isActive = activeTab === tab.key;
                    const panelId = `${tab.key}-panel`;
                    const tabId = `${tab.key}-tab`;
                    return (
                        <div
                            key={tab.key}
                            role="tabpanel"
                            id={panelId}
                            aria-labelledby={tabId}
                            hidden={!isActive}
                        >
                            {tab.key === "overview" && isActive && <OverviewTab profile={profile} />}
                            {tab.key === "financials" && isActive && <FinancialsTab profile={profile} />}
                            {tab.key === "ratios" && isActive && <RatiosTab profile={profile} />}
                            {tab.key === "filings" && isActive && <FilingsTab profile={profile} />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
