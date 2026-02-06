import Link from "next/link";
import { headers } from "next/headers";

import { auth } from "@/lib/better-auth/auth";
import { getNews, getSymbolSnapshot } from "@/lib/actions/finnhub.actions";
import { getAlertsByUser } from "@/lib/actions/alert.actions";
import { isSymbolInWatchlist } from "@/lib/actions/watchlist.actions";
import { getStockProfileV2 } from "@/lib/stocks/getStockProfileV2";

import StockProfileContent from "@/components/stock-profile/StockProfileContent";
import StockProfileHeader from "@/components/stock-profile/StockProfileHeader";

type StockPageProps = {
    params: Promise<{ symbol: string }>;
};

export default async function StockDetailsPage({ params }: StockPageProps) {
    const { symbol } = await params;
    const symbolUpper = symbol.toUpperCase();
    const session = await auth.api.getSession({ headers: await headers() });

    const [profileResult, snapshotResult, watchlistResult, alertsResult, newsResult] = await Promise.allSettled([
        getStockProfileV2(symbolUpper),
        getSymbolSnapshot(symbolUpper),
        session?.user ? isSymbolInWatchlist(session.user.id, symbolUpper) : Promise.resolve(false),
        session?.user ? getAlertsByUser(session.user.id) : Promise.resolve([]),
        getNews([symbolUpper]),
    ]);

    if (profileResult.status !== "fulfilled") {
        const message =
            profileResult.reason instanceof Error
                ? profileResult.reason.message
                : "Stock profile data is currently unavailable.";

        return (
            <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8 md:px-6">
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
                    <h1 className="text-2xl font-semibold text-red-100">Unable to load stock profile</h1>
                    <p className="mt-2 text-sm text-red-200">{message}</p>
                    <div className="mt-4 flex gap-2">
                        <Link
                            href={`/stocks/${symbolUpper}`}
                            className="rounded-md border border-red-300/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-50 hover:bg-red-500/20"
                        >
                            Retry
                        </Link>
                        <Link
                            href="/dashboard"
                            className="rounded-md border border-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-muted/20"
                        >
                            Back to Markets
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const stockProfile = profileResult.value;

    const snapshot =
        snapshotResult.status === "fulfilled"
            ? snapshotResult.value
            : {
                  symbol: symbolUpper,
                  company: stockProfile.company.name || symbolUpper,
              };

    const isInWatchlist = watchlistResult.status === "fulfilled" ? watchlistResult.value : false;
    const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
    const newsItems = newsResult.status === "fulfilled" ? newsResult.value : [];

    const symbolAlert = alerts.find((alert) => alert.symbol === symbolUpper);
    const symbolAlertDisplay = symbolAlert
        ? {
              ...symbolAlert,
              id: String((symbolAlert as { _id?: string })._id || symbolAlert._id || ""),
              createdAt: symbolAlert.createdAt,
          }
        : undefined;

    const companyName = stockProfile.company.name || snapshot.company || stockProfile.finnhubSymbol;
    const marketCap = stockProfile.company.marketCap || snapshot.marketCap;

    return (
        <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-8 md:px-6">
            <StockProfileHeader
                symbol={symbolUpper}
                companyName={companyName}
                exchange={stockProfile.company.exchange}
                sector={stockProfile.company.industry}
                currency={stockProfile.company.currency}
                marketCap={marketCap}
                price={stockProfile.price?.current ?? snapshot.currentPrice}
                changePercent={stockProfile.price?.changePercent ?? snapshot.changePercent}
                isInWatchlist={isInWatchlist}
                initialAlert={symbolAlertDisplay as AlertDisplay | undefined}
            />

            <StockProfileContent
                profile={stockProfile}
                symbol={symbolUpper}
                marketCap={marketCap}
                newsItems={newsItems}
                providerErrors={stockProfile.providerErrors}
            />
        </div>
    );
}
