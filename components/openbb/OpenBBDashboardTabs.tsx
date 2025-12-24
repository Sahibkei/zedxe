"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type DashboardTabKey =
    | "overview"
    | "financials"
    | "technical"
    | "comparison"
    | "ownership"
    | "calendar"
    | "estimates";

type TabConfig = {
    key: DashboardTabKey;
    label: string;
};

type OpenBBDashboardTabsProps = {
    activeKey?: DashboardTabKey;
    onChange?: (key: DashboardTabKey) => void;
    className?: string;
    tabs?: TabConfig[];
};

const defaultTabs: TabConfig[] = [
    { key: "overview", label: "Overview" },
    { key: "financials", label: "Financials" },
    { key: "technical", label: "Technical Analysis" },
    { key: "comparison", label: "Comparison Analysis" },
    { key: "ownership", label: "Ownership" },
    { key: "calendar", label: "Company Calendar" },
    { key: "estimates", label: "Estimates" },
];

export function OpenBBDashboardTabs({ activeKey, onChange, className, tabs }: OpenBBDashboardTabsProps) {
    const tabList = useMemo(() => tabs ?? defaultTabs, [tabs]);
    const [internal, setInternal] = useState<DashboardTabKey>(tabList[0]?.key ?? "overview");
    const current = activeKey ?? internal;

    const handleChange = (key: DashboardTabKey) => {
        setInternal(key);
        onChange?.(key);
    };

    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#101722] px-3 py-2 text-sm shadow-lg",
                className
            )}
            role="tablist"
            aria-label="OpenBB dashboard tabs"
        >
            {tabList.map((tab) => {
                const isActive = tab.key === current;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => handleChange(tab.key)}
                        className={cn(
                            "rounded-xl px-4 py-2 font-medium transition",
                            isActive
                                ? "bg-sky-500/20 text-slate-50 ring-1 ring-sky-400/40"
                                : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                        )}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}

export default OpenBBDashboardTabs;
