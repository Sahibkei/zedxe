"use client";

import { useEffect, useMemo, useState, useTransition } from 'react';

import AddPortfolioDialog from '@/components/portfolio/AddPortfolioDialog';
import AddTransactionDialog from '@/components/portfolio/AddTransactionDialog';
import PortfolioHoldingsTable from '@/components/portfolio/PortfolioHoldingsTable';
import PortfolioAllocationPie from '@/components/portfolio/PortfolioAllocationPie';
import PortfolioPerformanceChart from '@/components/portfolio/PortfolioPerformanceChart';
import PortfolioRatiosCard from '@/components/portfolio/PortfolioRatiosCard';
import PortfolioSettingsDialog from '@/components/portfolio/PortfolioSettingsDialog';
import { Button } from '@/components/ui/button';
import { getPortfolioPerformanceAction, getPortfolioSummaryAction, getUserPortfoliosAction } from '@/lib/portfolio/actions';
import type {
    PortfolioLean,
    PortfolioPerformancePoint,
    PortfolioPerformanceRange,
    PortfolioSummary,
} from '@/lib/portfolio/portfolio-service';
import { Settings2 } from 'lucide-react';

const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
    }).format(value || 0);
};

const changeColor = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return 'text-gray-300';
    return value > 0 ? 'text-green-400' : 'text-red-400';
};

const DEFAULT_PERFORMANCE_RANGE: PortfolioPerformanceRange = '1M';

const PortfolioPageClient = ({
    initialPortfolios,
    initialSummary,
    initialPerformanceRange,
    initialPerformancePoints,
}: {
    initialPortfolios: PortfolioLean[];
    initialSummary: PortfolioSummary | null;
    initialPerformanceRange: PortfolioPerformanceRange;
    initialPerformancePoints: PortfolioPerformancePoint[];
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
                const res = await getPortfolioPerformanceAction(portfolioId, DEFAULT_PERFORMANCE_RANGE);
                if (res.success) {
                    setPerformancePoints(res.points);
                    setPerformanceRange(DEFAULT_PERFORMANCE_RANGE);
                } else {
                    setPerformancePoints([]);
                    setPerformanceRange(DEFAULT_PERFORMANCE_RANGE);
                }
            } catch (e) {
                console.error('Failed to load portfolio summary', e);
                setError('Unable to load portfolio summary.');
                setPerformancePoints([]);
                setPerformanceRange(DEFAULT_PERFORMANCE_RANGE);
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

    const handlePortfolioUpdated = (updated: { id: string; name: string; baseCurrency: string }) => {
        setPortfolios((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, name: updated.name, baseCurrency: updated.baseCurrency } : p))
        );

        setSummary((prev) => {
            if (!prev || prev.portfolio.id !== updated.id) return prev;
            return { ...prev, portfolio: { ...prev.portfolio, name: updated.name, baseCurrency: updated.baseCurrency } };
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
    };

    const handleOpenTransactionForSymbol = (symbol: string) => {
        if (!selectedPortfolioId) return;
        setTransactionDefaultSymbol(symbol);
        setTransactionDialogOpen(true);
    };

    const hasPortfolios = portfolios.length > 0;
    const positions = summary?.positions || [];
    const totals = summary?.totals || { currentValue: 0, dayChangeValue: 0, dayChangePct: 0 };

    if (!hasPortfolios) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray-800 bg-gray-900/40 p-10 text-center">
                <h2 className="text-2xl font-semibold text-gray-100">Your portfolio is empty</h2>
                <p className="max-w-xl text-gray-400">
                    Create your first portfolio to start tracking your holdings and transactions.
                </p>
                <AddPortfolioDialog triggerLabel="Create your first portfolio" onCreated={handlePortfolioCreated} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-100">Portfolios</h1>
                    <p className="text-sm text-gray-400">Manage your accounts, transactions, and holdings.</p>
                </div>
                <AddPortfolioDialog onCreated={handlePortfolioCreated} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {portfolios.map((p) => {
                    const isActive = p.id === selectedPortfolioId;
                    return (
                        <Button
                            key={p.id}
                            variant={isActive ? 'default' : 'outline'}
                            className={isActive ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'border-gray-700 text-gray-200'}
                            onClick={() => handleSelectPortfolio(p.id)}
                        >
                            {p.name} ({p.baseCurrency})
                        </Button>
                    );
                })}
            </div>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-4">
                    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-6">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-sm text-gray-400">{summary?.portfolio.name || 'Portfolio'}</p>
                                <p className="text-xs text-gray-500">Base Currency: {baseCurrency}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <p className="text-3xl font-bold text-gray-100">
                                        {formatCurrency(totals.currentValue, baseCurrency)}
                                    </p>
                                    <p className={`text-sm font-medium ${changeColor(totals.dayChangeValue)}`}>
                                        {formatCurrency(totals.dayChangeValue, baseCurrency)} ({totals.dayChangePct.toFixed(2)}%) today
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="border border-gray-800 bg-gray-900 text-gray-200 hover:bg-gray-800"
                                    onClick={() => setIsSettingsOpen(true)}
                                    disabled={!activePortfolioMeta}
                                >
                                    <Settings2 className="h-4 w-4" />
                                    <span className="sr-only">Open portfolio settings</span>
                                </Button>
                            </div>
                        </div>
                        {loadingSummary && <p className="mt-2 text-sm text-gray-400">Refreshing portfolio...</p>}
                        <PortfolioPerformanceChart
                            portfolioId={selectedPortfolioId}
                            baseCurrency={baseCurrency}
                            initialRange={performanceRange}
                            initialPoints={performancePoints}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-100">Holdings</h3>
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
                        ratios={summary?.ratios || { beta: null, sharpe: null, benchmarkReturn: null, totalReturnPct: null }}
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
                          }
                        : null
                }
                open={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                onUpdated={handlePortfolioUpdated}
                onDeleted={handlePortfolioDeleted}
            />

            {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
    );
};

export default PortfolioPageClient;
