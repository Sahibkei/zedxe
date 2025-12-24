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
import { cn, formatMarketCapValue, formatPrice } from "@/lib/utils";
import ProviderStatusDebug from "./ProviderStatusDebug";
import HistogramWC from "@/components/charts/layerchart/HistogramWC";
import RevenueCharts from "./RevenueCharts";

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
    const priceDisplay = stockProfile.price?.current
        ? formatPrice(stockProfile.price.current)
        : snapshot.currentPrice
          ? formatPrice(snapshot.currentPrice)
          : "—";
    const change = stockProfile.price?.changePercent ?? snapshot.changePercent;
    const changeDisplay =
        change === undefined || change === null ? "" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
    const changeClass = change === undefined || change === null ? "text-muted-foreground" : change >= 0 ? "text-green-400" : "text-red-400";
    const showProviderDebug = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_PROVIDER_STATUS === "1";
    // TODO: replace placeholder chart data with real timeframe performance when available.
    const histogramData = [
        { label: "1D", value: Number.parseFloat((snapshot.changePercent ?? 0).toFixed(2)) || 0.2 },
        { label: "1W", value: Number.parseFloat(((snapshot as Record<string, number>).weekChangePercent ?? 1.4).toFixed(2)) },
        { label: "1M", value: Number.parseFloat(((snapshot as Record<string, number>).monthChangePercent ?? 2.1).toFixed(2)) },
        { label: "3M", value: Number.parseFloat(((snapshot as Record<string, number>).threeMonthChangePercent ?? 3.8).toFixed(2)) },
        { label: "YTD", value: Number.parseFloat(((snapshot as Record<string, number>).ytdChangePercent ?? 5.2).toFixed(2)) },
    ];

    return (
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8 space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-3xl font-semibold leading-tight text-foreground">{companyName}</h1>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary ring-1 ring-primary/50">
                            {stockProfile.finnhubSymbol}
                        </span>
                        {stockProfile.company.exchange && (
                            <span className="rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                                {stockProfile.company.exchange}
                            </span>
                        )}
                        {stockProfile.company.industry && (
                            <span className="rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                                {stockProfile.company.industry}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="text-2xl font-semibold text-foreground">{priceDisplay}</span>
                        {changeDisplay && (
                            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${change >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                                {changeDisplay}
                            </span>
                        )}
                    </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/60 p-3 shadow-lg backdrop-blur">
                    <StockActionBar
                        symbol={symbolUpper}
                        company={snapshot.company || symbolUpper}
                        isInWatchlist={inWatchlist}
                        initialAlert={symbolAlertDisplay as AlertDisplay | undefined}
                    />
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                <div className="space-y-4 col-span-12 lg:col-span-4">
                    <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-lg backdrop-blur">
                        <div className="mb-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Snapshot</p>
                                <h3 className="text-lg font-semibold text-foreground">Ticker Information</h3>
                            </div>
                            <span className="rounded-full bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                {stockProfile.company.currency || "Currency N/A"}
                            </span>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                                <span className="text-muted-foreground">Price</span>
                                <span className="font-semibold text-foreground">{priceDisplay}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                                <span className="text-muted-foreground">Day Change</span>
                                <span className={cn("font-semibold", changeClass)}>{changeDisplay || "—"}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2">
                                <span className="text-muted-foreground">Market Cap</span>
                                <span className="font-semibold text-foreground">{marketCapDisplay}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-lg bg-muted/10 px-3 py-2">
                                <span className="text-muted-foreground">Currency</span>
                                <span className="font-semibold text-foreground">
                                    {stockProfile.company.currency || "—"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-lg backdrop-blur space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">Company Profile</h3>
                            {stockProfile.company.ipo && (
                                <span className="text-xs text-muted-foreground">IPO: {stockProfile.company.ipo}</span>
                            )}
                        </div>
                        <dl className="space-y-3 text-sm">
                            <div className="flex items-start justify-between gap-4">
                                <dt className="text-muted-foreground">Website</dt>
                                <dd className="text-right">
                                    {stockProfile.company.website ? (
                                        <a
                                            href={stockProfile.company.website}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-medium text-primary underline"
                                        >
                                            {stockProfile.company.website}
                                        </a>
                                    ) : (
                                        <span className="text-muted-foreground">—</span>
                                    )}
                                </dd>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                                <dt className="text-muted-foreground">Country</dt>
                                <dd className="font-medium text-foreground">{stockProfile.company.country || "—"}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                                <dt className="text-muted-foreground">Exchange</dt>
                                <dd className="font-medium text-foreground">{stockProfile.company.exchange || "—"}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                                <dt className="text-muted-foreground">Industry</dt>
                                <dd className="font-medium text-foreground">{stockProfile.company.industry || "—"}</dd>
                            </div>
                        </dl>
                        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm">
                            <p className="font-semibold text-foreground">Description</p>
                            <p className="text-muted-foreground leading-relaxed">
                                {stockProfile.company.description || "Business description not available."}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-8">
                    <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-xl backdrop-blur">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Performance</p>
                                <h3 className="text-lg font-semibold text-foreground">Price Performance</h3>
                            </div>
                            <span className="rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                                {stockProfile.tvSymbol || stockProfile.finnhubSymbol}
                            </span>
                        </div>
                        <TradingViewWidget
                            scripUrl={`${scriptUrl}advanced-chart.js`}
                            config={CANDLE_CHART_WIDGET_CONFIG(symbolUpper)}
                            className="custom-chart"
                            height={540}
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-xl backdrop-blur space-y-4">
                <StockProfileTabs profile={stockProfile} />
                {showProviderDebug && <ProviderStatusDebug errors={stockProfile.providerErrors} />}
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-xl backdrop-blur">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Distribution / Histogram</p>
                    <HistogramWC data={histogramData} />
                </div>
                <RevenueCharts symbol={symbolUpper} />
            </div>
        </div>
    );
}
