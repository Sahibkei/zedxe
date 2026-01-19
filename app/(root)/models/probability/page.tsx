"use client";

import { useEffect, useMemo, useState } from "react";

import ProbabilityMiniCurve from "@/components/charts/ProbabilityMiniCurve";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    MAX_HORIZON_BARS,
    MAX_TARGET_X,
} from "@/lib/probability/validation";

type ProbabilityEvent = "end" | "touch";

type ProbabilityResponse = {
    status: "OK" | "MOCKED";
    message?: string;
    meta: {
        symbol: string;
        timeframe: string;
        horizonBars: number;
        requestedLookbackBars: number;
        effectiveLookbackBars: number;
        targetX: number;
        event: ProbabilityEvent;
        asOf: string;
        dataSource: "twelvedata" | "mock";
        wasClamped?: boolean;
        clampReason?: string;
    };
    prob: {
        up_ge_x: number;
        down_ge_x: number;
        within_pm_x: number;
        both_touch?: number;
    };
};

type ProbabilitySurfacePayload = {
    xs: number[];
    up: number[];
    down: number[];
    within: number[];
};

type ProbabilitySurfaceMeta = {
    symbol: string;
    timeframe: string;
    requestedLookbackBars: number;
    effectiveLookbackBars: number;
    requestedHorizonBars: number;
    effectiveHorizonBars: number;
    requestedTargetXs: number[];
    effectiveTargetXs: number[];
    event: ProbabilityEvent;
    asOf: string;
    dataSource: "twelvedata";
    wasClamped: boolean;
    wasTargetXsClamped: boolean;
    sampleCount: number;
};

type MarketSymbol = {
    symbol: string;
    timeframes: string[];
    pip_size: number;
    point_size: number;
};

type MarketSymbolsResponse = {
    symbols: MarketSymbol[];
    timeframes: string[];
    data_source: "twelvedata" | "mock";
};

const DEFAULT_SYMBOLS: MarketSymbol[] = [
    {
        symbol: "EURUSD",
        timeframes: ["M5", "M15", "M30", "H1"],
        pip_size: 0.0001,
        point_size: 0.00001,
    },
];

const LOOKBACKS = [250, 500, 1000] as const;
const X_PRESETS = [5, 10, 15, 20, 25] as const;

const formatProbability = (value?: number) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return "--";
    }
    return `${(value * 100).toFixed(1)}%`;
};

const isProbabilityResponse = (value: unknown): value is ProbabilityResponse => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const data = value as Record<string, unknown>;
    if (data.status !== "OK" && data.status !== "MOCKED") {
        return false;
    }
    if (typeof data.meta !== "object" || data.meta === null) {
        return false;
    }
    if (typeof data.prob !== "object" || data.prob === null) {
        return false;
    }
    const meta = data.meta as Record<string, unknown>;
    if (typeof meta.symbol !== "string") {
        return false;
    }
    if (typeof meta.timeframe !== "string") {
        return false;
    }
    if (
        typeof meta.horizonBars !== "number" ||
        typeof meta.requestedLookbackBars !== "number" ||
        typeof meta.effectiveLookbackBars !== "number" ||
        typeof meta.targetX !== "number"
    ) {
        return false;
    }
    if (meta.event !== "end" && meta.event !== "touch") {
        return false;
    }
    if (typeof meta.asOf !== "string") {
        return false;
    }
    if (meta.dataSource !== "twelvedata" && meta.dataSource !== "mock") {
        return false;
    }
    const prob = data.prob as Record<string, unknown>;
    if (
        typeof prob.up_ge_x !== "number" ||
        typeof prob.down_ge_x !== "number" ||
        typeof prob.within_pm_x !== "number"
    ) {
        return false;
    }
    return true;
};

const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

const isProbabilitySurfaceResponse = (
    value: unknown
): value is {
    status: "OK";
    surface: ProbabilitySurfacePayload;
    meta: ProbabilitySurfaceMeta;
} => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const data = value as Record<string, unknown>;
    if (data.status !== "OK") {
        return false;
    }
    if (typeof data.meta !== "object" || data.meta === null) {
        return false;
    }
    if (typeof data.surface !== "object" || data.surface === null) {
        return false;
    }
    const meta = data.meta as Record<string, unknown>;
    if (typeof meta.symbol !== "string") {
        return false;
    }
    if (typeof meta.timeframe !== "string") {
        return false;
    }
    if (
        typeof meta.requestedHorizonBars !== "number" ||
        typeof meta.effectiveHorizonBars !== "number"
    ) {
        return false;
    }
    if (
        typeof meta.requestedLookbackBars !== "number" ||
        typeof meta.effectiveLookbackBars !== "number"
    ) {
        return false;
    }
    if (
        !Array.isArray(meta.requestedTargetXs) ||
        !Array.isArray(meta.effectiveTargetXs)
    ) {
        return false;
    }
    if (meta.event !== "end" && meta.event !== "touch") {
        return false;
    }
    if (typeof meta.asOf !== "string") {
        return false;
    }
    if (meta.dataSource !== "twelvedata") {
        return false;
    }
    if (typeof meta.sampleCount !== "number") {
        return false;
    }
    const surface = data.surface as Record<string, unknown>;
    if (
        !Array.isArray(surface.xs) ||
        !Array.isArray(surface.up) ||
        !Array.isArray(surface.down) ||
        !Array.isArray(surface.within)
    ) {
        return false;
    }
    if (
        !surface.xs.every(isFiniteNumber) ||
        !surface.up.every(isFiniteNumber) ||
        !surface.down.every(isFiniteNumber) ||
        !surface.within.every(isFiniteNumber)
    ) {
        return false;
    }
    const length = surface.xs.length;
    if (
        length < 2 ||
        surface.up.length !== length ||
        surface.down.length !== length ||
        surface.within.length !== length
    ) {
        return false;
    }
    if (
        !surface.up.every((value) => value >= 0 && value <= 1) ||
        !surface.down.every((value) => value >= 0 && value <= 1) ||
        !surface.within.every((value) => value >= 0 && value <= 1)
    ) {
        return false;
    }
    return true;
};

const ProbabilityPage = () => {
    const isTouchEnabled =
        process.env.NEXT_PUBLIC_FEATURE_PROB_TOUCH === "1";
    const [marketSymbols, setMarketSymbols] = useState<MarketSymbol[]>(
        DEFAULT_SYMBOLS
    );
    const [symbol, setSymbol] = useState<string>("EURUSD");
    const [timeframe, setTimeframe] = useState<string>("M15");
    const [horizonBars, setHorizonBars] = useState(48);
    const [lookbackBars, setLookbackBars] = useState<number>(500);
    const [targetX, setTargetX] = useState(15);
    const [event, setEvent] = useState<ProbabilityEvent>("end");
    const [debouncedTargetX, setDebouncedTargetX] = useState(targetX);
    const [rewardR, setRewardR] = useState(1);
    const [riskR, setRiskR] = useState(1);
    const [probability, setProbability] =
        useState<ProbabilityResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);
    const [surface, setSurface] =
        useState<ProbabilitySurfacePayload | null>(null);
    const [surfaceMeta, setSurfaceMeta] =
        useState<ProbabilitySurfaceMeta | null>(null);
    const [surfaceLoading, setSurfaceLoading] = useState(false);
    const [surfaceError, setSurfaceError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSymbols = async () => {
            try {
                const response = await fetch("/api/market/symbols");
                if (!response.ok) {
                    return;
                }
                const data = (await response.json()) as MarketSymbolsResponse;
                if (Array.isArray(data.symbols) && data.symbols.length > 0) {
                    setMarketSymbols(data.symbols);
                }
            } catch (error) {
                setMarketSymbols(DEFAULT_SYMBOLS);
            }
        };

        fetchSymbols();
    }, []);

    const availableLookbacks = useMemo(() => LOOKBACKS, []);

    const availableSymbols = useMemo(
        () => marketSymbols.map((item) => item.symbol),
        [marketSymbols]
    );

    const availableTimeframes = useMemo(() => {
        const symbolInfo = marketSymbols.find(
            (item) => item.symbol === symbol
        );
        return symbolInfo?.timeframes ?? ["M5", "M15", "M30", "H1"];
    }, [marketSymbols, symbol]);

    useEffect(() => {
        if (!availableSymbols.includes(symbol)) {
            setSymbol(availableSymbols[0] ?? "EURUSD");
        }
    }, [availableSymbols, symbol]);

    useEffect(() => {
        if (!availableTimeframes.includes(timeframe)) {
            setTimeframe(availableTimeframes[0] ?? "M15");
        }
    }, [availableTimeframes, timeframe]);

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedTargetX(targetX);
        }, 150);

        return () => clearTimeout(handle);
    }, [targetX]);

    useEffect(() => {
        const controller = new AbortController();
        const payload = {
            symbol,
            timeframe,
            horizonBars,
            lookbackBars,
            targetX: debouncedTargetX,
            event,
        };

        const fetchProbability = async () => {
            setIsLoading(true);
            setRequestError(null);
            setProbability(null);
            try {
                const response = await fetch("/api/probability/query", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                const data = await response.json();
                if (!controller.signal.aborted) {
                    if (isProbabilityResponse(data)) {
                        setProbability(data);
                    } else {
                        setProbability(null);
                        setRequestError("Invalid response");
                    }
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setProbability(null);
                    setRequestError("Network error. Please try again.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        fetchProbability();

        return () => controller.abort();
    }, [
        debouncedTargetX,
        event,
        horizonBars,
        lookbackBars,
        symbol,
        timeframe,
    ]);

    useEffect(() => {
        const controller = new AbortController();
        const payload = {
            symbol,
            timeframe,
            horizonBars,
            lookbackBars,
            event,
            targetXs: [...X_PRESETS],
        };

        const fetchSurface = async () => {
            setSurfaceLoading(true);
            setSurfaceError(null);
            setSurface(null);
            setSurfaceMeta(null);
            try {
                const response = await fetch("/api/probability/surface", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Request failed: ${response.status}`);
                }

                const data = await response.json();
                if (!controller.signal.aborted) {
                    if (isProbabilitySurfaceResponse(data)) {
                        setSurface(data.surface);
                        setSurfaceMeta(data.meta);
                    } else {
                        setSurface(null);
                        setSurfaceMeta(null);
                        setSurfaceError("Invalid surface response");
                    }
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setSurface(null);
                    setSurfaceMeta(null);
                    setSurfaceError("Surface unavailable.");
                }
            } finally {
                if (!controller.signal.aborted) {
                    setSurfaceLoading(false);
                }
            }
        };

        fetchSurface();

        return () => controller.abort();
    }, [
        event,
        horizonBars,
        lookbackBars,
        symbol,
        timeframe,
    ]);

    const statusBadge = useMemo(() => {
        if (probability?.meta.dataSource === "twelvedata") {
            return {
                label: "LIVE (TwelveData)",
                className:
                    "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
            };
        }

        if (probability?.meta.dataSource === "mock") {
            return {
                label: "MOCKED",
                className: "border-gray-700 bg-gray-900/70 text-gray-400",
            };
        }

        return null;
    }, [probability?.meta.dataSource]);

    const runLabel =
        probability?.meta.dataSource === "twelvedata"
            ? "Live run"
            : "Mocked run";

    const eventLabel = event === "touch" ? "Touch" : "End";

    const evMetrics = useMemo(() => {
        if (!probability) {
            return null;
        }
        if (
            !Number.isFinite(rewardR) ||
            !Number.isFinite(riskR) ||
            rewardR <= 0 ||
            riskR <= 0
        ) {
            return null;
        }
        const xValue = probability.meta.targetX;
        const reward = rewardR * xValue;
        const risk = riskR * xValue;
        if (risk === 0) {
            return null;
        }
        const ev =
            probability.prob.up_ge_x * reward -
            probability.prob.down_ge_x * risk;
        const edge = ev / risk;
        return {
            ev,
            edge,
            isPositive: ev >= 0,
        };
    }, [probability, rewardR, riskR]);

    return (
        <section className="mx-auto max-w-6xl space-y-8 px-4 py-8">
            <header className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold text-white">
                            Probability (Now)
                        </h1>
                        <p className="text-gray-400">
                            {event === "touch"
                                ? "Touch event (high/low extremes)."
                                : "By horizon close (END event)."}
                        </p>
                    </div>
                    <span className="rounded-full border border-gray-800 bg-gray-900/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        as_of: {probability?.meta.asOf ?? "--"}
                    </span>
                </div>
            </header>

            <div className="rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20">
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label
                                id="symbol-label"
                                className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                            >
                                Symbol
                            </label>
                            <Select value={symbol} onValueChange={setSymbol}>
                                <SelectTrigger
                                    id="symbol"
                                    aria-labelledby="symbol-label"
                                    className="w-full bg-gray-950 text-white"
                                >
                                    <SelectValue placeholder="Select symbol" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableSymbols.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label
                                id="timeframe-label"
                                className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                            >
                                Timeframe
                            </label>
                            <Select
                                value={timeframe}
                                onValueChange={setTimeframe}
                            >
                                <SelectTrigger
                                    id="timeframe"
                                    aria-labelledby="timeframe-label"
                                    className="w-full bg-gray-950 text-white"
                                >
                                    <SelectValue placeholder="Select timeframe" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableTimeframes.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label
                                    htmlFor="horizon"
                                    className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                                >
                                    Horizon (bars)
                                </label>
                                <Input
                                    id="horizon"
                                    type="number"
                                    min={1}
                                    max={MAX_HORIZON_BARS}
                                    value={horizonBars}
                                    onChange={(event) => {
                                        const value =
                                            event.currentTarget.valueAsNumber;
                                        if (Number.isFinite(value)) {
                                            setHorizonBars(
                                                Math.max(
                                                    1,
                                                    Math.min(
                                                        MAX_HORIZON_BARS,
                                                        value
                                                    )
                                                )
                                            );
                                        }
                                    }}
                                    className="border-gray-800 bg-gray-950 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label
                                    id="lookback-label"
                                    className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                                >
                                    Lookback preset
                                </label>
                                <Select
                                    value={String(lookbackBars)}
                                    onValueChange={(value) =>
                                        setLookbackBars(Number(value))
                                    }
                                >
                                    <SelectTrigger
                                        id="lookback"
                                        aria-labelledby="lookback-label"
                                        className="w-full bg-gray-950 text-white"
                                    >
                                        <SelectValue placeholder="Lookback" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableLookbacks.map((item) => (
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
                            <label
                                htmlFor="target-x"
                                className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                            >
                                Target X
                            </label>
                                <Input
                                    id="target-x"
                                    type="number"
                                    min={1}
                                    max={MAX_TARGET_X}
                                    value={targetX}
                                    onChange={(event) => {
                                        const value =
                                            event.currentTarget.valueAsNumber;
                                        if (Number.isFinite(value)) {
                                            setTargetX(
                                                Math.max(
                                                    1,
                                                    Math.min(
                                                        MAX_TARGET_X,
                                                        value
                                                    )
                                                )
                                            );
                                        }
                                    }}
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
                                                isActive
                                                    ? "secondary"
                                                    : "outline"
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

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label
                                    htmlFor="reward-r"
                                    className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                                >
                                    Reward (R)
                                </label>
                                <Input
                                    id="reward-r"
                                    type="number"
                                    min={0.1}
                                    step={0.1}
                                    value={rewardR}
                                    onChange={(event) => {
                                        const value =
                                            event.currentTarget.valueAsNumber;
                                        if (Number.isFinite(value)) {
                                            setRewardR(Math.max(0.1, value));
                                        }
                                    }}
                                    className="border-gray-800 bg-gray-950 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label
                                    htmlFor="risk-r"
                                    className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                                >
                                    Risk (R)
                                </label>
                                <Input
                                    id="risk-r"
                                    type="number"
                                    min={0.1}
                                    step={0.1}
                                    value={riskR}
                                    onChange={(event) => {
                                        const value =
                                            event.currentTarget.valueAsNumber;
                                        if (Number.isFinite(value)) {
                                            setRiskR(Math.max(0.1, value));
                                        }
                                    }}
                                    className="border-gray-800 bg-gray-950 text-white"
                                />
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
                                    className={
                                        event === "end"
                                            ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                                            : "border-gray-800 bg-gray-950 text-gray-300"
                                    }
                                    onClick={() => setEvent("end")}
                                >
                                    End
                                </Button>
                                {isTouchEnabled ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className={
                                            event === "touch"
                                                ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                                                : "border-gray-800 bg-gray-950 text-gray-300"
                                        }
                                        onClick={() => setEvent("touch")}
                                    >
                                        Touch
                                    </Button>
                                ) : (
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
                                )}
                            </div>
                            {event === "touch" ? (
                                <p className="text-xs text-gray-500">
                                    Up/Down can both occur in Touch mode.
                                </p>
                            ) : null}
                        </div>

                        <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 text-xs text-gray-400">
                            {runLabel} for{" "}
                            <span className="text-gray-200">{symbol}</span> ·
                            <span className="text-gray-200"> {timeframe}</span> ·
                            horizon
                            <span className="text-gray-200">
                                {" "}
                                {horizonBars}
                            </span>
                            {" "}
                            bars · lookback
                            <span className="text-gray-200">
                                {" "}
                                {lookbackBars}
                            </span>{" "}
                            bars.
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold text-white">
                            Results
                        </h2>
                        {probability?.message ? (
                            <p className="text-xs text-amber-200/80">
                                {probability.message}
                            </p>
                        ) : null}
                        {requestError ? (
                            <p className="text-xs text-rose-200/80">
                                {requestError}
                            </p>
                        ) : null}
                        {probability?.meta.wasClamped ? (
                            <p className="text-xs text-amber-200/80">
                                Lookback clamped to {" "}
                                {probability.meta.effectiveLookbackBars} bars
                                (requested {probability.meta.requestedLookbackBars}
                                ).
                            </p>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                        <span>Computed from last completed candle</span>
                        {statusBadge ? (
                            <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusBadge.className}`}
                            >
                                {statusBadge.label}
                            </span>
                        ) : null}
                        {isLoading ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Updating…
                            </span>
                        ) : null}
                    </div>
                </div>
                <div className="rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-white">
                                Probability curve
                            </p>
                            <p className="text-xs text-gray-500">
                                X sweep for {eventLabel.toUpperCase()} event.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-500">
                            {surfaceLoading ? <span>Loading…</span> : null}
                            {surfaceMeta?.sampleCount ? (
                                <span>{surfaceMeta.sampleCount} samples</span>
                            ) : null}
                        </div>
                    </div>
                    <div className="mt-4">
                        {surfaceError ? (
                            <p className="text-xs text-rose-200/80">
                                {surfaceError}
                            </p>
                        ) : null}
                        <ProbabilityMiniCurve
                            surface={
                                surface ?? {
                                    xs: [],
                                    up: [],
                                    down: [],
                                    within: [],
                                }
                            }
                            className="mt-3"
                        />
                    </div>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                    {[
                        {
                            label:
                                event === "touch"
                                    ? "P(touch up ≥ X)"
                                    : "P(up ≥ X)",
                            value: probability?.prob.up_ge_x,
                            tone: "text-emerald-200",
                        },
                        {
                            label:
                                event === "touch"
                                    ? "P(touch down ≥ X)"
                                    : "P(down ≥ X)",
                            value: probability?.prob.down_ge_x,
                            tone: "text-rose-200",
                        },
                        {
                            label:
                                event === "touch"
                                    ? "P(no touch within ±X)"
                                    : "P(within ±X)",
                            value: probability?.prob.within_pm_x,
                            tone: "text-sky-200",
                        },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20"
                        >
                            <p className="text-sm text-gray-400">
                                {item.label}
                            </p>
                            <p
                                className={`mt-4 text-3xl font-semibold ${item.tone}`}
                            >
                                {isLoading && !probability
                                    ? "Updating…"
                                    : formatProbability(item.value)}
                            </p>
                        </div>
                    ))}
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20">
                        <p className="text-sm text-gray-400">
                            Expected Value (X-units)
                        </p>
                        <p
                            className={`mt-4 text-3xl font-semibold ${
                                evMetrics?.isPositive
                                    ? "text-emerald-200"
                                    : "text-rose-200"
                            }`}
                        >
                            {evMetrics
                                ? evMetrics.ev.toFixed(2)
                                : isLoading && !probability
                                ? "Updating…"
                                : "--"}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                            {evMetrics
                                ? `${evMetrics.isPositive ? "Positive" : "Negative"} EV`
                                : "Awaiting data"}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                            EV = X × (RewardR × P(up ≥ X) - RiskR × P(down ≥ X)).
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                            If probabilities are similar, EV/Edge ≈ 0 (neutral).
                        </p>
                    </div>
                    <div className="rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20">
                        <p className="text-sm text-gray-400">Edge</p>
                        <p className="mt-4 text-3xl font-semibold text-sky-200">
                            {evMetrics
                                ? `${(evMetrics.edge * 100).toFixed(2)}%`
                                : isLoading && !probability
                                ? "Updating…"
                                : "--"}
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                            Edge = (RewardR × P(up ≥ X) - RiskR × P(down ≥ X)) /
                            RiskR.
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                            If probabilities are similar, EV/Edge ≈ 0 (neutral).
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProbabilityPage;
