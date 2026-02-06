"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
    { key: "overview", label: "Overview" },
    { key: "financials", label: "Financials" },
    { key: "ratios", label: "Ratios" },
    { key: "earnings", label: "Earnings" },
    { key: "filings", label: "Filings" },
];

const StockProfileSubnav = ({ symbol }: { symbol: string }) => {
    const pathname = usePathname();

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1c2432] bg-[#0d1117]/90 px-4 py-3 shadow-lg">
            <Link href="/dashboard" className="text-sm font-medium text-slate-400 hover:text-slate-200">
                ← Back to Markets
            </Link>
            <div className="flex flex-wrap items-center gap-4" role="tablist" aria-label="Stock profile sections">
                {navItems.map((item) => {
                    const href = `/stocks/${symbol}/${item.key}`;
                    const isActive = pathname?.toLowerCase() === href.toLowerCase();
                    return (
                        <Link
                            key={item.key}
                            href={href}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`${item.key}-panel`}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                                "border-b-2 px-1 py-2 text-xs font-semibold transition",
                                isActive
                                    ? "border-emerald-400 text-slate-100"
                                    : "border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-200",
                            )}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default StockProfileSubnav;
