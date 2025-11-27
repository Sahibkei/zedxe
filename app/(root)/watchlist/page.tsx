import { Star } from "lucide-react";

import SearchCommand from "@/components/SearchCommand";
import WatchlistWithAlerts from "@/components/WatchlistWithAlerts";
import { searchStocks } from "@/lib/actions/finnhub.actions";
import { getAlertsForCurrentUser } from "@/lib/actions/alert.actions";
import { getWatchlistWithData } from "@/lib/actions/watchlist.actions";

const WatchlistPage = async () => {
    const watchlist = await getWatchlistWithData();
    const initialStocks = await searchStocks();
    const alerts = await getAlertsForCurrentUser();

    if (watchlist.length === 0) {
        return (
            <section className="watchlist-empty-container">
                <div className="watchlist-empty">
                    <Star className="watchlist-star" />
                    <h2 className="empty-title">Your watchlist is empty</h2>
                    <p className="empty-description">
                        Start building your watchlist by searching for stocks and clicking the star icon to add them.
                    </p>
                </div>
                <SearchCommand initialStocks={initialStocks} />
            </section>
        );
    }

    return (
        <section className="watchlist">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="watchlist-title">Watchlist</h2>
                <SearchCommand initialStocks={initialStocks} />
            </div>
            <WatchlistWithAlerts watchlist={watchlist} alerts={alerts} />
        </section>
    );
};

export default WatchlistPage;
