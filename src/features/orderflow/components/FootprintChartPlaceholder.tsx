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
                "flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-[#0d1118] p-3 shadow-[0_14px_40px_rgba(0,0,0,0.35)]",
                className,
            )}
        >
            <header className="flex items-start justify-between gap-3 border-b border-white/10 pb-2">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Footprint</p>
                    <h2 className="text-[42px] leading-tight font-semibold text-white">{symbol.toUpperCase()}</h2>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                    <p>Window {windowLabel}</p>
                    <p>Bucket {bucketLabel}</p>
                </div>
            </header>

            <div className="relative mt-3 min-h-[240px] flex-1 overflow-hidden rounded-lg border border-white/10 bg-[#080c12]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,0,0,0.16),transparent_58%),radial-gradient(ellipse_at_bottom,rgba(0,255,210,0.16),transparent_58%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,30,30,0.14)_0%,rgba(255,30,30,0.06)_48%,rgba(0,250,220,0.10)_52%,rgba(0,250,220,0.20)_100%)]" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-300/40" />

                <div className="absolute inset-x-4 bottom-8 flex h-28 items-end gap-1.5 opacity-85">
                    {["52", "35", "30", "44", "40", "64", "28", "46", "38", "36", "55", "42", "60", "48", "33", "40", "58", "62", "39", "45"].map((height, index) => (
                        <span
                            key={`vol-${index}`}
                            className={index % 3 === 0 ? "w-2 rounded-sm bg-rose-500/70" : "w-2 rounded-sm bg-cyan-400/70"}
                            style={{ height: `${height}%` }}
                        />
                    ))}
                </div>

                <div className="absolute inset-x-4 bottom-28 flex h-48 items-end gap-2 opacity-90">
                    {["24", "36", "42", "30", "38", "28", "34", "26", "35", "32", "29", "41", "33", "44", "37", "40", "46", "39", "48"].map((height, index) => (
                        <span
                            key={`bar-${index}`}
                            className={index % 2 === 0 ? "w-2 rounded-sm bg-cyan-400/80" : "w-2 rounded-sm bg-rose-500/80"}
                            style={{ height: `${height}%` }}
                        />
                    ))}
                </div>

                <div className="absolute right-3 top-8 bottom-10 flex w-24 flex-col justify-end gap-1.5">
                    {["32", "44", "27", "52", "46", "38", "57", "42", "60", "54", "48"].map((width, index) => (
                        <span
                            key={`vp-${index}`}
                            className={index % 2 === 0 ? "h-2 rounded-sm bg-cyan-400/75" : "h-2 rounded-sm bg-rose-500/70"}
                            style={{ width: `${width}%` }}
                        />
                    ))}
                </div>

                <div className="absolute inset-0 flex items-center justify-center text-center">
                    <div>
                        <p className="text-2xl font-semibold text-slate-100">Footprint chart (coming in PR 3)</p>
                        <p className="mt-1 text-xs text-slate-400">Mocked visuals only. No websocket and no chart engine in this PR.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
