import TradingViewAdvancedChart from "@/components/stocks/TradingViewAdvancedChart";
import { redirect } from "next/navigation";

import { formatMarketCapValue } from "@/lib/utils";
import { getCanonicalSymbol, getStockProfileData } from "../data";

const StockOverviewPage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    const canonicalSymbol = getCanonicalSymbol(symbol);
    if (symbol !== canonicalSymbol) {
        redirect(`/stocks/${canonicalSymbol}/overview`);
    }
    const { profile, quote, error } = await getStockProfileData(canonicalSymbol);

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" role="tabpanel" id="overview-panel">
            <div className="space-y-6">
                <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-5 shadow-xl">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Advanced Chart</p>
                            <p className="text-lg font-semibold text-slate-100">{profile.symbol} Price Action</p>
                        </div>
                        <span className="rounded-full border border-[#1c2432] bg-[#0b0f14] px-3 py-1 text-xs font-mono text-slate-400">
                            {profile.symbol}
                        </span>
                    </div>
                    <div className="h-[520px] rounded-xl border border-[#1c2432] bg-[#0b0f14]">
                        <TradingViewAdvancedChart
                            symbol={profile.symbol}
                            exchange={profile.exchange}
                            className="h-full"
                        />
                    </div>
                </div>

                <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl">
                    <p className="text-sm font-semibold text-slate-200">Business Overview</p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-400">
                        {profile.description || "No company description available yet."}
                    </p>

                    <div className="mt-4 rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 px-4 py-3 text-xs text-slate-400">
                        {error
                            ? `Data unavailable: ${error}`
                            : quote
                              ? "Live pricing available."
                              : "Live pricing unavailable; try again later."}
                    </div>
                </div>
            </div>

            <aside className="space-y-6">
                <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-5 shadow-xl">
                    <p className="text-sm font-semibold text-slate-100">Key Stats</p>
                    <dl className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between text-slate-300">
                            <dt className="text-slate-500">Market Cap</dt>
                            <dd className="font-medium text-slate-100">
                                {profile.marketCap ? formatMarketCapValue(profile.marketCap) : "—"}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                            <dt className="text-slate-500">52W Range</dt>
                            <dd className="font-medium text-slate-100">
                                {profile.range52wLow && profile.range52wHigh
                                    ? `${profile.range52wLow.toFixed(2)} - ${profile.range52wHigh.toFixed(2)}`
                                    : "—"}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                            <dt className="text-slate-500">Avg Volume</dt>
                            <dd className="font-medium text-slate-100">
                                {profile.avgVolume ? profile.avgVolume.toLocaleString("en-US") : "—"}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                            <dt className="text-slate-500">Beta</dt>
                            <dd className="font-medium text-slate-100">
                                {profile.beta !== undefined ? profile.beta.toFixed(2) : "—"}
                            </dd>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                            <dt className="text-slate-500">Dividend Yield</dt>
                            <dd className="font-medium text-slate-100">
                                {profile.dividendYield !== undefined ? `${profile.dividendYield.toFixed(2)}%` : "—"}
                            </dd>
                        </div>
                    </dl>
                </div>

                <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-5 shadow-xl">
                    <p className="text-sm font-semibold text-slate-100">Company Snapshot</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-400">
                        {profile.sector && (
                            <p>
                                <span className="text-slate-500">Sector:</span> {profile.sector}
                            </p>
                        )}
                        {profile.industry && (
                            <p>
                                <span className="text-slate-500">Industry:</span> {profile.industry}
                            </p>
                        )}
                        <p>
                            <span className="text-slate-500">HQ:</span>{" "}
                            {profile.hqCity || profile.hqState || profile.hqCountry
                                ? `${profile.hqCity ?? ""} ${profile.hqState ?? ""} ${profile.hqCountry ?? ""}`.trim()
                                : "—"}
                        </p>
                        <p>
                            <span className="text-slate-500">Employees:</span>{" "}
                            {profile.employees ? profile.employees.toLocaleString("en-US") : "—"}
                        </p>
                        {profile.website ? (
                            <a
                                href={profile.website}
                                className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 hover:text-emerald-200"
                                target="_blank"
                                rel="noreferrer"
                            >
                                {profile.website}
                            </a>
                        ) : (
                            <span className="text-sm text-slate-500">Website unavailable</span>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
};

export default StockOverviewPage;
