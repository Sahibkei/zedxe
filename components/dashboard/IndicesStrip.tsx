import type { MarketQuote } from '@/lib/market/providers';

const indices = [
    { label: 'SPX', symbol: '^GSPC' },
    { label: 'NDX', symbol: '^NDX' },
    { label: 'DJI', symbol: '^DJI' },
    { label: 'RUT', symbol: '^RUT' },
    { label: 'VIX', symbol: '^VIX' },
    { label: 'TNX', symbol: '^TNX' },
] as const;

const formatValue = (value?: number) => (typeof value === 'number' ? value.toLocaleString('en-US') : '—');

const formatChange = (value?: number) => (typeof value === 'number' ? value.toFixed(2) : '—');

const IndicesStrip = ({ quotes }: { quotes: Record<string, MarketQuote | null> }) => {
    return (
        <div className="flex flex-wrap gap-4">
            {indices.map((index) => {
                const quote = quotes[index.symbol] ?? null;
                const change = quote?.d;
                const changePercent = quote?.dp;
                const isPositive = typeof changePercent === 'number' ? changePercent >= 0 : true;
                const color = isPositive ? 'text-[#00d395]' : 'text-[#ff6b6b]';
                const sign = isPositive ? '+' : '';

                return (
                    <div
                        key={index.label}
                        className="flex min-w-[180px] flex-1 flex-col gap-2 rounded-xl border border-[#1c2432] bg-gradient-to-br from-[#0d1117]/80 to-[#0b0f14] p-4"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-slate-400">{index.label}</span>
                            <span className={`text-xs font-mono ${color}`}>{typeof change === 'number' ? `${sign}${formatChange(change)}` : '—'}</span>
                        </div>
                        <div className="text-lg font-semibold text-slate-100">{formatValue(quote?.c)}</div>
                        <div className={`text-xs font-mono ${color}`}>
                            {typeof changePercent === 'number' ? `${sign}${changePercent.toFixed(2)}%` : '—'}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default IndicesStrip;
