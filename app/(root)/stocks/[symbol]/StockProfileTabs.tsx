"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Globe2, Link2, MapPin, Phone, Users } from "lucide-react";
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

const mockManagementTeam = [
    { name: "Greg Joswiak", title: "Senior Vice President", compensation: "-", currency: "USD" },
    { name: "Jeffrey E. Williams", title: "Senior Vice President", compensation: "5.02 M", currency: "USD" },
    { name: "Kevan Parekh", title: "Senior Vice President", compensation: "4.61 M", currency: "USD" },
    { name: "Sabih Khan", title: "Chief Operating Officer", compensation: "4.64 M", currency: "USD" },
];

const earningsHistory = [
    { date: "2025-10-30", eps: 1.85, epsEst: 1.78, revenue: "102.466 B", revenueEst: "102.23 B" },
    { date: "2025-07-31", eps: 1.57, epsEst: 1.44, revenue: "94.036 B", revenueEst: "89.56 B" },
    { date: "2025-05-01", eps: 1.65, epsEst: 1.63, revenue: "95.359 B", revenueEst: "94.54 B" },
    { date: "2025-01-30", eps: 2.4, epsEst: 2.36, revenue: "124.300 B", revenueEst: "124.26 B" },
];

const dividendHistory = [
    { date: "2025-11-10", adjusted: 0.26, dividend: 0.26, recordDate: "2025-11-10", paymentDate: "2025-11-13" },
    { date: "2025-08-11", adjusted: 0.26, dividend: 0.26, recordDate: "2025-08-11", paymentDate: "2025-08-14" },
    { date: "2025-05-12", adjusted: 0.26, dividend: 0.26, recordDate: "2025-05-12", paymentDate: "2025-05-15" },
    { date: "2025-02-10", adjusted: 0.25, dividend: 0.25, recordDate: "2025-02-10", paymentDate: "2025-02-13" },
];

const businessLineData = [
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

const formatPercent = (value?: number) => {
    if (value === undefined || value === null || Number.isNaN(value)) return "—";
    const prefix = value >= 0 ? "+" : "";
    return `${prefix}${value.toFixed(2)}%`;
};

const Pill = ({
    active,
    children,
    onClick,
}: {
    active?: boolean;
    children: React.ReactNode;
    onClick?: () => void;
}) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            "rounded-lg px-3 py-1 text-xs font-semibold transition",
            active ? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/40" : "bg-white/5 text-slate-300"
        )}
    >
        {children}
    </button>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <p className="text-sm font-semibold text-slate-100">{children}</p>
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

    const revenueSeries = useMemo(() => {
        const source = revenueView === "annual" ? profile.financials.annual : profile.financials.quarterly;
        if (source.length) return source;
        return [
            { label: "FY 2021", revenue: 365_817_000_000 },
            { label: "FY 2022", revenue: 394_328_000_000 },
            { label: "FY 2023", revenue: 383_285_000_000 },
            { label: "FY 2024", revenue: 391_035_000_000 },
            { label: "FY 2025", revenue: 416_161_000_000 },
        ];
    }, [profile.financials.annual, profile.financials.quarterly, revenueView]);

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

    const valuationSeries = useMemo(() => {
        const base = revenueSeries.length ? revenueSeries : businessLineData;
        const { pe = 18, ps = 5, pb = 6, evToEbitda = 14 } = profile.metrics;
        return base.map((entry, idx) => ({
            label: entry.label,
            pe: Math.max(0, pe + idx * 0.4),
            ps: Math.max(0, (ps || 4) + idx * 0.2),
            pb: Math.max(0, (pb || 7) + idx * 0.15),
            evSales: Math.max(0, (ps || 4) + 1 + idx * 0.25),
            evEbitda: Math.max(0, (evToEbitda || 14) + idx * 0.35),
        }));
    }, [profile.metrics, revenueSeries]);

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

    const businessChunks = useMemo(() => {
        const size = 6;
        const chunks = [];
        for (let i = 0; i < businessLineData.length; i += size) {
            chunks.push(businessLineData.slice(i, i + size));
        }
        return chunks;
    }, []);
    const currentChunk = businessChunks[businessPage] ?? businessChunks[0];
    const businessLineOption = useMemo(() => {
        const segments = ["Mac", "iPhone", "Service", "Wearables", "iPad", "Other"];
        return {
            backgroundColor: "transparent",
            tooltip: { trigger: "axis" },
            legend: { data: segments, textStyle: { color: "#cbd5e1" } },
            grid: { left: 48, right: 20, top: 40, bottom: 50 },
            xAxis: {
                type: "category",
                data: currentChunk?.map((c) => c.label),
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

    const keyMetrics = [
        { label: "Beta", value: "1.11" },
        { label: "Vol Avg", value: "48.01 M" },
        { label: "Market Cap", value: marketCapDisplay },
        { label: "Div Yield", value: profile.metrics.dividendYieldPercent ? formatPercent(profile.metrics.dividendYieldPercent) : "0.37%" },
        { label: "P/E Ratio", value: profile.metrics.pe ? profile.metrics.pe.toFixed(2) : "36.72" },
    ];

    const shareStats = [
        { label: "Free float", value: "99.826" },
        { label: "Float shares", value: "14.751 B" },
        { label: "Outstanding shares", value: "14.776 B" },
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
        const source = revenueSeries.length ? revenueSeries : businessLineData;
        return source.slice(-10).map((item, idx) => ({
            name: item.label ?? `P${idx}`,
            value: (item as any).revenue ?? (item as any).iPhone ?? 0,
        }));
    }, [revenueSeries]);

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

    const renderOverview = () => (
        <OpenBBLayoutGrid
            tickerInformation={
                <OpenBBWidgetShell title="Ticker Information" symbol={symbol} rightControls={<SymbolChip value={symbol} />} height={230}>
                    <div className="grid gap-3 lg:grid-cols-3">
                        <div className="lg:col-span-2 space-y-1">
                            <p className="text-3xl font-semibold text-slate-50">{priceDisplay}</p>
                            <p className={cn("text-sm font-semibold", priceChangeClass)}>{changeDisplay || "—"}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                <span>Volume</span>
                                <span className="font-medium text-slate-100">8.866 M</span>
                                <span className="text-slate-500">•</span>
                                <span>Consumer Electronics</span>
                                <span className="text-slate-500">|</span>
                                <span>US</span>
                                <span className="text-slate-500">|</span>
                                <span>{profile.company.exchange || "NASDAQ"}</span>
                            </div>
                        </div>
                        <div className="h-24">
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
                        </div>
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
                                <span>{profile.company.country || "Country N/A"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                                <Globe2 className="h-4 w-4 text-sky-300" />
                                <span>
                                    Sector: <span className="font-semibold text-slate-100">{profile.company.industry || "—"}</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                                <Users className="h-4 w-4 text-emerald-300" />
                                <span>Full time employees: 164,000</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                                <Phone className="h-4 w-4 text-purple-300" />
                                <span>Exchange: {profile.company.exchange || "NASDAQ"}</span>
                            </div>
                        </div>
                        <div className="space-y-2 rounded-xl border border-white/5 bg-white/5 p-3">
                            <SectionTitle>Description</SectionTitle>
                            <div className="max-h-32 overflow-y-auto pr-2 text-sm leading-relaxed text-slate-300">
                                {profile.company.description ||
                                    "Business description not available from the current provider."}
                            </div>
                        </div>
                    </div>
                </OpenBBWidgetShell>
            }
            pricePerformance={
                <OpenBBWidgetShell title="Price Performance" symbol={symbol} rightControls={<SymbolChip value={symbol} />} height={520}>
                    <div className="space-y-2">
                        <p className="text-xs text-slate-400">Outstanding Shares: 14.776 B</p>
                        <TradingViewWidget
                            scripUrl="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
                            config={CANDLE_CHART_WIDGET_CONFIG(profile.tvSymbol || symbol)}
                            className="w-full"
                            height={460}
                        />
                    </div>
                </OpenBBWidgetShell>
            }
            revenueGrowth={
                <OpenBBWidgetShell title="Revenue Growth" symbol={symbol} rightControls={revenueControls} height={300}>
                    <OpenBBECharts option={revenueOption} height={230} />
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
                <OpenBBWidgetShell title="Valuation Multiples" symbol={symbol} rightControls={valuationControls} height={360}>
                    <OpenBBECharts option={valuationOption} height={280} />
                </OpenBBWidgetShell>
            }
            managementTeam={
                <OpenBBWidgetShell title="Management Team" symbol={symbol} height={360}>
                    <div className="overflow-hidden rounded-lg border border-white/5">
                        <div className="grid grid-cols-4 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
                            <span>Name</span>
                            <span>Title</span>
                            <span>Compensation</span>
                            <span>Currency</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {mockManagementTeam.map((member) => (
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
                </OpenBBWidgetShell>
            }
            revenueBusinessLine={
                <OpenBBWidgetShell
                    title="Revenue Per Business Line"
                    symbol={symbol}
                    rightControls={
                        <div className="flex items-center gap-2">
                            <Pill active>FY</Pill>
                            <Pill>QTR</Pill>
                            {businessPagination}
                        </div>
                    }
                    height={360}
                >
                    <OpenBBECharts option={businessLineOption} height={280} />
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
                        <Pill active>FY</Pill>
                        <Pill>QTR</Pill>
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

            <OpenBBWidgetShell title="Earnings History" symbol={symbol}>
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
                                <a className="text-sky-300 hover:text-sky-200" href="#">
                                    View transcript
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            </OpenBBWidgetShell>

            <OpenBBWidgetShell title="Dividend Payment" symbol={symbol}>
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
