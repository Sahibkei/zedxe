import Link from 'next/link';
import { notFound } from 'next/navigation';

import TradingViewWidget from '@/components/TradingViewWidget';
import { getCryptoCoinDetails } from '@/lib/crypto/market-data';
import { formatMarketCapValue, formatPrice, getChangeColorClass } from '@/lib/utils';

const formatPercent = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
};

const formatSupply = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0,
    }).format(value);
};

export default async function CryptoCoinPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    const coin = await getCryptoCoinDetails(id);

    if (!coin) {
        notFound();
    }

    const tradingViewSymbol = coin.tradingViewSymbol ?? `BINANCE:${coin.symbol.toUpperCase()}USDT`;

    return (
        <section className="space-y-8">
            <div className="flex items-start justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-3xl font-semibold text-gray-100">
                            {coin.name} <span className="text-gray-400">({coin.symbol.toUpperCase()})</span>
                        </h1>
                        {coin.rank ? (
                            <span className="rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-300">Rank #{coin.rank}</span>
                        ) : null}
                    </div>
                    <p className="text-gray-400">Live market data powered by CoinGecko.</p>
                    <Link href="/crypto" className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300">
                        ← Back to Crypto Overview
                    </Link>
                </div>

                <div className="text-right space-y-1">
                    <p className="text-sm uppercase tracking-wide text-gray-400">Current Price</p>
                    <p className="text-4xl font-bold text-gray-100">
                        {coin.currentPriceUsd !== null ? formatPrice(coin.currentPriceUsd) : '—'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-800 bg-[#0f0f0f] p-4 shadow">
                    <p className="text-sm text-gray-400">24h Change</p>
                    <p className={`text-2xl font-semibold ${getChangeColorClass(coin.priceChange24h ?? undefined)}`}>
                        {formatPercent(coin.priceChange24h)}
                    </p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-[#0f0f0f] p-4 shadow">
                    <p className="text-sm text-gray-400">7d Change</p>
                    <p className={`text-2xl font-semibold ${getChangeColorClass(coin.priceChange7d ?? undefined)}`}>
                        {formatPercent(coin.priceChange7d)}
                    </p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-[#0f0f0f] p-4 shadow">
                    <p className="text-sm text-gray-400">30d Change</p>
                    <p className={`text-2xl font-semibold ${getChangeColorClass(coin.priceChange30d ?? undefined)}`}>
                        {formatPercent(coin.priceChange30d)}
                    </p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-[#0f0f0f] p-4 shadow">
                    <p className="text-sm text-gray-400">Market Cap</p>
                    <p className="text-2xl font-semibold text-gray-100">{formatMarketCapValue(coin.marketCapUsd ?? 0)}</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-[#0f0f0f] p-4 shadow">
                    <p className="text-sm text-gray-400">Circulating Supply</p>
                    <p className="text-2xl font-semibold text-gray-100">{formatSupply(coin.circulatingSupply)}</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-[#0f0f0f] p-4 shadow">
                    <p className="text-sm text-gray-400">Total Supply</p>
                    <p className="text-2xl font-semibold text-gray-100">{formatSupply(coin.totalSupply)}</p>
                </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#0f0f0f] p-4 shadow-lg">
                <TradingViewWidget
                    title={`${coin.symbol.toUpperCase()} Price Chart`}
                    scriptUrl={`https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js`}
                    config={{
                        height: 550,
                        symbol: tradingViewSymbol,
                        interval: '60',
                        timezone: 'Etc/UTC',
                        theme: 'dark',
                        style: '1',
                        locale: 'en',
                        enable_publishing: false,
                        hide_top_toolbar: false,
                        hide_legend: false,
                        save_image: false,
                        backgroundColor: '#0f0f0f',
                    }}
                    className="mt-6 w-full"
                />
            </div>
        </section>
    );
}
