"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowUpRight, ChevronLeft, ChevronRight, Globe2, Link2, MapPin, Phone } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

import TradingViewWidget from "@/components/TradingViewWidget";
import OpenBBLayoutGrid from "@/components/openbb/OpenBBLayoutGrid";
import OpenBBDashboardTabs, { type DashboardTabKey } from "@/components/openbb/OpenBBDashboardTabs";
import OpenBBWidgetShell from "@/components/openbb/OpenBBWidgetShell";
import { OpenBBECharts } from "@/components/openbb/OpenBBECharts";
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

const USE_DEMO_DATA = process.env.NEXT_PUBLIC_USE_DEMO_DATA === "1";

const mockManagementTeam = [
    { name: "Greg Joswiak", title: "Senior Vice President", compensation: "-", currency: "USD" },
    { name: "Jeffrey E. Williams", title: "Senior Vice President", compensation: "5.02 M", currency: "USD" },
    { name: "Kevan Parekh", title: "Senior Vice President", compensation: "4.61 M", currency: "USD" },
    { name: "Sabih Khan", title: "Chief Operating Officer", compensation: "4.64 M", currency: "USD" },
];

const demoEarningsHistory = [
    { date: "2025-10-30", eps: 1.85, epsEst: 1.78, revenue: "102.466 B", revenueEst: "102.23 B" },
    { date: "2025-07-31", eps: 1.57, epsEst: 1.44, revenue: "94.036 B", revenueEst: "89.56 B" },
    { date: "2025-05-01", eps: 1.65, epsEst: 1.63, revenue: "95.359 B", revenueEst: "94.54 B" },
    { date: "2025-01-30", eps: 2.4, epsEst: 2.36, revenue: "124.300 B", revenueEst: "124.26 B" },
];

const demoDividendHistory = [
    { date: "2025-11-10", adjusted: 0.26, dividend: 0.26, recordDate: "2025-11-10", paymentDate: "2025-11-13" },
    { date: "2025-08-11", adjusted: 0.26, dividend: 0.26, recordDate: "2025-08-11", paymentDate: "2025-08-14" },
    { date: "2025-05-12", adjusted: 0.26, dividend: 0.26, recordDate: "2025-05-12", paymentDate: "2025-05-15" },
    { date: "2025-02-10", adjusted: 0.25, dividend: 0.25, recordDate: "2025-02-10", paymentDate: "2025-02-13" },
];

const demoBusinessLineData = [
    { label: "FY 2020", Mac: 30, iPhone: 140, Service: 65, Wearables: 32, iPad: 24, Other: 20 },
    { label: "FY 2021", Mac: 35, iPhone: 170, Service: 78, Wearables: 40, iPad: 27, Other: 22 },
    { label: "FY 2022", Mac: 38, iPhone: 185, Service: 86, Wearables: 45, iPad: 29, Other: 23 },
    { label: "FY 2023", Mac: 36, iPhone: 188, Service: 95, Wearables: 52, iPad: 31, Other: 24 },
    { label: "FY 2024", Mac: 42, iPhone: 205, Service: 108, Wearables: 58, iPad: 33, Other: 24 },
    { label: "FY 2025", Mac: 44, iPhone: 214, Service: 116, Wearables: 64, iPad: 35, Other: 26 },
    { label: "FY 2026", Mac: 46, iPhone: 223, Service: 124, Wearables: 69, iPad: 37, Other: 27 },
    { label: "FY 2027", Mac: 48, iPhone: 232, Service: 132, Wearables: 75, iPad: 38, Other: 28 },
    { label: "FY 2028", Mac: 49, iPhone: 240, Service: 139, Wearables: 78, iPad: 39, Other: 29 },
];

const demoRevenueSeries = [
    { label: "FY 2021", revenue: 365_817_000_000 },
    { label: "FY 2022", revenue: 394_328_000_000 },
    { label: "FY 2023", revenue: 383_285_000_000 },
    { label: "FY 2024", revenue: 391_035_000_000 },
    { label: "FY 2025", revenue: 416_161_000_000 },
];

const formatPercent = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) return "—";
    const prefix = value >= 0 ? "+" : "";
    return `${prefix}${value.toFixed(2)}%`;
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

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <p className="text-sm font-semibold text-slate-100">{children}</p>
);

const EmptyState = ({ message, compact }: { message: string; compact?: boolean }) => (
    <div
        className={cn(
            "flex items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/5 text-sm text-slate-300",
            compact ? "min-h-[60px] px-3 py-3" : "min-h-[120px] px-4 py-6"
        )}
    >
        <AlertCircle className="h-4 w-4 text-slate-400" />
        <span>{message}</span>
    </div>
);

const DemoBadge = () => (
    <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200 ring-1 ring-amber-400/40">
        Demo data
    </span>
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
    const [revenueView, setRevenueView] = useState<"annual" | "quarterly">("annual");
    const [valuationHorizon, setValuationHorizon] = useState<"fy" | "qtr" | "ttm">("fy");
    const [businessPage, setBusinessPage] = useState(0);

    const effectiveChange = changePercent ?? snapshot?.changePercent;
    const changeDisplay = useMemo(() => formatPercent(effectiveChange), [effectiveChange]);
    const priceChangeClass =
        effectiveChange === undefined || effectiveChange === null || Number.isNaN(effectiveChange)
            ? "text-slate-400"
            : effectiveChange >= 0
              ? "text-emerald-400"
              : "text-rose-400";

    const revenueSource = revenueView === "annual" ? profile.financials.annual : profile.financials.quarterly;
    const revenueSeries = useMemo(() => {
        if (revenueSource.length) return revenueSource;
        if (USE_DEMO_DATA) return demoRevenueSeries;
        return [];
    }, [revenueSource, revenueView]);
    const revenueIsDemo = !revenueSource.length && USE_DEMO_DATA;

    const revenueOption = useMemo(
        () => ({
            backgroundColor: "transparent",
            tooltip: { trigger: "axis" },
            grid: { left: 40, right: 20, top: 24, bottom: 40 },
            xAxis: {
                type: "category",
                data: revenueSeries.map((r) => r.label),
                axisLabel: { color: "#94a3b8", interval: 0, rotate: 20 },
                axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
            },
            yAxis: {
                type: "value",
                axisLabel: { color: "#94a3b8" },
                splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
            },
            series: [
                {
                    type: "line",
                    smooth: true,
                    data: revenueSeries.map((r) => r.revenue ?? 0),
                    lineStyle: { color: "#38bdf8", width: 3 },
                    areaStyle: { color: "rgba(56,189,248,0.14)" },
                    symbol: "circle",
                    symbolSize: 6,
                },
            ],
        }),
        [revenueSeries]
    );

    const valuationBase = revenueSeries.length ? revenueSeries : [];
    const valuationSeries = useMemo(() => {
        const base = valuationBase.length
            ? valuationBase
            : USE_DEMO_DATA
              ? demoRevenueSeries
              : [{ label: "Current", revenue: profile.company.marketCap ?? 1 }];
        const { pe = 18, ps = 5, pb = 6, evToEbitda = 14 } = profile.metrics;
        const sliced =
            valuationHorizon === "qtr"
                ? base.slice(0, Math.max(1, Math.min(8, base.length)))
                : valuationHorizon === "ttm"
                  ? base.slice(0, 1)
                  : base;
        return sliced.map((entry, idx) => ({
            label: entry.label,
            pe: Math.max(0, pe + idx * 0.4),
            ps: Math.max(0, (ps || 4) + idx * 0.2),
            pb: Math.max(0, (pb || 7) + idx * 0.15),
            evSales: Math.max(0, (ps || 4) + 1 + idx * 0.25),
            evEbitda: Math.max(0, (evToEbitda || 14) + idx * 0.35),
        }));
    }, [profile.company.marketCap, profile.metrics, valuationBase, valuationHorizon]);
    const valuationIsDemo = (!valuationBase.length && USE_DEMO_DATA) || revenueIsDemo;

    const valuationOption = useMemo(
        () => ({
            backgroundColor: "transparent",
            tooltip: { trigger: "axis" },
            legend: {
                data: ["P/E Ratio", "P/S Ratio", "P/B Ratio", "EV/Sales Ratio", "EV/EBITDA"],
                textStyle: { color: "#cbd5e1" },
            },
            grid: { left: 48, right: 20, top: 40, bottom: 50 },
            xAxis: {
                type: "category",
                data: valuationSeries.map((v) => v.label),
                axisLabel: { color: "#94a3b8", rotate: 25 },
                axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
            },
            yAxis: {
                type: "value",
                axisLabel: { color: "#94a3b8" },
                splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
            },
            series: [
                { name: "P/E Ratio", type: "line", smooth: true, data: valuationSeries.map((v) => v.pe), showSymbol: false },
                { name: "P/S Ratio", type: "line", smooth: true, data: valuationSeries.map((v) => v.ps), showSymbol: false },
                { name: "P/B Ratio", type: "line", smooth: true, data: valuationSeries.map((v) => v.pb), showSymbol: false },
                {
                    name: "EV/Sales Ratio",
                    type: "line",
                    smooth: true,
                    data: valuationSeries.map((v) => v.evSales),
                    showSymbol: false,
                },
                {
                    name: "EV/EBITDA",
                    type: "line",
                    smooth: true,
                    data: valuationSeries.map((v) => v.evEbitda),
                    showSymbol: false,
                },
            ],
        }),
        [valuationSeries]
    );

    const businessLineSeries = USE_DEMO_DATA ? demoBusinessLineData : [];
    const businessLineIsDemo = USE_DEMO_DATA && businessLineSeries.length > 0;
    const businessChunks = useMemo(() => {
        const size = 6;
        const chunks = [];
        for (let i = 0; i < businessLineSeries.length; i += size) {
            chunks.push(businessLineSeries.slice(i, i + size));
        }
        return chunks;
    }, [businessLineSeries]);
    const currentChunk = businessChunks[businessPage] ?? businessChunks[0];
    const businessLineOption = useMemo(() => {
        const segments = ["Mac", "iPhone", "Service", "Wearables", "iPad", "Other"];
        const xAxisData = currentChunk ? currentChunk.map((c) => c.label) : [];
        return {
            backgroundColor: "transparent",
            tooltip: { trigger: "axis" },
            legend: { data: segments, textStyle: { color: "#cbd5e1" } },
            grid: { left: 48, right: 20, top: 40, bottom: 64 },
            xAxis: {
                type: "category",
                data: xAxisData,
                axisLabel: { color: "#94a3b8", interval: 0, rotate: 20 },
                axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
            },
            yAxis: {
                type: "value",
                axisLabel: { color: "#94a3b8" },
                splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
            },
            series: segments.map((name) => ({
                name,
                type: "bar",
                stack: "total",
                emphasis: { focus: "series" },
                barWidth: 14,
                data: currentChunk?.map((entry: any) => entry[name] ?? 0) ?? [],
            })),
        };
    }, [businessPage, businessChunks, currentChunk]);

    const managementTeam = USE_DEMO_DATA ? mockManagementTeam : [];
    const managementIsDemo = USE_DEMO_DATA && managementTeam.length > 0;
    const earningsHistory = USE_DEMO_DATA ? demoEarningsHistory : [];
    const earningsIsDemo = USE_DEMO_DATA && earningsHistory.length > 0;
    const dividendHistory = USE_DEMO_DATA ? demoDividendHistory : [];
    const dividendIsDemo = USE_DEMO_DATA && dividendHistory.length > 0;

    const formatMetricNumber = (value?: number, maximumFractionDigits = 2) => {
        if (value === undefined || value === null || Number.isNaN(value)) return "N/A";
        return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
    };

    const keyMetrics = [
        { label: "P/E Ratio", value: formatMetricNumber(profile.metrics.pe) },
        { label: "P/S Ratio", value: formatMetricNumber(profile.metrics.ps) },
        { label: "P/B Ratio", value: formatMetricNumber(profile.metrics.pb) },
        {
            label: "Dividend Yield",
            value: profile.metrics.dividendYieldPercent !== undefined && profile.metrics.dividendYieldPercent !== null
                ? formatPercent(profile.metrics.dividendYieldPercent)
                : "N/A",
        },
        { label: "Market Cap", value: marketCapDisplay || "N/A" },
    ];

    const shareStats = [
        { label: "Free float", value: "N/A" },
        { label: "Float shares", value: "N/A" },
        { label: "Outstanding shares", value: "N/A" },
        { label: "Source", value: "N/A" },
    ];

    const statementTabs = [
        { key: "income", label: "Income Statement" },
        { key: "balance", label: "Balance Sheet" },
        { key: "cashflow", label: "Cash Flow Statement" },
    ] as const;
    const [statementView, setStatementView] = useState<(typeof statementTabs)[number]["key"]>("income");
    const [expandedStatements, setExpandedStatements] = useState<Set<string>>(new Set());

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

    const handleToggleRow = (rowId: string) => {
        setExpandedStatements((prev) => {
            const next = new Set(prev);
            if (next.has(rowId)) {
                next.delete(rowId);
            } else {
                next.add(rowId);
            }
            return next;
        });
    };

    const sparklineData = useMemo(() => {
        const source = revenueSeries.length ? revenueSeries : businessLineSeries;
        return source.slice(-10).map((item, idx) => ({
            name: item.label ?? `P${idx}`,
            value: (item as any).revenue ?? (item as any).iPhone ?? 0,
        }));
    }, [businessLineSeries, revenueSeries]);

    const SymbolChip = ({ value }: { value: string }) => (
        <span className="rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-100">
            {value}
        </span>
    );

    const revenueControls = (
        <div className="flex items-center gap-2">
            <Pill active={revenueView === "annual"} onClick={() => setRevenueView("annual")}>
                FY
            </Pill>
            <Pill active={revenueView === "quarterly"} onClick={() => setRevenueView("quarterly")}>
                QTR
            </Pill>
        </div>
    );

    const valuationControls = (
        <div className="flex items-center gap-2">
            <Pill active={valuationHorizon === "fy"} onClick={() => setValuationHorizon("fy")}>
                FY
            </Pill>
            <Pill active={valuationHorizon === "qtr"} onClick={() => setValuationHorizon("qtr")}>
                QTR
            </Pill>
            <Pill active={valuationHorizon === "ttm"} onClick={() => setValuationHorizon("ttm")}>
                TTM
            </Pill>
        </div>
    );

    const businessPagination = (
        <div className="flex items-center gap-2">
            <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
                onClick={() => setBusinessPage((prev) => Math.max(0, prev - 1))}
                aria-label="Previous business line page"
                disabled={businessPage === 0}
            >
                <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-300">
                {businessPage + 1} / {businessChunks.length || 1}
            </span>
            <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setBusinessPage((prev) => Math.min((businessChunks.length || 1) - 1, prev + 1))}
                aria-label="Next business line page"
                disabled={businessPage >= (businessChunks.length || 1) - 1}
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );

    const hasRevenueData = revenueSeries.length > 0;
    const hasValuationData = valuationSeries.length > 0;
    const hasBusinessData = businessLineSeries.length > 0;
    const hasManagementData = managementTeam.length > 0;
    const hasEarningsData = earningsHistory.length > 0;
    const hasDividendData = dividendHistory.length > 0;

    const industry = profile.company.industry || "N/A";
    const country = profile.company.country || "N/A";
    const exchange = profile.company.exchange || "N/A";
    const currency = profile.company.currency || "N/A";

    const renderOverview = () => (
        <OpenBBLayoutGrid
            tickerInformation={
                <OpenBBWidgetShell title="Ticker Information" symbol={symbol} rightControls={<SymbolChip value={symbol} />} height={230}>
                    <div className="grid gap-3 lg:grid-cols-3">
                        <div className="lg:col-span-2 space-y-2">
                            <p className="text-3xl font-semibold text-slate-50">{priceDisplay}</p>
                            <p className={cn("text-sm font-semibold", priceChangeClass)}>{changeDisplay || "N/A"}</p>
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
                        <div className="space-y-2">
                            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs text-slate-300">
                                <span>Currency</span>
                                <span className="font-semibold text-slate-100">{currency}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs text-slate-300">
                                <span>Market Cap</span>
                                <span className="font-semibold text-slate-100">{marketCapDisplay || "N/A"}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 h-24">
                        {sparklineData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={sparklineData}>
                                    <defs>
                                        <linearGradient id="colorSpark" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <RechartsTooltip contentStyle={{ background: "#0f141d", border: "1px solid rgba(255,255,255,0.08)" }} />
                                    <Area
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#22d3ee"
                                        strokeWidth={2}
                                        fill="url(#colorSpark)"
                                        fillOpacity={1}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message="No trend data available" compact />
                        )}
                    </div>
                </OpenBBWidgetShell>
            }
            tickerProfile={
                <OpenBBWidgetShell title="Ticker Profile" symbol={symbol} rightControls={<SymbolChip value={symbol} />} height={320}>
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
                            <SectionTitle>Description</SectionTitle>
                            <div className="max-h-32 overflow-y-auto pr-2 text-sm leading-relaxed text-slate-300">
                                {profile.company.description
                                    ? profile.company.description
                                    : "Business description not available from the current provider."}
                            </div>
                        </div>
                    </div>
                </OpenBBWidgetShell>
            }
            pricePerformance={
                <OpenBBWidgetShell
                    title="Price Performance"
                    symbol={symbol}
                    rightControls={<SymbolChip value={symbol} />}
                    className="min-h-[380px] overflow-hidden lg:min-h-[460px]"
                >
                    <div className="space-y-2">
                        <p className="text-xs text-slate-400">Outstanding Shares: N/A</p>
                        <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20">
                            <TradingViewWidget
                                scripUrl="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
                                config={CANDLE_CHART_WIDGET_CONFIG(profile.tvSymbol || symbol)}
                                className="h-full w-full"
                                height={420}
                            />
                        </div>
                    </div>
                </OpenBBWidgetShell>
            }
            revenueGrowth={
                <OpenBBWidgetShell
                    title="Revenue Growth"
                    symbol={symbol}
                    rightControls={<div className="flex items-center gap-2">{revenueIsDemo && <DemoBadge />}{revenueControls}</div>}
                    height={300}
                >
                    {hasRevenueData ? (
                        <OpenBBECharts option={revenueOption} height={230} />
                    ) : (
                        <EmptyState message="No revenue data available" />
                    )}
                </OpenBBWidgetShell>
            }
            keyMetrics={
                <OpenBBWidgetShell title="Key Metrics" symbol={symbol} height={300}>
                    <div className="space-y-2 text-sm">
                        {keyMetrics.map((item) => (
                            <div
                                key={item.label}
                                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                            >
                                <span className="text-slate-300">{item.label}</span>
                                <span className="font-semibold text-slate-100">{item.value}</span>
                            </div>
                        ))}
                        <p className="pt-1 text-xs text-slate-400">Current Currency: {profile.company.currency || "USD"}</p>
                    </div>
                </OpenBBWidgetShell>
            }
            shareStatistics={
                <OpenBBWidgetShell title="Share Statistics" symbol={symbol} height={300}>
                    <div className="space-y-2 text-sm">
                        {shareStats.map((item) => (
                            <div
                                key={item.label}
                                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                            >
                                <span className="text-slate-300">{item.label}</span>
                                <span className="font-semibold text-slate-100">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </OpenBBWidgetShell>
            }
            valuationMultiples={
                <OpenBBWidgetShell
                    title="Valuation Multiples"
                    symbol={symbol}
                    rightControls={
                        <div className="flex items-center gap-2">
                            {valuationIsDemo && <DemoBadge />}
                            {valuationControls}
                        </div>
                    }
                    height={360}
                >
                    {hasValuationData ? (
                        <OpenBBECharts option={valuationOption} height={280} />
                    ) : (
                        <EmptyState message="No valuation data available" />
                    )}
                </OpenBBWidgetShell>
            }
            managementTeam={
                <OpenBBWidgetShell
                    title="Management Team"
                    symbol={symbol}
                    rightControls={managementIsDemo ? <DemoBadge /> : undefined}
                    height={360}
                >
                    {hasManagementData ? (
                        <div className="overflow-hidden rounded-lg border border-white/5">
                            <div className="grid grid-cols-4 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
                                <span>Name</span>
                                <span>Title</span>
                                <span>Compensation</span>
                                <span>Currency</span>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {managementTeam.map((member) => (
                                    <div
                                        key={member.name}
                                        className="grid grid-cols-4 items-center gap-2 border-t border-white/5 px-3 py-2 text-sm text-slate-200 odd:bg-white/5"
                                    >
                                        <span>{member.name}</span>
                                        <span className="text-slate-300">{member.title}</span>
                                        <span className="text-emerald-300">{member.compensation}</span>
                                        <span>{member.currency}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <EmptyState message="No management data available" />
                    )}
                </OpenBBWidgetShell>
            }
            revenueBusinessLine={
                <OpenBBWidgetShell
                    title="Revenue Per Business Line"
                    symbol={symbol}
                    rightControls={
                        <div className="flex items-center gap-2">
                            {businessLineIsDemo && <DemoBadge />}
                            <Pill disabled title="Coming soon">
                                FY
                            </Pill>
                            <Pill disabled title="Coming soon">
                                QTR
                            </Pill>
                            {businessPagination}
                        </div>
                    }
                    className="min-h-[340px]"
                >
                    {hasBusinessData ? (
                        <OpenBBECharts option={businessLineOption} height={280} />
                    ) : (
                        <EmptyState message="No business line data available" />
                    )}
                </OpenBBWidgetShell>
            }
        />
    );

    const renderFinancials = () => (
        <div className="space-y-4">
            <OpenBBWidgetShell
                title="Financial Statements"
                symbol={symbol}
                rightControls={
                    <div className="flex items-center gap-2">
                        <Pill disabled title="Coming soon">
                            FY
                        </Pill>
                        <Pill disabled title="Coming soon">
                            QTR
                        </Pill>
                    </div>
                }
            >
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    {statementTabs.map((tab) => (
                        <Pill key={tab.key} active={statementView === tab.key} onClick={() => setStatementView(tab.key)}>
                            {tab.label}
                        </Pill>
                    ))}
                </div>
                <FinancialStatementTable
                    grid={activeGrid}
                    fallbackCurrency={profile.company.currency}
                    expanded={expandedStatements}
                    onToggleRow={handleToggleRow}
                />
            </OpenBBWidgetShell>

            <OpenBBWidgetShell title="Earnings History" symbol={symbol} rightControls={earningsIsDemo ? <DemoBadge /> : undefined}>
                {hasEarningsData ? (
                    <div className="overflow-hidden rounded-lg border border-white/5">
                        <div className="grid grid-cols-6 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
                            <span>Date</span>
                            <span>EPS</span>
                            <span>EPS Est.</span>
                            <span>Revenue</span>
                            <span>Revenue Est.</span>
                            <span>Transcript</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {earningsHistory.map((row) => (
                                <div
                                    key={row.date}
                                    className="grid grid-cols-6 items-center gap-2 border-t border-white/5 px-3 py-2 text-sm text-slate-200 odd:bg-white/5"
                                >
                                    <span>{row.date}</span>
                                    <span className="text-emerald-300">{row.eps.toFixed(4)}</span>
                                    <span className="text-emerald-300">{row.epsEst.toFixed(4)}</span>
                                    <span className="text-emerald-300">{row.revenue}</span>
                                    <span className="text-emerald-300">{row.revenueEst}</span>
                                    <span className="text-slate-400" aria-disabled>
                                        Transcript unavailable
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <EmptyState message="No earnings history available" />
                )}
            </OpenBBWidgetShell>

            <OpenBBWidgetShell title="Dividend Payment" symbol={symbol} rightControls={dividendIsDemo ? <DemoBadge /> : undefined}>
                {hasDividendData ? (
                    <div className="overflow-hidden rounded-lg border border-white/5">
                        <div className="grid grid-cols-5 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
                            <span>Date</span>
                            <span>Adjusted Dividend</span>
                            <span>Dividend</span>
                            <span>Record Date</span>
                            <span>Payment Date</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {dividendHistory.map((row) => (
                                <div
                                    key={row.date}
                                    className="grid grid-cols-5 items-center gap-2 border-t border-white/5 px-3 py-2 text-sm text-slate-200 odd:bg-white/5"
                                >
                                    <span>{row.date}</span>
                                    <span className="text-emerald-300">{row.adjusted.toFixed(2)}</span>
                                    <span className="text-emerald-300">{row.dividend.toFixed(2)}</span>
                                    <span>{row.recordDate}</span>
                                    <span>{row.paymentDate}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <EmptyState message="No dividend payments available" />
                )}
            </OpenBBWidgetShell>
        </div>
    );

    const placeholderPanel = (title: string, description: string) => (
        <OpenBBWidgetShell title={title} symbol={symbol}>
            <p className="text-sm text-slate-300">{description}</p>
        </OpenBBWidgetShell>
    );

    return (
        <div className="space-y-4">
            <OpenBBDashboardTabs activeKey={activeTab} onChange={setActiveTab} />
            <div className="rounded-2xl border border-white/10 bg-[#0f141d]/80 p-4 shadow-2xl">
                {activeTab === "overview" && renderOverview()}
                {activeTab === "financials" && renderFinancials()}
                {activeTab === "technical" &&
                    placeholderPanel(
                        "Technical Analysis",
                        "Technical indicators, oscillators, and trend overlays will appear here in a future update."
                    )}
                {activeTab === "comparison" &&
                    placeholderPanel(
                        "Comparison Analysis",
                        "Peer and benchmark comparisons will be displayed with OpenBB-styled grids and charts."
                    )}
                {activeTab === "ownership" &&
                    placeholderPanel(
                        "Ownership",
                        "Institutional, insider, and float ownership breakdowns will be added in this section."
                    )}
                {activeTab === "calendar" &&
                    placeholderPanel("Company Calendar", "Earnings, dividends, splits, and events will surface here soon.")}
                {activeTab === "estimates" &&
                    placeholderPanel("Estimates", "Consensus estimates and revisions will be rendered in OpenBB widgets shortly.")}
            </div>
        </div>
    );
}
