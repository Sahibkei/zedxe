"use client";

import { useMemo, useState } from "react";
import { FinancialStatementEntry, FilingItem, StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";

const tabOptions = [
    { key: "financials", label: "Financials" },
    { key: "ratios", label: "Ratios" },
    { key: "earnings", label: "Earnings" },
    { key: "filings", label: "Filings" },
] as const;

type TabKey = (typeof tabOptions)[number]["key"];

function formatCurrency(value?: number) {
    if (value === undefined || value === null || Number.isNaN(value)) return "—";
    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
    });
    return formatter.format(value);
}

function isMissingNumber(value?: number) {
    return value === null || value === undefined || Number.isNaN(value);
}

function formatPercentFromFraction(value?: number) {
    if (isMissingNumber(value)) return "—";
    return `${(value * 100).toFixed(2)}%`;
}

function formatRatio(value?: number, suffix = "") {
    if (value === undefined || value === null || Number.isNaN(value)) return "—";
    return `${value.toFixed(2)}${suffix}`;
}

function buildSecArchiveUrl(cik?: string | number, accessionNumber?: string, primaryDocument?: string) {
    if (!cik || !accessionNumber || !primaryDocument) return undefined;

    const accPlain = accessionNumber.replace(/-/g, "");
    const cikNumeric = Number(cik);

    if (Number.isNaN(cikNumeric)) return undefined;

    const cikPlain = String(cikNumeric);
    return `https://www.sec.gov/Archives/edgar/data/${cikPlain}/${accPlain}/${primaryDocument}`;
}

function Table({ title, data }: { title: string; data: FinancialStatementEntry[] }) {
    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950/50">
                <table className="min-w-full text-left text-sm text-neutral-200">
                    <thead className="bg-neutral-900 text-xs uppercase text-neutral-400">
                        <tr>
                            <th className="px-4 py-3">Period</th>
                            <th className="px-4 py-3">Revenue</th>
                            <th className="px-4 py-3">Gross Profit</th>
                            <th className="px-4 py-3">Operating Income</th>
                            <th className="px-4 py-3">Net Income</th>
                            <th className="px-4 py-3">EPS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td className="px-4 py-3 text-center text-neutral-400" colSpan={6}>
                                    No data available
                                </td>
                            </tr>
                        ) : (
                            data.map((row) => (
                                <tr key={`${row.fiscalYear}-${row.fiscalDate}`} className="border-t border-neutral-800">
                                    <td className="px-4 py-3 text-neutral-300">{row.fiscalYear}</td>
                                    <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
                                    <td className="px-4 py-3">{formatCurrency(row.grossProfit)}</td>
                                    <td className="px-4 py-3">{formatCurrency(row.operatingIncome)}</td>
                                    <td className="px-4 py-3">{formatCurrency(row.netIncome)}</td>
                                    <td className="px-4 py-3">{row.eps?.toFixed(2) ?? "—"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function FinancialsPanel({ profile }: { profile: StockProfileV2Model }) {
    return (
        <div className="space-y-4">
            <Table title="Annual" data={profile.financialsAnnual} />
            <Table title="Quarterly" data={profile.financialsQuarterly} />
        </div>
    );
}

function RatiosPanel({ profile }: { profile: StockProfileV2Model }) {
    const ratioItems = useMemo(
        () => [
            { label: "P/E", value: formatRatio(profile.ratios.pe) },
            { label: "P/B", value: formatRatio(profile.ratios.pb) },
            { label: "P/S", value: formatRatio(profile.ratios.ps) },
            { label: "EV/EBITDA", value: formatRatio(profile.ratios.evToEbitda) },
            { label: "Debt/Equity", value: formatRatio(profile.ratios.debtToEquity) },
            { label: "Current Ratio", value: formatRatio(profile.ratios.currentRatio) },
            { label: "Dividend Yield", value: formatPercentFromFraction(profile.ratios.dividendYield) },
        ],
        [profile.ratios]
    );

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ratioItems.map((item) => (
                <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/50 px-4 py-3"
                >
                    <span className="text-sm text-neutral-400">{item.label}</span>
                    <span className="text-base font-semibold text-white">{item.value}</span>
                </div>
            ))}
        </div>
    );
}

function EarningsPanel({ profile }: { profile: StockProfileV2Model }) {
    const cards = [
        {
            title: "Latest Quarter",
            data: profile.earningsLatestQuarter,
        },
        {
            title: "Latest Annual",
            data: profile.earningsLatestAnnual,
        },
    ];

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((card) => (
                <div
                    key={card.title}
                    className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4"
                >
                    <div className="mb-2 flex items-center justify-between text-sm text-neutral-400">
                        <span>{card.title}</span>
                        <span>{card.data?.period ?? "—"}</span>
                    </div>
                    <div className="space-y-2 text-sm text-neutral-300">
                        <div className="flex items-center justify-between">
                            <span>EPS</span>
                            <span className="font-semibold text-white">{card.data?.eps?.toFixed(2) ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Consensus EPS</span>
                            <span>{card.data?.consensusEps?.toFixed(2) ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Surprise</span>
                            <span>{formatPercentFromFraction(card.data?.surprisePercent)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Revenue</span>
                            <span>{isMissingNumber(card.data?.revenue) ? "—" : formatCurrency(card.data?.revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Revenue YoY</span>
                            <span>{formatPercentFromFraction(card.data?.revenueYoYPercent)}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function FilingsPanel({ profile }: { profile: StockProfileV2Model }) {
    const { filings } = profile;
    const keyFilings = [
        { label: "Latest 10-Q", item: filings.latest10Q },
        { label: "Latest 10-K", item: filings.latest10K },
    ];

    const renderFilingLink = (item?: FilingItem) => {
        const derivedUrl = item?.url ?? buildSecArchiveUrl(item?.cik, item?.accessionNumber, item?.primaryDocument);

        if (!derivedUrl) {
            return <div className="text-neutral-500">Link available when data provider is connected</div>;
        }

        return (
            <a href={derivedUrl} className="text-yellow-400 hover:text-yellow-300" target="_blank" rel="noreferrer">
                View filing
            </a>
        );
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
                {keyFilings.map(({ label, item }) => (
                    <div key={label} className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
                        <div className="mb-2 text-sm text-neutral-400">{label}</div>
                        {item ? (
                            <div className="space-y-1 text-sm">
                                <div className="flex items-center justify-between text-white">
                                    <span>{item.formType}</span>
                                    <span className="text-neutral-300">{item.filingDate}</span>
                                </div>
                                <div className="text-neutral-400">Period end: {item.periodEnd}</div>
                                {renderFilingLink(item)}
                            </div>
                        ) : (
                            <div className="text-sm text-neutral-500">No filing data</div>
                        )}
                    </div>
                ))}
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-950/50">
                <div className="border-b border-neutral-800 px-4 py-3 text-sm font-semibold text-white">Recent Filings</div>
                <ul className="divide-y divide-neutral-800">
                    {filings.recent && filings.recent.length > 0 ? (
                        filings.recent.map((item, idx) => (
                            <li key={`${item.formType}-${item.filingDate}-${idx}`} className="px-4 py-3 text-sm text-neutral-300">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-semibold text-white">{item.formType}</span>
                                    <span className="text-neutral-400">{item.filingDate}</span>
                                </div>
                                <div className="text-neutral-400">Period end: {item.periodEnd}</div>
                                {renderFilingLink(item)}
                            </li>
                        ))
                    ) : (
                        <li className="px-4 py-3 text-sm text-neutral-500">No recent filings</li>
                    )}
                </ul>
            </div>
        </div>
    );
}

export default function StockProfileTabs({ profile }: { profile: StockProfileV2Model }) {
    const [activeTab, setActiveTab] = useState<TabKey>("financials");

    const renderContent = () => {
        switch (activeTab) {
            case "financials":
                return <FinancialsPanel profile={profile} />;
            case "ratios":
                return <RatiosPanel profile={profile} />;
            case "earnings":
                return <EarningsPanel profile={profile} />;
            case "filings":
                return <FilingsPanel profile={profile} />;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2" role="tablist">
                {tabOptions.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                                isActive
                                    ? "border-yellow-500 bg-yellow-500/10 text-yellow-200"
                                    : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700"
                            }`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
            <div role="tabpanel" className="space-y-4">
                {renderContent()}
            </div>
        </div>
    );
}
