import { cn } from "@/lib/utils";

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
    className?: string;
    hideTinyTrades: boolean;
}

export default function TradesFeedMock({ className, hideTinyTrades }: TradesFeedMockProps) {
    const rows = hideTinyTrades
        ? MOCK_TRADES.filter((trade) => trade.size >= HIDE_THRESHOLD)
        : MOCK_TRADES;

    return (
        <section
            className={cn(
                "flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-[#0d1118] p-3 shadow-[0_14px_40px_rgba(0,0,0,0.35)]",
                className,
            )}
        >
            <header className="mb-2.5 flex items-start justify-between gap-2 border-b border-white/10 pb-2">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Trades feed</p>
                    <h2 className="text-base leading-tight font-semibold text-white">Last 12 prints (mocked)</h2>
                </div>
                <span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                    {rows.length} rows
                </span>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10">
                <div className="h-full overflow-y-auto overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                        <thead className="sticky top-0 z-10 bg-[#161f2b] text-[11px] uppercase tracking-wide text-slate-400">
                            <tr>
                                <th className="px-3 py-2 font-medium">Time</th>
                                <th className="px-3 py-2 font-medium">Side</th>
                                <th className="px-3 py-2 font-medium">Price</th>
                                <th className="px-3 py-2 font-medium">Size</th>
                                <th className="px-3 py-2 font-medium">Venue</th>
                            </tr>
                        </thead>
                        <tbody className="font-mono tabular-nums">
                            {rows.map((trade) => (
                                <tr key={trade.id} className="border-t border-white/10 text-slate-200">
                                    <td className="px-3 py-1.5">{trade.time}</td>
                                    <td
                                        className={`px-3 py-1.5 font-medium ${
                                            trade.side === "Buy" ? "text-emerald-300" : "text-rose-300"
                                        }`}
                                    >
                                        {trade.side}
                                    </td>
                                    <td className="px-3 py-1.5">
                                        {trade.price.toLocaleString("en-US", {
                                            minimumFractionDigits: 1,
                                            maximumFractionDigits: 1,
                                        })}
                                    </td>
                                    <td className="px-3 py-1.5">{trade.size.toFixed(4)}</td>
                                    <td className="px-3 py-1.5 text-slate-400">{trade.venue}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}
