"use client";

import type { ReactNode } from 'react';
import type { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { TooltipProps } from 'recharts';

type DarkTooltipProps = TooltipProps<ValueType, NameType> & {
    formatLabel?: (label: NameType) => ReactNode;
    formatValue?: (value: ValueType, entry: Payload<ValueType, NameType>) => ReactNode;
};

const defaultFormatLabel = (label: NameType) => (label == null ? '' : String(label));
const defaultFormatValue = (value: ValueType) => (value == null ? 'N/A' : String(value));

export const DarkTooltip = ({
    active,
    payload,
    label,
    formatLabel = defaultFormatLabel,
    formatValue = defaultFormatValue,
}: DarkTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;

    const renderedLabel = formatLabel(label);

    return (
        <div className="bg-slate-950/90 text-slate-100 border border-slate-800 rounded-lg shadow-lg px-3 py-2 text-xs max-w-[220px]">
            {renderedLabel ? <p className="mb-1 font-semibold text-slate-100">{renderedLabel}</p> : null}
            <div className="space-y-1">
                {payload.map((entry, index) => {
                    const key = `${entry.name ?? 'row'}-${index}`;
                    const markerColor = entry.color || '#94a3b8';
                    return (
                        <div key={key} className="grid grid-cols-[8px_1fr_auto] items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: markerColor }} />
                            <span className="truncate text-slate-200">{entry.name ? String(entry.name) : 'Value'}</span>
                            <span className="font-semibold tabular-nums text-slate-100">
                                {formatValue(entry.value, entry)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DarkTooltip;
