import OrderBookLadderMock, { OrderBookLevel } from "@/src/features/orderflow/components/OrderBookLadderMock";

interface VenueOrderBook {
    comingSoon?: boolean;
    levels: OrderBookLevel[];
    pair: string;
    venue: string;
}

const VENUE_ORDERBOOKS: VenueOrderBook[] = [
    {
        venue: "Binance",
        pair: "BTC/USDT",
        levels: [
            { bidSize: "0.410", price: "98,420.0", askSize: "0.355" },
            { bidSize: "0.365", price: "98,420.5", askSize: "0.408" },
            { bidSize: "0.510", price: "98,421.0", askSize: "0.295" },
            { bidSize: "0.280", price: "98,421.5", askSize: "0.330" },
            { bidSize: "0.190", price: "98,422.0", askSize: "0.260" },
            { bidSize: "0.120", price: "98,422.5", askSize: "0.210" },
        ],
    },
    {
        venue: "Bitfinex",
        pair: "BTC/USD",
        comingSoon: true,
        levels: [
            { bidSize: "0.220", price: "98,419.9", askSize: "0.180" },
            { bidSize: "0.210", price: "98,420.4", askSize: "0.215" },
            { bidSize: "0.198", price: "98,420.9", askSize: "0.205" },
            { bidSize: "0.170", price: "98,421.4", askSize: "0.160" },
            { bidSize: "0.155", price: "98,421.9", askSize: "0.148" },
            { bidSize: "0.130", price: "98,422.4", askSize: "0.122" },
        ],
    },
    {
        venue: "Coinbase",
        pair: "BTC/USD",
        comingSoon: true,
        levels: [
            { bidSize: "0.305", price: "98,420.1", askSize: "0.252" },
            { bidSize: "0.275", price: "98,420.6", askSize: "0.266" },
            { bidSize: "0.242", price: "98,421.1", askSize: "0.214" },
            { bidSize: "0.188", price: "98,421.6", askSize: "0.190" },
            { bidSize: "0.163", price: "98,422.1", askSize: "0.172" },
            { bidSize: "0.141", price: "98,422.6", askSize: "0.154" },
        ],
    },
];

export default function OrderBookPanel() {
    return (
        <section className="rounded-xl border border-white/10 bg-[#0d1118] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
            <header className="mb-4">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Order book</p>
                <h2 className="text-base font-semibold text-white">Venue ladders (mocked)</h2>
            </header>

            <div className="overflow-x-auto">
                <div className="grid min-w-[720px] grid-cols-3 gap-3">
                    {VENUE_ORDERBOOKS.map((book) => (
                        <OrderBookLadderMock
                            key={book.venue}
                            venue={book.venue}
                            pair={book.pair}
                            levels={book.levels}
                            comingSoon={book.comingSoon}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
