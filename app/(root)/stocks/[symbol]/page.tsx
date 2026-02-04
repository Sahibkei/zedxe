import TradingViewWidget from "@/components/TradingViewWidget";
import { CANDLE_CHART_WIDGET_CONFIG } from "@/lib/constants";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { getSymbolSnapshot } from "@/lib/actions/finnhub.actions";
import { isSymbolInWatchlist } from "@/lib/actions/watchlist.actions";
import Link from "next/link";
import { getAlertsByUser } from "@/lib/actions/alert.actions";
import { getNews } from "@/lib/actions/finnhub.actions";
import StockActionBar from "./StockActionBar";
import { getStockProfileV2 } from "@/lib/stocks/getStockProfileV2";
import { formatMarketCapValue, formatPrice } from "@/lib/utils";
import ProviderStatusDebug from "./ProviderStatusDebug";
import StockHeroCard from "@/src/components/finance/StockHeroCard";
import CompanyStatsGrid from "@/src/components/finance/CompanyStatsGrid";
import SectionCard from "@/src/components/ui/SectionCard";
import StockFinancialStatementsSection from "./StockFinancialStatementsSection";
import FilingsTable from "@/src/components/finance/FilingsTable";

export default async function StockDetails({ params }: StockDetailsPageProps) {
    const { symbol } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    const symbolUpper = symbol.toUpperCase();
    const [stockProfile, snapshot, inWatchlist, alerts, news] = await Promise.all([
        getStockProfileV2(symbolUpper),
        getSymbolSnapshot(symbolUpper).catch(() => ({ symbol: symbolUpper })),
        session?.user ? isSymbolInWatchlist(session.user.id, symbolUpper) : Promise.resolve(false),
        session?.user ? getAlertsByUser(session.user.id) : Promise.resolve([]),
        getNews([symbolUpper]).catch(() => []),
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
    const formatNewsDate = (timestamp?: number) => {
        if (!timestamp) return "—";
        return new Date(timestamp * 1000).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };
    const showProviderDebug = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_PROVIDER_STATUS === "1";

    return (
        <div className="space-y-8">
            <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-100">
                ← Back to Markets
            </Link>
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

            <SectionCard
                eyebrow="Performance"
                title="Price Performance"
                action={
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                        {stockProfile.tvSymbol || stockProfile.finnhubSymbol}
                    </span>
                }
            >
                <TradingViewWidget
                    scripUrl={`${scriptUrl}advanced-chart.js`}
                    config={CANDLE_CHART_WIDGET_CONFIG(symbolUpper)}
                    className="custom-chart"
                    height={520}
                />
            </SectionCard>

            <SectionCard eyebrow="Company" title="Company Overview">
                <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
                    <div>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            {stockProfile.company.description || "Business description not available."}
                        </p>
                    </div>
                    <div className="space-y-3 text-sm text-slate-300">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Website</span>
                            {stockProfile.company.website ? (
                                <a
                                    href={stockProfile.company.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-slate-100 underline"
                                >
                                    {stockProfile.company.website}
                                </a>
                            ) : (
                                <span className="text-slate-500">—</span>
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Exchange</span>
                            <span className="font-medium text-slate-100">{stockProfile.company.exchange || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Industry</span>
                            <span className="font-medium text-slate-100">{stockProfile.company.industry || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400">Country</span>
                            <span className="font-medium text-slate-100">{stockProfile.company.country || "—"}</span>
                        </div>
                    </div>
                </div>
            </SectionCard>

            <SectionCard eyebrow="Market" title="Latest News">
                <div className="space-y-4">
                    {news.length === 0 ? (
                        <p className="text-sm text-slate-400">No recent news available.</p>
                    ) : (
                        news.slice(0, 6).map((article) => (
                            <a
                                key={article.id}
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                            >
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                    <span>{article.source || "Source"}</span>
                                    <span>•</span>
                                    <span>{formatNewsDate(article.datetime)}</span>
                                </div>
                                <h3 className="text-sm font-semibold text-slate-100">{article.headline}</h3>
                                <p className="text-sm text-slate-400 line-clamp-2">{article.summary}</p>
                            </a>
                        ))
                    )}
                </div>
            </SectionCard>

            <SectionCard eyebrow="Financials" title="Financial Statements">
                <StockFinancialStatementsSection profile={stockProfile} />
            </SectionCard>

            <SectionCard eyebrow="SEC" title="Recent Filings">
                <FilingsTable symbol={stockProfile.secTicker || stockProfile.symbolRaw || stockProfile.finnhubSymbol} />
            </SectionCard>

            {showProviderDebug && (
                <SectionCard eyebrow="Debug" title="Provider Status">
                    <ProviderStatusDebug errors={stockProfile.providerErrors} />
                </SectionCard>
            )}
        </div>
    );
}
