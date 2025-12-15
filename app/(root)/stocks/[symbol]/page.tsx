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

const scriptUrlBase = "https://s3.tradingview.com/external-embedding/embed-widget-";

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

function formatPrice(value?: number) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(change?: number, changePercent?: number) {
    if (change === null || change === undefined || Number.isNaN(change)) return "—";

    const percent = changePercent !== undefined && !Number.isNaN(changePercent) ? `${changePercent.toFixed(2)}%` : "—";
    const sign = change > 0 ? "+" : "";
    return `${sign}${change.toFixed(2)} (${percent})`;
}

export default async function StockDetails({ params }: StockDetailsPageProps) {
    const { symbol } = await params;
    const symbolUpper = symbol.toUpperCase();

    const session = await auth.api.getSession({ headers: await headers() });

    let profile: StockProfileV2Model | null = null;
    let profileError: string | null = null;

    try {
        profile = await getStockProfileV2(symbolUpper);
    } catch (error) {
        profileError = error instanceof Error ? error.message : "Unable to load stock profile.";
    }

    const [snapshot, inWatchlist, alerts] = await Promise.all([
        getSymbolSnapshot(symbolUpper).catch(() => ({ symbol: symbolUpper })),
        session?.user ? isSymbolInWatchlist(session.user.id, symbolUpper) : Promise.resolve(false),
        session?.user ? getAlertsByUser(session.user.id) : Promise.resolve([]),
    ]);

    const symbolAlert = alerts.find((alert) => alert.symbol === symbolUpper);
    const symbolAlertDisplay = symbolAlert
        ? {
              ...symbolAlert,
              id: String(symbolAlert._id ?? symbolAlert.id ?? ""),
              createdAt: symbolAlert.createdAt,
          }
        : undefined;

    const companyProfile = profile?.companyProfile;
    const companyName = companyProfile?.name || snapshot.company || symbolUpper;
    const chartSymbol = profile?.chartSymbol ?? symbolUpper;

    const finnhubAvailable = profile?.sources?.finnhubAvailable ?? false;
    const secAvailable = profile?.sources?.secAvailable ?? false;

    const dataSources: string[] = [];
    if (profile?.financialsSource === "FINNHUB_REPORTED") {
        dataSources.push("Financials & ratios: Finnhub");
    } else if (profile?.financialsSource === "SEC_XBRL") {
        dataSources.push("Financials: SEC XBRL fallback");
    } else if (finnhubAvailable) {
        dataSources.push("Fundamentals: Finnhub");
    }
    dataSources.push(secAvailable ? "Filings: SEC (XBRL/EDGAR)" : "Filings unavailable (SEC)");
    if (chartSymbol) {
        dataSources.push("Chart: TradingView");
    }

    const overviewDescription = companyProfile?.description && companyProfile.description.trim() !== "" ? companyProfile.description : "—";

    const tickerDisplay = companyProfile?.ticker || symbolUpper;
    const exchangeDisplay = companyProfile?.exchange;
    const sectorDisplay = companyProfile?.sector;
    const industryDisplay = companyProfile?.industry;
    const priceDisplay = formatPrice(profile?.quote?.price);
    const changeDisplay = formatChange(profile?.quote?.change, profile?.quote?.changePercent);

    return (
        <div className="flex min-h-screen p-4 md:p-6 lg:p-8">
            <div className="w-full space-y-6">
                {profileError && (
                    <div className="rounded-lg border border-yellow-700 bg-yellow-900/30 p-4 text-sm text-yellow-200">
                        SEC data unavailable: {profileError}
                    </div>
                )}
                {profile?.sources?.finnhubError && (
                    <div className="rounded-lg border border-yellow-700 bg-yellow-900/30 p-4 text-sm text-yellow-200">
                        Fundamentals unavailable: {profile.sources.finnhubError}
                    </div>
                )}
                {profile?.sources?.secError && !profileError && (
                    <div className="rounded-lg border border-yellow-700 bg-yellow-900/30 p-4 text-sm text-yellow-200">
                        SEC filings unavailable: {profile.sources.secError}
                    </div>
                )}
                <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-semibold text-white">{companyName || "Unknown company"}</h1>
                            <div className="flex flex-wrap gap-3 text-sm text-neutral-300">
                                <span className="rounded-full bg-neutral-800 px-3 py-1 font-semibold">{tickerDisplay}</span>
                                <span className="rounded-full bg-neutral-800 px-3 py-1">{formatDetail(exchangeDisplay)}</span>
                                <span className="rounded-full bg-neutral-800 px-3 py-1">{formatDetail(sectorDisplay)}</span>
                                <span className="rounded-full bg-neutral-800 px-3 py-1">{formatDetail(industryDisplay)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right text-sm">
                                <div className="text-xl font-semibold text-white">{priceDisplay}</div>
                                <div className="text-xs text-neutral-400">{changeDisplay}</div>
                            </div>
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
                        <div className="text-xs text-neutral-400">TradingView data · {chartSymbol ?? "Unavailable"}</div>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-black/40">
                        {chartSymbol ? (
                            <TradingViewWidget
                                scriptUrl={`${scriptUrlBase}advanced-chart.js`}
                                config={CANDLE_CHART_WIDGET_CONFIG(chartSymbol)}
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
                            scriptUrl={`${scriptUrlBase}symbol-info.js`}
                            config={SYMBOL_INFO_WIDGET_CONFIG(tickerDisplay)}
                            height={120}
                        />
                    </div>
                    <div className="mb-6 grid gap-4 rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-white">Business Overview</h3>
                            <p className="text-sm leading-relaxed text-neutral-300">
                                {overviewDescription}
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <div className="text-xs uppercase tracking-wide text-neutral-500">Website</div>
                                {companyProfile?.website ? (
                                    <a
                                        href={companyProfile.website}
                                        className="text-sm text-yellow-400 hover:text-yellow-300"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {companyProfile.website}
                                    </a>
                                ) : (
                                    <div className="text-sm text-neutral-300">{formatDetail(companyProfile?.website)}</div>
                                )}
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-neutral-500">Headquarters</div>
                                <div className="text-sm text-neutral-300">
                                    {formatDetail(
                                        [companyProfile?.headquartersCity, companyProfile?.headquartersCountry]
                                            .filter(Boolean)
                                            .join(", ")
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-neutral-500">Employees</div>
                                <div className="text-sm text-neutral-300">{formatDetail(companyProfile?.employees)}</div>
                            </div>
                            <div>
                                <div className="text-xs uppercase tracking-wide text-neutral-500">CEO</div>
                                <div className="text-sm text-neutral-300">{formatDetail(companyProfile?.ceo)}</div>
                            </div>
                        </div>
                    </div>
                    {profile ? (
                        <StockProfileTabs profile={profile} />
                    ) : (
                        <EmptyState message="Financials, ratios, earnings, and filings are unavailable." />
                    )}
                    {dataSources.length > 0 && (
                        <div className="mt-2 text-xs text-neutral-500">{dataSources.join(" · ")}</div>
                    )}
                </section>
            </div>
        </div>
    );
}
