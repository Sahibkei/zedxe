import { redirect } from "next/navigation";

import { getCanonicalSymbol, getStockProfileData } from "../data";

const StockEarningsPage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    const canonicalSymbol = getCanonicalSymbol(symbol);
    if (symbol !== canonicalSymbol) {
        redirect(`/stocks/${canonicalSymbol}/earnings`);
    }
    const { profile } = await getStockProfileData(canonicalSymbol);
    const isPositive = profile.earnings.surprise.trim().startsWith("+");
    const surpriseClass = isPositive ? "text-emerald-300" : "text-rose-300";

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl" role="tabpanel" id="earnings-panel">
            <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Earnings Snapshot</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">Latest Quarter</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Quarter</p>
                    <p className="mt-2 text-lg font-semibold text-slate-100">{profile.earnings.quarter}</p>
                </div>
                <div className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">EPS</p>
                    <p className="mt-2 text-lg font-semibold text-slate-100">{profile.earnings.eps}</p>
                </div>
                <div className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Revenue</p>
                    <p className="mt-2 text-lg font-semibold text-slate-100">{profile.earnings.revenue}</p>
                </div>
            </div>
            <div className="mt-6 rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 px-4 py-3 text-sm text-slate-300">
                Surprise: <span className={`font-semibold ${surpriseClass}`}>{profile.earnings.surprise}</span>
            </div>
        </div>
    );
};

export default StockEarningsPage;
