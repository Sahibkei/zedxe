"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { analyzeOptions, fetchExpiries, fetchOptionChain } from "@/lib/options/client";
import { formatNumber, formatPercent } from "@/lib/options/format";
import ImpliedVolatilitySmile from "@/app/(root)/stocks/[symbol]/options/ImpliedVolatilitySmile";
import IVSurface from "@/app/(root)/stocks/[symbol]/options/IVSurface";
import RiskNeutralDistribution from "@/app/(root)/stocks/[symbol]/options/RiskNeutralDistribution";
import ScenarioAnalysis from "@/app/(root)/stocks/[symbol]/options/ScenarioAnalysis";
import SingleOptionAnalytics from "@/app/(root)/stocks/[symbol]/options/SingleOptionAnalytics";
import type { AnalyzeResponse, ChainResponse, OptionContract } from "@/lib/options/types";
import { cn } from "@/lib/utils";

const tabs = [
    { key: "model-setup", label: "Model Setup" },
    { key: "iv-smile", label: "Implied Volatility Smile" },
    { key: "iv-surface", label: "IV Surface" },
    { key: "distribution", label: "Risk-Neutral Distribution" },
    { key: "single-option", label: "Single-Option Analytics" },
    { key: "scenario", label: "Scenario Analysis" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

type OptionsAnalysisContentProps = {
    symbol: string;
    companyName?: string;
};

type ApiStatus = "pending" | "connected" | "error";

type FilterState = {
    maxSpreadPct: number;
    minOpenInterest: number;
    moneynessMin: number;
    moneynessMax: number;
};

type SideFilter = "all" | "call" | "put";

const defaultFilters: FilterState = {
    maxSpreadPct: 5,
    minOpenInterest: 50,
    moneynessMin: 0.8,
    moneynessMax: 1.2,
};

const PAGE_SIZE = 25;

export default function OptionsAnalysisContent({ symbol, companyName }: OptionsAnalysisContentProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("model-setup");
    const [apiStatus, setApiStatus] = useState<ApiStatus>("pending");
    const [apiError, setApiError] = useState<string | null>(null);
    const [expiries, setExpiries] = useState<string[]>([]);
    const [selectedExpiry, setSelectedExpiry] = useState<string>("");
    const [loadingExpiries, setLoadingExpiries] = useState(false);
    const [chain, setChain] = useState<ChainResponse | null>(null);
    const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
    const [loadingData, setLoadingData] = useState(false);
    const [chainError, setChainError] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [riskFreeRate, setRiskFreeRate] = useState(0.05);
    const [dividendYield, setDividendYield] = useState(0.005);
    const [filters, setFilters] = useState<FilterState>(defaultFilters);
    const [showFilters, setShowFilters] = useState(false);
    const [sideFilter, setSideFilter] = useState<SideFilter>("all");
    const [strikeSearch, setStrikeSearch] = useState("");
    const [page, setPage] = useState(1);
    const fetchControllerRef = useRef<AbortController | null>(null);

    const title = companyName ? `Options Analysis for ${companyName} (${symbol})` : `Options Analysis for ${symbol}`;
    const tabList = tabs;
    const apiStatusStyles: Record<ApiStatus, { container: string; dot: string; label: string }> = {
        pending: {
            container: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
            dot: "bg-yellow-400",
            label: "Pending",
        },
        connected: {
            container: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
            dot: "bg-emerald-400",
            label: "Connected",
        },
        error: {
            container: "border-red-500/40 bg-red-500/10 text-red-400",
            dot: "bg-red-400",
            label: "Error",
        },
    };

    useEffect(() => {
        setApiStatus("pending");
        setApiError(null);
        setExpiries([]);
        setSelectedExpiry("");
        setChain(null);
        setAnalysis(null);
        setChainError(null);
        setAnalysisError(null);
        setRiskFreeRate(0.05);
        setDividendYield(0.005);
        setFilters(defaultFilters);
        setSideFilter("all");
        setStrikeSearch("");
        setPage(1);

        fetchControllerRef.current?.abort();

        const controller = new AbortController();
        setLoadingExpiries(true);

        fetchExpiries(symbol, controller.signal)
            .then((response) => {
                if (controller.signal.aborted) return;
                setExpiries(response.expiries);
                if (response.expiries.length > 0) {
                    setSelectedExpiry(response.expiries[0]);
                }
                setApiStatus("connected");
            })
            .catch((error) => {
                if (controller.signal.aborted) return;
                setApiStatus("error");
                setApiError(error?.message || "Unable to reach options API");
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoadingExpiries(false);
                }
            });

        return () => {
            controller.abort();
            fetchControllerRef.current?.abort();
        };
    }, [symbol]);

    useEffect(() => {
        setPage(1);
    }, [sideFilter, strikeSearch, chain]);

    useEffect(() => {
        if (expiries.length > 0 && !selectedExpiry) {
            setSelectedExpiry(expiries[0]);
        }
    }, [expiries, selectedExpiry]);

    const apiBadgeStyle = apiStatusStyles[apiStatus];

    const handleFilterChange = (key: keyof FilterState, value: number) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const handleFetchData = async () => {
        if (!selectedExpiry) {
            setChainError("Select an expiry to load the option chain.");
            return;
        }

        fetchControllerRef.current?.abort();
        const controller = new AbortController();
        fetchControllerRef.current = controller;
        setLoadingData(true);
        setChainError(null);
        setAnalysisError(null);

        try {
            const [chainResponse, analysisResponse] = await Promise.all([
                fetchOptionChain(symbol, selectedExpiry, controller.signal),
                analyzeOptions(
                    {
                        symbol,
                        expiry: selectedExpiry,
                        r: riskFreeRate,
                        q: dividendYield,
                        filters,
                    },
                    controller.signal
                ),
            ]);

            if (controller.signal.aborted) return;
            setChain(chainResponse);
            setAnalysis(analysisResponse);
        } catch (error) {
            const isAbortError = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
            if (isAbortError) return;

            const message = error instanceof Error ? error.message : "Unable to fetch option data";
            setChain(null);
            setAnalysis(null);
            setChainError(message);
            setAnalysisError(message);
        } finally {
            if (!controller.signal.aborted) {
                setLoadingData(false);
            }
        }
    };

    const handleAutoPickExpiry = () => {
        if (expiries.length > 0) {
            setSelectedExpiry(expiries[0]);
        }
    };

    const sortedContracts = useMemo(() => {
        if (!chain?.contracts) return [] as OptionContract[];
        return [...chain.contracts].sort((a, b) => {
            if (a.strike === b.strike && a.side !== b.side) {
                return a.side === "call" ? -1 : 1;
            }
            return a.strike - b.strike;
        });
    }, [chain]);

    const filteredContracts = useMemo(() => {
        let results = sortedContracts;

        if (sideFilter !== "all") {
            results = results.filter((contract) => contract.side === sideFilter);
        }

        const strikeValue = strikeSearch.trim() ? Number(strikeSearch.trim()) : null;
        if (strikeValue !== null && Number.isFinite(strikeValue)) {
            results = results.filter((contract) => contract.strike === strikeValue);
        }

        return results;
    }, [sideFilter, strikeSearch, sortedContracts]);

    const totalPages = Math.max(1, Math.ceil(filteredContracts.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pagedContracts = filteredContracts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const isFetchDisabled = !selectedExpiry || loadingExpiries || loadingData;
    const smileSpot = chain?.spot ?? analysis?.spot ?? null;
    const smileExpiry = selectedExpiry || chain?.expiry || analysis?.expiry || null;
    const smileContracts = chain?.contracts ?? [];
    const smileTYears = analysis?.tYears ?? null;

    return (
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8 space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Derivatives</p>
                    <h1 className="text-3xl font-semibold text-foreground leading-tight">{title}</h1>
                    <p className="text-sm text-muted-foreground">
                        Configure pricing assumptions, visualize implied volatility, and explore risk scenarios for this symbol.
                    </p>
                </div>
                <div
                    className={cn(
                        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-sm",
                        apiBadgeStyle.container
                    )}
                >
                    <span className={cn("size-2 rounded-full", apiBadgeStyle.dot)} aria-hidden />
                    <span>API Status: {apiBadgeStyle.label}</span>
                </div>
            </div>

            {apiError && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    Unable to load expiries for {symbol}: {apiError}
                </div>
            )}

            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-lg backdrop-blur">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Options analysis sections">
                    {tabList.map((tab) => {
                        const isActive = activeTab === tab.key;
                        const tabId = `options-tab-${tab.key}`;
                        const panelId = `options-panel-${tab.key}`;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={cn(
                                    "rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                                    isActive
                                        ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/60"
                                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                )}
                                type="button"
                                role="tab"
                                id={tabId}
                                aria-selected={isActive}
                                aria-controls={panelId}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-8">
                    {tabList.map((tab) => {
                        const isActive = activeTab === tab.key;
                        const tabId = `options-tab-${tab.key}`;
                        const panelId = `options-panel-${tab.key}`;
                        return (
                            <div
                                key={tab.key}
                                role="tabpanel"
                                id={panelId}
                                aria-labelledby={tabId}
                                hidden={!isActive}
                            >
                                {tab.key === "model-setup" && isActive ? (
                                    <ModelSetup
                                        symbol={symbol}
                                        expiries={expiries}
                                        selectedExpiry={selectedExpiry}
                                        setSelectedExpiry={setSelectedExpiry}
                                        riskFreeRate={riskFreeRate}
                                        setRiskFreeRate={setRiskFreeRate}
                                        dividendYield={dividendYield}
                                        setDividendYield={setDividendYield}
                                        filters={filters}
                                        onFilterChange={handleFilterChange}
                                        showFilters={showFilters}
                                        setShowFilters={setShowFilters}
                                        loadingExpiries={loadingExpiries}
                                        loadingData={loadingData}
                                        onFetchData={handleFetchData}
                                        onAutoPickExpiry={handleAutoPickExpiry}
                                        analysis={analysis}
                                        chain={chain}
                                        chainError={chainError}
                                        analysisError={analysisError}
                                        isFetchDisabled={isFetchDisabled}
                                        sideFilter={sideFilter}
                                        setSideFilter={setSideFilter}
                                        strikeSearch={strikeSearch}
                                        setStrikeSearch={setStrikeSearch}
                                        pagedContracts={pagedContracts}
                                        filteredContractsLength={filteredContracts.length}
                                        totalPages={totalPages}
                                        currentPage={currentPage}
                                        setPage={setPage}
                                        onRetry={handleFetchData}
                                        selectedExpiryExists={Boolean(selectedExpiry)}
                                    />
                                ) : tab.key === "iv-smile" && isActive ? (
                                    <ImpliedVolatilitySmile
                                        symbol={symbol}
                                        spot={smileSpot}
                                        expiry={smileExpiry}
                                        tYears={smileTYears}
                                        r={riskFreeRate}
                                        q={dividendYield}
                                        contracts={smileContracts}
                                    />
                                ) : tab.key === "iv-surface" && isActive ? (
                                    <IVSurface symbol={symbol} riskFreeRate={riskFreeRate} dividendYield={dividendYield} />
                                ) : tab.key === "distribution" && isActive ? (
                                    <RiskNeutralDistribution
                                        symbol={symbol}
                                        expiries={expiries}
                                        selectedExpiry={selectedExpiry}
                                        setSelectedExpiry={setSelectedExpiry}
                                        r={riskFreeRate}
                                        setR={setRiskFreeRate}
                                        q={dividendYield}
                                        setQ={setDividendYield}
                                        loadingExpiries={loadingExpiries}
                                    />
                                ) : tab.key === "single-option" && isActive ? (
                                    <SingleOptionAnalytics
                                        symbol={symbol}
                                        expiries={expiries}
                                        selectedExpiry={selectedExpiry}
                                        setSelectedExpiry={setSelectedExpiry}
                                        r={riskFreeRate}
                                        setR={setRiskFreeRate}
                                        q={dividendYield}
                                        setQ={setDividendYield}
                                        loadingExpiries={loadingExpiries}
                                    />
                                ) : tab.key === "scenario" && isActive ? (
                                    <ScenarioAnalysis
                                        symbol={symbol}
                                        expiries={expiries}
                                        selectedExpiry={selectedExpiry}
                                        setSelectedExpiry={setSelectedExpiry}
                                        r={riskFreeRate}
                                        setR={setRiskFreeRate}
                                        q={dividendYield}
                                        setQ={setDividendYield}
                                        loadingExpiries={loadingExpiries}
                                    />
                                ) : (
                                    isActive && (
                                        <TabPlaceholder
                                            label={tabList.find((currentTab) => currentTab.key === activeTab)?.label || ""}
                                        />
                                    )
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="space-y-4 lg:col-span-4">
                    <PricingEngineSidebar symbol={symbol} />
                </div>
            </div>
        </div>
    );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-lg backdrop-blur space-y-3">
            <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
            </div>
            {children}
        </div>
    );
}

function InputLabel({ children }: { children: ReactNode }) {
    return <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</span>;
}

function FieldShell({ children }: { children: ReactNode }) {
    return <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3">{children}</div>;
}

function ModelSetup({
    symbol,
    expiries,
    selectedExpiry,
    setSelectedExpiry,
    riskFreeRate,
    setRiskFreeRate,
    dividendYield,
    setDividendYield,
    filters,
    onFilterChange,
    showFilters,
    setShowFilters,
    loadingExpiries,
    loadingData,
    onFetchData,
    onAutoPickExpiry,
    analysis,
    chain,
    chainError,
    analysisError,
    isFetchDisabled,
    sideFilter,
    setSideFilter,
    strikeSearch,
    setStrikeSearch,
    pagedContracts,
    filteredContractsLength,
    totalPages,
    currentPage,
    setPage,
    onRetry,
    selectedExpiryExists,
}: {
    symbol: string;
    expiries: string[];
    selectedExpiry: string;
    setSelectedExpiry: (value: string) => void;
    riskFreeRate: number;
    setRiskFreeRate: (value: number) => void;
    dividendYield: number;
    setDividendYield: (value: number) => void;
    filters: FilterState;
    onFilterChange: (key: keyof FilterState, value: number) => void;
    showFilters: boolean;
    setShowFilters: (value: boolean) => void;
    loadingExpiries: boolean;
    loadingData: boolean;
    onFetchData: () => Promise<void> | void;
    onAutoPickExpiry: () => void;
    analysis: AnalyzeResponse | null;
    chain: ChainResponse | null;
    chainError: string | null;
    analysisError: string | null;
    isFetchDisabled: boolean;
    sideFilter: SideFilter;
    setSideFilter: (value: SideFilter) => void;
    strikeSearch: string;
    setStrikeSearch: (value: string) => void;
    pagedContracts: OptionContract[];
    filteredContractsLength: number;
    totalPages: number;
    currentPage: number;
    setPage: (value: number) => void;
    onRetry: () => void;
    selectedExpiryExists: boolean;
}) {
    const renderSummary = () => {
        if (!analysis) return null;

        const summaryItems = [
            { label: "Spot", value: formatNumber(analysis.spot, 2) },
            { label: "Expiry", value: analysis.expiry },
            { label: "DTE", value: formatNumber(analysis.dte, 0) },
            { label: "Total Contracts", value: formatNumber(analysis.totalCount, 0) },
            { label: "Filtered Contracts", value: formatNumber(analysis.filteredCount, 0) },
            { label: "Price Rule", value: analysis.priceRule.toUpperCase() },
        ];

        return (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {summaryItems.map((item) => (
                    <div key={item.label} className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                        <p className="text-sm font-semibold text-foreground">{item.value}</p>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <SectionCard
                title="Set Core Assumptions and Parameters"
                description="Configure pricing inputs, choose expirations, and pull data before running analytics."
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <FieldShell>
                        <InputLabel>Symbol</InputLabel>
                        <input
                            value={symbol}
                            readOnly
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        />
                        <p className="text-xs text-muted-foreground">Read-only from the route.</p>
                    </FieldShell>
                    <FieldShell>
                        <div className="flex items-center justify-between gap-2">
                            <InputLabel>Expiry</InputLabel>
                            <button
                                type="button"
                                onClick={onAutoPickExpiry}
                                className="text-xs font-semibold text-primary hover:underline"
                                disabled={loadingExpiries || expiries.length === 0}
                            >
                                Auto-pick expiry
                            </button>
                        </div>
                        <select
                            className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                            value={selectedExpiry}
                            onChange={(event) => setSelectedExpiry(event.target.value)}
                            disabled={loadingExpiries || expiries.length === 0}
                        >
                            {expiries.length === 0 && <option value="">Loading expiries...</option>}
                            {expiries.map((expiry) => (
                                <option key={expiry} value={expiry}>
                                    {expiry}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                            {loadingExpiries ? "Loading expiries from the options API..." : "Select the contract expiration to analyze."}
                        </p>
                    </FieldShell>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <FieldShell>
                        <InputLabel>Risk-free rate (r)</InputLabel>
                        <input
                            type="number"
                            step="0.001"
                            value={riskFreeRate}
                            onChange={(event) => setRiskFreeRate(Number(event.target.value))}
                            className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                        />
                        <p className="text-xs text-muted-foreground">Default: 0.05</p>
                    </FieldShell>
                    <FieldShell>
                        <InputLabel>Dividend yield (q)</InputLabel>
                        <input
                            type="number"
                            step="0.001"
                            value={dividendYield}
                            onChange={(event) => setDividendYield(Number(event.target.value))}
                            className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                        />
                        <p className="text-xs text-muted-foreground">Default: 0.005</p>
                    </FieldShell>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <InputLabel>Filters</InputLabel>
                        <button
                            type="button"
                            onClick={() => setShowFilters((previous) => !previous)}
                            className="text-xs font-semibold text-primary hover:underline"
                        >
                            {showFilters ? "Hide filters" : "Show filters"}
                        </button>
                    </div>
                    {showFilters && (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <FieldShell>
                                <InputLabel>Max Spread %</InputLabel>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={filters.maxSpreadPct}
                                    onChange={(event) => onFilterChange("maxSpreadPct", Number(event.target.value))}
                                    className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                                />
                            </FieldShell>
                            <FieldShell>
                                <InputLabel>Min Open Interest</InputLabel>
                                <input
                                    type="number"
                                    step="1"
                                    value={filters.minOpenInterest}
                                    onChange={(event) => onFilterChange("minOpenInterest", Number(event.target.value))}
                                    className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                                />
                            </FieldShell>
                            <FieldShell>
                                <InputLabel>Moneyness Min</InputLabel>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={filters.moneynessMin}
                                    onChange={(event) => onFilterChange("moneynessMin", Number(event.target.value))}
                                    className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                                />
                            </FieldShell>
                            <FieldShell>
                                <InputLabel>Moneyness Max</InputLabel>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={filters.moneynessMax}
                                    onChange={(event) => onFilterChange("moneynessMax", Number(event.target.value))}
                                    className="h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                                />
                            </FieldShell>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onFetchData}
                        disabled={isFetchDisabled}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors",
                            isFetchDisabled ? "cursor-not-allowed opacity-70" : "hover:bg-primary/90"
                        )}
                    >
                        {loadingData ? "Fetching..." : "Fetch Data"}
                    </button>
                    {chain && (
                        <p className="text-xs text-muted-foreground">
                            Loaded {chain.contracts.length} contracts for {chain.expiry} at spot {formatNumber(chain.spot, 2)}.
                        </p>
                    )}
                </div>

                {(chainError || analysisError) && (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <span>{chainError || analysisError}</span>
                        <button
                            type="button"
                            onClick={onRetry}
                            className="rounded-lg border border-destructive/40 px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {renderSummary()}
            </SectionCard>

            <SectionCard
                title="Pull Underlying Spot and Option Chain Data"
                description="Review the normalized option chain, apply quick filters, and paginate through contracts."
            >
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                    <div className="flex items-center gap-2">
                        <InputLabel>Side</InputLabel>
                        <select
                            className="h-9 rounded-lg border border-border/60 bg-background px-2 text-sm"
                            value={sideFilter}
                            onChange={(event) => setSideFilter(event.target.value as SideFilter)}
                        >
                            <option value="all">All</option>
                            <option value="call">Calls</option>
                            <option value="put">Puts</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <InputLabel>Strike</InputLabel>
                        <input
                            type="number"
                            value={strikeSearch}
                            onChange={(event) => setStrikeSearch(event.target.value)}
                            className="h-9 w-32 rounded-lg border border-border/60 bg-background px-2 text-sm"
                            placeholder="Search"
                        />
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {selectedExpiryExists ? `Expiry ${selectedExpiryExists ? selectedExpiry : ""}` : "Select an expiry to view the chain."}
                    </div>
                </div>

                {!selectedExpiryExists && (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        Select an expiry above to load and view option contracts.
                    </div>
                )}

                {selectedExpiryExists && !chain && !loadingData && (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        Click "Fetch Data" to retrieve spot and option chain data for this expiry.
                    </div>
                )}

                {loadingData && (
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        Fetching option chain and analysis for {selectedExpiry}...
                    </div>
                )}

                {chain && (
                    <div className="space-y-3">
                        <div className="overflow-x-auto rounded-xl border border-border/60">
                            <table className="min-w-full divide-y divide-border/60 text-sm">
                                <thead className="bg-muted/40 text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold">Strike</th>
                                        <th className="px-3 py-2 text-left font-semibold">Side</th>
                                        <th className="px-3 py-2 text-left font-semibold">Bid</th>
                                        <th className="px-3 py-2 text-left font-semibold">Ask</th>
                                        <th className="px-3 py-2 text-left font-semibold">Mid</th>
                                        <th className="px-3 py-2 text-left font-semibold">Spread%</th>
                                        <th className="px-3 py-2 text-left font-semibold">OI</th>
                                        <th className="px-3 py-2 text-left font-semibold">Volume</th>
                                        <th className="px-3 py-2 text-left font-semibold">Last</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {pagedContracts.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                                                No option contracts match the current filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        pagedContracts.map((contract) => {
                                            const mid = (contract.bid + contract.ask) / 2;
                                            const spreadPct = mid > 0 ? ((contract.ask - contract.bid) / mid) * 100 : null;
                                            return (
                                                <tr key={`${contract.side}-${contract.strike}`} className="hover:bg-muted/30">
                                                    <td className="px-3 py-2 font-semibold">{formatNumber(contract.strike, 2)}</td>
                                                    <td className="px-3 py-2 capitalize">{contract.side}</td>
                                                    <td className="px-3 py-2">{formatNumber(contract.bid, 2)}</td>
                                                    <td className="px-3 py-2">{formatNumber(contract.ask, 2)}</td>
                                                    <td className="px-3 py-2">{formatNumber(mid, 2)}</td>
                                                    <td className="px-3 py-2">{formatPercent(spreadPct, 2)}</td>
                                                    <td className="px-3 py-2">{formatNumber(contract.openInterest ?? null, 0)}</td>
                                                    <td className="px-3 py-2">{formatNumber(contract.volume ?? null, 0)}</td>
                                                    <td className="px-3 py-2">{formatNumber(contract.last ?? null, 2)}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                            <div>
                                Showing {pagedContracts.length} of {filteredContractsLength} contracts
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="rounded-lg border border-border/60 px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Prev
                                </button>
                                <span className="text-xs">
                                    Page {currentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="rounded-lg border border-border/60 px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </SectionCard>
        </div>
    );
}

function TabPlaceholder({ label }: { label: string }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-lg backdrop-blur space-y-3">
            <h3 className="text-lg font-semibold text-foreground">{label}</h3>
            <p className="text-sm text-muted-foreground">
                Interactive visuals and analytics for {label.toLowerCase()} will appear here. This is a placeholder for the Step 1 shell.
            </p>
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Add charts, sliders, and tables in later milestones without changing this route.
            </div>
        </div>
    );
}

function SidebarRow({ title, value }: { title: string; value: string }) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{title}</span>
            <span className="font-semibold text-foreground">{value}</span>
        </div>
    );
}

function PricingEngineSidebar({ symbol }: { symbol: string }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-xl backdrop-blur space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Sidecar</p>
                    <h3 className="text-lg font-semibold text-foreground">Pricing Engine</h3>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/50">Preview</span>
            </div>
            <SidebarRow title="Symbol" value={symbol} />
            <SidebarRow title="Valuation Clock" value="Live" />
            <SidebarRow title="Calibration" value="Pending inputs" />
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
                <p className="font-semibold text-foreground">Engine Notes</p>
                <p className="text-muted-foreground leading-relaxed">
                    This side panel will anchor parameter presets, engine runs, and pricing snapshots. Hook it into the live
                    models once data connections are ready.
                </p>
            </div>
        </div>
    );
}
