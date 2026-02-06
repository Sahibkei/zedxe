import TradingViewAdvancedChart from "@/components/stocks/TradingViewAdvancedChart";

import { getCanonicalSymbol, getStockProfileData } from "../data";
import { redirect } from "next/navigation";

const StockOverviewPage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    const canonicalSymbol = getCanonicalSymbol(symbol);
    if (symbol !== canonicalSymbol) {
        redirect(`/stocks/${canonicalSymbol}/overview`);
    }
    const { profile, hasLiveQuote } = await getStockProfileData(canonicalSymbol);
    const highlights = profile.overview.highlights ?? [];

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" role="tabpanel" id="overview-panel">
            <div className="space-y-6">
                <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-5 shadow-xl">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Advanced Chart</p>
                            <p className="text-lg font-semibold text-slate-100">{profile.header.symbol} Price Action</p>
                        </div>
                        <span className="rounded-full border border-[#1c2432] bg-[#0b0f14] px-3 py-1 text-xs font-mono text-slate-400">
                            {profile.header.symbol}
                        </span>
                    </div>
                    <div className="h-[520px] rounded-xl border border-[#1c2432] bg-[#0b0f14]">
                        <TradingViewAdvancedChart
                            symbol={profile.header.symbol}
                            exchange={profile.header.exchange}
                            className="h-full"
                        />
                    </div>
                </div>

                <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl">
                    <p className="text-sm font-semibold text-slate-200">Business Overview</p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-400">{profile.overview.description}</p>

                    <div className="mt-4 rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 px-4 py-3 text-xs text-slate-400">
                        {hasLiveQuote
                            ? "Live pricing available."
                            : "Live pricing unavailable; values reflect delayed or estimated data."}
                    </div>

                    {highlights.length > 0 && (
                        <div className="mt-6">
                            <p className="text-sm font-semibold text-slate-200">Key Highlights</p>
                            <ul className="mt-3 grid gap-3 md:grid-cols-2">
                                {highlights.map((highlight) => (
                                    <li
                                        key={highlight}
                                        className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 px-4 py-3 text-sm text-slate-300"
                                    >
                                        {highlight}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <aside className="space-y-6">
                <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-5 shadow-xl">
                    <p className="text-sm font-semibold text-slate-100">Key Stats</p>
                    <dl className="mt-4 space-y-3 text-sm">
                        {profile.keyStats.map((stat) => (
                            <div key={stat.label} className="flex items-center justify-between text-slate-300">
                                <dt className="text-slate-500">{stat.label}</dt>
                                <dd className="font-medium text-slate-100">{stat.value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-5 shadow-xl">
                    <p className="text-sm font-semibold text-slate-100">Company Snapshot</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-400">
                        <p>
                            <span className="text-slate-500">Sector:</span> {profile.overview.sector}
                        </p>
                        <p>
                            <span className="text-slate-500">Industry:</span> {profile.overview.industry}
                        </p>
                        <p>
                            <span className="text-slate-500">HQ:</span> {profile.about.headquarters}
                        </p>
                        <p>
                            <span className="text-slate-500">Employees:</span> {profile.about.employees}
                        </p>
                        <a
                            href={profile.about.website}
                            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 hover:text-emerald-200"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {profile.about.website}
                        </a>
                    </div>
                </div>
                <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-5 shadow-xl">
                    <p className="text-sm font-semibold text-slate-100">Business Detail</p>
                    <div className="mt-4 space-y-4 text-sm text-slate-400">
                        {profile.overview.sections.map((section) => (
                            <div key={section.title}>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {section.title}
                                </p>
                                <p className="mt-2 text-sm text-slate-300">{section.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>
        </div>
    );
};

export default StockOverviewPage;
