"use client";

import { PauseCircle, PlayCircle, TimerReset } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatTime } from "@/utils/formatters";

interface ReplayControlsProps {
    startTimestamp: number;
    endTimestamp: number;
    value: number;
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    onChange: (value: number) => void;
    disabled?: boolean;
}

export const ReplayControls = ({
    startTimestamp,
    endTimestamp,
    value,
    enabled,
    onToggle,
    onChange,
    disabled,
}: ReplayControlsProps) => {
    const clampedValue = Math.min(Math.max(value, startTimestamp), endTimestamp);
    const progress = ((clampedValue - startTimestamp) / Math.max(endTimestamp - startTimestamp, 1)) * 100;

    return (
        <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Replay Mode</p>
                    <h3 className="text-lg font-semibold text-white">Scrub the latest window</h3>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant={enabled ? "default" : "outline"}
                        onClick={() => onToggle(!enabled)}
                        disabled={disabled}
                        className={enabled ? "bg-emerald-600" : undefined}
                    >
                        {enabled ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                        <span className="ml-2">{enabled ? "Pause" : "Replay"}</span>
                    </Button>
                    {enabled ? (
                        <Button size="icon" variant="ghost" onClick={() => onChange(endTimestamp)}>
                            <TimerReset size={16} />
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="space-y-2">
                <input
                    type="range"
                    min={startTimestamp}
                    max={endTimestamp}
                    step={1000}
                    value={clampedValue}
                    onChange={(event) => onChange(Number(event.target.value))}
                    disabled={disabled || !enabled}
                    className="w-full accent-emerald-500"
                />
                <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{formatTime(startTimestamp)}</span>
                    <span className="flex items-center gap-2 text-white">
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-800">
                            <span
                                className="block h-full bg-emerald-500"
                                style={{ width: `${progress}%` }}
                                aria-label="Replay progress"
                            />
                        </span>
                        {formatTime(clampedValue)}
                    </span>
                    <span>{formatTime(endTimestamp)}</span>
                </div>
            </div>
        </div>
    );
};

export default ReplayControls;
