import { ExternalLink } from "lucide-react";

import { getStockProfileData } from "../data";

const StockFilingsPage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    const { profile } = await getStockProfileData(symbol);

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl">
            <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Recent Filings</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-100">Regulatory Updates</h2>
            <div className="mt-6 space-y-3">
                {profile.filings.map((filing, index) => (
                    <a
                        key={`${filing.type}-${filing.date}-${filing.url}-${index}`}
                        href={filing.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-xl border border-[#1c2432] bg-[#0b0f14]/70 px-4 py-3 text-sm text-slate-300 transition hover:border-emerald-500/40 hover:bg-[#10151d]"
                    >
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">{filing.type}</p>
                            <p className="text-sm font-semibold text-slate-100">{filing.title}</p>
                            <p className="text-xs text-slate-500">Filed {filing.date}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-slate-500" />
                    </a>
                ))}
            </div>
        </div>
    );
};

export default StockFilingsPage;
