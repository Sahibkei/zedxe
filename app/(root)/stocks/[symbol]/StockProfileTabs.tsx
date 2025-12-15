"use client";

import { useMemo, useState } from "react";
import type { StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";
import { formatMarketCapValue, formatPrice } from "@/lib/utils";

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

function formatCurrency(value?: number) {
    if (value === undefined || value === null || Number.isNaN(value)) return "—";
    return formatPrice(value);
}

function Callout({ title, messages }: { title: string; messages: string[] }) {
    if (messages.length === 0) return null;
    return (
        <div className="rounded-lg border border-yellow-400 bg-yellow-50 p-4 text-sm text-yellow-900">
            <p className="font-semibold">{title}</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
                {messages.map((msg, idx) => (
                    <li key={`${msg}-${idx}`}>{msg}</li>
                ))}
            </ul>
        </div>
    );
}

function DataStatus({ profile }: { profile: StockProfileV2Model }) {
    const messages = profile.providerStatus.map((s) => `${s.source.toUpperCase()}: ${s.message}`);
    const showUnavailable =
        profile.financials.annual.length === 0 && profile.financials.quarterly.length === 0 && messages.length > 0;

    if (!showUnavailable && messages.length === 0) return null;

    return (
        <div className="space-y-2">
            {showUnavailable && <Callout title="Data temporarily unavailable" messages={["Some provider requests failed."]} />}
            {messages.length > 0 && <Callout title="Provider status" messages={messages} />}
        </div>
    );
}

function OverviewTab({ profile }: { profile: StockProfileV2Model }) {
    const description = profile.company.description || "Business description not available from current provider.";
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="text-xl font-semibold">{profile.company.name || profile.finnhubSymbol}</p>
                    <a
                        href={profile.company.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 text-sm underline"
                    >
                        {profile.company.website}
                    </a>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Market Cap</p>
                        <p className="font-medium">
                            {profile.company.marketCap ? formatMarketCapValue(profile.company.marketCap) : "—"}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Industry</p>
                        <p className="font-medium">{profile.company.industry || "—"}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Country</p>
                        <p className="font-medium">{profile.company.country || "—"}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Exchange</p>
                        <p className="font-medium">{profile.company.exchange || "—"}</p>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                <p className="text-sm text-muted-foreground">Business Overview</p>
                <p className="text-sm leading-relaxed">{description}</p>
            </div>
        </div>
    );
}

function RatioRow({ label, value, isPercent = false }: { label: string; value?: number; isPercent?: boolean }) {
    return (
        <div className="flex items-center justify-between border-b last:border-b-0 py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{isPercent ? formatPercent(value) : formatNumber(value)}</span>
        </div>
    );
}

function RatiosTab({ profile }: { profile: StockProfileV2Model }) {
    const ratios = profile.metrics;
    return (
        <div className="rounded-lg border divide-y">
            <RatioRow label="P/E" value={ratios.pe} />
            <RatioRow label="P/B" value={ratios.pb} />
            <RatioRow label="P/S" value={ratios.ps} />
            <RatioRow label="EV/EBITDA" value={ratios.evToEbitda} />
            <RatioRow label="Dividend Yield" value={ratios.dividendYieldPercent} isPercent />
        </div>
    );
}

function FinancialTable({ rows, title }: { rows: StockProfileV2Model["financials"]["annual"]; title: string }) {
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
                            <td className="px-2 py-2">{formatNumber(row.revenue)}</td>
                            <td className="px-2 py-2">{formatNumber(row.operatingIncome)}</td>
                            <td className="px-2 py-2">{formatNumber(row.netIncome)}</td>
                            <td className="px-2 py-2">{formatNumber(row.eps)}</td>
                            <td className="px-2 py-2">{formatNumber(row.operatingCashFlow)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function FinancialsTab({ profile }: { profile: StockProfileV2Model }) {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Annual (last 5)</h3>
                <FinancialTable rows={profile.financials.annual} title="annual" />
            </div>
            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Quarterly (recent)</h3>
                <FinancialTable rows={profile.financials.quarterly} title="quarterly" />
            </div>
        </div>
    );
}

function FilingsTab({ profile }: { profile: StockProfileV2Model }) {
    if (!profile.filings || profile.filings.length === 0) {
        return <p className="text-sm text-muted-foreground">No filings available.</p>;
    }

    return (
        <div className="space-y-3">
            {profile.filings.map((filing, idx) => (
                <div key={`${filing.accessionNumber}-${idx}`} className="border rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold">{filing.formType}</span>
                        <span className="text-muted-foreground">{filing.filedAt || ""}</span>
                    </div>
                    <p className="text-muted-foreground">{filing.description || ""}</p>
                    {filing.link && (
                        <a href={filing.link} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">
                            View filing
                        </a>
                    )}
                </div>
            ))}
        </div>
    );
}

export default function StockProfileTabs({ profile }: { profile: StockProfileV2Model }) {
    const [activeTab, setActiveTab] = useState<TabKey>("overview");

    const headerMetrics = useMemo(() => {
        const price = profile.price?.current;
        const change = profile.price?.changePercent;
        return {
            price: price !== undefined ? formatCurrency(price) : "—",
            change: change !== undefined ? formatPercent(change) : "",
        };
    }, [profile.price]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                    <p className="text-sm text-muted-foreground">{profile.finnhubSymbol}</p>
                    <h2 className="text-2xl font-semibold">{profile.company.name || profile.finnhubSymbol}</h2>
                    <div className="text-sm text-muted-foreground">{headerMetrics.price}</div>
                    {headerMetrics.change && <div className="text-xs text-muted-foreground">{headerMetrics.change}</div>}
                </div>
                <div className="flex gap-2 overflow-x-auto">
                    {tabList.map((tab) => (
                        <button
                            key={tab.key}
                            className={`px-3 py-2 rounded-md text-sm border ${
                                activeTab === tab.key ? "bg-primary text-primary-foreground" : "bg-background"
                            }`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <DataStatus profile={profile} />

            {activeTab === "overview" && <OverviewTab profile={profile} />}
            {activeTab === "financials" && <FinancialsTab profile={profile} />}
            {activeTab === "ratios" && <RatiosTab profile={profile} />}
            {activeTab === "filings" && <FilingsTab profile={profile} />}
        </div>
    );
}
