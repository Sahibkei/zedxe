import Link from 'next/link';

import type { MarketQuote } from '@/lib/market/providers';

const formatCurrency = (value: number) =>
    value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const MarketList = ({
    stocks,
    quotes,
}: {
    stocks: StockWithWatchlistStatus[];
    quotes: Record<string, MarketQuote | null>;
}) => {
    const rows = stocks.slice(0, 6);

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70">
            <div className="flex items-center justify-between border-b border-[#1c2432] px-4 py-3">
                <p className="text-sm font-mono text-slate-400">Trending Stocks</p>
                <span className="text-xs font-mono text-slate-500">Live snapshot</span>
            </div>
            <div className="divide-y divide-[#1c2432]">
                {rows.map((stock) => {
                    const quote = quotes[stock.symbol.toUpperCase()];
                    const changePercent = quote?.dp;
                    const changeValue = quote?.d;
                    const priceValue = quote?.c;
                    const isPositive = typeof changePercent === 'number' ? changePercent >= 0 : true;
                    const color =
                        typeof changePercent === 'number' ? (isPositive ? 'text-[#00d395]' : 'text-[#ff6b6b]') : 'text-slate-500';
                    const sign = isPositive ? '+' : '';

                    return (
                        <Link
                            key={stock.symbol}
                            href={`/stocks/${stock.symbol}`}
                            className="flex items-center justify-between gap-4 px-4 py-3 transition hover:border-emerald-500/40 hover:bg-[#0b0f14] hover:shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1c2432] bg-[#0b0f14] text-xs font-semibold text-slate-200">
                                    {stock.symbol.slice(0, 2)}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-100">{stock.symbol}</p>
                                    <p className="text-xs text-slate-500">{stock.name}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-slate-100">
                                    {typeof priceValue === 'number' ? formatCurrency(priceValue) : '--'}
                                </p>
                                <p className={`text-xs font-mono ${color}`}>
                                    {typeof priceValue === 'number' && typeof changeValue === 'number' && typeof changePercent === 'number' ? (
                                        <>
                                            {sign}
                                            {changeValue.toFixed(2)} ({sign}
                                            {changePercent.toFixed(2)}%)
                                        </>
                                    ) : (
                                        '--'
                                    )}
                                </p>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default MarketList;
