"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockProfileV2 } from "@/src/features/stock-profile-v2/contract/types";

const tabOptions = [
    { key: "overview", label: "Overview" },
    { key: "financials", label: "Financials" },
    { key: "ratios", label: "Ratios" },
    { key: "earnings", label: "Earnings" },
    { key: "filings", label: "Filings" },
] as const;

type TabKey = (typeof tabOptions)[number]["key"];

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
    value.toLocaleString("en-US", options ?? { maximumFractionDigits: 0 });

const formatCurrency = (value: number) =>
    value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    });

const StockProfileTabs = ({ profile }: { profile: StockProfileV2 }) => {
    const [activeTab, setActiveTab] = useState<TabKey>("overview");

    const keyHighlights = useMemo(
        () => [
            `Sector focus: ${profile.overview.sector}`,
            `Industry leadership in ${profile.overview.industry}`,
            "Subscription-led recurring revenue model",
            "Global enterprise customer base",
        ],
        [profile.overview.industry, profile.overview.sector],
    );

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#1c2432] pb-4">
                {tabOptions.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                            "rounded-full px-4 py-2 text-sm font-medium transition",
                            activeTab === tab.key
                                ? "bg-[#10151d] text-slate-100 shadow"
                                : "text-slate-400 hover:bg-[#10151d] hover:text-slate-200",
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="pt-6">
                {activeTab === "overview" && (
                    <div className="space-y-5">
                        <div className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 p-4">
                            <p className="text-sm font-semibold text-slate-200">Business Summary</p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-400">{profile.overview.description}</p>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-200">Key Highlights</p>
                            <ul className="mt-3 grid gap-3 md:grid-cols-2">
                                {keyHighlights.map((highlight) => (
                                    <li
                                        key={highlight}
                                        className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 px-4 py-3 text-sm text-slate-300"
                                    >
                                        {highlight}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === "financials" && (
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 p-4">
                            <p className="text-sm font-semibold text-slate-200">Income Statement (Annual)</p>
                            <table className="mt-4 w-full text-xs text-slate-400">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                                        <th className="py-1">Year</th>
                                        <th className="py-1">Revenue</th>
                                        <th className="py-1">Net</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1c2432]">
                                    {profile.financials.incomeStatement.map((row) => (
                                        <tr key={row.year} className="text-slate-300">
                                            <td className="py-2 font-medium text-slate-200">{row.year}</td>
                                            <td className="py-2">{formatCurrency(row.revenue)}</td>
                                            <td className="py-2">{formatCurrency(row.netIncome)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 p-4">
                            <p className="text-sm font-semibold text-slate-200">Balance Sheet (Annual)</p>
                            <table className="mt-4 w-full text-xs text-slate-400">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                                        <th className="py-1">Year</th>
                                        <th className="py-1">Assets</th>
                                        <th className="py-1">Debt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1c2432]">
                                    {profile.financials.balanceSheet.map((row) => (
                                        <tr key={row.year} className="text-slate-300">
                                            <td className="py-2 font-medium text-slate-200">{row.year}</td>
                                            <td className="py-2">{formatCurrency(row.assets)}</td>
                                            <td className="py-2">{formatCurrency(row.debt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 p-4">
                            <p className="text-sm font-semibold text-slate-200">Cash Flow (Annual)</p>
                            <table className="mt-4 w-full text-xs text-slate-400">
                                <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                                        <th className="py-1">Year</th>
                                        <th className="py-1">Op CF</th>
                                        <th className="py-1">FCF</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1c2432]">
                                    {profile.financials.cashFlow.map((row) => (
                                        <tr key={row.year} className="text-slate-300">
                                            <td className="py-2 font-medium text-slate-200">{row.year}</td>
                                            <td className="py-2">{formatCurrency(row.operatingCashFlow)}</td>
                                            <td className="py-2">{formatCurrency(row.freeCashFlow)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === "ratios" && (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {profile.ratios.map((ratio) => (
                            <div
                                key={ratio.label}
                                className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 p-4"
                            >
                                <p className="text-xs uppercase tracking-wide text-slate-500">{ratio.label}</p>
                                <p className="mt-2 text-lg font-semibold text-slate-100">{ratio.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === "earnings" && (
                    <div className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 p-5">
                        <p className="text-sm font-semibold text-slate-200">Latest Quarter</p>
                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-500">Quarter</p>
                                <p className="mt-1 text-lg font-semibold text-slate-100">{profile.earnings.quarter}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-500">EPS</p>
                                <p className="mt-1 text-lg font-semibold text-slate-100">{profile.earnings.eps}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-slate-500">Revenue</p>
                                <p className="mt-1 text-lg font-semibold text-slate-100">{profile.earnings.revenue}</p>
                            </div>
                        </div>
                        <div className="mt-4 rounded-lg border border-[#1c2432] bg-[#0d1117]/80 px-4 py-3 text-sm text-slate-300">
                            Surprise: <span className="font-semibold text-emerald-300">{profile.earnings.surprise}</span>
                        </div>
                    </div>
                )}

                {activeTab === "filings" && (
                    <div className="space-y-3">
                        {profile.filings.map((filing) => (
                            <a
                                key={`${filing.type}-${filing.date}`}
                                href={filing.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 px-4 py-3 text-sm text-slate-300 transition hover:border-emerald-500/40 hover:bg-[#10151d]"
                            >
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-slate-500">{filing.type}</p>
                                    <p className="text-sm font-semibold text-slate-100">{filing.title}</p>
                                    <p className="text-xs text-slate-500">Filed {filing.date}</p>
                                </div>
                                <ExternalLink className="h-4 w-4 text-slate-500" />
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockProfileTabs;
