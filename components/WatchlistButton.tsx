"use client";

import { useState, useTransition } from "react";
import { Loader2, Star, Trash2 } from "lucide-react";

import { addToWatchlist, removeFromWatchlist } from "@/lib/actions/watchlist.actions";

const WatchlistButton = ({
    symbol,
    company,
    isInWatchlist,
    showTrashIcon = false,
    type = "button",
    onWatchlistChange,
}: WatchlistButtonProps) => {
    const [added, setAdded] = useState<boolean>(isInWatchlist);
    const [pending, startTransition] = useTransition();

    const handleToggle = () => {
        if (pending) return;

        startTransition(async () => {
            try {
                if (added) {
                    const res = await removeFromWatchlist(symbol);
                    if (res?.success) {
                        setAdded(false);
                        onWatchlistChange?.(symbol, false);
                    }
                } else {
                    const res = await addToWatchlist(symbol, company);
                    if (res?.success) {
                        setAdded(true);
                        onWatchlistChange?.(symbol, true);
                    }
                }
            } catch (error) {
                console.error("WatchlistButton error", error);
            }
        });
    };

    const renderIcon = () => {
        if (pending) return <Loader2 className="h-4 w-4 animate-spin" />;
        if (added && showTrashIcon) return <Trash2 className="trash-icon" />;
        return <Star className={added ? "star-icon text-yellow-500" : "star-icon"} fill={added ? "currentColor" : "none"} />;
    };

    if (type === "icon") {
        return (
            <button
                type="button"
                aria-label={added ? "Remove from watchlist" : "Add to watchlist"}
                className={`watchlist-icon-btn ${added ? "watchlist-icon-added" : ""}`}
                onClick={handleToggle}
                disabled={pending}
            >
                <span className="watchlist-icon">{renderIcon()}</span>
            </button>
        );
    }

    return (
        <button className={`watchlist-btn ${added ? "watchlist-remove" : ""}`} onClick={handleToggle} disabled={pending}>
            {pending ? "Updating..." : added ? "Remove from Watchlist" : "Add to Watchlist"}
        </button>
    );
};

export default WatchlistButton;
