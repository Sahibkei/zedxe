"use client";

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Settings2 } from 'lucide-react';

import AddPortfolioDialog from '@/components/portfolio/AddPortfolioDialog';
import AddTransactionDialog from '@/components/portfolio/AddTransactionDialog';
import PortfolioAllocationPie from '@/components/portfolio/PortfolioAllocationPie';
import PortfolioHoldingsTable from '@/components/portfolio/PortfolioHoldingsTable';
import PortfolioPerformanceChart, { type PortfolioChartRange } from '@/components/portfolio/PortfolioPerformanceChart';
import PortfolioRatiosCard from '@/components/portfolio/PortfolioRatiosCard';
import PortfolioSettingsDialog from '@/components/portfolio/PortfolioSettingsDialog';
import CryptoPortfolioPanel from '@/components/portfolio/CryptoPortfolioPanel';
import { Button } from '@/components/ui/button';
import type { CryptoPortfolioSnapshotLean } from '@/lib/crypto/portfolio-service';
import type { PortfolioAnalyticsRange, PortfolioAnalyticsResponse } from '@/lib/portfolio/analytics';
import { getPortfolioPerformanceAction, getPortfolioSummaryAction, getUserPortfoliosAction } from '@/lib/portfolio/actions';
import type {
    PortfolioLean,
    PortfolioPerformancePoint,
    PortfolioPerformanceRange,
    PortfolioSummary,
} from '@/lib/portfolio/portfolio-service';

const DEFAULT_CHART_RANGE: PortfolioChartRange = '1M';

const CHART_TO_SERVICE_RANGE: Record<PortfolioChartRange, PortfolioPerformanceRange> = {
    '1M': '1M',
    '3M': '3M',
    '6M': '6M',
    '1Y': '1Y',
    ALL: 'MAX',
};

const CHART_TO_ANALYTICS_RANGE: Record<PortfolioChartRange, PortfolioAnalyticsRange> = {
    '1M': '1m',
    '3M': '3m',
    '6M': '6m',
    '1Y': '1y',
    ALL: 'all',
};

const normalizeInitialRange = (range: PortfolioPerformanceRange): PortfolioChartRange => {
    if (range === '3M') return '3M';
    if (range === '6M') return '6M';
    if (range === '1Y') return '1Y';
    if (range === 'MAX') return 'ALL';
    return '1M';
};

const formatCurrency = (value: number, currency: string) => {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value || 0);
    } catch {
        return `${(value || 0).toFixed(2)} ${currency}`;
    }
};

const formatPercent = (value: number) => {
    if (!Number.isFinite(value)) return 'N/A';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
};

const changeTone = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return 'text-muted-foreground';
    return value > 0 ? 'text-emerald-300' : 'text-rose-300';
};

const fetchPortfolioAnalytics = async (portfolioId: string, range: PortfolioAnalyticsRange): Promise<PortfolioAnalyticsResponse> => {
    const params = new URLSearchParams({ portfolioId, range });
    const response = await fetch(`/api/portfolio/analytics?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as
        | (PortfolioAnalyticsResponse & { error?: string })
        | { error?: string }
        | null;

    if (!response.ok) {
        throw new Error(payload && 'error' in payload && payload.error ? payload.error : 'Unable to load analytics');
    }

    return payload as PortfolioAnalyticsResponse;
};

const PortfolioPageClient = ({
    initialPortfolios,
    initialSummary,
    initialPerformanceRange,
    initialPerformancePoints,
    initialCryptoSnapshots,
}: {
    initialPortfolios: PortfolioLean[];
    initialSummary: PortfolioSummary | null;
    initialPerformanceRange: PortfolioPerformanceRange;
    initialPerformancePoints: PortfolioPerformancePoint[];
    initialCryptoSnapshots: CryptoPortfolioSnapshotLean[];
}) => {
    const initialChartRange = normalizeInitialRange(initialPerformanceRange);

    const [portfolios, setPortfolios] = useState<PortfolioLean[]>(initialPortfolios);
    const [summary, setSummary] = useState<PortfolioSummary | null>(initialSummary);
    const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(
        initialSummary?.portfolio.id || initialPortfolios[0]?.id || ''
    );
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
    const [transactionDefaultSymbol, setTransactionDefaultSymbol] = useState<string | null>(null);
    const [loadingSummary, startTransition] = useTransition();
    const [error, setError] = useState('');
    const [performanceRange, setPerformanceRange] = useState<PortfolioChartRange>(initialChartRange);
    const [performancePoints, setPerformancePoints] = useState<PortfolioPerformancePoint[]>(initialPerformancePoints);
    const [performanceLoading, setPerformanceLoading] = useState(false);
    const [performanceError, setPerformanceError] = useState('');
    const [analytics, setAnalytics] = useState<PortfolioAnalyticsResponse | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(Boolean(selectedPortfolioId));
    const [analyticsError, setAnalyticsError] = useState('');
    const [mode, setMode] = useState<'stocks' | 'crypto'>(initialPortfolios.length > 0 ? 'stocks' : 'crypto');

    const baseCurrency =
        summary?.portfolio.baseCurrency || portfolios.find((portfolio) => portfolio.id === selectedPortfolioId)?.baseCurrency || 'USD';
    const selectedPortfolio = useMemo(
        () => portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) || null,
        [portfolios, selectedPortfolioId]
    );
    const activePortfolioMeta = summary?.portfolio || selectedPortfolio;
    const weeklyReportPortfolio = useMemo(() => portfolios.find((portfolio) => portfolio.weeklyReportEnabled) ?? null, [portfolios]);
    const hasPortfolios = portfolios.length > 0;
    const positions = useMemo(() => summary?.positions ?? [], [summary]);
    const totals = summary?.totals || { currentValue: 0, dayChangeValue: 0, dayChangePct: 0 };
    const holdingsCount = positions.length;

    const topHoldings = useMemo(
        () => [...positions].sort((a, b) => b.currentValue - a.currentValue).slice(0, 6),
        [positions]
    );
    const totalPnlAbs = useMemo(() => positions.reduce((sum, position) => sum + position.pnlAbs, 0), [positions]);
    const totalCost = useMemo(() => positions.reduce((sum, position) => sum + position.avgPrice * position.quantity, 0), [positions]);
    const totalPnlPct = totalCost > 0 ? (totalPnlAbs / totalCost) * 100 : 0;

    const refreshPortfolios = async () => {
        const next = await getUserPortfoliosAction();
        setPortfolios(next);
    };

    const loadRangeData = async (
        portfolioId: string,
        range: PortfolioChartRange,
        options?: { loadPerformance?: boolean; loadAnalytics?: boolean; resetErrors?: boolean }
    ) => {
        const loadPerformance = options?.loadPerformance ?? true;
        const loadAnalytics = options?.loadAnalytics ?? true;
        const resetErrors = options?.resetErrors ?? true;

        if (loadPerformance) {
            setPerformanceLoading(true);
        }
        if (loadAnalytics) {
            setAnalyticsLoading(true);
        }
        if (resetErrors) {
            if (loadPerformance) setPerformanceError('');
            if (loadAnalytics) setAnalyticsError('');
        }

        const performancePromise = loadPerformance
            ? getPortfolioPerformanceAction(portfolioId, CHART_TO_SERVICE_RANGE[range])
            : Promise.resolve(null);
        const analyticsPromise = loadAnalytics
            ? fetchPortfolioAnalytics(portfolioId, CHART_TO_ANALYTICS_RANGE[range])
            : Promise.resolve(null);

        const [performanceResult, analyticsResult] = await Promise.allSettled([performancePromise, analyticsPromise]);

        if (loadPerformance) {
            if (performanceResult.status === 'fulfilled' && performanceResult.value?.success) {
                setPerformancePoints(performanceResult.value.points);
            } else if (performanceResult.status === 'fulfilled' && performanceResult.value && !performanceResult.value.success) {
                setPerformanceError(performanceResult.value.error || 'Unable to load performance.');
            } else {
                setPerformanceError('Unable to load performance.');
            }
            setPerformanceLoading(false);
        }

        if (loadAnalytics) {
            if (analyticsResult.status === 'fulfilled' && analyticsResult.value) {
                setAnalytics(analyticsResult.value);
            } else if (analyticsResult.status === 'rejected') {
                setAnalytics(null);
                setAnalyticsError(analyticsResult.reason instanceof Error ? analyticsResult.reason.message : 'Unable to load ratios.');
            } else {
                setAnalytics(null);
                setAnalyticsError('Unable to load ratios.');
            }
            setAnalyticsLoading(false);
        }
    };

    const handleSelectPortfolio = (portfolioId: string) => {
        setSelectedPortfolioId(portfolioId);
        const nextRange = DEFAULT_CHART_RANGE;
        setPerformanceRange(nextRange);

        startTransition(async () => {
            try {
                const data = await getPortfolioSummaryAction(portfolioId);
                setSummary(data);
                setError('');
            } catch (summaryError) {
                console.error('Failed to load portfolio summary', summaryError);
                setSummary(null);
                setError('Unable to load portfolio summary.');
            }

            await loadRangeData(portfolioId, nextRange, {
                loadPerformance: true,
                loadAnalytics: true,
                resetErrors: true,
            });
        });
    };

    const handlePortfolioCreated = async (portfolio: PortfolioLean) => {
        setPortfolios((prev) => [...prev, portfolio]);
        setSelectedPortfolioId(portfolio.id);
        await refreshPortfolios();
        handleSelectPortfolio(portfolio.id);
    };

    const handleTransactionAdded = () => {
        if (!selectedPortfolioId) return;
        handleSelectPortfolio(selectedPortfolioId);
    };

    const handlePortfolioUpdated = (
        updated: { id: string; name: string; baseCurrency: string; weeklyReportEnabled: boolean },
        weeklyReportPortfolioId?: string | null
    ) => {
        setPortfolios((prev) => {
            const baseUpdated = prev.map((portfolio) =>
                portfolio.id === updated.id
                    ? { ...portfolio, name: updated.name, baseCurrency: updated.baseCurrency }
                    : portfolio
            );

            if (weeklyReportPortfolioId !== undefined) {
                return baseUpdated.map((portfolio) => ({
                    ...portfolio,
                    weeklyReportEnabled: weeklyReportPortfolioId ? portfolio.id === weeklyReportPortfolioId : false,
                }));
            }

            if (updated.weeklyReportEnabled) {
                return baseUpdated.map((portfolio) => ({
                    ...portfolio,
                    weeklyReportEnabled: portfolio.id === updated.id,
                }));
            }

            return baseUpdated.map((portfolio) =>
                portfolio.id === updated.id
                    ? { ...portfolio, weeklyReportEnabled: updated.weeklyReportEnabled }
                    : { ...portfolio, weeklyReportEnabled: updated.weeklyReportEnabled ? false : portfolio.weeklyReportEnabled }
            );
        });

        setSummary((prev) => {
            if (!prev) return prev;
            const isUpdatedPortfolio = prev.portfolio.id === updated.id;
            const nextWeeklyEnabled =
                weeklyReportPortfolioId !== undefined
                    ? weeklyReportPortfolioId === prev.portfolio.id
                    : isUpdatedPortfolio
                    ? updated.weeklyReportEnabled
                    : prev.portfolio.weeklyReportEnabled;

            if (!isUpdatedPortfolio && weeklyReportPortfolioId === undefined) return prev;

            return {
                ...prev,
                portfolio: {
                    ...prev.portfolio,
                    ...(isUpdatedPortfolio ? { name: updated.name, baseCurrency: updated.baseCurrency } : {}),
                    weeklyReportEnabled: nextWeeklyEnabled,
                },
            };
        });

        handleSelectPortfolio(updated.id);
    };

    const handlePortfolioDeleted = () => {
        if (!activePortfolioMeta) return;
        const removedId = activePortfolioMeta.id;
        const remaining = portfolios.filter((portfolio) => portfolio.id !== removedId);
        setPortfolios(remaining);

        if (remaining.length > 0) {
            handleSelectPortfolio(remaining[0].id);
        } else {
            setSelectedPortfolioId('');
            setSummary(null);
            setPerformancePoints([]);
            setAnalytics(null);
            setPerformanceRange(DEFAULT_CHART_RANGE);
            setPerformanceError('');
            setAnalyticsError('');
            setPerformanceLoading(false);
            setAnalyticsLoading(false);
        }
    };

    const handleOpenTransactionForSymbol = (symbol: string) => {
        if (!selectedPortfolioId) return;
        setTransactionDefaultSymbol(symbol);
        setTransactionDialogOpen(true);
    };

    const handlePerformanceRangeChange = async (range: PortfolioChartRange) => {
        if (!selectedPortfolioId || range === performanceRange) return;
        setPerformanceRange(range);
        await loadRangeData(selectedPortfolioId, range, {
            loadPerformance: true,
            loadAnalytics: true,
            resetErrors: true,
        });
    };

    useEffect(() => {
        if (!selectedPortfolioId) return;
        if (!summary) {
            handleSelectPortfolio(selectedPortfolioId);
            return;
        }

        void loadRangeData(selectedPortfolioId, performanceRange, {
            loadPerformance: false,
            loadAnalytics: true,
            resetErrors: false,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const renderStockPortfolios = () => {
        if (!hasPortfolios) {
            return (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-10 text-center">
                    <h2 className="text-2xl font-semibold text-foreground">Your portfolio is empty</h2>
                    <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                        Create your first portfolio to start tracking positions, allocation, and performance.
                    </p>
                    <div className="mt-5">
                        <AddPortfolioDialog
                            triggerLabel="Create your first portfolio"
                            onCreated={handlePortfolioCreated}
                            triggerClassName="h-9 rounded-lg border border-border/70 bg-primary/20 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground hover:bg-primary/25"
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-6 rounded-2xl border border-border/70 bg-gradient-to-b from-card to-[#0a111a] p-4 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {portfolios.map((portfolio) => {
                            const isActive = portfolio.id === selectedPortfolioId;
                            return (
                                <Button
                                    key={portfolio.id}
                                    variant="ghost"
                                    className={
                                        isActive
                                            ? 'h-8 rounded-lg border border-border/70 bg-primary/20 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground hover:bg-primary/25'
                                            : 'h-8 rounded-lg border border-border/60 bg-muted/20 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                                    }
                                    onClick={() => handleSelectPortfolio(portfolio.id)}
                                >
                                    {portfolio.name}
                                </Button>
                            );
                        })}
                        <AddPortfolioDialog triggerLabel="New Portfolio" onCreated={handlePortfolioCreated} />
                    </div>

                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8 rounded-lg border border-border/70 bg-muted/20 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                        onClick={() => setIsSettingsOpen(true)}
                        disabled={!activePortfolioMeta}
                    >
                        <Settings2 className="h-4 w-4" />
                        <span className="sr-only">Open portfolio settings</span>
                    </Button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-semibold text-foreground">Portfolio</h2>
                        <p className="text-sm text-muted-foreground">
                            {activePortfolioMeta?.name || 'Selected portfolio'} ({holdingsCount} positions)
                        </p>
                    </div>
                    <AddTransactionDialog
                        key={selectedPortfolioId || portfolios[0]?.id}
                        portfolios={portfolios}
                        defaultPortfolioId={selectedPortfolioId}
                        defaultSymbol={transactionDefaultSymbol || undefined}
                        triggerLabel="Add Position"
                        onAdded={handleTransactionAdded}
                        open={transactionDialogOpen}
                        onOpenChange={(open) => {
                            setTransactionDialogOpen(open);
                            if (!open) setTransactionDefaultSymbol(null);
                        }}
                    />
                </div>

                {loadingSummary ? <p className="text-xs text-muted-foreground">Refreshing portfolio data...</p> : null}

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-border/80 bg-muted/15 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total Value</p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(totals.currentValue, baseCurrency)}</p>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-muted/15 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Total P&L</p>
                        <p className={`mt-2 text-2xl font-semibold tabular-nums ${changeTone(totalPnlAbs)}`}>
                            {formatCurrency(totalPnlAbs, baseCurrency)}
                        </p>
                        <p className={`mt-1 text-sm font-medium ${changeTone(totalPnlPct)}`}>{formatPercent(totalPnlPct)}</p>
                    </div>
                    <div className="rounded-xl border border-border/80 bg-muted/15 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Holdings</p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{holdingsCount}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Base currency: {baseCurrency}</p>
                    </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                    <PortfolioAllocationPie positions={positions} />

                    <div className="rounded-xl border border-border/80 bg-card p-5">
                        <div className="border-b border-border/60 pb-3">
                            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Holdings Summary</h3>
                        </div>
                        {topHoldings.length === 0 ? (
                            <div className="mt-4 flex h-[250px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/15 text-sm text-muted-foreground">
                                Add positions to view holdings summary.
                            </div>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {topHoldings.map((position) => (
                                    <div
                                        key={`summary-${position.symbol}`}
                                        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/40 py-2.5 last:border-b-0"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{position.symbol}</p>
                                            <p className="text-xs text-muted-foreground">{position.companyName || 'Company name unavailable'}</p>
                                        </div>
                                        <p className="text-sm font-semibold tabular-nums text-foreground">
                                            {formatCurrency(position.currentValue, baseCurrency)}
                                        </p>
                                        <p className={`text-sm font-semibold tabular-nums ${changeTone(position.pnlPct)}`}>
                                            {formatPercent(position.pnlPct)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                    <PortfolioPerformanceChart
                        data={performancePoints}
                        baseCurrency={baseCurrency}
                        selectedRange={performanceRange}
                        onRangeChange={handlePerformanceRangeChange}
                        loading={performanceLoading || loadingSummary}
                        error={performanceError}
                    />

                    <div className="space-y-2">
                        <PortfolioRatiosCard
                            ratios={analytics?.ratios || null}
                            benchmarkSymbol={analytics?.benchmark.symbol || 'SPY'}
                            loading={analyticsLoading || loadingSummary}
                        />
                        {analyticsError ? <p className="text-xs text-destructive">{analyticsError}</p> : null}
                    </div>
                </div>

                <PortfolioHoldingsTable
                    positions={positions}
                    baseCurrency={baseCurrency}
                    onAddTransactionForSymbol={handleOpenTransactionForSymbol}
                />

                <PortfolioSettingsDialog
                    portfolio={
                        activePortfolioMeta
                            ? {
                                  id: activePortfolioMeta.id,
                                  name: activePortfolioMeta.name,
                                  baseCurrency: activePortfolioMeta.baseCurrency,
                                  weeklyReportEnabled: Boolean(activePortfolioMeta.weeklyReportEnabled),
                              }
                            : null
                    }
                    portfolios={portfolios.map((portfolio) => ({
                        id: portfolio.id,
                        name: portfolio.name,
                        baseCurrency: portfolio.baseCurrency,
                        weeklyReportEnabled: Boolean(portfolio.weeklyReportEnabled),
                    }))}
                    weeklyReportPortfolio={weeklyReportPortfolio}
                    open={isSettingsOpen}
                    onOpenChange={setIsSettingsOpen}
                    onUpdated={handlePortfolioUpdated}
                    onDeleted={handlePortfolioDeleted}
                />
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Portfolio</h1>
                    <p className="text-sm text-muted-foreground">Track positions, allocation, and performance.</p>
                </div>
                <div className="inline-flex gap-2 rounded-lg border border-border/70 bg-card/60 p-1">
                    <Button
                        variant="ghost"
                        className={
                            mode === 'stocks'
                                ? 'h-8 rounded-md bg-primary/20 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground hover:bg-primary/25'
                                : 'h-8 rounded-md px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                        }
                        onClick={() => setMode('stocks')}
                    >
                        Stocks
                    </Button>
                    <Button
                        variant="ghost"
                        className={
                            mode === 'crypto'
                                ? 'h-8 rounded-md bg-primary/20 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground hover:bg-primary/25'
                                : 'h-8 rounded-md px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                        }
                        onClick={() => setMode('crypto')}
                    >
                        Crypto
                    </Button>
                </div>
            </div>

            {mode === 'stocks' ? renderStockPortfolios() : <CryptoPortfolioPanel initialSnapshots={initialCryptoSnapshots} />}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
    );
};

export default PortfolioPageClient;
