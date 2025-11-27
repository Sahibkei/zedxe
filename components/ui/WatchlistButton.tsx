"use client";
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const WatchlistButton = ({
                             symbol,
                             company,
                             isInWatchlist,
                             showTrashIcon = false,
                             type = "button",
                             onWatchlistChange,
                         }: WatchlistButtonProps) => {
    const router = useRouter();
    const [added, setAdded] = useState<boolean>(!!isInWatchlist);
    const [pending, setPending] = useState(false);

    const label = useMemo(() => {
        if (type === "icon") return "";
        return added ? "Remove from Watchlist" : "Add to Watchlist";
    }, [added, type]);

    const handleClick = async () => {
        if (pending) return;
        setPending(true);

        const redirectToSignIn = () => {
            const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/sign-in';
            router.push(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
        };

        try {
            if (!added) {
                const res = await fetch('/api/watchlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ symbol, company }),
                });

                if (res.status === 401) return redirectToSignIn();
                if (!res.ok) throw new Error('Failed to add to watchlist');

                setAdded(true);
                toast.success(`${symbol} added to your watchlist`);
                onWatchlistChange?.(symbol, true);
            } else {
                const res = await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, {
                    method: 'DELETE',
                    credentials: 'include',
                });
                const res = await fetch(`/api/watchlist/${symbol}`, { method: 'DELETE' });
                if (res.status === 401) return redirectToSignIn();
                if (!res.ok) throw new Error('Failed to remove from watchlist');

                setAdded(false);
                toast.success(`${symbol} removed from your watchlist`);
                onWatchlistChange?.(symbol, false);
            }
        } catch (error) {
            console.error('WatchlistButton error', error);
            toast.error('Could not update watchlist. Please try again.');
        } finally {
            setPending(false);
        }
    };

    if (type === "icon") {
        return (
            <button
                title={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
                aria-label={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
                className={`watchlist-icon-btn ${added ? "watchlist-icon-added" : ""}`}
                onClick={handleClick}
                disabled={pending}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill={added ? "#FACC15" : "none"}
                    stroke="#FACC15"
                    strokeWidth="1.5"
                    className="watchlist-star"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.385a.563.563 0 00-.182-.557L3.04 10.385a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z"
                    />
                </svg>
            </button>
        );
    }

    const baseClass = added
        ? 'bg-[#111] text-yellow-300 border border-yellow-400 hover:bg-gray-900'
        : 'bg-yellow-500 text-black hover:bg-yellow-400';

    return (
        <Button onClick={handleClick} disabled={pending} className={baseClass}>
        <button className={`watchlist-btn ${added ? "watchlist-remove" : ""}`} onClick={handleClick} disabled={pending}>
            {showTrashIcon && added ? (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 mr-2"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 4v6m4-6v6m4-6v6" />
                </svg>
            ) : null}
            <span>{pending ? 'Working...' : label}</span>
        </Button>
    );
};

export default WatchlistButton;