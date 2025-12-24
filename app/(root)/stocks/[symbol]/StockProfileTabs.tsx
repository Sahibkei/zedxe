"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Globe2, Link2, MapPin, Phone } from "lucide-react";

import TradingViewWidget from "@/components/TradingViewWidget";
import OpenBBDashboardTabs, { type DashboardTabKey } from "@/components/openbb/OpenBBDashboardTabs";
import OpenBBWidgetShell from "@/components/openbb/OpenBBWidgetShell";
import { CANDLE_CHART_WIDGET_CONFIG } from "@/lib/constants";
import type { StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";
import { cn } from "@/lib/utils";
import { FinancialStatementTable, collectExpandableIds } from "./components/FinancialStatementTable";

type SnapshotLike = {
    symbol: string;
    company?: string;
    currentPrice?: number;
    changePercent?: number;
    marketCap?: number;
};

type StockProfileTabsProps = {
    profile: StockProfileV2Model;
    snapshot?: SnapshotLike;
    priceDisplay: string;
    marketCapDisplay: string;
    changePercent?: number;
};

const Pill = ({
    active,
    children,
    onClick,
    disabled,
    title,
}: {
    active?: boolean;
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-disabled={disabled}
        title={title}
        className={cn(
            "rounded-lg px-3 py-1 text-xs font-semibold transition",
            active ? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/40" : "bg-white/5 text-slate-300",
            disabled && "cursor-not-allowed opacity-60"
        )}
    >
        {children}
    </button>
);

export default function StockProfileTabs({
    profile,
    snapshot,
    priceDisplay,
    marketCapDisplay,
    changePercent,
}: StockProfileTabsProps) {
    const symbol = profile.finnhubSymbol;
    const [activeTab, setActiveTab] = useState<DashboardTabKey>("overview");
    const [statementView, setStatementView] = useState<"income" | "balance" | "cashflow">("income");
    const [expandedStatements, setExpandedStatements] = useState<Set<string>>(new Set());

    const effectiveChange = changePercent ?? snapshot?.changePercent;
    const changeDisplay =
        effectiveChange === undefined || effectiveChange === null || Number.isNaN(effectiveChange)
            ? "N/A"
            : `${effectiveChange >= 0 ? "+" : ""}${effectiveChange.toFixed(2)}%`;
    const priceChangeClass =
        effectiveChange === undefined || effectiveChange === null || Number.isNaN(effectiveChange)
            ? "text-slate-400"
            : effectiveChange >= 0
              ? "text-emerald-400"
              : "text-rose-400";

    const statementTabs = [
        { key: "income", label: "Income Statement" },
        { key: "balance", label: "Balance Sheet" },
        { key: "cashflow", label: "Cash Flow Statement" },
    ] as const;

    const activeGrid =
        statementView === "balance"
            ? profile.financials.statements?.balanceSheet
            : statementView === "cashflow"
              ? profile.financials.statements?.cashFlow
              : profile.financials.statements?.income;

    useEffect(() => {
        if (!activeGrid?.rows) return;
        setExpandedStatements(collectExpandableIds(activeGrid.rows));
    }, [activeGrid]);

    const industry = profile.company.industry || "N/A";
    const country = profile.company.country || "N/A";
    const exchange = profile.company.exchange || "N/A";
    const currency = profile.company.currency || "N/A";

    const renderOverview = () => (
        <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.05fr_1.95fr]">
                <div className="space-y-4">
                    <OpenBBWidgetShell title="Ticker Information" symbol={symbol} height={220}>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <p className="text-3xl font-semibold text-slate-50">{priceDisplay}</p>
                                <p className={cn("text-sm font-semibold", priceChangeClass)}>{changeDisplay}</p>
                            </div>
                            <div className="grid gap-2 text-xs text-slate-300">
                                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                                    <span>Currency</span>
                                    <span className="font-semibold text-slate-100">{currency}</span>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                                    <span>Market Cap</span>
                                    <span className="font-semibold text-slate-100">{marketCapDisplay || "N/A"}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                <span>Industry:</span>
                                <span className="font-medium text-slate-100">{industry}</span>
                                <span className="text-slate-500">|</span>
                                <span>Country:</span>
                                <span className="font-medium text-slate-100">{country}</span>
                                <span className="text-slate-500">|</span>
                                <span>Exchange:</span>
                                <span className="font-medium text-slate-100">{exchange}</span>
                            </div>
                        </div>
                    </OpenBBWidgetShell>

                    <OpenBBWidgetShell title="Ticker Profile" symbol={symbol} height={260}>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <p className="text-lg font-semibold text-slate-100">{profile.company.name || symbol}</p>
                                {profile.company.website ? (
                                    <a
                                        href={profile.company.website}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200"
                                    >
                                        <Link2 className="h-3.5 w-3.5" />
                                        {profile.company.website}
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </a>
                                ) : (
                                    <p className="text-sm text-slate-400">Website not available</p>
                                )}
                            </div>
                            <div className="grid gap-2 text-sm text-slate-200">
                                <div className="flex items-center gap-2 text-slate-300">
                                    <MapPin className="h-4 w-4 text-amber-300" />
                                    <span>{country}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Globe2 className="h-4 w-4 text-sky-300" />
                                    <span>
                                        Sector: <span className="font-semibold text-slate-100">{industry}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-300">
                                    <Phone className="h-4 w-4 text-purple-300" />
                                    <span>Exchange: {exchange}</span>
                                </div>
                            </div>
                            <div className="space-y-2 rounded-xl border border-white/5 bg-white/5 p-3">
                                <p className="text-sm font-semibold text-slate-100">Description</p>
                                <div className="max-h-28 overflow-y-auto pr-2 text-sm leading-relaxed text-slate-300">
                                    {profile.company.description
                                        ? profile.company.description
                                        : "Business description not available from the current provider."}
                                </div>
                            </div>
                        </div>
                    </OpenBBWidgetShell>
                </div>

                <OpenBBWidgetShell
                    title="Price Performance"
                    symbol={symbol}
                    className="min-h-[380px] overflow-hidden md:min-h-[460px]"
                >
                    <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20">
                        <TradingViewWidget
                            scripUrl="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
                            config={CANDLE_CHART_WIDGET_CONFIG(profile.tvSymbol || symbol)}
                            className="h-full w-full"
                            height={520}
                        />
                    </div>
                </OpenBBWidgetShell>
            </div>
        </div>
    );

    const renderFinancials = () => (
        <div className="space-y-4">
            <OpenBBWidgetShell
                title="Financial Statements"
                symbol={symbol}
                rightControls={
                    <div className="flex flex-wrap items-center gap-2">
                        {statementTabs.map((tab) => (
                            <Pill key={tab.key} active={statementView === tab.key} onClick={() => setStatementView(tab.key)}>
                                {tab.label}
                            </Pill>
                        ))}
                    </div>
                }
            >
                <FinancialStatementTable
                    grid={activeGrid}
                    fallbackCurrency={profile.company.currency}
                    expanded={expandedStatements}
                    onToggleRow={(id) =>
                        setExpandedStatements((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) {
                                next.delete(id);
                            } else {
                                next.add(id);
                            }
                            return next;
                        })
                    }
                />
            </OpenBBWidgetShell>
        </div>
    );

    return (
        <div className="space-y-4">
            <OpenBBDashboardTabs activeKey={activeTab} onChange={setActiveTab} />
            <div className="rounded-2xl border border-white/10 bg-[#0f141d]/80 p-4 shadow-2xl">
                {activeTab === "overview" && renderOverview()}
                {activeTab === "financials" && renderFinancials()}
            </div>
        </div>
    );
}
