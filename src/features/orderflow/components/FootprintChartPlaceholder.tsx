interface FootprintChartPlaceholderProps {
    symbol: string;
    windowLabel: string;
    bucketLabel: string;
}

export default function FootprintChartPlaceholder({
    symbol,
    windowLabel,
    bucketLabel,
}: FootprintChartPlaceholderProps) {
    return (
        <section className="rounded-xl border border-white/10 bg-[#0d1118] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
            <header className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Footprint</p>
                    <h2 className="text-base font-semibold text-white">{symbol.toUpperCase()}</h2>
                </div>
                <div className="text-right text-xs text-slate-400">
                    <p>Window {windowLabel}</p>
                    <p>Bucket {bucketLabel}</p>
                </div>
            </header>

            <div className="mt-4 flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-700/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-6 text-center">
                <div>
                    <p className="text-sm font-medium text-slate-200">Footprint chart (coming in PR 3)</p>
                    <p className="mt-1 text-xs text-slate-500">UI skeleton only. No live data and no rendering engine in this PR.</p>
                </div>
            </div>
        </section>
    );
}
