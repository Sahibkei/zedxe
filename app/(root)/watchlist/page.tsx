import Link from "next/link";
import { Plus, Star } from "lucide-react";

import AlertsPanel from "@/components/AlertsPanel";
import WatchlistTable from "@/components/WatchlistTable";
import { getWatchlistWithData } from "@/lib/actions/watchlist.actions";
import { getUserAlerts } from "@/lib/actions/alert.actions";

const WatchlistPage = async () => {
    const watchlist = await getWatchlistWithData();
    const alerts = await getUserAlerts();

    return (
        <section className="watchlist">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="watchlist-title">Watchlist</h2>
                <Link
                    href="/search"
                    className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-yellow-500/20 transition hover:bg-yellow-400"
                >
                    <Plus className="h-4 w-4" />
                    Add Stock
                </Link>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)]">
                <section className="rounded-2xl bg-[#111318] border border-white/5 overflow-hidden">
                    {watchlist.length === 0 ? (
                        <div className="p-8 text-center text-gray-300">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                                <Star className="h-6 w-6 text-yellow-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white">Your watchlist is empty</h3>
                            <p className="mt-2 text-sm text-gray-400">
                                Start building your watchlist by searching for stocks and clicking the star icon to add them.
                            </p>
                            <div className="mt-6 flex justify-center">
                                <Link
                                    href="/search"
                                    className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                                >
                                    <Plus className="h-4 w-4" />
                                    Browse Stocks
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <WatchlistTable watchlist={watchlist} />
                    )}
                </section>

                <section className="rounded-2xl bg-[#111318] border border-white/5 overflow-hidden">
                    <AlertsPanel alerts={alerts} />
                </section>
            </div>
        </section>
    );
};

export default WatchlistPage;
