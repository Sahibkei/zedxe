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

    return (
        <div className="min-h-screen bg-[#0b0f14]">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-8 space-y-6 md:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-3xl font-semibold leading-tight text-white">{companyName}</h1>
                            <span className="rounded-md bg-sky-500/10 px-3 py-1 text-sm font-semibold text-sky-200 ring-1 ring-sky-400/50">
                                {stockProfile.finnhubSymbol}
                            </span>
                            {stockProfile.company.exchange && (
                                <span className="rounded-md bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/10">
                                    {stockProfile.company.exchange}
                                </span>
                            )}
                            {stockProfile.company.industry && (
                                <span className="rounded-md bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/10">
                                    {stockProfile.company.industry}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                            <span className="text-2xl font-semibold text-white">{priceDisplay}</span>
                            {changeDisplay && (
                                <span
                                    className={cn(
                                        "rounded-full px-3 py-1 text-sm font-semibold",
                                        change >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                    )}
                                >
                                    {changeDisplay}
                                </span>
                            )}
                            {marketCapDisplay && <span className="text-xs text-slate-400">Market Cap {marketCapDisplay}</span>}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#101722] p-3 shadow-2xl">
                        <StockActionBar
                            symbol={symbolUpper}
                            company={snapshot.company || symbolUpper}
                            isInWatchlist={inWatchlist}
                            initialAlert={symbolAlertDisplay as AlertDisplay | undefined}
                        />
                    </div>
                </div>

                <StockProfileTabs
                    profile={stockProfile}
                    snapshot={snapshot}
                    priceDisplay={priceDisplay}
                    marketCapDisplay={marketCapDisplay}
                    changePercent={change}
                />

                {showProviderDebug && <ProviderStatusDebug errors={stockProfile.providerErrors} />}
            </div>
        </div>
    );
}
