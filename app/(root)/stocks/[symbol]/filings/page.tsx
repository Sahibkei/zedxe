import { ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";

import { getStockProfileV2 } from "@/lib/stocks/getStockProfileV2";
import { getCanonicalSymbol } from "../data";

const StockFilingsPage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    const canonicalSymbol = getCanonicalSymbol(symbol);
    if (symbol !== canonicalSymbol) {
        redirect(`/stocks/${canonicalSymbol}/filings`);
    }
    let filings: Array<{ accessionNumber?: string; form?: string; filed?: string; reportDate?: string; url?: string; description?: string }> = [];
    try {
        const profile = await getStockProfileV2(canonicalSymbol);
        filings = profile.filings || [];
    } catch {
        filings = [];
    }

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl" role="tabpanel" id="filings-panel">
            <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Recent Filings</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">Regulatory Updates</h2>
            <div className="mt-6 space-y-3">
                {filings.length === 0 && (
                    <div className="rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 px-4 py-3 text-sm text-slate-400">
                        Filings data unavailable.
                    </div>
                )}
                {filings.map((filing, index) => (
                    <a
                        key={`${filing.form}-${filing.filed}-${filing.url}-${index}`}
                        href={filing.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 px-4 py-3 text-sm text-slate-300 transition hover:border-emerald-500/40 hover:bg-[#10151d]"
                    >
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">{filing.form ?? "Filing"}</p>
                            <p className="text-sm font-semibold text-slate-100">
                                {filing.description ?? filing.form ?? "Filing"}
                            </p>
                            <p className="text-xs text-slate-500">Filed {filing.filed ?? filing.reportDate ?? "—"}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-slate-500" />
                    </a>
                ))}
            </div>
        </div>
    );
};

export default StockFilingsPage;
