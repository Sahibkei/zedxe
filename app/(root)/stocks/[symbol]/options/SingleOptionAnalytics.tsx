"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { fetchOptionChain, fetchSingleOptionAnalytics } from "@/lib/options/client";
import { bsPrice } from "@/lib/options/bs";
import { formatIV, formatNumber, formatPercent } from "@/lib/options/format";
import type {
    ChainResponse,
    OptionPriceSource,
    OptionSide,
    SingleOptionAnalyticsResponse,
} from "@/lib/options/types";
import { cn } from "@/lib/utils";

type SingleOptionAnalyticsProps = {
    symbol: string;
    expiries: string[];
    selectedExpiry: string;
    setSelectedExpiry: (value: string) => void;
    r: number;
    setR: (value: number) => void;
    q: number;
    setQ: (value: number) => void;
    loadingExpiries: boolean;
};

type PayoffPoint = {
    underlying: number;
    pnl: number;
    value: number;
};

const priceSources: OptionPriceSource[] = ["mid", "bid", "ask", "last"];

function SectionCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-lg backdrop-blur space-y-3">
            <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                {description ? <p className="text-sm text-muted-foreground leading-relaxed">{description}</p> : null}
            </div>
            {children}
        </div>
    );
}

function FieldShell({ children }: { children: ReactNode }) {
    return <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 p-3">{children}</div>;
}

function InputLabel({ children }: { children: ReactNode }) {
    return <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</span>;
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold text-foreground">{value}</p>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
    );
}

function ChartCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-lg backdrop-blur space-y-3">
            <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {children}
        </div>
    );
}

export default function SingleOptionAnalytics({
    symbol,
    expiries,
    selectedExpiry,
    setSelectedExpiry,
    r,
    setR,
    q,
    setQ,
    loadingExpiries,
}: SingleOptionAnalyticsProps) {
    const [optionType, setOptionType] = useState<OptionSide>("call");
    const [priceSource, setPriceSource] = useState<OptionPriceSource>("mid");
    const [chain, setChain] = useState<ChainResponse | null>(null);
    const [chainLoading, setChainLoading] = useState(false);
    const [chainError, setChainError] = useState<string | null>(null);
    const [strikeInput, setStrikeInput] = useState("");
    const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
    const [analytics, setAnalytics] = useState<SingleOptionAnalyticsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [rInput, setRInput] = useState(() => String(r));
    const [qInput, setQInput] = useState(() => String(q));
    const [rError, setRError] = useState<string | null>(null);
    const [qError, setQError] = useState<string | null>(null);
    const [strikeError, setStrikeError] = useState<string | null>(null);
    const chainAbortRef = useRef<AbortController | null>(null);
    const analyticsAbortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        setRInput(String(r));
    }, [r]);

    useEffect(() => {
        setQInput(String(q));
    }, [q]);

    useEffect(() => {
        return () => {
            chainAbortRef.current?.abort();
            analyticsAbortRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        if (!selectedExpiry) return;
        chainAbortRef.current?.abort();
        const controller = new AbortController();
        chainAbortRef.current = controller;
        setChainLoading(true);
        setChainError(null);

        fetchOptionChain(symbol, selectedExpiry, controller.signal)
            .then((response) => {
                if (controller.signal.aborted) return;
                setChain(response);
                setChainError(null);
            })
            .catch((fetchError) => {
                if (controller.signal.aborted) return;
                const message = fetchError instanceof Error ? fetchError.message : "Unable to load option chain.";
                setChain(null);
                setChainError(message);
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setChainLoading(false);
                }
            });
    }, [symbol, selectedExpiry]);

    const strikes = useMemo(() => {
        if (!chain?.contracts) return [];
        const unique = new Set<number>();
        chain.contracts.forEach((contract) => {
            if (contract.side === optionType) {
                unique.add(contract.strike);
            }
        });
        return Array.from(unique).sort((a, b) => a - b);
    }, [chain, optionType]);

    useEffect(() => {
        if (strikes.length === 0) return;
        if (selectedStrike !== null && strikes.includes(selectedStrike)) {
            setStrikeInput(String(selectedStrike));
            return;
        }
        const spot = chain?.spot ?? strikes[0];
        const closest = strikes.reduce((prev, current) =>
            Math.abs(current - spot) < Math.abs(prev - spot) ? current : prev
        );
        setSelectedStrike(closest);
        setStrikeInput(String(closest));
    }, [chain?.spot, selectedStrike, strikes]);

    const dte = analytics ? Math.max(0, Math.round(analytics.spot.T * 365)) : null;
    const contractLabel = analytics
        ? `${analytics.contract.symbol} ${analytics.contract.expiry} ${analytics.contract.type.toUpperCase()} ${analytics.contract.strike}`
        : "--";

    const payoffData = useMemo<PayoffPoint[]>(() => {
        if (!analytics) return [];
        const spot = analytics.spot.spot;
        const min = Math.max(1, spot * 0.5);
        const max = spot * 1.5;
        const steps = 50;
        const data: PayoffPoint[] = [];
        const side = analytics.contract.type;
        const strike = analytics.contract.strike;
        const premium = analytics.market.premium;
        const sigma = analytics.model.ivUsed;
        const tYears = analytics.spot.T;
        const rValue = analytics.inputs.r;
        const qValue = analytics.inputs.q;

        for (let i = 0; i <= steps; i += 1) {
            const underlying = min + ((max - min) * i) / steps;
            const payoff =
                side === "call" ? Math.max(0, underlying - strike) : Math.max(0, strike - underlying);
            const pnl = payoff - premium;
            const value = bsPrice({ side, S: underlying, K: strike, r: rValue, q: qValue, t: tYears, sigma });
            data.push({ underlying, pnl, value: Number.isFinite(value) ? value : 0 });
        }
        return data;
    }, [analytics]);

    const handleStrikeChange = (value: string) => {
        setStrikeInput(value);
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            setSelectedStrike(parsed);
        } else {
            setSelectedStrike(null);
        }
    };

    const handleRefresh = async () => {
        setError(null);
        setWarnings([]);
        setStrikeError(null);

        if (!selectedExpiry) {
            setError("Select an expiry to fetch analytics.");
            return;
        }

        const parsedR = Number.parseFloat(rInput);
        const parsedQ = Number.parseFloat(qInput);
        const nextRError = Number.isFinite(parsedR) ? null : "Enter a valid risk-free rate.";
        const nextQError = Number.isFinite(parsedQ) ? null : "Enter a valid dividend yield.";

        setRError(nextRError);
        setQError(nextQError);

        if (nextRError || nextQError) {
            return;
        }

        if (selectedStrike === null || !Number.isFinite(selectedStrike)) {
            setStrikeError("Choose a valid strike from the chain.");
            return;
        }

        if (strikes.length > 0 && !strikes.includes(selectedStrike)) {
            setStrikeError("Strike not found in selected expiry.");
            return;
        }

        analyticsAbortRef.current?.abort();
        const controller = new AbortController();
        analyticsAbortRef.current = controller;
        setLoading(true);

        try {
            const response = await fetchSingleOptionAnalytics(
                symbol,
                selectedExpiry,
                optionType,
                selectedStrike,
                parsedR,
                parsedQ,
                priceSource,
                { signal: controller.signal }
            );
            if (controller.signal.aborted) return;
            setAnalytics(response);
            setWarnings(response.warnings ?? []);
            setR(parsedR);
            setQ(parsedQ);
        } catch (fetchError) {
            if (controller.signal.aborted) return;
            const message = fetchError instanceof Error ? fetchError.message : "Unable to fetch analytics.";
            setError(message);
            setAnalytics(null);
            setWarnings([]);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    };

    return (
        <div className="space-y-4">
            <SectionCard
                title="Single-Option Inputs"
                description="Choose an expiry, option contract, and pricing assumptions to compute single-option analytics."
            >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <FieldShell>
                        <InputLabel>Expiry</InputLabel>
                        <select
                            value={selectedExpiry}
                            onChange={(event) => setSelectedExpiry(event.target.value)}
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        >
                            <option value="" disabled>
                                {loadingExpiries ? "Loading expiries..." : "Select expiry"}
                            </option>
                            {expiries.map((expiry) => (
                                <option key={expiry} value={expiry}>
                                    {expiry}
                                </option>
                            ))}
                        </select>
                    </FieldShell>
                    <FieldShell>
                        <InputLabel>Type</InputLabel>
                        <div className="flex rounded-lg border border-border/60 bg-muted/20 p-1">
                            {(["call", "put"] as OptionSide[]).map((side) => (
                                <button
                                    key={side}
                                    type="button"
                                    onClick={() => setOptionType(side)}
                                    className={cn(
                                        "flex-1 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                                        optionType === side
                                            ? "bg-primary/20 text-foreground ring-1 ring-primary/50"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {side}
                                </button>
                            ))}
                        </div>
                    </FieldShell>
                    <FieldShell>
                        <InputLabel>Strike</InputLabel>
                        <input
                            list="strike-options"
                            value={strikeInput}
                            onChange={(event) => handleStrikeChange(event.target.value)}
                            placeholder={chainLoading ? "Loading strikes..." : "Select strike"}
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        />
                        <datalist id="strike-options">
                            {strikes.map((strike) => (
                                <option key={strike} value={strike.toFixed(2)} />
                            ))}
                        </datalist>
                        {strikeError ? <p className="text-xs text-red-400">{strikeError}</p> : null}
                    </FieldShell>
                    <FieldShell>
                        <InputLabel>Risk-Free Rate (r)</InputLabel>
                        <input
                            value={rInput}
                            onChange={(event) => setRInput(event.target.value)}
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        />
                        {rError ? <p className="text-xs text-red-400">{rError}</p> : null}
                    </FieldShell>
                    <FieldShell>
                        <InputLabel>Dividend Yield (q)</InputLabel>
                        <input
                            value={qInput}
                            onChange={(event) => setQInput(event.target.value)}
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        />
                        {qError ? <p className="text-xs text-red-400">{qError}</p> : null}
                    </FieldShell>
                    <FieldShell>
                        <InputLabel>Price Source</InputLabel>
                        <select
                            value={priceSource}
                            onChange={(event) => setPriceSource(event.target.value as OptionPriceSource)}
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        >
                            {priceSources.map((source) => (
                                <option key={source} value={source}>
                                    {source.toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </FieldShell>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={loading || chainLoading || !selectedExpiry}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? "Refreshing..." : "Refresh"}
                    </button>
                    {chainLoading ? <span className="text-xs text-muted-foreground">Loading chain...</span> : null}
                    {chainError ? <span className="text-xs text-red-400">{chainError}</span> : null}
                </div>
            </SectionCard>

            {error ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                </div>
            ) : null}

            {warnings.length > 0 ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-100">Warnings</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100">
                        {warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <SectionCard title="Contract Analytics Snapshot" description="Key pricing and risk outputs for the selected contract.">
                {loading && !analytics ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="h-20 animate-pulse rounded-xl border border-border/60 bg-muted/30" />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <SummaryCard label="Contract" value={contractLabel} hint={analytics?.inputs.priceSource.toUpperCase()} />
                        <SummaryCard
                            label="Spot / Forward"
                            value={
                                analytics
                                    ? `${formatNumber(analytics.spot.spot, 2)} / ${formatNumber(analytics.spot.forward, 2)}`
                                    : "--"
                            }
                            hint={analytics ? `T=${formatNumber(analytics.spot.T, 4)} yrs · DTE ${dte ?? "--"}` : undefined}
                        />
                        <SummaryCard
                            label="Market Premium"
                            value={analytics ? formatNumber(analytics.market.premium, 2) : "--"}
                            hint={
                                analytics
                                    ? `Bid ${formatNumber(analytics.market.bid, 2)} / Ask ${formatNumber(analytics.market.ask, 2)}`
                                    : undefined
                            }
                        />
                        <SummaryCard
                            label="Spread"
                            value={analytics ? formatPercent(analytics.market.spreadPct, 2) : "--"}
                            hint={analytics ? `Abs ${formatNumber(analytics.market.spreadAbs, 2)}` : undefined}
                        />
                        <SummaryCard
                            label="Implied Vol"
                            value={analytics ? formatIV(analytics.model.ivUsed, 2) : "--"}
                            hint={
                                analytics?.market.vendorIV !== undefined
                                    ? `Vendor ${formatIV(analytics.market.vendorIV, 2)}`
                                    : "Vendor IV --"
                            }
                        />
                        <SummaryCard
                            label="IV Diff"
                            value={
                                analytics?.market.vendorIV !== undefined
                                    ? formatIV(analytics.model.ivUsed - analytics.market.vendorIV, 2)
                                    : "--"
                            }
                        />
                        <SummaryCard
                            label="Delta"
                            value={analytics ? formatNumber(analytics.model.greeks.delta, 3) : "--"}
                        />
                        <SummaryCard
                            label="Gamma"
                            value={analytics ? formatNumber(analytics.model.greeks.gamma, 4) : "--"}
                        />
                        <SummaryCard
                            label="Vega"
                            value={analytics ? formatNumber(analytics.model.greeks.vega, 4) : "--"}
                        />
                        <SummaryCard
                            label="Theta"
                            value={analytics ? formatNumber(analytics.model.greeks.theta, 4) : "--"}
                        />
                        <SummaryCard
                            label="Rho"
                            value={analytics ? formatNumber(analytics.model.greeks.rho, 4) : "--"}
                        />
                        <SummaryCard
                            label="Prob ITM"
                            value={analytics ? formatPercent(analytics.model.probITM * 100, 2) : "--"}
                        />
                        <SummaryCard
                            label="Breakeven"
                            value={analytics ? formatNumber(analytics.model.breakeven, 2) : "--"}
                            hint="At expiry, per-share"
                        />
                    </div>
                )}
            </SectionCard>

            <ChartCard
                title="Payoff at Expiry"
                description="Per-share PnL across terminal prices. Reference lines mark strike, spot, and breakeven."
            >
                {payoffData.length === 0 ? (
                    <div className="h-64 w-full animate-pulse rounded-xl border border-border/60 bg-muted/30" />
                ) : (
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={payoffData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                                <XAxis
                                    dataKey="underlying"
                                    tickFormatter={(value) => formatNumber(value, 0)}
                                    stroke="rgba(148,163,184,0.7)"
                                />
                                <YAxis
                                    tickFormatter={(value) => formatNumber(value, 0)}
                                    stroke="rgba(148,163,184,0.7)"
                                />
                                <Tooltip
                                    formatter={(value: number) => formatNumber(value, 2)}
                                    labelFormatter={(value) => `Underlying ${formatNumber(value as number, 2)}`}
                                    contentStyle={{
                                        background: "rgba(15,23,42,0.9)",
                                        border: "1px solid rgba(148,163,184,0.2)",
                                    }}
                                />
                                <ReferenceLine
                                    x={analytics?.contract.strike}
                                    stroke="rgba(148,163,184,0.5)"
                                    strokeDasharray="4 4"
                                    label={{ value: "Strike", position: "top", fill: "rgba(148,163,184,0.7)" }}
                                />
                                <ReferenceLine
                                    x={analytics?.spot.spot}
                                    stroke="rgba(59,130,246,0.6)"
                                    strokeDasharray="4 4"
                                    label={{ value: "Spot", position: "top", fill: "rgba(59,130,246,0.8)" }}
                                />
                                <ReferenceLine
                                    x={analytics?.model.breakeven}
                                    stroke="rgba(34,197,94,0.7)"
                                    strokeDasharray="4 4"
                                    label={{ value: "Breakeven", position: "top", fill: "rgba(34,197,94,0.8)" }}
                                />
                                <Line type="monotone" dataKey="pnl" stroke="#38bdf8" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>

            <ChartCard
                title="Option Value vs Underlying (Today)"
                description="BSM model value across spot levels with fixed maturity and implied volatility."
            >
                {payoffData.length === 0 ? (
                    <div className="h-64 w-full animate-pulse rounded-xl border border-border/60 bg-muted/30" />
                ) : (
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={payoffData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                                <XAxis
                                    dataKey="underlying"
                                    tickFormatter={(value) => formatNumber(value, 0)}
                                    stroke="rgba(148,163,184,0.7)"
                                />
                                <YAxis
                                    tickFormatter={(value) => formatNumber(value, 2)}
                                    stroke="rgba(148,163,184,0.7)"
                                />
                                <Tooltip
                                    formatter={(value: number) => formatNumber(value, 2)}
                                    labelFormatter={(value) => `Underlying ${formatNumber(value as number, 2)}`}
                                    contentStyle={{
                                        background: "rgba(15,23,42,0.9)",
                                        border: "1px solid rgba(148,163,184,0.2)",
                                    }}
                                />
                                <ReferenceLine
                                    x={analytics?.contract.strike}
                                    stroke="rgba(148,163,184,0.5)"
                                    strokeDasharray="4 4"
                                    label={{ value: "Strike", position: "top", fill: "rgba(148,163,184,0.7)" }}
                                />
                                <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </ChartCard>
        </div>
    );
}
