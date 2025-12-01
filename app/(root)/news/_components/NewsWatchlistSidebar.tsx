import { headers } from "next/headers";

import { getWatchlistWithData } from "@/lib/actions/watchlist.actions";
import { auth } from "@/lib/better-auth/auth";
import { formatChangePercent, formatPrice, getChangeColorClass } from "@/lib/utils";

const NewsWatchlistSidebar = async () => {
    let watchlist: WatchlistEntryWithData[] = [];

    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (session?.user) {
            watchlist = await getWatchlistWithData();
        }
    } catch (error) {
        console.error("[NewsWatchlistSidebar] Failed to load watchlist", error);
    }

    if (!watchlist || watchlist.length === 0) {
        return (
            <aside className="rounded-2xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
                <h3 className="text-lg font-semibold text-white">Watchlist</h3>
                <p className="mt-2 text-sm text-gray-400">Sign in to see your saved symbols.</p>
            </aside>
        );
    }

    return (
        <aside className="rounded-2xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Watchlist</h3>
                <span className="text-xs text-gray-500">Tracking {watchlist.length}</span>
            </div>
            <div className="divide-y divide-gray-800">
                {watchlist.map((item) => (
                    <div key={item.symbol} className="py-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-100">{item.company}</p>
                                <p className="text-xs uppercase tracking-wide text-gray-500">{item.symbol}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-gray-100">
                                    {typeof item.currentPrice === "number" ? formatPrice(item.currentPrice) : item.priceFormatted ?? "—"}
                                </p>
                                <p className={`text-xs ${getChangeColorClass(item.changePercent)}`}>
                                    {item.changeFormatted || formatChangePercent(item.changePercent) || "—"}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    );
};

export default NewsWatchlistSidebar;
