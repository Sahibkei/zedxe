import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { getCryptoPageData } from '@/lib/crypto/market-data';
import { ORDERFLOW_DEFAULT_SYMBOL } from '@/lib/constants';
import { formatMarketCapValue, formatPrice, getChangeColorClass } from '@/lib/utils';

const formatPercent = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
};

const formatSupply = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0,
    }).format(value);
};

const CryptoPage = async () => {
    const { totalMarketCapUsd, rows } = await getCryptoPageData();

    return (
        <section className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <h1 className="text-3xl font-semibold text-gray-100">Crypto Market Overview</h1>
                    <p className="text-gray-400">Track the global crypto market and top 100 coins by market cap.</p>
                </div>
                <Button asChild className="w-full sm:w-auto">
                    <Link href="/orderflow">View live orderflow ({ORDERFLOW_DEFAULT_SYMBOL.toUpperCase()})</Link>
                </Button>
            </div>

            <div className="rounded-xl bg-[#0f0f0f] border border-gray-800 p-6 shadow-lg">
                <p className="text-sm uppercase tracking-wide text-gray-400">Total Market Cap</p>
                <p className="text-4xl font-bold text-gray-100">{formatMarketCapValue(totalMarketCapUsd)}</p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0f0f0f] shadow-lg">
                <table className="min-w-full divide-y divide-gray-800">
                    <thead>
                        <tr className="bg-gray-900/50">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Rank</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Name</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Price</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">24h %</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">7d %</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">30d %</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Market Cap</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Circulating Supply</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {rows.map((coin) => (
                            <tr key={coin.id} className="hover:bg-gray-900/30 transition-colors">
                                <td className="p-0 text-left text-gray-100">
                                    <Link href={`/crypto/${coin.id}`} className="block px-4 py-3">
                                        {coin.market_cap_rank ?? '—'}
                                    </Link>
                                </td>
                                <td className="p-0">
                                    <Link href={`/crypto/${coin.id}`} className="block px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-100">{coin.name}</span>
                                            <span className="text-sm uppercase text-gray-400">{coin.symbol}</span>
                                        </div>
                                    </Link>
                                </td>
                                <td className="p-0 text-right font-medium text-gray-100">
                                    <Link href={`/crypto/${coin.id}`} className="block px-4 py-3">
                                        {formatPrice(coin.current_price)}
                                    </Link>
                                </td>
                                <td className={`p-0 text-right font-medium ${getChangeColorClass(coin.price_change_percentage_24h_in_currency ?? undefined)}`}>
                                    <Link href={`/crypto/${coin.id}`} className="block px-4 py-3">
                                        {formatPercent(coin.price_change_percentage_24h_in_currency)}
                                    </Link>
                                </td>
                                <td className={`p-0 text-right font-medium ${getChangeColorClass(coin.price_change_percentage_7d_in_currency ?? undefined)}`}>
                                    <Link href={`/crypto/${coin.id}`} className="block px-4 py-3">
                                        {formatPercent(coin.price_change_percentage_7d_in_currency)}
                                    </Link>
                                </td>
                                <td className={`p-0 text-right font-medium ${getChangeColorClass(coin.price_change_percentage_30d_in_currency ?? undefined)}`}>
                                    <Link href={`/crypto/${coin.id}`} className="block px-4 py-3">
                                        {formatPercent(coin.price_change_percentage_30d_in_currency)}
                                    </Link>
                                </td>
                                <td className="p-0 text-right font-medium text-gray-100">
                                    <Link href={`/crypto/${coin.id}`} className="block px-4 py-3">
                                        {formatMarketCapValue(coin.market_cap)}
                                    </Link>
                                </td>
                                <td className="p-0 text-right text-gray-100">
                                    <Link href={`/crypto/${coin.id}`} className="block px-4 py-3">
                                        {formatSupply(coin.circulating_supply)}
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default CryptoPage;
