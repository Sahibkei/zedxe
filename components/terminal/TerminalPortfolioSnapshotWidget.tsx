'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TerminalPortfolioWidgetPayload = {
    portfolio: {
        id: string;
        name: string;
        baseCurrency: string;
    } | null;
    totals?: {
        currentValue: number;
        dayChangeValue: number;
        dayChangePct: number;
    };
    positions?: Array<{
        symbol: string;
        companyName?: string;
        quantity: number;
        currentValue: number;
        pnlPct: number;
        weightPct: number;
    }>;
    warning?: string;
};

const formatMoney = (value: number | undefined, currency = 'USD') => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    });
};

const formatPercent = (value: number | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const TerminalPortfolioSnapshotWidget = ({
    payload,
    isLoading,
}: {
    payload: TerminalPortfolioWidgetPayload | null;
    isLoading: boolean;
}) => {
    if (isLoading && !payload) {
        return <div className="flex h-full items-center justify-center text-sm terminal-muted">Loading portfolio snapshot...</div>;
    }

    if (!payload?.portfolio) {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-sm font-semibold">No portfolio connected</p>
                <p className="text-sm terminal-muted">{payload?.warning ?? 'Create a portfolio to pin holdings and PnL into the terminal dashboard.'}</p>
                <Link href="/portfolio" className="terminal-mini-btn">
                    Open Portfolio
                    <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
            </div>
        );
    }

    const currency = payload.portfolio.baseCurrency || 'USD';
    const positions = payload.positions ?? [];
    const totalValue = payload.totals?.currentValue;
    const dayChangePct = payload.totals?.dayChangePct;
    const dayChangeValue = payload.totals?.dayChangeValue;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-[var(--terminal-border)] px-3 py-2">
                <div>
                    <p className="text-sm font-semibold">{payload.portfolio.name}</p>
                    <p className="text-xs terminal-muted">{positions.length} active holdings</p>
                </div>
                <Link href="/portfolio" className="terminal-mini-btn">
                    Open
                    <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-[var(--terminal-border)] p-3">
                <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] terminal-muted">Value</p>
                    <p className="mt-1 text-lg font-semibold">{formatMoney(totalValue, currency)}</p>
                </div>
                <div className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] terminal-muted">Today</p>
                    <p className={cn('mt-1 text-lg font-semibold', typeof dayChangePct === 'number' ? (dayChangePct >= 0 ? 'terminal-up' : 'terminal-down') : 'terminal-muted')}>
                        {formatPercent(dayChangePct)}
                    </p>
                    <p className="text-xs terminal-muted">{formatMoney(dayChangeValue, currency)}</p>
                </div>
            </div>

            <div className="terminal-table">
                <div className="terminal-table-head" style={{ gridTemplateColumns: 'minmax(0,1.5fr) 88px 88px 76px' }}>
                    <span className="text-left">Holding</span>
                    <span className="text-right">Value</span>
                    <span className="text-right">PnL</span>
                    <span className="text-right">Weight</span>
                </div>
                {positions.slice(0, 5).map((position) => (
                    <div
                        key={position.symbol}
                        className="terminal-table-row terminal-table-row-compact"
                        style={{ gridTemplateColumns: 'minmax(0,1.5fr) 88px 88px 76px' }}
                    >
                        <span className="terminal-table-cell terminal-table-cell-left">
                            <Link href={`/stocks/${encodeURIComponent(position.symbol)}`} className="terminal-ticker-link">
                                {position.symbol}
                            </Link>
                        </span>
                        <span className="terminal-table-cell terminal-table-cell-right">{formatMoney(position.currentValue, currency)}</span>
                        <span
                            className={cn(
                                'terminal-table-cell terminal-table-cell-right',
                                position.pnlPct >= 0 ? 'terminal-up' : 'terminal-down'
                            )}
                        >
                            {formatPercent(position.pnlPct)}
                        </span>
                        <span className="terminal-table-cell terminal-table-cell-right">{formatPercent(position.weightPct)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TerminalPortfolioSnapshotWidget;
