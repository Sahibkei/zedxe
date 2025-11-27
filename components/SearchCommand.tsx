"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CommandDialog, CommandEmpty, CommandInput, CommandList } from "@/components/ui/command";
import { Loader2, Search, TrendingUp, X } from "lucide-react";

import WatchlistButton from "@/components/WatchlistButton";
import { Button } from "@/components/ui/button";
import { searchStocks } from "@/lib/actions/finnhub.actions";
import { useDebounce } from "@/hooks/useDebounce";

export default function SearchCommand({ renderAs = "button", label = "Add stock", initialStocks = [] }: SearchCommandProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(pathname === "/search");
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [stocks, setStocks] = useState<StockWithWatchlistStatus[]>(initialStocks || []);
    const [, startTransition] = useTransition();

    const isSearchMode = !!searchTerm.trim();

    useEffect(() => {
        setStocks(initialStocks || []);
    }, [initialStocks]);

    useEffect(() => {
        if (pathname === "/search") {
            setOpen(true);
        }
    }, [pathname]);

    const displayStocks = useMemo(
        () => (isSearchMode ? stocks : (stocks || []).slice(0, 10)),
        [isSearchMode, stocks]
    );

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((v) => !v);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const handleSearch = async () => {
        if (!isSearchMode) return setStocks(initialStocks || []);

        setLoading(true);
        try {
            const results = await searchStocks(searchTerm.trim());
            setStocks(results || []);
        } catch {
            setStocks([]);
        } finally {
            setLoading(false);
        }
    };

    const debouncedSearch = useDebounce(handleSearch, 300);

    useEffect(() => {
        debouncedSearch();
    }, [searchTerm, debouncedSearch]);

    const handleSelectStock = (symbol: string) => {
        startTransition(() => {
            router.push(`/stocks/${symbol}`);
            setOpen(false);
            setSearchTerm("");
            setStocks(initialStocks || []);
        });
    };

    const handleWatchlistChange = (symbol: string, isAdded: boolean) => {
        setStocks((prev) =>
            (prev || []).map((item) =>
                item.symbol === symbol ? { ...item, isInWatchlist: isAdded } : item
            )
        );
    };

    const renderTrigger = () => {
        if (renderAs === "text") {
            return (
                <span onClick={() => setOpen(true)} className="search-text cursor-pointer hover:text-yellow-400">
                    {label}
                </span>
            );
        }

        return (
            <Button onClick={() => setOpen(true)} className="search-btn">
                {label}
            </Button>
        );
    };

    return (
        <>
            {renderTrigger()}
            <CommandDialog open={open} onOpenChange={setOpen} className="search-dialog">
                <div className="mx-auto mt-24 max-w-3xl rounded-2xl bg-[#12141b]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                        <Search className="h-5 w-5 text-gray-400" />
                        <CommandInput
                            value={searchTerm}
                            onValueChange={setSearchTerm}
                            placeholder="Search by symbol or company name"
                            className="flex-1 bg-transparent border-0 shadow-none text-white placeholder:text-gray-500 focus:ring-0"
                        />
                        {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10"
                            aria-label="Close search"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <CommandList className="max-h-[460px] overflow-y-auto py-3 bg-transparent">
                        {loading ? (
                            <CommandEmpty className="py-10 text-center text-gray-400">Loading stocks...</CommandEmpty>
                        ) : displayStocks?.length === 0 ? (
                            <div className="py-10 text-center text-gray-400">{isSearchMode ? "No results found" : "No stocks available"}</div>
                        ) : (
                            <div className="space-y-2">
                                <div className="px-4 text-xs uppercase tracking-[0.18em] text-gray-500">
                                    {isSearchMode ? "Results" : "Popular Stocks"} ({displayStocks?.length || 0})
                                </div>
                                <div className="divide-y divide-white/5">
                                    {displayStocks?.map((stock) => (
                                        <div
                                            key={stock.symbol}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => handleSelectStock(stock.symbol)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSelectStock(stock.symbol);
                                            }}
                                            className="flex items-center justify-between px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-300">
                                                    <TrendingUp className="h-5 w-5" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="font-medium text-white">{stock.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {stock.symbol} · {stock.exchange} · {stock.type}
                                                    </div>
                                                </div>
                                            </div>
                                            <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                                                <WatchlistButton
                                                    type="icon"
                                                    symbol={stock.symbol}
                                                    company={stock.name}
                                                    isInWatchlist={stock.isInWatchlist}
                                                    onWatchlistChange={handleWatchlistChange}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CommandList>
                </div>
            </CommandDialog>
        </>
    );
}
