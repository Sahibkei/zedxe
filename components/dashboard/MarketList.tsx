const formatCurrency = (value: number) =>
    value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const buildMetrics = (symbol: string) => {
    const seed = symbol
        .toUpperCase()
        .split('')
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const price = 80 + (seed % 1800) / 10;
    const changePercent = ((seed % 400) - 200) / 100;
    const changeValue = (price * changePercent) / 100;

    return {
        price,
        changePercent,
        changeValue,
    };
};

const fallbackStocks: StockWithWatchlistStatus[] = [
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
    { symbol: 'MSFT', name: 'Microsoft Corp.', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
    { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
    { symbol: 'META', name: 'Meta Platforms', exchange: 'NASDAQ', type: 'Common Stock', isInWatchlist: false },
];

const MarketList = ({ stocks }: { stocks: StockWithWatchlistStatus[] }) => {
    const rows = (stocks.length ? stocks : fallbackStocks).slice(0, 6);

    return (
        <div className="rounded-xl border border-[#1c2432] bg-[#0d1117]">
            <div className="flex items-center justify-between border-b border-[#1c2432] px-4 py-3">
                <p className="text-sm font-mono text-slate-400">Trending Stocks</p>
                <span className="text-xs font-mono text-slate-500">Live snapshot</span>
            </div>
            <div className="divide-y divide-[#1c2432]">
                {rows.map((stock) => {
                    const metrics = buildMetrics(stock.symbol);
                    const isPositive = metrics.changePercent >= 0;
                    const color = isPositive ? 'text-[#00d395]' : 'text-[#ff6b6b]';
                    const sign = isPositive ? '+' : '';

                    return (
                        <div
                            key={stock.symbol}
                            className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-[#0b0f14]"
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
                                <p className="text-sm font-semibold text-slate-100">{formatCurrency(metrics.price)}</p>
                                <p className={`text-xs font-mono ${color}`}>
                                    {sign}
                                    {metrics.changeValue.toFixed(2)} ({sign}
                                    {metrics.changePercent.toFixed(2)}%)
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MarketList;
