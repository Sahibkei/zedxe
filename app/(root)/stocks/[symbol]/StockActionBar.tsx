"use client";

import WatchlistButton from "@/components/WatchlistButton";

const StockActionBar = ({ symbol, company, isInWatchlist }: { symbol: string; company: string; isInWatchlist: boolean }) => {
    return (
        <div className="flex items-center gap-3">
            <WatchlistButton symbol={symbol} company={company} isInWatchlist={isInWatchlist} />
        </div>
    );
};

export default StockActionBar;
