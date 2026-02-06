import Link from 'next/link';

import type { MarketQuote } from '@/lib/market/providers';

const formatCurrency = (value: number) =>
    value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

type Mover = {
    symbol: string;
    name: string;
    quote: MarketQuote | null;
};

const TopMovers = ({ title, movers }: { title: string; movers: Mover[] }) => {
    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70">
            <div className="flex items-center justify-between border-b border-[#1c2432] px-4 py-3">
                <p className="text-sm font-mono text-slate-400">{title}</p>
                <span className="text-xs font-mono text-slate-500">Today</span>
            </div>
            <div className="divide-y divide-[#1c2432]">
                {movers.map((item) => {
                    const changePercent = item.quote?.dp;
                    const priceValue = item.quote?.c;
                    const isPositive = typeof changePercent === 'number' ? changePercent >= 0 : true;
                    const badgeColor =
                        typeof changePercent === 'number'
                            ? isPositive
                                ? 'bg-[#00d395]/15 text-[#00d395]'
                                : 'bg-[#ff6b6b]/15 text-[#ff6b6b]'
                            : 'bg-slate-500/15 text-slate-400';
                    const sign = isPositive ? '+' : '';

                    return (
                        <Link
                            key={item.symbol}
                            href={`/stocks/${item.symbol}`}
                            className="flex items-center justify-between gap-4 px-4 py-3 transition hover:border-emerald-500/40 hover:bg-[#0b0f14] hover:shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                        >
                            <div>
                                <p className="text-sm font-semibold text-slate-100">{item.symbol}</p>
                                <p className="text-xs text-slate-500">{item.name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-slate-100">
                                    {typeof priceValue === 'number' ? formatCurrency(priceValue) : '--'}
                                </p>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono ${badgeColor}`}>
                                    {typeof changePercent === 'number' ? `${sign}${changePercent.toFixed(2)}%` : '--'}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default TopMovers;
