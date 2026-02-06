import type { Metadata } from "next";

import StockProfileHeader from "@/components/stocks/StockProfileHeader";
import StockProfileTabs from "@/components/stocks/StockProfileTabs";
import TradingViewAdvancedChart from "@/components/stocks/TradingViewAdvancedChart";
import { getQuote } from "@/lib/market/providers";
import { getMockStockProfile } from "@/src/features/stock-profile-v2/contract/mock";

const resolveSymbol = (rawSymbol: string | undefined) => {
    const cleaned = (rawSymbol ?? "").trim();
    return cleaned ? cleaned.toUpperCase() : "UNKNOWN";
};

export async function generateMetadata({
    params,
}: {
    params: { symbol: string };
}): Promise<Metadata> {
    const symbol = resolveSymbol(params?.symbol);
    return {
        title: `${symbol} · Stock Profile · ZedXe`,
    };
}

const StockProfilePage = async ({ params }: { params: { symbol: string } }) => {
    const symbol = resolveSymbol(params?.symbol);
    let profile = getMockStockProfile(symbol);

    try {
        const quote = await getQuote(symbol);
        if (quote && typeof quote.c === "number") {
            profile = {
                ...profile,
                header: {
                    ...profile.header,
                    price: quote.c,
                    change: typeof quote.d === "number" ? quote.d : profile.header.change,
                    changePct: typeof quote.dp === "number" ? quote.dp : profile.header.changePct,
                    status: "Live",
                },
            };
        }
    } catch {
        // Fall back to mock pricing silently
    }

    return (
        <div className="min-h-screen bg-[#010409] text-slate-100">
            <div className="mx-auto w-full max-w-[1800px] px-6 pb-12 pt-24">
                <div className="space-y-6">
                    <div className="sticky top-20 z-20">
                        <StockProfileHeader header={profile.header} />
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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
                                    <TradingViewAdvancedChart symbol={profile.header.symbol} className="h-full" />
                                </div>
                            </div>

                            <StockProfileTabs profile={profile} />
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
                                <p className="text-sm font-semibold text-slate-100">About</p>
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
                        </aside>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockProfilePage;
