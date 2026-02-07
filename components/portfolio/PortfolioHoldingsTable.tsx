import Link from 'next/link';
import { ArrowUpRight, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PositionSummary } from '@/lib/portfolio/portfolio-service';
import { cn } from '@/lib/utils';

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

const formatNumber = (value: number, digits = 2) => {
    if (!Number.isFinite(value)) return '--';
    return value.toFixed(digits);
};

const changeTone = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return 'text-muted-foreground';
    return value > 0 ? 'text-emerald-300' : 'text-rose-300';
};

const PortfolioHoldingsTable = ({
    positions,
    baseCurrency,
    onAddTransactionForSymbol,
}: {
    positions: PositionSummary[];
    baseCurrency: string;
    onAddTransactionForSymbol?: (symbol: string) => void;
}) => {
    return (
        <div className="rounded-xl border border-border/80 bg-card p-5">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">All Positions</h3>
                <p className="text-xs text-muted-foreground">{positions.length} total</p>
            </div>

            <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        <tr className="border-b border-border/60">
                            <th className="px-2 py-2.5 text-left font-semibold">Ticker</th>
                            <th className="px-2 py-2.5 text-right font-semibold">Shares</th>
                            <th className="px-2 py-2.5 text-right font-semibold">Avg Cost</th>
                            <th className="px-2 py-2.5 text-right font-semibold">Current</th>
                            <th className="px-2 py-2.5 text-right font-semibold">Value</th>
                            <th className="px-2 py-2.5 text-right font-semibold">P/L</th>
                            <th className="px-2 py-2.5 text-right font-semibold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {positions.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-2 py-10 text-center text-sm text-muted-foreground">
                                    No positions yet. Add a transaction to populate your table.
                                </td>
                            </tr>
                        ) : (
                            positions.map((position) => (
                                <tr
                                    key={position.symbol}
                                    className="border-b border-border/40 text-foreground/95 last:border-b-0 hover:bg-muted/10"
                                >
                                    <td className="px-2 py-3.5">
                                        <div className="space-y-0.5">
                                            <p className="font-semibold">{position.symbol}</p>
                                            <p className="text-xs text-muted-foreground">{position.companyName || 'Company name unavailable'}</p>
                                        </div>
                                    </td>
                                    <td className="px-2 py-3.5 text-right tabular-nums">{formatNumber(position.quantity, 4)}</td>
                                    <td className="px-2 py-3.5 text-right tabular-nums">{formatCurrency(position.avgPrice, baseCurrency)}</td>
                                    <td className="px-2 py-3.5 text-right tabular-nums">{formatCurrency(position.currentPrice, baseCurrency)}</td>
                                    <td className="px-2 py-3.5 text-right tabular-nums">{formatCurrency(position.currentValue, baseCurrency)}</td>
                                    <td className={cn('px-2 py-3.5 text-right tabular-nums font-semibold', changeTone(position.pnlPct))}>
                                        {formatCurrency(position.pnlAbs, baseCurrency)} ({position.pnlPct > 0 ? '+' : ''}
                                        {formatNumber(position.pnlPct)}%)
                                    </td>
                                    <td className="px-2 py-3.5">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                className="h-7 w-7 rounded-md border border-border/60 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                                                onClick={() => onAddTransactionForSymbol?.(position.symbol)}
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                <span className="sr-only">Add transaction for {position.symbol}</span>
                                            </Button>
                                            <Button
                                                asChild
                                                variant="ghost"
                                                size="icon-sm"
                                                className="h-7 w-7 rounded-md border border-border/60 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                                            >
                                                <Link href={`/stocks/${position.symbol}`} prefetch={false}>
                                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                                    <span className="sr-only">Open {position.symbol}</span>
                                                </Link>
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PortfolioHoldingsTable;
