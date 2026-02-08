import { cn } from "@/lib/utils";

interface FootprintChartPlaceholderProps {
    className?: string;
    symbol: string;
    windowLabel: string;
    bucketLabel: string;
}

export default function FootprintChartPlaceholder({
    className,
    symbol,
    windowLabel,
    bucketLabel,
}: FootprintChartPlaceholderProps) {
    return (
        <section
            className={cn(
                "flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-[#0d1118] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]",
                className,
            )}
        >
            <header className="flex items-start justify-between gap-3 border-b border-white/10 pb-2">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Footprint</p>
                    <h2 className="text-[28px] leading-tight font-semibold text-white">{symbol.toUpperCase()}</h2>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                    <p>Window {windowLabel}</p>
                    <p>Bucket {bucketLabel}</p>
                </div>
            </header>

            <div className="mt-3 flex min-h-[240px] flex-1 items-center justify-center rounded-lg border border-dashed border-slate-700/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] p-4 text-center">
                <div>
                    <p className="text-base font-medium text-slate-200">Footprint chart (coming in PR 3)</p>
                    <p className="mt-1 text-xs text-slate-500">UI skeleton only. No live data and no rendering engine in this PR.</p>
                </div>
            </div>
        </section>
    );
}
