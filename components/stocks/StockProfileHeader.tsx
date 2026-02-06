'use client';

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { cn, formatMarketCapValue } from "@/lib/utils";
import type { QuoteData, StockProfileData } from "@/src/server/market-data/provider";

const formatPrice = (value: number, currency: string) =>
    value.toLocaleString("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const fetchQuote = async (symbol: string): Promise<QuoteData> => {
    const res = await fetch(`/api/stocks/${symbol}/quote`);
    if (!res.ok) {
        throw new Error("Quote unavailable");
    }
    return res.json();
};

const StockProfileHeader = ({
    profile,
    initialQuote,
    className,
}: {
    profile: StockProfileData;
    initialQuote: QuoteData | null;
    className?: string;
}) => {
    const symbol = profile.symbol;
    const { data: quote } = useQuery({
        queryKey: ["stock-quote", symbol],
        queryFn: () => fetchQuote(symbol),
        refetchInterval: 5000,
        refetchOnWindowFocus: true,
        refetchIntervalInBackground: true,
        staleTime: 0,
        initialData: initialQuote ?? undefined,
        retry: false,
    });

    const hasQuote = quote && typeof quote.price === "number";
    const hasChange = hasQuote && typeof quote.change === "number" && typeof quote.changePercent === "number";
    const isPositive = hasChange ? quote.change >= 0 : true;
    const badgeClasses = isPositive
        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
        : "bg-rose-500/15 text-rose-300 border-rose-500/40";
    const changePrefix = isPositive ? "+" : "";
    const priceDisplay = hasQuote ? formatPrice(quote.price, profile.currency ?? "USD") : "—";

    const statusClass = hasQuote ? "border-emerald-500/40 text-emerald-300" : "border-slate-500/40 text-slate-300";
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const lastTradeLabel = useMemo(() => {
        if (!quote?.lastTradeAt) return "Data unavailable";
        const parsed = new Date(quote.lastTradeAt).getTime();
        if (Number.isNaN(parsed)) return "Data unavailable";
        const diff = Math.max(0, Math.round((now - parsed) / 1000));
        return `Updated ${diff}s ago`;
    }, [quote?.lastTradeAt, now]);

    return (
        <div className={cn("rounded-2xl border border-[#1c2432] bg-[#0d1117]/80 px-6 py-5 shadow-xl backdrop-blur", className)}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Stock Profile</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-semibold text-slate-100">
                            {profile.symbol}
                            <span className="ml-2 text-base font-normal text-slate-400">{profile.name}</span>
                        </h1>
                        <span
                            className={cn(
                                "rounded-full border bg-[#0b0f14] px-2.5 py-1 text-xs font-mono",
                                statusClass,
                            )}
                        >
                            {hasQuote ? "Live" : "Delayed"}
                        </span>
                        {profile.exchange && (
                            <span className="rounded-full border border-[#1c2432] bg-[#0b0f14] px-2.5 py-1 text-xs font-mono text-slate-400">
                                {profile.exchange}
                            </span>
                        )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{lastTradeLabel}</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-2xl font-semibold text-slate-100">{priceDisplay}</p>
                        <p className="text-sm text-slate-500">
                            {profile.marketCap ? `Mkt Cap ${formatMarketCapValue(profile.marketCap)}` : "Last trade"}
                        </p>
                    </div>
                    <div
                        className={cn(
                            "rounded-xl border px-3 py-2 text-sm font-mono",
                            hasChange ? badgeClasses : "border-[#1c2432] text-slate-400",
                        )}
                    >
                        {hasChange ? (
                            <>
                                <span>
                                    {changePrefix}
                                    {quote.change.toFixed(2)}
                                </span>
                                <span className="ml-2">
                                    ({changePrefix}
                                    {quote.changePercent.toFixed(2)}%)
                                </span>
                            </>
                        ) : (
                            <span>—</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockProfileHeader;
