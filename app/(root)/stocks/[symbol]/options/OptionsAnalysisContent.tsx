"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const tabs = [
    { key: "model-setup", label: "Model Setup" },
    { key: "iv-smile", label: "Implied Volatility Smile" },
    { key: "iv-surface", label: "IV Surface" },
    { key: "distribution", label: "Risk-Neutral Distribution" },
    { key: "single-option", label: "Single-Option Analytics" },
    { key: "scenario", label: "Scenario Analysis" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

/**
 * Shell UI for the Options Analysis experience. Displays tabs and placeholder sections for future functionality.
 */
type OptionsAnalysisContentProps = {
    symbol: string;
    companyName?: string;
};

export default function OptionsAnalysisContent({ symbol, companyName }: OptionsAnalysisContentProps) {
    const [activeTab, setActiveTab] = useState<TabKey>("model-setup");
    const title = companyName ? `Options Analysis for ${companyName} (${symbol})` : `Options Analysis for ${symbol}`;
    const tabList = tabs;

    return (
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8 space-y-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Derivatives</p>
                    <h1 className="text-3xl font-semibold text-foreground leading-tight">{title}</h1>
                    <p className="text-sm text-muted-foreground">
                        Configure pricing assumptions, visualize implied volatility, and explore risk scenarios for this symbol.
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-400 shadow-sm">
                    <span className="size-2 rounded-full bg-yellow-400" aria-hidden />
                    <span>API Status: Pending</span>
                </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-lg backdrop-blur">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Options analysis sections">
                    {tabList.map((tab) => {
                        const isActive = activeTab === tab.key;
                        const tabId = `options-tab-${tab.key}`;
                        const panelId = `options-panel-${tab.key}`;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={cn(
                                    "rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                                    isActive
                                        ? "bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/60"
                                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                )}
                                type="button"
                                role="tab"
                                id={tabId}
                                aria-selected={isActive}
                                aria-controls={panelId}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-8">
                    {tabList.map((tab) => {
                        const isActive = activeTab === tab.key;
                        const tabId = `options-tab-${tab.key}`;
                        const panelId = `options-panel-${tab.key}`;
                        return (
                            <div
                                key={tab.key}
                                role="tabpanel"
                                id={panelId}
                                aria-labelledby={tabId}
                                hidden={!isActive}
                            >
                                {tab.key === "model-setup" && isActive ? (
                                    <ModelSetupPlaceholder symbol={symbol} />
                                ) : (
                                    isActive && (
                                        <TabPlaceholder
                                            label={tabList.find((currentTab) => currentTab.key === activeTab)?.label || ""}
                                        />
                                    )
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="space-y-4 lg:col-span-4">
                    <PricingEngineSidebar symbol={symbol} />
                </div>
            </div>
        </div>
    );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-lg backdrop-blur space-y-3">
            <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
            </div>
            {children}
        </div>
    );
}

function PlaceholderTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold text-foreground">{value}</p>
        </div>
    );
}

function PlaceholderList({ items }: { items: string[] }) {
    return (
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            {items.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    );
}

function ModelSetupPlaceholder({ symbol }: { symbol: string }) {
    return (
        <div className="space-y-4">
            <SectionCard title="Set Core Assumptions and Parameters" description="Define valuation date, pricing model, and core assumptions before running analytics.">
                <div className="grid gap-3 sm:grid-cols-2">
                    <PlaceholderTile label="Symbol" value={symbol} />
                    <PlaceholderTile label="Valuation Date" value="Today (auto)" />
                    <PlaceholderTile label="Pricing Model" value="Black-Scholes (placeholder)" />
                    <PlaceholderTile label="Vol Surface" value="Pending configuration" />
                </div>
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    Connect interest rate curves, dividend assumptions, and custom parameters here in the next iteration.
                </div>
            </SectionCard>

            <SectionCard
                title="Pull Underlying Spot and Option Chain Data"
                description="Link to market data providers and select expirations and strikes for downstream analytics."
            >
                <div className="grid gap-3 sm:grid-cols-3">
                    <PlaceholderTile label="Spot Source" value="Primary Market Data" />
                    <PlaceholderTile label="Chain Depth" value="Next 6 expirations" />
                    <PlaceholderTile label="Strikes" value="±20 around ATM" />
                </div>
                <PlaceholderList
                    items={[
                        "Auto-refresh spot and option chain snapshots",
                        "Normalize calls/puts into unified schema",
                        "Flag illiquid strikes for downstream filtering",
                    ]}
                />
            </SectionCard>

            <SectionCard
                title="Pricing Engine"
                description="Choose calibration approach and stress parameters before running any models."
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <PlaceholderTile label="Calibration" value="Smile fit queued" />
                    <PlaceholderTile label="Risk-Free Curve" value="UST (placeholder)" />
                    <PlaceholderTile label="Dividend Assumptions" value="Forward div yield" />
                    <PlaceholderTile label="Engine Status" value="Ready to price" />
                </div>
                <PlaceholderList
                    items={[
                        "Plug in Monte Carlo or tree-based engines",
                        "Enable scenario sweeps across greeks",
                        "Generate pricing snapshots for dashboard tiles",
                    ]}
                />
            </SectionCard>
        </div>
    );
}

function TabPlaceholder({ label }: { label: string }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-lg backdrop-blur space-y-3">
            <h3 className="text-lg font-semibold text-foreground">{label}</h3>
            <p className="text-sm text-muted-foreground">
                Interactive visuals and analytics for {label.toLowerCase()} will appear here. This is a placeholder for the Step 1 shell.
            </p>
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Add charts, sliders, and tables in later milestones without changing this route.
            </div>
        </div>
    );
}

function SidebarRow({ title, value }: { title: string; value: string }) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{title}</span>
            <span className="font-semibold text-foreground">{value}</span>
        </div>
    );
}

function PricingEngineSidebar({ symbol }: { symbol: string }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-xl backdrop-blur space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Sidecar</p>
                    <h3 className="text-lg font-semibold text-foreground">Pricing Engine</h3>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/50">Preview</span>
            </div>
            <SidebarRow title="Symbol" value={symbol} />
            <SidebarRow title="Valuation Clock" value="Live" />
            <SidebarRow title="Calibration" value="Pending inputs" />
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
                <p className="font-semibold text-foreground">Engine Notes</p>
                <p className="text-muted-foreground leading-relaxed">
                    This side panel will anchor parameter presets, engine runs, and pricing snapshots. Hook it into the live
                    models once data connections are ready.
                </p>
            </div>
        </div>
    );
}
