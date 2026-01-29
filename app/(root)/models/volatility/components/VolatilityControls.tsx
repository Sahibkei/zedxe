"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INTERVAL_OPTIONS = [30, 60, 120] as const;
const MAX_DAYS_RANGE = { min: 7, max: 365 };
const EXPIRIES_RANGE = { min: 5, max: 60 };
const X_MIN_RANGE = { min: -2, max: -0.1 };
const X_MAX_RANGE = { min: 0.1, max: 2 };

type VolatilityControlsProps = {
    maxDays: number;
    expiries: number;
    xMin: number;
    xMax: number;
    refreshSeconds: number;
    autoRefresh: boolean;
    onChange: (next: {
        maxDays: number;
        expiries: number;
        xMin: number;
        xMax: number;
        refreshSeconds: number;
        autoRefresh: boolean;
    }) => void;
    onRefresh: () => void;
};

type VolatilityParams = {
    maxDays: number;
    expiries: number;
    xMin: number;
    xMax: number;
    refreshSeconds: number;
    autoRefresh: boolean;
};

const parseInputNumber = (value: string, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const clampValue = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

const normalizeParams = (next: VolatilityParams) => {
    const maxDays = clampValue(next.maxDays, MAX_DAYS_RANGE.min, MAX_DAYS_RANGE.max);
    const expiries = clampValue(next.expiries, EXPIRIES_RANGE.min, EXPIRIES_RANGE.max);
    let xMin = clampValue(next.xMin, X_MIN_RANGE.min, X_MIN_RANGE.max);
    let xMax = clampValue(next.xMax, X_MAX_RANGE.min, X_MAX_RANGE.max);
    if (xMin >= xMax) {
        const swappedMin = Math.min(xMax, X_MIN_RANGE.max);
        const swappedMax = Math.max(xMin, X_MAX_RANGE.min);
        xMin = clampValue(swappedMin, X_MIN_RANGE.min, X_MIN_RANGE.max);
        xMax = clampValue(swappedMax, X_MAX_RANGE.min, X_MAX_RANGE.max);
        if (xMin >= xMax) {
            xMax = clampValue(xMin + 0.1, X_MAX_RANGE.min, X_MAX_RANGE.max);
        }
    }

    return {
        ...next,
        maxDays,
        expiries,
        xMin,
        xMax,
    };
};

export default function VolatilityControls({
    maxDays,
    expiries,
    xMin,
    xMax,
    refreshSeconds,
    autoRefresh,
    onChange,
    onRefresh,
}: VolatilityControlsProps) {
    const updateParams = (next: VolatilityParams) => onChange(normalizeParams(next));

    return (
        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0b0f14] p-5 text-sm text-slate-200 shadow-xl shadow-black/30 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                        Max DTE (days)
                    </Label>
                    <Input
                        type="number"
                        min={MAX_DAYS_RANGE.min}
                        max={MAX_DAYS_RANGE.max}
                        value={maxDays}
                        onChange={(event) =>
                            updateParams({
                                maxDays: parseInputNumber(event.target.value, maxDays),
                                expiries,
                                xMin,
                                xMax,
                                refreshSeconds,
                                autoRefresh,
                            })
                        }
                        className="border-white/10 bg-[#0f141b] text-white"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                        Expiry slices
                    </Label>
                    <Input
                        type="number"
                        min={EXPIRIES_RANGE.min}
                        max={EXPIRIES_RANGE.max}
                        value={expiries}
                        onChange={(event) =>
                            updateParams({
                                maxDays,
                                expiries: parseInputNumber(event.target.value, expiries),
                                xMin,
                                xMax,
                                refreshSeconds,
                                autoRefresh,
                            })
                        }
                        className="border-white/10 bg-[#0f141b] text-white"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                        x-min ln(K/S)
                    </Label>
                    <Input
                        type="number"
                        step={0.05}
                        min={X_MIN_RANGE.min}
                        max={X_MIN_RANGE.max}
                        value={xMin}
                        onChange={(event) =>
                            updateParams({
                                maxDays,
                                expiries,
                                xMin: parseInputNumber(event.target.value, xMin),
                                xMax,
                                refreshSeconds,
                                autoRefresh,
                            })
                        }
                        className="border-white/10 bg-[#0f141b] text-white"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                        x-max ln(K/S)
                    </Label>
                    <Input
                        type="number"
                        step={0.05}
                        min={X_MAX_RANGE.min}
                        max={X_MAX_RANGE.max}
                        value={xMax}
                        onChange={(event) =>
                            updateParams({
                                maxDays,
                                expiries,
                                xMin,
                                xMax: parseInputNumber(event.target.value, xMax),
                                refreshSeconds,
                                autoRefresh,
                            })
                        }
                        className="border-white/10 bg-[#0f141b] text-white"
                    />
                </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide text-emerald-200/70">
                        Auto refresh
                    </Label>
                    <div className="flex items-center gap-2 text-xs text-slate-200">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(event) =>
                                updateParams({
                                    maxDays,
                                    expiries,
                                    xMin,
                                    xMax,
                                    refreshSeconds,
                                    autoRefresh: event.target.checked,
                                })
                            }
                            className="h-4 w-4 accent-emerald-400"
                        />
                        <select
                            value={refreshSeconds}
                            onChange={(event) =>
                                updateParams({
                                    maxDays,
                                    expiries,
                                    xMin,
                                    xMax,
                                    refreshSeconds: parseInputNumber(
                                        event.target.value,
                                        refreshSeconds
                                    ),
                                    autoRefresh,
                                })
                            }
                            className="rounded-lg border border-white/10 bg-[#0f141b] px-2 py-1 text-xs text-white"
                        >
                            {INTERVAL_OPTIONS.map((interval) => (
                                <option key={interval} value={interval}>
                                    {interval}s
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <Button
                    type="button"
                    onClick={onRefresh}
                    className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                >
                    Refresh
                </Button>
            </div>
        </div>
    );
}
