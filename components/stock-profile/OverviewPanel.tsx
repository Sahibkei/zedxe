"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import TradingViewWidget from "@/components/TradingViewWidget";
import KeyMetricsGrid from "@/components/stock-profile/KeyMetricsGrid";
import {
    calculateCagr,
    formatCurrencyShort,
    formatInteger,
    formatPercent,
    formatRatio,
} from "@/components/stock-profile/formatters";
import { CANDLE_CHART_WIDGET_CONFIG } from "@/lib/constants";
import type { StatementGrid, StatementRow, StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";
import { cn } from "@/lib/utils";

type TimeframeOption = {
    key: string;
    interval: string;
};

const TIMEFRAMES: TimeframeOption[] = [
    { key: "1D", interval: "5" },
    { key: "5D", interval: "30" },
    { key: "1M", interval: "60" },
    { key: "3M", interval: "D" },
    { key: "6M", interval: "D" },
    { key: "YTD", interval: "W" },
    { key: "1Y", interval: "W" },
    { key: "5Y", interval: "M" },
    { key: "MAX", interval: "M" },
];

type OverviewPanelProps = {
    profile: StockProfileV2Model;
    symbol: string;
    marketCap?: number;
    newsItems: MarketNewsArticle[];
};

const getRelativeTime = (unixSeconds?: number) => {
    if (!unixSeconds) return "Just now";
    const diff = Math.max(0, Date.now() - unixSeconds * 1000);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

const findRowById = (rows: StatementRow[], targetId: string): StatementRow | undefined => {
    for (const row of rows) {
        if (row.id === targetId) return row;
        if (row.children?.length) {
            const found = findRowById(row.children, targetId);
            if (found) return found;
        }
    }
    return undefined;
};

const readValue = (grid: StatementGrid | undefined, rowId: string, column = "ttm") => {
    if (!grid?.rows?.length) return undefined;
    const row = findRowById(grid.rows, rowId);
    return row?.valuesByColumnKey[column];
};

const normalizeRows = (rows: Array<{ label: string; value: string }>) => rows.filter((row) => row.value && row.value !== "--");

export default function OverviewPanel({ profile, symbol, marketCap, newsItems }: OverviewPanelProps) {
    const [timeframe, setTimeframe] = useState("1Y");
    const [expandedDescription, setExpandedDescription] = useState(false);

    const selectedTimeframe = TIMEFRAMES.find((option) => option.key === timeframe) || TIMEFRAMES[6];
    const chartConfig = useMemo(
        () => ({
            ...CANDLE_CHART_WIDGET_CONFIG(symbol),
            interval: selectedTimeframe.interval,
            withdateranges: true,
        }),
        [selectedTimeframe.interval, symbol]
    );

    const metricSections = useMemo(() => {
        const income = profile.financials.statements?.income;
        const cashFlow = profile.financials.statements?.cashFlow;
        const balanceSheet = profile.financials.statements?.balanceSheet;

        const revenueTtm = readValue(income, "revenue");
        const grossProfitTtm = readValue(income, "gross-profit");
        const operatingIncomeTtm = readValue(income, "operating-income");
        const netIncomeTtm = readValue(income, "net-income");
        const sharesDilutedTtm = readValue(income, "shares-diluted");

        const operatingCashFlowTtm = readValue(cashFlow, "operating-cash-flow");
        const capexTtm = readValue(cashFlow, "capex");
        const depreciationTtm = readValue(cashFlow, "depreciation");

        const shortDebt = readValue(balanceSheet, "debt-current");
        const longDebt = readValue(balanceSheet, "debt-long");
        const cash = readValue(balanceSheet, "cash");

        const freeCashFlowTtm =
            typeof operatingCashFlowTtm === "number" && typeof capexTtm === "number"
                ? operatingCashFlowTtm + capexTtm
                : undefined;

        const ebitdaTtm =
            typeof operatingIncomeTtm === "number" && typeof depreciationTtm === "number"
                ? operatingIncomeTtm + depreciationTtm
                : undefined;

        const totalDebt =
            typeof shortDebt === "number" || typeof longDebt === "number"
                ? (shortDebt || 0) + (longDebt || 0)
                : undefined;

        const marketCapValue = marketCap || profile.company.marketCap;
        const enterpriseValue =
            typeof marketCapValue === "number" && typeof totalDebt === "number"
                ? marketCapValue + totalDebt - (cash || 0)
                : undefined;

        const evSales =
            typeof enterpriseValue === "number" && typeof revenueTtm === "number" && revenueTtm !== 0
                ? enterpriseValue / revenueTtm
                : undefined;

        const pFcf =
            typeof marketCapValue === "number" && typeof freeCashFlowTtm === "number" && freeCashFlowTtm !== 0
                ? marketCapValue / freeCashFlowTtm
                : undefined;

        const grossMargin =
            typeof revenueTtm === "number" && revenueTtm !== 0 && typeof grossProfitTtm === "number"
                ? (grossProfitTtm / revenueTtm) * 100
                : undefined;
        const ebitdaMargin =
            typeof revenueTtm === "number" && revenueTtm !== 0 && typeof ebitdaTtm === "number"
                ? (ebitdaTtm / revenueTtm) * 100
                : undefined;
        const operatingMargin =
            typeof revenueTtm === "number" && revenueTtm !== 0 && typeof operatingIncomeTtm === "number"
                ? (operatingIncomeTtm / revenueTtm) * 100
                : undefined;
        const netMargin =
            typeof revenueTtm === "number" && revenueTtm !== 0 && typeof netIncomeTtm === "number"
                ? (netIncomeTtm / revenueTtm) * 100
                : undefined;
        const fcfMargin =
            typeof revenueTtm === "number" && revenueTtm !== 0 && typeof freeCashFlowTtm === "number"
                ? (freeCashFlowTtm / revenueTtm) * 100
                : undefined;

        const annual = profile.financials.annual || [];
        const rev3YearCagr = calculateCagr(annual[0]?.revenue, annual[3]?.revenue, 3);
        const rev5YearCagr = calculateCagr(annual[0]?.revenue, annual[5]?.revenue, 5);
        const eps3YearCagr = calculateCagr(annual[0]?.eps, annual[3]?.eps, 3);
        const eps5YearCagr = calculateCagr(annual[0]?.eps, annual[5]?.eps, 5);

        const currency = profile.company.currency || "USD";

        return [
            {
                title: "Profile",
                rows: normalizeRows([
                    { label: "Market Cap", value: formatCurrencyShort(marketCapValue, currency) },
                    { label: "EV", value: formatCurrencyShort(enterpriseValue, currency) },
                    { label: "Shares Out", value: formatInteger(profile.company.shareOutstanding || sharesDilutedTtm) },
                    { label: "Revenue (TTM)", value: formatCurrencyShort(revenueTtm, currency) },
                    { label: "Employees", value: formatInteger(profile.company.employees) },
                ]),
            },
            {
                title: "Valuation (TTM)",
                rows: normalizeRows([
                    { label: "P/E", value: formatRatio(profile.metrics.pe) },
                    { label: "P/B", value: formatRatio(profile.metrics.pb) },
                    { label: "EV/Sales", value: formatRatio(evSales) },
                    { label: "EV/EBITDA", value: formatRatio(profile.metrics.evToEbitda) },
                    { label: "P/FCF", value: formatRatio(pFcf) },
                ]),
            },
            {
                title: "Growth (CAGR)",
                rows: normalizeRows([
                    { label: "Revenue 3Y", value: formatPercent(rev3YearCagr) },
                    { label: "Revenue 5Y", value: formatPercent(rev5YearCagr) },
                    { label: "EPS 3Y", value: formatPercent(eps3YearCagr) },
                    { label: "EPS 5Y", value: formatPercent(eps5YearCagr) },
                ]),
            },
            {
                title: "Margins",
                rows: normalizeRows([
                    { label: "Gross", value: formatPercent(grossMargin) },
                    { label: "EBITDA", value: formatPercent(ebitdaMargin) },
                    { label: "Operating", value: formatPercent(operatingMargin) },
                    { label: "Net", value: formatPercent(netMargin) },
                    { label: "FCF", value: formatPercent(fcfMargin) },
                ]),
            },
            {
                title: "Dividends",
                rows: normalizeRows([
                    { label: "Yield", value: formatPercent(profile.metrics.dividendYieldPercent) },
                ]),
            },
        ];
    }, [marketCap, profile]);

    const longDescription = profile.company.description || "Company overview is unavailable for this symbol.";
    const shouldClampDescription = longDescription.length > 360;
    const descriptionText =
        shouldClampDescription && !expandedDescription
            ? `${longDescription.slice(0, 360).trimEnd()}...`
            : longDescription;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
                <div className="space-y-4">
                    <section className="rounded-xl border border-border/80 bg-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">Company Overview</h3>
                            {profile.company.website ? (
                                <a
                                    href={profile.company.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary hover:underline"
                                >
                                    Visit website
                                </a>
                            ) : null}
                        </div>

                        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Exchange</dt>
                                <dd className="mt-1 font-medium text-foreground">{profile.company.exchange || "Unavailable"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Country</dt>
                                <dd className="mt-1 font-medium text-foreground">{profile.company.country || "Unavailable"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Industry</dt>
                                <dd className="mt-1 font-medium text-foreground">{profile.company.industry || "Unavailable"}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Currency</dt>
                                <dd className="mt-1 font-medium text-foreground">{profile.company.currency || "Unavailable"}</dd>
                            </div>
                        </dl>

                        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{descriptionText}</p>
                        {shouldClampDescription ? (
                            <button
                                type="button"
                                className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary hover:underline"
                                onClick={() => setExpandedDescription((prev) => !prev)}
                            >
                                {expandedDescription ? "Read less" : "Read more"}
                            </button>
                        ) : null}
                    </section>

                    <KeyMetricsGrid sections={metricSections} />
                </div>

                <section className="rounded-xl border border-border/80 bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Price Performance</p>
                            <h3 className="text-base font-semibold text-foreground">Interactive Price Chart</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
                            {TIMEFRAMES.map((option) => {
                                const isActive = option.key === timeframe;
                                return (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setTimeframe(option.key)}
                                        className={cn(
                                            "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition",
                                            isActive
                                                ? "bg-primary/20 text-foreground"
                                                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                                        )}
                                    >
                                        {option.key}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <TradingViewWidget
                        scripUrl="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
                        config={chartConfig}
                        className="custom-chart"
                        height={660}
                    />
                </section>
            </div>

            <section className="rounded-xl border border-border/80 bg-card p-4">
                <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">Market News</h3>
                    <Link href="/news" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary hover:underline">
                        View all
                    </Link>
                </div>

                {newsItems.length === 0 ? (
                    <div className="rounded-lg border border-border/70 bg-muted/15 p-3 text-sm text-muted-foreground">
                        Market news is unavailable right now.
                    </div>
                ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                        {newsItems.slice(0, 6).map((item) => (
                            <a
                                key={`${item.url}-${item.id}`}
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg border border-border/70 bg-muted/15 p-3 transition hover:bg-muted/25"
                            >
                                <p className="text-sm font-medium text-foreground">{item.headline}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {item.source || "Market"} | {getRelativeTime(item.datetime)}
                                </p>
                            </a>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}