import TradingViewWidget from "@/components/TradingViewWidget";
import { CANDLE_CHART_WIDGET_CONFIG, TECHNICAL_ANALYSIS_WIDGET_CONFIG } from "@/lib/constants";
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
        : "—";
    const priceDisplay = stockProfile.price?.current ? formatPrice(stockProfile.price.current) : "—";
    const change = stockProfile.price?.changePercent;
    const changeDisplay =
        change === undefined || change === null ? "" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
    const changeClass = change === undefined || change === null ? "text-muted-foreground" : change >= 0 ? "text-green-600" : "text-red-600";

    return (
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-6 space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-3xl font-semibold leading-tight">{companyName}</h1>
                            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
                                {stockProfile.finnhubSymbol}
                            </span>
                            {stockProfile.company.exchange && (
                                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                    {stockProfile.company.exchange}
                                </span>
                            )}
                            {stockProfile.company.industry && (
                                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                    {stockProfile.company.industry}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="text-lg font-semibold text-foreground">{priceDisplay}</span>
                            {changeDisplay && <span className={changeClass}>{changeDisplay}</span>}
                        </div>
                    </div>
                    <StockActionBar
                        symbol={symbolUpper}
                        company={snapshot.company || symbolUpper}
                        isInWatchlist={inWatchlist}
                        initialAlert={symbolAlertDisplay as AlertDisplay | undefined}
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="space-y-4 lg:col-span-8">
                        <div className="rounded-lg border bg-card p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-lg font-semibold">Price Chart</h3>
                            </div>
                            <TradingViewWidget
                                scripUrl={`${scriptUrl}advanced-chart.js`}
                                config={CANDLE_CHART_WIDGET_CONFIG(symbolUpper)}
                                className="custom-chart"
                                height={520}
                            />
                        </div>

                        <div className="rounded-lg border bg-card p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-lg font-semibold">Technical Analysis</h3>
                            </div>
                            <TradingViewWidget
                                scripUrl={`${scriptUrl}technical-analysis.js`}
                                config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(symbolUpper)}
                                height={380}
                            />
                        </div>
                    </div>

                    <div className="space-y-4 lg:col-span-4">
                        <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
                            <h3 className="text-lg font-semibold">Company Snapshot</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Market Cap</span>
                                    <span className="font-medium text-foreground">{marketCapDisplay}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Country</span>
                                    <span className="font-medium text-foreground">
                                        {stockProfile.company.country || "—"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Exchange</span>
                                    <span className="font-medium text-foreground">
                                        {stockProfile.company.exchange || "—"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Website</span>
                                    {stockProfile.company.website ? (
                                        <a
                                            href={stockProfile.company.website}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-medium text-primary underline"
                                        >
                                            Visit
                                        </a>
                                    ) : (
                                        <span className="font-medium text-foreground">—</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
                <StockProfileTabs profile={stockProfile} />
                <ProviderStatusDebug errors={stockProfile.providerErrors} />
            </div>
        </div>
    );
}