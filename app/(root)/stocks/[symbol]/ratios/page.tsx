import { redirect } from "next/navigation";

import { getCanonicalSymbol, getStockProfileData } from "../data";

const StockRatiosPage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    const canonicalSymbol = getCanonicalSymbol(symbol);
    if (symbol !== canonicalSymbol) {
        redirect(`/stocks/${canonicalSymbol}/ratios`);
    }
    const { profile } = await getStockProfileData(canonicalSymbol);

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl" role="tabpanel" id="ratios-panel">
            <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Key Ratios</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">Valuation &amp; Profitability</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {profile.ratios.map((ratio) => (
                    <div key={ratio.label} className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">{ratio.label}</p>
                        <p className="mt-2 text-lg font-semibold text-slate-100">{ratio.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StockRatiosPage;
