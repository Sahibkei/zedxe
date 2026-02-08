export interface OrderBookLevel {
    askSize: string;
    bidSize: string;
    price: string;
}

interface OrderBookLadderMockProps {
    venue: string;
    pair: string;
    levels: OrderBookLevel[];
    comingSoon?: boolean;
}

export default function OrderBookLadderMock({
    venue,
    pair,
    levels,
    comingSoon = false,
}: OrderBookLadderMockProps) {
    return (
        <article className="rounded-lg border border-white/10 bg-[#0a0f15] p-3">
            <header className="mb-3 flex items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-white">{venue}</p>
                    <p className="text-[11px] text-slate-400">{pair}</p>
                </div>
                {comingSoon ? (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                        Coming soon
                    </span>
                ) : null}
            </header>

            <div className="grid grid-cols-[1fr_1fr_1fr] border-y border-white/10 py-1 text-[10px] uppercase tracking-wide text-slate-500">
                <span>Bid size</span>
                <span className="text-center">Price</span>
                <span className="text-right">Ask size</span>
            </div>

            <div className="mt-2 space-y-1">
                {levels.map((level) => (
                    <div
                        key={`${venue}-${level.price}`}
                        className="grid grid-cols-[1fr_1fr_1fr] rounded-md border border-transparent px-1 py-1 text-xs text-slate-200 hover:border-white/10"
                    >
                        <span className="text-emerald-300">{level.bidSize}</span>
                        <span className="text-center font-medium text-slate-100">{level.price}</span>
                        <span className="text-right text-rose-300">{level.askSize}</span>
                    </div>
                ))}
            </div>
        </article>
    );
}
