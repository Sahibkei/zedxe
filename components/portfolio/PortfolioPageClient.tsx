"use client";

import { useEffect, useMemo, useState, useTransition } from 'react';

import AddPortfolioDialog from '@/components/portfolio/AddPortfolioDialog';
import AddTransactionDialog from '@/components/portfolio/AddTransactionDialog';
import PortfolioHoldingsTable from '@/components/portfolio/PortfolioHoldingsTable';
import PortfolioAllocationPie from '@/components/portfolio/PortfolioAllocationPie';
import PortfolioPerformanceChart from '@/components/portfolio/PortfolioPerformanceChart';
import PortfolioRatiosCard from '@/components/portfolio/PortfolioRatiosCard';
import PortfolioSettingsDialog from '@/components/portfolio/PortfolioSettingsDialog';
import CryptoPortfolioPanel from '@/components/portfolio/CryptoPortfolioPanel';
import { Button } from '@/components/ui/button';
import SectionCard from '@/src/components/ui/SectionCard';
import { getPortfolioPerformanceAction, getPortfolioSummaryAction, getUserPortfoliosAction } from '@/lib/portfolio/actions';
import type {
    PortfolioLean,
    PortfolioPerformancePoint,
    PortfolioPerformanceRange,
    PortfolioSummary,
} from '@/lib/portfolio/portfolio-service';
import type { CryptoPortfolioSnapshotLean } from '@/lib/crypto/portfolio-service';
import { Settings2 } from 'lucide-react';

const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
    }).format(value || 0);
};

const changeColor = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return 'text-slate-300';
    return value > 0 ? 'text-green-400' : 'text-red-400';
};

const DEFAULT_PERFORMANCE_RANGE: PortfolioPerformanceRange = '1M';

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
    const [performanceRange, setPerformanceRange] = useState<PortfolioPerformanceRange>(initialPerformanceRange);
    const [performancePoints, setPerformancePoints] = useState<PortfolioPerformancePoint[]>(initialPerformancePoints);
    const [performanceLoading, setPerformanceLoading] = useState(false);
    const [performanceError, setPerformanceError] = useState('');
    const [mode, setMode] = useState<'stocks' | 'crypto'>(initialPortfolios.length > 0 ? 'stocks' : 'crypto');

    useEffect(() => {
        if (!summary && selectedPortfolioId) {
            handleSelectPortfolio(selectedPortfolioId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const baseCurrency =
        summary?.portfolio.baseCurrency || portfolios.find((p) => p.id === selectedPortfolioId)?.baseCurrency || 'USD';
    const selectedPortfolio = useMemo(
        () => portfolios.find((p) => p.id === selectedPortfolioId) || null,
        [portfolios, selectedPortfolioId]
    );
    const activePortfolioMeta = summary?.portfolio || selectedPortfolio;
    const weeklyReportPortfolio = useMemo(
        () => portfolios.find((p) => p.weeklyReportEnabled) ?? null,
        [portfolios]
    );

    const refreshPortfolios = async () => {
        const next = await getUserPortfoliosAction();
        setPortfolios(next);
    };

    const handleSelectPortfolio = (portfolioId: string) => {
        setSelectedPortfolioId(portfolioId);
        startTransition(async () => {
            try {
                const data = await getPortfolioSummaryAction(portfolioId);
                setSummary(data);
                setError('');
                setPerformanceLoading(true);
                setPerformanceError('');
                const res = await getPortfolioPerformanceAction(portfolioId, DEFAULT_PERFORMANCE_RANGE);
                if (res.success) {
                    setPerformancePoints(res.points);
                    setPerformanceRange(DEFAULT_PERFORMANCE_RANGE);
                } else {
                    setPerformancePoints([]);
                    setPerformanceRange(DEFAULT_PERFORMANCE_RANGE);
                    setPerformanceError(res.error || 'Unable to load performance.');
                }
            } catch (e) {
                console.error('Failed to load portfolio summary', e);
                setError('Unable to load portfolio summary.');
                setPerformancePoints([]);
                setPerformanceRange(DEFAULT_PERFORMANCE_RANGE);
                setPerformanceError('Unable to load performance.');
            } finally {
                setPerformanceLoading(false);
            }
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
            const baseUpdated = prev.map((p) =>
                p.id === updated.id ? { ...p, name: updated.name, baseCurrency: updated.baseCurrency } : p
            );

            if (weeklyReportPortfolioId !== undefined) {
                return baseUpdated.map((p) => ({
                    ...p,
                    weeklyReportEnabled: weeklyReportPortfolioId ? p.id === weeklyReportPortfolioId : false,
                }));
            }

            if (updated.weeklyReportEnabled) {
                return baseUpdated.map((p) => ({
                    ...p,
                    weeklyReportEnabled: p.id === updated.id,
                }));
            }

            return baseUpdated.map((p) =>
                p.id === updated.id
                    ? { ...p, weeklyReportEnabled: updated.weeklyReportEnabled }
                    : { ...p, weeklyReportEnabled: updated.weeklyReportEnabled ? false : p.weeklyReportEnabled }
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
                    ...(isUpdatedPortfolio
                        ? { name: updated.name, baseCurrency: updated.baseCurrency }
                        : {}),
                    weeklyReportEnabled: nextWeeklyEnabled,
                },
            };
        });

        handleSelectPortfolio(updated.id);
    };

    const handlePortfolioDeleted = () => {
        if (!activePortfolioMeta) return;
        const removedId = activePortfolioMeta.id;
        const remaining = portfolios.filter((p) => p.id !== removedId);
        setPortfolios(remaining);

        if (remaining.length > 0) {
            const nextId = remaining[0].id;
            handleSelectPortfolio(nextId);
        } else {
            setSelectedPortfolioId('');
            setSummary(null);
            setPerformancePoints([]);
            setPerformanceRange(DEFAULT_PERFORMANCE_RANGE);
        }
        setPerformanceError('');
        setPerformanceLoading(false);
    };

    const handleOpenTransactionForSymbol = (symbol: string) => {
        if (!selectedPortfolioId) return;
        setTransactionDefaultSymbol(symbol);
        setTransactionDialogOpen(true);
    };

    const handlePerformanceRangeChange = async (range: PortfolioPerformanceRange) => {
        if (!selectedPortfolioId || range === performanceRange) return;
        setPerformanceLoading(true);
        setPerformanceError('');
        try {
            const res = await getPortfolioPerformanceAction(selectedPortfolioId, range);
            if (res.success) {
                setPerformancePoints(res.points);
                setPerformanceRange(range);
            } else {
                setPerformanceError(res.error || 'Unable to load performance.');
            }
        } catch (e) {
            console.error('Failed to load performance series', e);
            setPerformanceError('Unable to load this range right now.');
        } finally {
            setPerformanceLoading(false);
        }
    };

    const hasPortfolios = portfolios.length > 0;
    const positions = summary?.positions || [];
    const totals = summary?.totals || { currentValue: 0, dayChangeValue: 0, dayChangePct: 0 };

    const renderStockPortfolios = () => {
        if (!hasPortfolios) {
            return (
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-10 text-center">
                    <h2 className="text-2xl font-semibold text-slate-100">Your portfolio is empty</h2>
                    <p className="max-w-xl text-slate-400">
                        Create your first portfolio to start tracking your holdings and transactions.
                    </p>
                    <AddPortfolioDialog triggerLabel="Create your first portfolio" onCreated={handlePortfolioCreated} />
                </div>
            );
        }

        return (
            <>
                <div className="flex flex-wrap items-center gap-2">
                    {portfolios.map((p) => {
                        const isActive = p.id === selectedPortfolioId;
                        return (
                            <Button
                                key={p.id}
                                variant={isActive ? 'default' : 'outline'}
                                className={
                                    isActive
                                        ? 'bg-slate-100 text-slate-900 hover:bg-white'
                                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                                }
                                onClick={() => handleSelectPortfolio(p.id)}
                            >
                                {p.name} ({p.baseCurrency})
                            </Button>
                        );
                    })}
                </div>

                <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-sm text-slate-400">{summary?.portfolio.name || 'Portfolio'}</p>
                                    <p className="text-xs text-slate-500">Base Currency: {baseCurrency}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <p className="text-3xl font-semibold text-slate-100">
                                            {formatCurrency(totals.currentValue, baseCurrency)}
                                        </p>
                                        <p className={`text-sm font-medium ${changeColor(totals.dayChangeValue)}`}>
                                            {formatCurrency(totals.dayChangeValue, baseCurrency)} ({totals.dayChangePct.toFixed(2)}% today)
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                                        onClick={() => setIsSettingsOpen(true)}
                                        disabled={!activePortfolioMeta}
                                    >
                                        <Settings2 className="h-4 w-4" />
                                        <span className="sr-only">Open portfolio settings</span>
                                    </Button>
                                </div>
                            </div>
                            {loadingSummary && <p className="mt-2 text-sm text-slate-400">Refreshing portfolio...</p>}
                            <PortfolioPerformanceChart
                                data={performancePoints}
                                baseCurrency={baseCurrency}
                                selectedRange={performanceRange}
                                onRangeChange={handlePerformanceRangeChange}
                                loading={performanceLoading || loadingSummary}
                                error={performanceError}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-100">Holdings</h3>
                            <AddTransactionDialog
                                key={selectedPortfolioId || portfolios[0]?.id}
                                portfolios={portfolios}
                                defaultPortfolioId={selectedPortfolioId}
                                defaultSymbol={transactionDefaultSymbol || undefined}
                                triggerLabel="+ Add Transaction"
                                onAdded={handleTransactionAdded}
                                open={transactionDialogOpen}
                                onOpenChange={(open) => {
                                    setTransactionDialogOpen(open);
                                    if (!open) setTransactionDefaultSymbol(null);
                                }}
                            />
                        </div>
                        <PortfolioHoldingsTable
                            positions={positions}
                            baseCurrency={baseCurrency}
                            onAddTransactionForSymbol={handleOpenTransactionForSymbol}
                        />
                    </div>
                    <div className="space-y-4">
                        <PortfolioAllocationPie positions={positions} />
                        <PortfolioRatiosCard
                            ratios={summary?.ratios || { beta: null, sharpe: null, benchmarkReturnPct: null, totalReturnPct: null }}
                        />
                    </div>
                </div>

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
                    portfolios={portfolios.map((p) => ({
                        id: p.id,
                        name: p.name,
                        baseCurrency: p.baseCurrency,
                        weeklyReportEnabled: Boolean(p.weeklyReportEnabled),
                    }))}
                    weeklyReportPortfolio={weeklyReportPortfolio}
                    open={isSettingsOpen}
                    onOpenChange={setIsSettingsOpen}
                    onUpdated={handlePortfolioUpdated}
                    onDeleted={handlePortfolioDeleted}
                />
            </>
        );
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Portfolio</p>
                    <h1 className="text-2xl font-semibold text-slate-100">Portfolio Overview</h1>
                    <p className="text-sm text-slate-400">Manage your accounts, transactions, and holdings.</p>
                </div>
                {mode === 'stocks' && <AddPortfolioDialog onCreated={handlePortfolioCreated} />}
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant={mode === 'stocks' ? 'default' : 'outline'}
                    className={
                        mode === 'stocks'
                            ? 'bg-slate-100 text-slate-900 hover:bg-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }
                    onClick={() => setMode('stocks')}
                >
                    Stocks
                </Button>
                <Button
                    variant={mode === 'crypto' ? 'default' : 'outline'}
                    className={
                        mode === 'crypto'
                            ? 'bg-slate-100 text-slate-900 hover:bg-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }
                    onClick={() => setMode('crypto')}
                >
                    Crypto
                </Button>
            </div>

            {mode === 'stocks' ? (
                renderStockPortfolios()
            ) : (
                <SectionCard eyebrow="Crypto" title="Crypto Portfolio">
                    <CryptoPortfolioPanel initialSnapshots={initialCryptoSnapshots} />
                </SectionCard>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
    );
};

export default PortfolioPageClient;
