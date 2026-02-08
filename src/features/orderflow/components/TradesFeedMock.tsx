const HIDE_THRESHOLD = 0.001;

interface TradeRow {
    id: string;
    price: number;
    side: "Buy" | "Sell";
    size: number;
    time: string;
    venue: string;
}

const MOCK_TRADES: TradeRow[] = [
    { id: "t1", time: "14:42:11.203", side: "Buy", price: 98420.6, size: 0.0091, venue: "Binance" },
    { id: "t2", time: "14:42:10.884", side: "Sell", price: 98420.2, size: 0.0044, venue: "Binance" },
    { id: "t3", time: "14:42:10.517", side: "Buy", price: 98419.8, size: 0.0008, venue: "Binance" },
    { id: "t4", time: "14:42:10.088", side: "Buy", price: 98419.4, size: 0.0153, venue: "Binance" },
    { id: "t5", time: "14:42:09.619", side: "Sell", price: 98419.1, size: 0.0021, venue: "Binance" },
    { id: "t6", time: "14:42:09.214", side: "Sell", price: 98418.9, size: 0.0017, venue: "Binance" },
    { id: "t7", time: "14:42:08.705", side: "Buy", price: 98418.5, size: 0.0129, venue: "Binance" },
    { id: "t8", time: "14:42:08.302", side: "Sell", price: 98418.2, size: 0.0006, venue: "Binance" },
    { id: "t9", time: "14:42:07.931", side: "Buy", price: 98417.8, size: 0.0036, venue: "Binance" },
    { id: "t10", time: "14:42:07.411", side: "Buy", price: 98417.2, size: 0.0011, venue: "Binance" },
    { id: "t11", time: "14:42:07.004", side: "Sell", price: 98416.9, size: 0.0052, venue: "Binance" },
    { id: "t12", time: "14:42:06.627", side: "Buy", price: 98416.5, size: 0.0028, venue: "Binance" },
];

interface TradesFeedMockProps {
    hideTinyTrades: boolean;
}

export default function TradesFeedMock({ hideTinyTrades }: TradesFeedMockProps) {
    const rows = hideTinyTrades
        ? MOCK_TRADES.filter((trade) => trade.size >= HIDE_THRESHOLD)
        : MOCK_TRADES;

    return (
        <section className="rounded-xl border border-white/10 bg-[#0d1118] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
            <header className="mb-3 flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Trades feed</p>
                    <h2 className="text-base font-semibold text-white">Last 12 prints (mocked)</h2>
                </div>
                <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-slate-300">
                    {rows.length} rows
                </span>
            </header>

            <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="min-w-full text-left text-xs">
                    <thead className="bg-white/5 text-slate-400">
                        <tr>
                            <th className="px-3 py-2 font-medium">Time</th>
                            <th className="px-3 py-2 font-medium">Side</th>
                            <th className="px-3 py-2 font-medium">Price</th>
                            <th className="px-3 py-2 font-medium">Size</th>
                            <th className="px-3 py-2 font-medium">Venue</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((trade) => (
                            <tr key={trade.id} className="border-t border-white/10 text-slate-200">
                                <td className="px-3 py-2">{trade.time}</td>
                                <td
                                    className={`px-3 py-2 font-medium ${
                                        trade.side === "Buy" ? "text-emerald-300" : "text-rose-300"
                                    }`}
                                >
                                    {trade.side}
                                </td>
                                <td className="px-3 py-2">{trade.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                <td className="px-3 py-2">{trade.size.toFixed(4)}</td>
                                <td className="px-3 py-2 text-slate-400">{trade.venue}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
