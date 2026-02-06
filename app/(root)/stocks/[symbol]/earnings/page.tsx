import { redirect } from "next/navigation";

import { getCanonicalSymbol, getStockProfileData } from "../data";

const StockEarningsPage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    const canonicalSymbol = getCanonicalSymbol(symbol);
    if (symbol !== canonicalSymbol) {
        redirect(`/stocks/${canonicalSymbol}/earnings`);
    }
    const { error } = await getStockProfileData(canonicalSymbol);

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl" role="tabpanel" id="earnings-panel">
            <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Earnings Snapshot</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">Latest Quarter</h2>
            <div className="mt-6 rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 px-4 py-4 text-sm text-slate-300">
                Earnings data is not available from the current provider. {error ? `(${error})` : ""}
            </div>
        </div>
    );
};

export default StockEarningsPage;
