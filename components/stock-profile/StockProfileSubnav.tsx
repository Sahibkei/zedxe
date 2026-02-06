"use client";

import { cn } from "@/lib/utils";

export const STOCK_PROFILE_TABS = [
    { key: "overview", label: "Overview" },
    { key: "financials", label: "Financials" },
    { key: "technical", label: "Technical Analysis" },
    { key: "ownership", label: "Ownership" },
    { key: "news", label: "News" },
    { key: "estimates", label: "Estimates" },
] as const;

export type StockProfileTabKey = (typeof STOCK_PROFILE_TABS)[number]["key"];

type StockProfileSubnavProps = {
    activeTab: StockProfileTabKey;
    onTabChange: (tab: StockProfileTabKey) => void;
};

export default function StockProfileSubnav({ activeTab, onTabChange }: StockProfileSubnavProps) {
    return (
        <div className="sticky top-16 z-30 rounded-2xl border border-border/70 bg-[#0b111a]/95 px-2 py-2 backdrop-blur">
            <nav className="flex gap-2 overflow-x-auto scrollbar-hide-default" aria-label="Stock profile sections">
                {STOCK_PROFILE_TABS.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => onTabChange(tab.key)}
                            className={cn(
                                "whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide transition",
                                isActive
                                    ? "bg-primary/20 text-foreground ring-1 ring-primary/50"
                                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                            )}
                            aria-current={isActive ? "page" : undefined}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
