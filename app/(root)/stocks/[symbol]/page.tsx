import TradingViewWidget from "@/components/TradingViewWidget";
import { CANDLE_CHART_WIDGET_CONFIG } from "@/lib/constants";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { getSymbolSnapshot } from "@/lib/actions/finnhub.actions";
import { isSymbolInWatchlist } from "@/lib/actions/watchlist.actions";
import { getAlertsByUser } from "@/lib/actions/alert.actions";
import StockActionBar from "./StockActionBar";
import { getStockProfileV2 } from "@/lib/stocks/getStockProfileV2";
import StockProfileTabs from "./StockProfileTabs";
import { formatMarketCapValue, formatPrice } from "@/lib/utils";
import ProviderStatusDebug from "./ProviderStatusDebug";
import StockHeroCard from "@/src/components/finance/StockHeroCard";
import CompanyStatsGrid from "@/src/components/finance/CompanyStatsGrid";

export default async function StockDetails({ params }: StockDetailsPageProps) {
    const { symbol } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    const symbolUpper = symbol.toUpperCase();
    const [stockProfile, snapshot, inWatchlist, alerts] = await Promise.all([
        getStockProfileV2(symbolUpper),
        getSymbolSnapshot(symbolUpper).catch(() => ({ symbol: symbolUpper })),
        session?.user ? isSymbolInWatchlist(session.user.id, symbolUpper) : Promise.resolve(false),
        session?.user ? getAlertsByUser(session.user.id) : Promise.resolve([]),
    ]);

    const symbolAlert = alerts.find((alert) => alert.symbol === symbolUpper);
    const symbolAlertDisplay = symbolAlert
        ? {
              ...symbolAlert,
              id: String((symbolAlert as { _id?: string })._id || symbolAlert._id || ''),
              createdAt: symbolAlert.createdAt,
          }
        : undefined;
    const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;
    const companyName = stockProfile.company.name || stockProfile.finnhubSymbol;
    const marketCapDisplay = stockProfile.company.marketCap
        ? formatMarketCapValue(stockProfile.company.marketCap)
        : snapshot.marketCap
          ? formatMarketCapValue(snapshot.marketCap)
          : "—";
    const currentPriceValue = stockProfile.price?.current ?? snapshot.currentPrice;
    const priceDisplay = currentPriceValue ? formatPrice(currentPriceValue) : "—";
    const change = stockProfile.price?.changePercent ?? snapshot.changePercent;
    const changePercentDisplay =
        change === undefined || change === null ? "" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
    const changeValue = currentPriceValue && change !== undefined && change !== null ? (currentPriceValue * change) / 100 : undefined;
    const changeValueDisplay = changeValue !== undefined ? formatPrice(Math.abs(changeValue)) : "";
    const changeDisplay =
        changePercentDisplay && changeValueDisplay
            ? `${change >= 0 ? "+" : "-"}${changeValueDisplay} (${changePercentDisplay})`
            : changePercentDisplay;
    const changeClass = change === undefined || change === null ? "text-slate-400" : change >= 0 ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300";
    const subtitle = [stockProfile.company.industry, stockProfile.company.exchange].filter(Boolean).join(" | ");
    const subtitleDisplay = subtitle || "—";
    const formatNumber = (value?: number) => {
        if (value === undefined || value === null || Number.isNaN(value)) return "—";
        return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
    };
    const dividendYieldDisplay =
        stockProfile.metrics.dividendYieldPercent === undefined || stockProfile.metrics.dividendYieldPercent === null
            ? "—"
            : `${formatNumber(stockProfile.metrics.dividendYieldPercent)}%`;
    const showProviderDebug = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_PROVIDER_STATUS === "1";

    return (
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8 space-y-8">
            <StockHeroCard
                companyName={companyName}
                symbol={stockProfile.finnhubSymbol}
                subtitle={subtitleDisplay}
                price={priceDisplay}
                change={changeDisplay}
                changeClassName={changeClass}
                metricItems={[
                    { label: "Volume", value: "—" },
                    { label: "Market Cap", value: marketCapDisplay },
                    { label: "P/E", value: formatNumber(stockProfile.metrics.pe) },
                    { label: "52W Range", value: "—" },
                ]}
                actions={
                    <StockActionBar
                        symbol={symbolUpper}
                        company={snapshot.company || symbolUpper}
                        isInWatchlist={inWatchlist}
                        initialAlert={symbolAlertDisplay as AlertDisplay | undefined}
                    />
                }
            />

            <CompanyStatsGrid
                items={[
                    { label: "Market Cap", value: marketCapDisplay },
                    { label: "P/E", value: formatNumber(stockProfile.metrics.pe) },
                    { label: "P/B", value: formatNumber(stockProfile.metrics.pb) },
                    { label: "P/S", value: formatNumber(stockProfile.metrics.ps) },
                    { label: "EV/EBITDA", value: formatNumber(stockProfile.metrics.evToEbitda) },
                    { label: "Debt/Equity", value: formatNumber(stockProfile.metrics.debtToEquity) },
                    { label: "Current Ratio", value: formatNumber(stockProfile.metrics.currentRatio) },
                    { label: "Dividend Yield", value: dividendYieldDisplay },
                    { label: "52W Range", value: "—" },
                ]}
            />

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl backdrop-blur">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Performance</p>
                        <h3 className="text-lg font-semibold text-slate-100">Price Performance</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                        {stockProfile.tvSymbol || stockProfile.finnhubSymbol}
                    </span>
                </div>
                <TradingViewWidget
                    scripUrl={`${scriptUrl}advanced-chart.js`}
                    config={CANDLE_CHART_WIDGET_CONFIG(symbolUpper)}
                    className="custom-chart"
                    height={520}
                />
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur space-y-4">
                <StockProfileTabs profile={stockProfile} />
                {showProviderDebug && <ProviderStatusDebug errors={stockProfile.providerErrors} />}
            </div>
        </div>
    );
}
