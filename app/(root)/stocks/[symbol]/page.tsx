import TradingViewWidget from "@/components/TradingViewWidget";
import { SYMBOL_INFO_WIDGET_CONFIG, CANDLE_CHART_WIDGET_CONFIG } from "@/lib/constants";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { getSymbolSnapshot } from "@/lib/actions/finnhub.actions";
import { isSymbolInWatchlist } from "@/lib/actions/watchlist.actions";
import { getAlertsByUser } from "@/lib/actions/alert.actions";
import StockActionBar from "./StockActionBar";
import { getStockProfileV2 } from "@/lib/stocks/getStockProfileV2";
import { StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";
import StockProfileTabs from "./StockProfileTabs";

const scriptUrl = "https://s3.tradingview.com/external-embedding/embed-widget-";

function formatDetail(value?: string | number) {
    if (value === null || value === undefined) return "—";

    if (typeof value === "number") {
        if (Number.isNaN(value)) return "—";
        return value.toLocaleString();
    }

    const trimmed = value.trim();
    return trimmed !== "" ? trimmed : "—";
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6 text-center text-sm text-neutral-300">
            {message}
        </div>
    );
}

export default async function StockDetails({ params }: StockDetailsPageProps) {
    const { symbol } = await params;
    const symbolUpper = symbol.toUpperCase();

    const session = await auth.api.getSession({ headers: await headers() });

    const [profile, snapshot, inWatchlist, alerts] = await Promise.all([
        getStockProfileV2(symbolUpper).catch<StockProfileV2Model | null>(() => null),
        getSymbolSnapshot(symbolUpper).catch(() => ({ symbol: symbolUpper })),
        session?.user ? isSymbolInWatchlist(session.user.id, symbolUpper) : Promise.resolve(false),
        session?.user ? getAlertsByUser(session.user.id) : Promise.resolve([]),
    ]);

    const symbolAlert = alerts.find((alert) => alert.symbol === symbolUpper);
    const symbolAlertDisplay = symbolAlert
        ? {
              ...symbolAlert,
              id: String((symbolAlert as { _id?: string })._id || symbolAlert._id || ""),
              createdAt: symbolAlert.createdAt,
          }
        : undefined;

    const companyName = profile?.companyProfile.name || snapshot.company || symbolUpper;

    if (!profile) {
        return (
            <div className="flex min-h-screen p-4 md:p-6 lg:p-8">
                <div className="w-full space-y-6">
                    <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
                        <div className="space-y-1">
                            <div className="h-6 w-40 animate-pulse rounded bg-neutral-800" />
                            <div className="h-4 w-24 animate-pulse rounded bg-neutral-800" />
                        </div>
                        <StockActionBar
                            symbol={symbolUpper}
                            company={companyName}
                            isInWatchlist={inWatchlist}
                            initialAlert={symbolAlertDisplay as AlertDisplay | undefined}
                        />
                    </div>
                    <EmptyState message="No stock data available. Please verify the symbol or try again later." />
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen p-4 md:p-6 lg:p-8">
            <div className="w-full space-y-6">
                <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-semibold text-white">{companyName}</h1>
                            <div className="flex flex-wrap gap-3 text-sm text-neutral-300">
                                <span className="rounded-full bg-neutral-800 px-3 py-1 font-semibold">{profile.companyProfile.ticker}</span>
                                <span className="rounded-full bg-neutral-800 px-3 py-1">{formatDetail(profile.companyProfile.exchange)}</span>
                                <span className="rounded-full bg-neutral-800 px-3 py-1">{formatDetail(profile.companyProfile.sector)}</span>
                                <span className="rounded-full bg-neutral-800 px-3 py-1">{formatDetail(profile.companyProfile.industry)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <StockActionBar
                                symbol={symbolUpper}
                                company={companyName}
                                isInWatchlist={inWatchlist}
                                initialAlert={symbolAlertDisplay as AlertDisplay | undefined}
                            />
                        </div>
                    </div>
                </section>

                <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Price & Chart</h2>
                        <div className="text-xs text-neutral-400">TradingView data · {profile.chartSymbol}</div>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-black/40">
                        {profile.chartSymbol ? (
                            <TradingViewWidget
                                scripUrl={`${scriptUrl}advanced-chart.js`}
                                config={CANDLE_CHART_WIDGET_CONFIG(profile.chartSymbol)}
                                className="custom-chart"
                                height={520}
                            />
                        ) : (
                            <div className="flex h-80 items-center justify-center text-sm text-neutral-400">Chart unavailable</div>
                        )}
                    </div>
                </section>

                <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Company Overview</h2>
                            <p className="text-sm text-neutral-400">Fundamentals, earnings, ratios, and filings</p>
                        </div>
                        <TradingViewWidget
                            scripUrl={`${scriptUrl}symbol-info.js`}
                            config={SYMBOL_INFO_WIDGET_CONFIG(profile.companyProfile.ticker)}
                            height={120}
                        />
                    </div>
                    <div className="mb-6 grid gap-4 rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-white">Business Overview</h3>
                            <p className="text-sm leading-relaxed text-neutral-300">
                                {formatDetail(profile.companyProfile.description)}
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-neutral-500">Website</div>
                                {profile.companyProfile.website ? (
                                    <a
                                        href={profile.companyProfile.website}
                                        className="text-sm text-yellow-400 hover:text-yellow-300"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {profile.companyProfile.website}
                                    </a>
                                ) : (
                                    <div className="text-sm text-neutral-300">{formatDetail(profile.companyProfile.website)}</div>
                                )}
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-neutral-500">Headquarters</div>
                                <div className="text-sm text-neutral-300">
                                    {formatDetail(
                                        [profile.companyProfile.headquartersCity, profile.companyProfile.headquartersCountry]
                                            .filter(Boolean)
                                            .join(", ")
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-neutral-500">Employees</div>
                                <div className="text-sm text-neutral-300">{formatDetail(profile.companyProfile.employees)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-neutral-500">CEO</div>
                                <div className="text-sm text-neutral-300">{formatDetail(profile.companyProfile.ceo)}</div>
                            </div>
                        </div>
                    </div>
                    <StockProfileTabs profile={profile} />
                </section>
            </div>
        </div>
    );
}
