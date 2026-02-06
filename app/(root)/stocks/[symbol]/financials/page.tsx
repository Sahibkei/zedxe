import StockProfileFinancialsTable from "@/components/stocks/StockProfileFinancialsTable";

import { getStockProfileData } from "../data";

const StockFinancialsPage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    const { profile } = await getStockProfileData(symbol);

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-5 shadow-xl">
                <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Financial Statements</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-100">Annual Statements</h2>
                <p className="mt-2 text-sm text-slate-400">
                    Review the latest five-year financial performance across income, balance sheet, and cash flow.
                </p>
            </div>

            <StockProfileFinancialsTable financials={profile.financials} />
        </div>
    );
};

export default StockFinancialsPage;
