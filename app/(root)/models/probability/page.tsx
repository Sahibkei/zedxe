"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const SYMBOLS = ["EURUSD", "XAUUSD", "US500"] as const;
const TIMEFRAMES = ["M5", "M15", "H1"] as const;
const LOOKBACKS = [250, 500, 1000] as const;
const X_PRESETS = [5, 10, 15, 20, 25] as const;
const AS_OF = "2024-10-02 16:00 UTC";

const clampProbability = (value: number) =>
    Math.min(0.99, Math.max(0.01, value));

const formatProbability = (value: number) => `${(value * 100).toFixed(1)}%`;

const ProbabilityPage = () => {
    const [symbol, setSymbol] = useState<(typeof SYMBOLS)[number]>("EURUSD");
    const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>(
        "M15"
    );
    const [horizon, setHorizon] = useState(48);
    const [lookback, setLookback] = useState<number>(500);
    const [targetX, setTargetX] = useState(15);

    const probabilities = useMemo(() => {
        const normalized = Math.min(1, Math.max(0, targetX / 30));
        const up = clampProbability(0.15 + normalized * 0.7);
        const down = clampProbability(0.2 + (1 - normalized) * 0.6);
        const within = clampProbability(
            0.1 + (1 - Math.abs(0.5 - normalized) * 1.2) * 0.7
        );

        return {
            up,
            down,
            within,
        };
    }, [targetX]);

    return (
        <section className="mx-auto max-w-6xl space-y-8 px-4 py-8">
            <header className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold text-white">
                            Probability (Now)
                        </h1>
                        <p className="text-gray-400">
                            By horizon close (END event).
                        </p>
                    </div>
                    <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        as_of: {AS_OF}
                    </span>
                </div>
            </header>

            <div className="rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20">
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Symbol
                            </label>
                            <Select value={symbol} onValueChange={setSymbol}>
                                <SelectTrigger className="w-full bg-gray-950 text-white">
                                    <SelectValue placeholder="Select symbol" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SYMBOLS.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Timeframe
                            </label>
                            <Select
                                value={timeframe}
                                onValueChange={setTimeframe}
                            >
                                <SelectTrigger className="w-full bg-gray-950 text-white">
                                    <SelectValue placeholder="Select timeframe" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIMEFRAMES.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Horizon (bars)
                                </label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={horizon}
                                    onChange={(event) =>
                                        setHorizon(Number(event.target.value))
                                    }
                                    className="border-gray-800 bg-gray-950 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Lookback preset
                                </label>
                                <Select
                                    value={String(lookback)}
                                    onValueChange={(value) =>
                                        setLookback(Number(value))
                                    }
                                >
                                    <SelectTrigger className="w-full bg-gray-950 text-white">
                                        <SelectValue placeholder="Lookback" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LOOKBACKS.map((item) => (
                                            <SelectItem
                                                key={item}
                                                value={String(item)}
                                            >
                                                {item} bars
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Target X
                            </label>
                            <Input
                                type="number"
                                min={1}
                                value={targetX}
                                onChange={(event) =>
                                    setTargetX(Number(event.target.value))
                                }
                                className="border-gray-800 bg-gray-950 text-white"
                            />
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                X presets
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {X_PRESETS.map((value) => {
                                    const isActive = value === targetX;
                                    return (
                                        <Button
                                            key={value}
                                            type="button"
                                            variant={
                                                isActive ? "secondary" : "outline"
                                            }
                                            size="sm"
                                            className={
                                                isActive
                                                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                                                    : "border-gray-800 bg-gray-950 text-gray-300"
                                            }
                                            onClick={() => setTargetX(value)}
                                        >
                                            {value}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Event
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    type="button"
                                    size="sm"
                                    className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                                >
                                    End
                                </Button>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled
                                        className="border-gray-800 bg-gray-950 text-gray-400"
                                    >
                                        Touch
                                    </Button>
                                    <span className="rounded-full border border-gray-700 bg-gray-900/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                        Coming soon
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 text-xs text-gray-400">
                            Mocked run for <span className="text-gray-200">{symbol}</span> ·
                            <span className="text-gray-200"> {timeframe}</span> · horizon
                            <span className="text-gray-200"> {horizon}</span> bars · lookback
                            <span className="text-gray-200"> {lookback}</span> bars.
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold text-white">Results</h2>
                    <span className="text-xs uppercase tracking-wide text-gray-500">
                        Computed from last completed candle
                    </span>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                    {[
                        {
                            label: "P(up ≥ X)",
                            value: probabilities.up,
                            tone: "text-emerald-200",
                        },
                        {
                            label: "P(down ≥ X)",
                            value: probabilities.down,
                            tone: "text-rose-200",
                        },
                        {
                            label: "P(within ±X)",
                            value: probabilities.within,
                            tone: "text-sky-200",
                        },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20"
                        >
                            <p className="text-sm text-gray-400">{item.label}</p>
                            <p
                                className={`mt-4 text-3xl font-semibold ${item.tone}`}
                            >
                                {formatProbability(item.value)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ProbabilityPage;
