import Link from "next/link";
import { notFound } from "next/navigation";

import TradingViewWidget from "@/components/TradingViewWidget";
import { getCryptoCoinDetails } from "@/lib/crypto/market-data";
import { formatMarketCapValue, formatPrice, getChangeColorClass } from "@/lib/utils";

const formatPercent = (value?: number | null) => {
    if (value === null || value === undefined) return "--";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
};

const formatSupply = (value?: number | null) => {
    if (value === null || value === undefined) return "--";
    return new Intl.NumberFormat("en-US", {
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
    const stats = [
        { label: "24h Change", value: formatPercent(coin.priceChange24h), tone: getChangeColorClass(coin.priceChange24h ?? undefined) },
        { label: "7d Change", value: formatPercent(coin.priceChange7d), tone: getChangeColorClass(coin.priceChange7d ?? undefined) },
        { label: "30d Change", value: formatPercent(coin.priceChange30d), tone: getChangeColorClass(coin.priceChange30d ?? undefined) },
        { label: "Market Cap", value: formatMarketCapValue(coin.marketCapUsd ?? 0), tone: "text-gray-100" },
        { label: "Circulating Supply", value: formatSupply(coin.circulatingSupply), tone: "text-gray-100" },
        { label: "Total Supply", value: formatSupply(coin.totalSupply), tone: "text-gray-100" },
    ];

    return (
        <section className="bento-page space-y-5">
            <div className="bento-grid">
                <div className="bento-card p-6 xl:col-span-8">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-3xl font-semibold text-gray-100">
                                {coin.name} <span className="text-gray-400">({coin.symbol.toUpperCase()})</span>
                            </h1>
                            {coin.rank ? (
                                <span className="rounded-full bg-[#0f1624] px-3 py-1 text-sm text-gray-300 ring-1 ring-[#2d3a4b]">
                                    Rank #{coin.rank}
                                </span>
                            ) : null}
                        </div>
                        <p className="text-gray-400">Live market data powered by CoinGecko.</p>
                        <Link href="/crypto" className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300">
                            {"<-"} Back to Crypto Overview
                        </Link>
                    </div>
                </div>

                <div className="bento-card flex flex-col justify-center p-6 xl:col-span-4">
                    <p className="text-sm uppercase tracking-wide text-gray-400">Current Price</p>
                    <p className="mt-2 text-4xl font-bold text-gray-100">
                        {coin.currentPriceUsd !== null ? formatPrice(coin.currentPriceUsd) : "--"}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">Real-time snapshot</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {stats.map((stat) => (
                    <div key={stat.label} className="bento-card p-4">
                        <p className="text-sm text-gray-400">{stat.label}</p>
                        <p className={`mt-2 text-xl font-semibold md:text-2xl ${stat.tone}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="bento-card p-4">
                <TradingViewWidget
                    title={`${coin.symbol.toUpperCase()} Price Chart`}
                    cspUrl="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
                    height={1100}
                    config={{
                        autosize: true,
                        symbol: tradingViewSymbol,
                        interval: "60",
                        timezone: "Etc/UTC",
                        theme: "dark",
                        style: "1",
                        locale: "en",
                        enable_publishing: false,
                        hide_top_toolbar: false,
                        hide_legend: false,
                        save_image: false,
                        backgroundColor: "#0f0f0f",
                    }}
                    className="w-full"
                />
            </div>
        </section>
    );
}
