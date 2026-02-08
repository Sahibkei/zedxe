import OrderBookLadderMock, { OrderBookLevel } from "@/src/features/orderflow/components/OrderBookLadderMock";
import { cn } from "@/lib/utils";

interface VenueOrderBook {
    comingSoon?: boolean;
    midPrice: number;
    pair: string;
    seed: number;
    venue: string;
}

const VENUE_ORDERBOOKS: VenueOrderBook[] = [
    { venue: "Binance", pair: "BTC/USDT", midPrice: 71440, seed: 1 },
    { venue: "Bitfinex", pair: "BTC/USD", midPrice: 71445, seed: 2, comingSoon: true },
    { venue: "Coinbase", pair: "BTC/USD", midPrice: 71330, seed: 3, comingSoon: true },
];

const TOTAL_LEVELS = 28;
const MINI_WINDOWS = ["1h", "4h", "1d"] as const;

const formatPrice = (value: number) =>
    value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatSize = (value: number) => {
    if (value >= 10) return value.toFixed(1);
    if (value >= 1) return value.toFixed(2);
    if (value >= 0.1) return value.toFixed(3);
    return value.toFixed(2);
};

const buildLevels = (midPrice: number, seed: number): OrderBookLevel[] => {
    const midpoint = Math.floor(TOTAL_LEVELS / 2);

    return Array.from({ length: TOTAL_LEVELS }, (_, index) => {
        const price = midPrice + (midpoint - index) * 5;
        const distance = Math.abs(index - midpoint);
        const wave = (Math.sin((index + 1) * (seed + 1) * 0.63) + 1) / 2;
        const base = 0.06 + wave * 5.8;

        const bidRaw = index >= midpoint ? base * (1 + distance * 0.022) : base * 0.3;
        const askRaw = index <= midpoint ? base * (1 + distance * 0.022) : base * 0.3;

        return {
            bidSize: formatSize(bidRaw),
            askSize: formatSize(askRaw),
            price: formatPrice(price),
            isMid: index === midpoint,
        };
    });
};

const buildMiniBars = (seed: number, windowOffset: number) =>
    Array.from({ length: 22 }, (_, index) => {
        const wave = Math.sin((index + 1) * (seed + 0.85) * (windowOffset + 0.35));
        const up = wave >= 0;
        return {
            up,
            height: 18 + Math.abs(wave) * 82,
        };
    });

interface OrderBookPanelProps {
    className?: string;
}

export default function OrderBookPanel({ className }: OrderBookPanelProps) {
    return (
        <section
            className={cn(
                "min-h-0 rounded-xl border border-white/10 bg-[#0d1118] px-3 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.35)]",
                "flex h-full flex-col",
                className,
            )}
        >
            <header className="mb-2.5 flex items-start justify-between gap-3 border-b border-white/10 pb-2">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Order book</p>
                    <h2 className="text-base leading-tight font-semibold text-white">Venue ladders (mocked)</h2>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                    <p>Depth {TOTAL_LEVELS} levels</p>
                    <p>BTC composite</p>
                </div>
            </header>

            <div className="min-h-0 flex-1 overflow-x-auto lg:overflow-visible">
                <div className="grid min-w-[920px] grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-0 lg:grid-cols-3">
                    {VENUE_ORDERBOOKS.map((book) => (
                        <div key={book.venue} className="min-w-0">
                            <OrderBookLadderMock
                                venue={book.venue}
                                pair={book.pair}
                                levels={buildLevels(book.midPrice, book.seed)}
                                comingSoon={book.comingSoon}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-3 border-t border-white/10 pt-2.5">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.13em] text-slate-500">
                    <span>Mini charts</span>
                    <span>Mocked only</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {VENUE_ORDERBOOKS.map((book, venueIndex) => (
                        <article key={`mini-${book.venue}`} className="min-w-0 rounded-lg border border-white/10 bg-[#0a0f15] px-2 py-1.5">
                            <p className="mb-1 text-[11px] font-medium text-slate-200">{book.venue}</p>
                            <div className="space-y-1.5">
                                {MINI_WINDOWS.map((windowLabel, windowIndex) => {
                                    const bars = buildMiniBars(venueIndex + 1, windowIndex + 1);
                                    return (
                                        <div key={`${book.venue}-${windowLabel}`} className="grid grid-cols-[20px_minmax(0,1fr)] items-center gap-1.5">
                                            <span className="text-[10px] text-slate-500">{windowLabel}</span>
                                            <div className="flex h-6 items-end gap-[1px] overflow-hidden rounded-sm border border-white/10 bg-[#070b10] px-1 py-[2px]">
                                                {bars.map((bar, index) => (
                                                    <span
                                                        key={`${book.venue}-${windowLabel}-${index}`}
                                                        className={cn(
                                                            "min-w-0 flex-1 rounded-[1px]",
                                                            bar.up ? "bg-emerald-400/90" : "bg-rose-400/90",
                                                        )}
                                                        style={{ height: `${bar.height}%` }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
