import Link from "next/link";

import { formatChangePercent, formatPrice, getChangeColorClass } from "@/lib/utils";

const formatPriceValue = (item: WatchlistEntryWithData) => {
    if (item.priceFormatted) return item.priceFormatted;
    if (typeof item.currentPrice === "number") return formatPrice(item.currentPrice);
    return "—";
};

const formatChangeValue = (item: WatchlistEntryWithData) => {
    if (item.changeFormatted) return item.changeFormatted;
    const formatted = formatChangePercent(item.changePercent);
    return formatted || "—";
};

const NewsWatchlistSidebar = ({
    watchlist,
    isAuthenticated,
}: {
    watchlist: WatchlistEntryWithData[];
    isAuthenticated: boolean;
}) => {
    if (!isAuthenticated) {
        return (
            <aside className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 text-sm text-gray-300">
                <h3 className="text-lg font-semibold text-white">Your Watchlist</h3>
                <p className="mt-2 text-gray-400">Sign in to see the symbols you are tracking.</p>
                <Link
                    href="/sign-in"
                    className="mt-3 inline-flex rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
                >
                    Sign in
                </Link>
            </aside>
        );
    }

    if (!watchlist || watchlist.length === 0) {
        return (
            <aside className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 text-sm text-gray-300">
                <h3 className="text-lg font-semibold text-white">Your Watchlist</h3>
                <p className="mt-2 text-gray-400">Add symbols to your watchlist to see quick stats here.</p>
                <Link
                    href="/watchlist"
                    className="mt-3 inline-flex rounded-md border border-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
                >
                    Manage Watchlist
                </Link>
            </aside>
        );
    }

    return (
        <aside className="space-y-4 rounded-xl border border-gray-800 bg-[#0f1115] p-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Your Watchlist</h3>
                <Link
                    href="/watchlist"
                    className="text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
                >
                    View All
                </Link>
            </div>

            <div className="space-y-3">
                {watchlist.map((item) => (
                    <div
                        key={item.symbol}
                        className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-3"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <Link href={`/stocks/${item.symbol}`} className="text-sm font-semibold text-white">
                                    {item.symbol}
                                </Link>
                                <p className="truncate text-xs text-gray-400">{item.company}</p>
                            </div>

                            <div className="text-right">
                                <p className="text-sm font-semibold text-gray-100">{formatPriceValue(item)}</p>
                                <p className={`text-xs font-medium ${getChangeColorClass(item.changePercent)}`}>
                                    {formatChangeValue(item)}
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
