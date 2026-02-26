import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const formatCurrency = (value: number | null) => {
    if (!isFiniteNumber(value)) return '--';
    return value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

type Mover = {
    symbol: string;
    name: string;
    price: number | null;
    changePercent: number | null;
};

const TopMovers = ({ title, movers, viewAllHref }: { title: string; movers: Mover[]; viewAllHref?: string }) => {
    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70">
            <div className="flex items-center justify-between border-b border-[#1c2432] px-4 py-3">
                <p className="text-sm font-mono text-slate-400">{title}</p>
                <div className="flex items-center gap-2">
                    {viewAllHref ? (
                        <Link
                            href={viewAllHref}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#1c2432] text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
                            aria-label={`View all ${title.toLowerCase()}`}
                        >
                            <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    ) : null}
                    <span className="text-xs font-mono text-slate-500">Today</span>
                </div>
            </div>
            <div className="divide-y divide-[#1c2432]">
                {movers.map((item) => {
                    const changePercent = item.changePercent;
                    const priceValue = item.price;
                    const hasFiniteChange = isFiniteNumber(changePercent);
                    const isPositive = hasFiniteChange ? changePercent >= 0 : true;
                    const badgeColor =
                        hasFiniteChange
                            ? isPositive
                                ? 'bg-[#00d395]/15 text-[#00d395]'
                                : 'bg-[#ff6b6b]/15 text-[#ff6b6b]'
                            : 'bg-slate-500/15 text-slate-400';
                    const sign = isPositive ? '+' : '';
                    const profileHref = `/stocks/${encodeURIComponent(item.symbol)}`;

                    return (
                        <div key={item.symbol} className="group flex items-center justify-between gap-4 px-4 py-3">
                            <div>
                                <Link
                                    href={profileHref}
                                    className="inline-block text-sm font-semibold text-slate-100 transition hover:text-[#58a6ff] hover:underline"
                                    aria-label={`Open ${item.symbol} stock profile`}
                                >
                                    {item.symbol}
                                </Link>
                                <p className="text-xs text-slate-500">{item.name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-slate-100">{formatCurrency(priceValue)}</p>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono ${badgeColor}`}>
                                    {hasFiniteChange ? `${sign}${changePercent.toFixed(2)}%` : '--'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TopMovers;
