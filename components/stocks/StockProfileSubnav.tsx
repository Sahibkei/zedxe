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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 px-4 py-3 shadow-lg">
            <Link href="/dashboard" className="text-sm font-medium text-slate-400 hover:text-slate-200">
                ← Back to Markets
            </Link>
            <div className="flex flex-wrap items-center gap-2">
                {navItems.map((item) => {
                    const href = `/stocks/${symbol}/${item.key}`;
                    const isActive = pathname === href;
                    return (
                        <Link
                            key={item.key}
                            href={href}
                            className={cn(
                                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                                isActive
                                    ? "bg-[#10151d] text-slate-100 shadow"
                                    : "text-slate-400 hover:bg-[#10151d] hover:text-slate-200",
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
