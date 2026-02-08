import { cn } from "@/lib/utils";

export interface OrderBookLevel {
    askSize: string;
    bidSize: string;
    isMid?: boolean;
    price: string;
}

interface OrderBookLadderMockProps {
    comingSoon?: boolean;
    levels: OrderBookLevel[];
    pair: string;
    venue: string;
}

export default function OrderBookLadderMock({
    venue,
    pair,
    levels,
    comingSoon = false,
}: OrderBookLadderMockProps) {
    return (
        <article className="min-w-0 rounded-lg border border-white/10 bg-[#0a0f15] p-2">
            <header className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-lg leading-none font-semibold text-white">{venue}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{pair}</p>
                </div>
                {comingSoon ? (
                    <span className="rounded border border-amber-400/35 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-200">
                        Coming soon
                    </span>
                ) : null}
            </header>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] border-y border-white/10 py-1 text-[9px] uppercase tracking-[0.12em] text-slate-500 font-mono">
                <span className="text-right">Bid size</span>
                <span className="px-2 text-center">Price</span>
                <span className="text-right">Ask size</span>
            </div>

            <div className="mt-1 space-y-px font-mono tabular-nums">
                {levels.map((level) => (
                    <div
                        key={`${venue}-${level.price}`}
                        className={cn(
                            "grid h-[18px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-1 text-[11px] text-slate-200",
                            level.isMid
                                ? "border-y border-cyan-400/35 bg-cyan-400/10"
                                : "border-y border-transparent hover:border-white/10 hover:bg-white/5",
                        )}
                    >
                        <span className="truncate text-right text-emerald-300">{level.bidSize}</span>
                        <span
                            className={cn(
                                "px-2 text-center text-slate-100",
                                level.isMid && "font-semibold text-cyan-200",
                            )}
                        >
                            {level.price}
                        </span>
                        <span className="truncate text-right text-rose-300">{level.askSize}</span>
                    </div>
                ))}
            </div>
        </article>
    );
}
