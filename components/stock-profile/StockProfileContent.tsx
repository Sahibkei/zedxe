"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import OverviewPanel from "@/components/stock-profile/OverviewPanel";
import FinancialsPanel from "@/components/stock-profile/FinancialsPanel";
import StockProfileSubnav, { STOCK_PROFILE_TABS, type StockProfileTabKey } from "@/components/stock-profile/StockProfileSubnav";
import ComingSoonPanel from "@/components/stock-profile/ComingSoonPanel";
import StockNewsPanel from "@/components/stock-profile/StockNewsPanel";
import type { StockProfileV2Model } from "@/lib/stocks/stockProfileV2.types";

type StockProfileContentProps = {
    profile: StockProfileV2Model;
    symbol: string;
    marketCap?: number;
    newsItems: MarketNewsArticle[];
    providerErrors?: string[];
};

const tabSet = new Set(STOCK_PROFILE_TABS.map((tab) => tab.key));

const coerceTab = (value: string | null): StockProfileTabKey => {
    if (value && tabSet.has(value as StockProfileTabKey)) {
        return value as StockProfileTabKey;
    }
    return "overview";
};

export default function StockProfileContent({ profile, symbol, marketCap, newsItems, providerErrors }: StockProfileContentProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const activeTab = coerceTab(searchParams.get("tab"));

    useEffect(() => {
        const resolved = coerceTab(searchParams.get("tab"));

        if (searchParams.get("tab") !== resolved) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", resolved);
            const query = params.toString();
            router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
        }
    }, [pathname, router, searchParams]);

    const handleTabChange = (nextTab: StockProfileTabKey) => {
        if (nextTab === activeTab) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", nextTab);
        const query = params.toString();
        router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    };

    const activePanel = useMemo(() => {
        if (activeTab === "overview") {
            return <OverviewPanel profile={profile} symbol={symbol} marketCap={marketCap} newsItems={newsItems} />;
        }

        if (activeTab === "financials") {
            return <FinancialsPanel profile={profile} />;
        }

        if (activeTab === "news") {
            return <StockNewsPanel newsItems={newsItems} />;
        }

        if (activeTab === "technical") {
            return (
                <ComingSoonPanel
                    title="Technical Analysis Workspace"
                    description="Indicator overlays, trend diagnostics, and momentum studies are planned for this tab in the next release."
                />
            );
        }

        if (activeTab === "ownership") {
            return (
                <ComingSoonPanel
                    title="Ownership & Positioning"
                    description="Institutional ownership snapshots and insider activity views will be added once the ownership API integration is finalized."
                />
            );
        }

        return (
            <ComingSoonPanel
                title="Analyst Estimates"
                description="Consensus revenue/EPS estimates and revision history are not available from current providers yet."
            />
        );
    }, [activeTab, marketCap, newsItems, profile, symbol]);

    return (
        <div className="space-y-4">
            <StockProfileSubnav activeTab={activeTab} onTabChange={handleTabChange} />
            <section className="space-y-4">{activePanel}</section>
            {providerErrors && providerErrors.length > 0 ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                    Some upstream providers returned partial data:
                    <ul className="mt-2 list-disc pl-4">
                        {providerErrors.map((error) => (
                            <li key={error}>{error}</li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}

