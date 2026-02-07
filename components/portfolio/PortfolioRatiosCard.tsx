import { Info } from 'lucide-react';

import type { PortfolioAnalyticsRatios } from '@/lib/portfolio/analytics';

type PortfolioRatiosCardProps = {
    ratios: PortfolioAnalyticsRatios | null;
    benchmarkSymbol?: string;
    loading?: boolean;
};

const formatNumber = (value: number | null, decimals = 2) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    return value.toFixed(decimals);
};

const formatPercent = (value: number | null, decimals = 2) => {
    if (value == null || !Number.isFinite(value)) return 'N/A';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
};

const rowClassName = 'grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border/50 py-2.5 last:border-b-0';

const PortfolioRatiosCard = ({
    ratios,
    benchmarkSymbol = 'SPY',
    loading = false,
}: PortfolioRatiosCardProps) => {
    const entries = [
        { label: 'Beta', value: formatNumber(ratios?.beta ?? null) },
        { label: 'Sharpe', value: formatNumber(ratios?.sharpeAnnual ?? null) },
        { label: 'Volatility', value: formatPercent(ratios?.volAnnual ?? null) },
        { label: 'Max Drawdown', value: formatPercent(ratios?.maxDrawdownPct ?? null) },
        { label: 'Total Return', value: formatPercent(ratios?.totalReturnPct ?? null) },
        { label: `Benchmark Return (${benchmarkSymbol})`, value: formatPercent(ratios?.benchmarkReturnPct ?? null) },
    ];

    return (
        <div className="rounded-xl border border-border/80 bg-card p-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Portfolio Ratios</h3>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Computed from daily returns">
                    <Info className="h-3.5 w-3.5" />
                    Daily returns
                </span>
            </div>

            <div className="mt-2">
                {loading ? (
                    <div className="space-y-2 py-1">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={`ratio-skeleton-${index}`} className={rowClassName}>
                                <div className="h-3.5 w-28 animate-pulse rounded bg-muted/40" />
                                <div className="h-3.5 w-20 animate-pulse rounded bg-muted/40" />
                            </div>
                        ))}
                    </div>
                ) : (
                    entries.map((entry) => (
                        <div key={entry.label} className={rowClassName}>
                            <span className="text-sm text-muted-foreground">{entry.label}</span>
                            <span className="text-sm font-semibold tabular-nums text-foreground">{entry.value}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default PortfolioRatiosCard;
