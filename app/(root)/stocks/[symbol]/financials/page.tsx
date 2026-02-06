import StockProfileFinancialsTable from "@/components/stocks/StockProfileFinancialsTable";
import { redirect } from "next/navigation";

import { getCanonicalSymbol, getStockProfileData } from "../data";

const StockFinancialsPage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    const canonicalSymbol = getCanonicalSymbol(symbol);
    if (symbol !== canonicalSymbol) {
        redirect(`/stocks/${canonicalSymbol}/financials`);
    }
    const { profile } = await getStockProfileData(canonicalSymbol);

    return (
        <div className="space-y-6" role="tabpanel" id="financials-panel">
            <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-5 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Financial Statements</p>
                        <h2 className="mt-2 text-lg font-semibold text-slate-100">Annual Statements</h2>
                    </div>
                    <span className="rounded-full border border-[#1c2432] bg-[#0b0f14] px-3 py-1 text-xs font-mono text-slate-400">
                        {profile.header.symbol}
                    </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                    Review the latest five-year financial performance across income, balance sheet, and cash flow.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                        FY
                    </span>
                    <span className="rounded-full border border-[#1c2432] px-3 py-1">Quarterly</span>
                </div>
            </div>

            <StockProfileFinancialsTable symbol={profile.header.symbol} statements={profile.financialStatements} />
        </div>
    );
};

export default StockFinancialsPage;
