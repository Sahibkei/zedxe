"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Plus, Star, Trash2 } from "lucide-react";

import { addToWatchlist, removeFromWatchlist } from "@/lib/actions/watchlist.actions";
import { cn } from "@/lib/utils";

const WatchlistButton = ({
    symbol,
    company,
    isInWatchlist,
    showTrashIcon = false,
    type = "button",
    variant = "default",
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

    const isCompact = variant === "compact";

    return (
        <button
            type="button"
            onClick={handleToggle}
            disabled={pending}
            className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                isCompact ? "h-9 px-3 text-xs" : "h-10 px-4",
                added
                    ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18"
                    : "border-border/70 bg-muted/15 text-foreground hover:bg-muted/25"
            )}
            aria-label={added ? "Remove from watchlist" : "Add to watchlist"}
        >
            {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : added ? (
                <Check className="h-3.5 w-3.5" />
            ) : (
                <Plus className="h-3.5 w-3.5" />
            )}
            {pending ? "Updating..." : added ? "Watchlisted" : "Add to Watchlist"}
        </button>
    );
};

export default WatchlistButton;
