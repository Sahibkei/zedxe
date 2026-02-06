"use client";

import Image from "next/image";
import Link from "next/link";
import { Settings2, Share2, ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import StockActionBar from "@/app/(root)/stocks/[symbol]/StockActionBar";
import { formatCurrency, formatCurrencyShort } from "@/components/stock-profile/formatters";

type StockProfileHeaderProps = {
    symbol: string;
    companyName: string;
    exchange?: string;
    sector?: string;
    currency?: string;
    marketCap?: number;
    price?: number;
    changePercent?: number;
    isInWatchlist: boolean;
    initialAlert?: AlertDisplay;
};

const changeTone = (changePercent?: number) => {
    if (typeof changePercent !== "number" || Number.isNaN(changePercent)) return "text-muted-foreground";
    return changePercent >= 0 ? "text-emerald-300" : "text-rose-300";
};

export default function StockProfileHeader({
    symbol,
    companyName,
    exchange,
    sector,
    currency,
    marketCap,
    price,
    changePercent,
    isInWatchlist,
    initialAlert,
}: StockProfileHeaderProps) {
    const [copied, setCopied] = useState(false);

    const changeLabel = useMemo(() => {
        if (typeof changePercent !== "number" || Number.isNaN(changePercent)) return "--";
        const sign = changePercent > 0 ? "+" : "";
        return `${sign}${changePercent.toFixed(2)}%`;
    }, [changePercent]);

    const onShare = async () => {
        const url = typeof window !== "undefined" ? window.location.href : "";

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${symbol} - ${companyName}`,
                    text: `${symbol} stock profile`,
                    url,
                });
                return;
            } catch {
                // Fall back to clipboard below.
            }
        }

        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        } catch {
            setCopied(false);
        }
    };

    const priceLabel = formatCurrency(price, currency || "USD");

    return (
        <header className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.9)] lg:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <Link href="/app" className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5">
                        <Image src="/brand/zedxe-logo.svg" alt="ZedXe" width={96} height={30} className="h-5 w-auto" priority />
                    </Link>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Back to Markets
                    </Link>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onShare}
                        className="h-8 rounded-lg border-border/70 bg-transparent px-2.5 text-xs text-muted-foreground hover:bg-muted/30"
                    >
                        <Share2 className="h-3.5 w-3.5" />
                        {copied ? "Copied" : "Share"}
                    </Button>
                    <Button
                        variant="outline"
                        size="icon-sm"
                        className="h-8 w-8 rounded-lg border-border/70 bg-transparent text-muted-foreground hover:bg-muted/30"
                        aria-label="Stock profile settings"
                    >
                        <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="space-y-2.5">
                    <div className="flex flex-wrap items-end gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-[2rem]">{symbol}</h1>
                        <p className="text-base text-muted-foreground lg:text-lg">{companyName || "Company data unavailable"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                        {exchange ? (
                            <span className="rounded-md border border-border/70 bg-muted/20 px-2 py-1 text-muted-foreground">{exchange}</span>
                        ) : null}
                        {sector ? (
                            <span className="rounded-md border border-border/70 bg-muted/20 px-2 py-1 text-muted-foreground">{sector}</span>
                        ) : null}
                        {marketCap ? (
                            <span className="rounded-md border border-border/70 bg-muted/20 px-2 py-1 text-muted-foreground">
                                Mkt Cap {formatCurrencyShort(marketCap, currency || "USD")}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 lg:min-w-[236px]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Last Price</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{priceLabel}</p>
                    <p className={cn("text-sm font-semibold", changeTone(changePercent))}>{changeLabel}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Market status unavailable</p>
                </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/15 p-2.5">
                <StockActionBar
                    symbol={symbol}
                    company={companyName || symbol}
                    isInWatchlist={isInWatchlist}
                    initialAlert={initialAlert}
                />
            </div>
        </header>
    );
}