"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { fetchOptionChain, fetchScenarioAnalysis } from "@/lib/options/client";
import { formatIV, formatNumber, formatPercent } from "@/lib/options/format";
import { daysToExpiry } from "@/lib/options/time";
import type { ChainResponse, OptionSide, ScenarioAnalysisResponse, ScenarioPriceSource } from "@/lib/options/types";
import { cn } from "@/lib/utils";

type ScenarioAnalysisProps = {
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

const priceSources: ScenarioPriceSource[] = ["mid", "bid", "ask", "model"];

const parseNumericInput = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

export default function ScenarioAnalysis({
    symbol,
    expiries,
    selectedExpiry,
    setSelectedExpiry,
    r,
    setR,
    q,
    setQ,
    loadingExpiries,
}: ScenarioAnalysisProps) {
    const [optionType, setOptionType] = useState<OptionSide>("call");
    const [priceSource, setPriceSource] = useState<ScenarioPriceSource>("mid");
    const [chain, setChain] = useState<ChainResponse | null>(null);
    const [chainLoading, setChainLoading] = useState(false);
    const [chainError, setChainError] = useState<string | null>(null);
    const [strikeInput, setStrikeInput] = useState("");
    const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
    const [strikeError, setStrikeError] = useState<string | null>(null);
    const [scenario, setScenario] = useState<ScenarioAnalysisResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [rInput, setRInput] = useState(() => String(r));
    const [rValue, setRValue] = useState(r);
    const [qInput, setQInput] = useState(() => String(q));
    const [qValue, setQValue] = useState(q);
    const [rError, setRError] = useState<string | null>(null);
    const [qError, setQError] = useState<string | null>(null);
    const [horizonInput, setHorizonInput] = useState("0");
    const [horizonValue, setHorizonValue] = useState(0);
    const [horizonError, setHorizonError] = useState<string | null>(null);
    const [spotMinInput, setSpotMinInput] = useState("-20");
    const [spotMinValue, setSpotMinValue] = useState(-20);
    const [spotMaxInput, setSpotMaxInput] = useState("20");
    const [spotMaxValue, setSpotMaxValue] = useState(20);
    const [spotStepInput, setSpotStepInput] = useState("5");
    const [spotStepValue, setSpotStepValue] = useState(5);
    const [spotMinError, setSpotMinError] = useState<string | null>(null);
    const [spotMaxError, setSpotMaxError] = useState<string | null>(null);
    const [spotStepError, setSpotStepError] = useState<string | null>(null);
    const [spotRangeError, setSpotRangeError] = useState<string | null>(null);
    const [ivMinInput, setIvMinInput] = useState("-20");
    const [ivMinValue, setIvMinValue] = useState(-20);
    const [ivMaxInput, setIvMaxInput] = useState("20");
    const [ivMaxValue, setIvMaxValue] = useState(20);
    const [ivStepInput, setIvStepInput] = useState("5");
    const [ivStepValue, setIvStepValue] = useState(5);
    const [ivMinError, setIvMinError] = useState<string | null>(null);
    const [ivMaxError, setIvMaxError] = useState<string | null>(null);
    const [ivStepError, setIvStepError] = useState<string | null>(null);
    const [ivRangeError, setIvRangeError] = useState<string | null>(null);
    const chainAbortRef = useRef<AbortController | null>(null);
    const scenarioAbortRef = useRef<AbortController | null>(null);

    const expiryDte = useMemo(() => {
        if (!selectedExpiry) return 0;
        return daysToExpiry(selectedExpiry) ?? 0;
    }, [selectedExpiry]);

    useEffect(() => {
        setRInput(String(r));
        setRValue(r);
    }, [r]);

    useEffect(() => {
        setQInput(String(q));
        setQValue(q);
    }, [q]);

    useEffect(() => {
        if (horizonValue > expiryDte) {
            const clamped = clampValue(horizonValue, 0, expiryDte);
            setHorizonValue(clamped);
            setHorizonInput(String(clamped));
        }
    }, [expiryDte, horizonValue]);

    useEffect(() => {
        return () => {
            chainAbortRef.current?.abort();
            scenarioAbortRef.current?.abort();
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

    const handleStrikeChange = (value: string) => {
        setStrikeInput(value);
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            setSelectedStrike(parsed);
            setStrikeError(null);
        } else {
            setSelectedStrike(null);
        }
    };

    const handleNumberChange = (
        value: string,
        setInput: (next: string) => void,
        setNumeric: (next: number) => void,
        setError: (next: string | null) => void,
        label: string
    ) => {
        setInput(value);
        const parsed = parseNumericInput(value);
        if (parsed === null) {
            setError(`Enter a valid ${label}.`);
            return;
        }
        setNumeric(parsed);
        setError(null);
    };

    const handleNumberBlur = (
        errorValue: string | null,
        setInput: (next: string) => void,
        numeric: number,
        setError: (next: string | null) => void
    ) => {
        if (errorValue) {
            setInput(String(numeric));
            setError(null);
        }
    };

    const handleHorizonChange = (value: string) => {
        setHorizonInput(value);
        const parsed = parseNumericInput(value);
        if (parsed === null) {
            setHorizonError("Enter a valid horizon in days.");
            return;
        }
        const clamped = clampValue(parsed, 0, expiryDte);
        setHorizonValue(clamped);
        if (parsed < 0 || parsed > expiryDte) {
            setHorizonError(`Horizon must be between 0 and ${expiryDte} days.`);
        } else {
            setHorizonError(null);
        }
    };

    const handleRefresh = async () => {
        setError(null);
        setWarnings([]);
        setStrikeError(null);
        setSpotRangeError(null);
        setIvRangeError(null);

        if (!selectedExpiry) {
            setError("Select an expiry to compute scenarios.");
            return;
        }

        if (rError || qError || spotMinError || spotMaxError || spotStepError || ivMinError || ivMaxError || ivStepError || horizonError) {
            setError("Fix invalid inputs before refreshing.");
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

        if (spotMinValue > spotMaxValue || spotStepValue <= 0) {
            setSpotRangeError("Spot move range needs min ≤ max and a positive step.");
            return;
        }

        if (ivMinValue > ivMaxValue || ivStepValue <= 0) {
            setIvRangeError("IV shift range needs min ≤ max and a positive step.");
            return;
        }

        scenarioAbortRef.current?.abort();
        const controller = new AbortController();
        scenarioAbortRef.current = controller;
        setLoading(true);

        try {
            const response = await fetchScenarioAnalysis(
                {
                    symbol,
                    expiry: selectedExpiry,
                    type: optionType,
                    strike: selectedStrike,
                    r: rValue,
                    q: qValue,
                    priceSource,
                    horizonDays: horizonValue,
                    spotMinPct: spotMinValue / 100,
                    spotMaxPct: spotMaxValue / 100,
                    spotStepPct: spotStepValue / 100,
                    ivMinPct: ivMinValue / 100,
                    ivMaxPct: ivMaxValue / 100,
                    ivStepPct: ivStepValue / 100,
                },
                { signal: controller.signal }
            );
            if (controller.signal.aborted) return;
            setScenario(response);
            setWarnings(response.warnings ?? []);
            setR(rValue);
            setQ(qValue);
        } catch (fetchError) {
            if (controller.signal.aborted) return;
            const message = fetchError instanceof Error ? fetchError.message : "Unable to compute scenarios.";
            setError(message);
            setScenario(null);
            setWarnings([]);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    };

    const contractLabel = scenario
        ? `${scenario.base.symbol} ${scenario.base.expiry} ${scenario.base.type.toUpperCase()} ${scenario.base.strike}`
        : "--";

    const spotMoves = scenario?.axes.spotMovesPct ?? [];
    const ivShifts = scenario?.axes.ivShiftsPct ?? [];
    const pnlGrid = scenario?.grids.pnl ?? [];
    const priceGrid = scenario?.grids.price ?? [];
    const maxAbsPnl = scenario ? Math.max(Math.abs(scenario.stats.pnlMin), Math.abs(scenario.stats.pnlMax)) : 0;

    const getCellColor = (pnl: number) => {
        if (!Number.isFinite(pnl) || maxAbsPnl <= 0) return "transparent";
        const intensity = Math.min(1, Math.abs(pnl) / maxAbsPnl);
        const alpha = 0.15 + intensity * 0.45;
        return pnl >= 0 ? `rgba(16, 185, 129, ${alpha})` : `rgba(248, 113, 113, ${alpha})`;
    };

    return (
        <div className="space-y-4">
            <SectionCard
                title="Scenario Inputs"
                description="Pick a single contract and scenario ranges to compute model price and P&L grids."
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
                            list="scenario-strike-options"
                            value={strikeInput}
                            onChange={(event) => handleStrikeChange(event.target.value)}
                            placeholder={chainLoading ? "Loading strikes..." : "Select strike"}
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        />
                        <datalist id="scenario-strike-options">
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
                            onChange={(event) => handleNumberChange(event.target.value, setRInput, setRValue, setRError, "risk-free rate")}
                            onBlur={() => handleNumberBlur(rError, setRInput, rValue, setRError)}
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        />
                        {rError ? <p className="text-xs text-red-400">{rError}</p> : null}
                    </FieldShell>
                    <FieldShell>
                        <InputLabel>Dividend Yield (q)</InputLabel>
                        <input
                            value={qInput}
                            onChange={(event) => handleNumberChange(event.target.value, setQInput, setQValue, setQError, "dividend yield")}
                            onBlur={() => handleNumberBlur(qError, setQInput, qValue, setQError)}
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        />
                        {qError ? <p className="text-xs text-red-400">{qError}</p> : null}
                    </FieldShell>
                    <FieldShell>
                        <InputLabel>Price Source</InputLabel>
                        <select
                            value={priceSource}
                            onChange={(event) => setPriceSource(event.target.value as ScenarioPriceSource)}
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        >
                            {priceSources.map((source) => (
                                <option key={source} value={source}>
                                    {source.toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </FieldShell>
                    <FieldShell>
                        <InputLabel>Horizon (days forward)</InputLabel>
                        <input
                            type="number"
                            min={0}
                            max={expiryDte}
                            value={horizonInput}
                            onChange={(event) => handleHorizonChange(event.target.value)}
                            onBlur={() => handleNumberBlur(horizonError, setHorizonInput, horizonValue, setHorizonError)}
                            className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                        />
                        <span className="text-xs text-muted-foreground">Max DTE: {expiryDte} days</span>
                        {horizonError ? <p className="text-xs text-red-400">{horizonError}</p> : null}
                    </FieldShell>
                </div>

                <div className="grid gap-3 pt-3 lg:grid-cols-2">
                    <FieldShell>
                        <InputLabel>Spot Move Range (%)</InputLabel>
                        <div className="grid gap-2 sm:grid-cols-3">
                            <input
                                value={spotMinInput}
                                onChange={(event) => {
                                    setSpotRangeError(null);
                                    handleNumberChange(event.target.value, setSpotMinInput, setSpotMinValue, setSpotMinError, "spot min");
                                }}
                                onBlur={() => handleNumberBlur(spotMinError, setSpotMinInput, spotMinValue, setSpotMinError)}
                                className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                                placeholder="Min"
                            />
                            <input
                                value={spotMaxInput}
                                onChange={(event) => {
                                    setSpotRangeError(null);
                                    handleNumberChange(event.target.value, setSpotMaxInput, setSpotMaxValue, setSpotMaxError, "spot max");
                                }}
                                onBlur={() => handleNumberBlur(spotMaxError, setSpotMaxInput, spotMaxValue, setSpotMaxError)}
                                className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                                placeholder="Max"
                            />
                            <input
                                value={spotStepInput}
                                onChange={(event) => {
                                    setSpotRangeError(null);
                                    handleNumberChange(event.target.value, setSpotStepInput, setSpotStepValue, setSpotStepError, "spot step");
                                }}
                                onBlur={() => handleNumberBlur(spotStepError, setSpotStepInput, spotStepValue, setSpotStepError)}
                                className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                                placeholder="Step"
                            />
                        </div>
                        {spotMinError ? <p className="text-xs text-red-400">{spotMinError}</p> : null}
                        {spotMaxError ? <p className="text-xs text-red-400">{spotMaxError}</p> : null}
                        {spotStepError ? <p className="text-xs text-red-400">{spotStepError}</p> : null}
                        {spotRangeError ? <p className="text-xs text-red-400">{spotRangeError}</p> : null}
                    </FieldShell>
                    <FieldShell>
                        <InputLabel>IV Shift Range (%)</InputLabel>
                        <div className="grid gap-2 sm:grid-cols-3">
                            <input
                                value={ivMinInput}
                                onChange={(event) => {
                                    setIvRangeError(null);
                                    handleNumberChange(event.target.value, setIvMinInput, setIvMinValue, setIvMinError, "IV min");
                                }}
                                onBlur={() => handleNumberBlur(ivMinError, setIvMinInput, ivMinValue, setIvMinError)}
                                className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                                placeholder="Min"
                            />
                            <input
                                value={ivMaxInput}
                                onChange={(event) => {
                                    setIvRangeError(null);
                                    handleNumberChange(event.target.value, setIvMaxInput, setIvMaxValue, setIvMaxError, "IV max");
                                }}
                                onBlur={() => handleNumberBlur(ivMaxError, setIvMaxInput, ivMaxValue, setIvMaxError)}
                                className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                                placeholder="Max"
                            />
                            <input
                                value={ivStepInput}
                                onChange={(event) => {
                                    setIvRangeError(null);
                                    handleNumberChange(event.target.value, setIvStepInput, setIvStepValue, setIvStepError, "IV step");
                                }}
                                onBlur={() => handleNumberBlur(ivStepError, setIvStepInput, ivStepValue, setIvStepError)}
                                className="h-10 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-sm font-semibold text-foreground"
                                placeholder="Step"
                            />
                        </div>
                        {ivMinError ? <p className="text-xs text-red-400">{ivMinError}</p> : null}
                        {ivMaxError ? <p className="text-xs text-red-400">{ivMaxError}</p> : null}
                        {ivStepError ? <p className="text-xs text-red-400">{ivStepError}</p> : null}
                        {ivRangeError ? <p className="text-xs text-red-400">{ivRangeError}</p> : null}
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
                        {warnings.map((warning, index) => (
                            <li key={`${index}-${warning}`}>{warning}</li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <SectionCard
                title="Scenario Snapshot"
                description="Base pricing inputs and key P&L highlights for the selected scenario grid."
            >
                {loading && !scenario ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="h-20 animate-pulse rounded-xl border border-border/60 bg-muted/30" />
                        ))}
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <SummaryCard label="Contract" value={contractLabel} hint={priceSource.toUpperCase()} />
                        <SummaryCard
                            label="Base Spot / Forward"
                            value={
                                scenario
                                    ? `${formatNumber(scenario.base.spot, 2)} / ${formatNumber(scenario.base.forward, 2)}`
                                    : "--"
                            }
                            hint={scenario ? `DTE ${scenario.base.dte} · T=${formatNumber(scenario.base.tEff, 4)} yrs` : undefined}
                        />
                        <SummaryCard
                            label="Base Premium"
                            value={scenario ? formatNumber(scenario.base.basePremium, 2) : "--"}
                            hint={scenario ? priceSource.toUpperCase() : undefined}
                        />
                        <SummaryCard
                            label="Base IV Used"
                            value={scenario ? formatIV(scenario.base.baseSigma, 2) : "--"}
                        />
                        <SummaryCard
                            label="Horizon"
                            value={scenario ? `${scenario.base.horizonDays} days` : "--"}
                            hint={scenario ? `T_eff ${formatNumber(scenario.base.tEff, 4)} yrs` : undefined}
                        />
                        <SummaryCard
                            label="Best / Worst P&L"
                            value={
                                scenario
                                    ? `${formatNumber(scenario.stats.pnlBest.pnl, 2)} / ${formatNumber(scenario.stats.pnlWorst.pnl, 2)}`
                                    : "--"
                            }
                            hint={
                                scenario
                                    ? `Best ${formatPercent(scenario.stats.pnlBest.spotMovePct * 100, 0)} spot, ${formatPercent(
                                          scenario.stats.pnlBest.ivShiftPct * 100,
                                          0
                                      )} IV · Worst ${formatPercent(scenario.stats.pnlWorst.spotMovePct * 100, 0)} spot, ${formatPercent(
                                          scenario.stats.pnlWorst.ivShiftPct * 100,
                                          0
                                      )} IV`
                                    : undefined
                            }
                        />
                    </div>
                )}
            </SectionCard>

            <SectionCard
                title="Scenario P&L Grid"
                description="Per-share P&L across spot and implied volatility shocks. Hover a cell for details."
            >
                {loading && !scenario ? (
                    <div className="h-64 w-full animate-pulse rounded-xl border border-border/60 bg-muted/30" />
                ) : scenario ? (
                    <div className="space-y-3">
                        <div className="overflow-x-auto rounded-xl border border-border/60 bg-muted/10">
                            <table className="min-w-max border-collapse text-xs text-foreground">
                                <thead>
                                    <tr>
                                        <th className="sticky left-0 bg-muted/40 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                                            IV \\ Spot
                                        </th>
                                        {spotMoves.map((spotMove) => (
                                            <th key={spotMove} className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                                                {formatPercent(spotMove * 100, 0)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {ivShifts.map((ivShift, rowIndex) => (
                                        <tr key={ivShift}>
                                            <td className="sticky left-0 bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                                                {formatPercent(ivShift * 100, 0)}
                                            </td>
                                            {spotMoves.map((spotMove, colIndex) => {
                                                const pnl = pnlGrid[rowIndex]?.[colIndex] ?? 0;
                                                const scenarioPrice = priceGrid[rowIndex]?.[colIndex] ?? 0;
                                                const scenarioSpot = scenario.base.spot * (1 + spotMove);
                                                const scenarioSigma = Math.max(scenario.base.baseSigma * (1 + ivShift), 1e-6);
                                                const tooltip = `Spot Move: ${formatPercent(spotMove * 100, 2)}\nIV Shift: ${formatPercent(
                                                    ivShift * 100,
                                                    2
                                                )}\nScenario Spot: ${formatNumber(scenarioSpot, 2)}\nScenario IV: ${formatIV(
                                                    scenarioSigma,
                                                    2
                                                )}\nScenario Price: ${formatNumber(scenarioPrice, 2)}\nP&L: ${formatNumber(pnl, 2)}`;
                                                return (
                                                    <td
                                                        key={`${spotMove}-${ivShift}`}
                                                        title={tooltip}
                                                        className="border border-border/40 px-3 py-2 text-center"
                                                        style={{ backgroundColor: getCellColor(pnl) }}
                                                    >
                                                        {formatNumber(pnl, 2)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span>Rows: IV shift (%)</span>
                            <span>Columns: Spot move (%)</span>
                            <span>Color intensity scales to |P&L| range.</span>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        Run the scenario analysis to see the P&L grid.
                    </div>
                )}
            </SectionCard>
        </div>
    );
}
