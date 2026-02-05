import { INDICES } from '@/lib/market/indices';
import type { MarketQuote } from '@/lib/market/providers';

const formatValue = (value?: number) => (typeof value === 'number' ? value.toLocaleString('en-US') : '—');

const formatChange = (value?: number) => (typeof value === 'number' ? value.toFixed(2) : '—');

const IndicesStrip = ({ quotes }: { quotes: Record<string, MarketQuote | null> }) => {
    return (
        <div className="flex flex-wrap gap-4">
            {INDICES.map((index) => {
                const quote = quotes[index.symbol] ?? null;
                const change = quote?.d;
                const changePercent = quote?.dp;
                const hasChangePercent = typeof changePercent === 'number';
                const isPositive = hasChangePercent ? changePercent >= 0 : false;
                const color = hasChangePercent ? (isPositive ? 'text-[#00d395]' : 'text-[#ff6b6b]') : 'text-slate-400';
                const sign = hasChangePercent ? (isPositive ? '+' : '') : '';

                return (
                    <div
                        key={index.label}
                        className="flex min-w-[180px] flex-1 cursor-pointer flex-col gap-2 rounded-xl border border-[#1c2432] bg-gradient-to-br from-[#0d1117]/80 to-[#0b0f14] p-4 transition-colors duration-200 hover:border-slate-500/40 hover:bg-slate-900/40 hover:shadow-[0_0_0_1px_rgba(148,163,184,0.15)]"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-slate-400">{index.label}</span>
                            <span className={`text-xs font-mono ${color}`}>
                                {hasChangePercent && typeof change === 'number' ? `${sign}${formatChange(change)}` : '—'}
                            </span>
                        </div>
                        <div className="text-lg font-semibold text-slate-100">{formatValue(quote?.c)}</div>
                        <div className={`text-xs font-mono ${color}`}>
                            {hasChangePercent ? `${sign}${changePercent.toFixed(2)}%` : '—'}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default IndicesStrip;
