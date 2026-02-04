"use client";

import React, { useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StatementGrid, StatementRow, StatementValueType } from "@/lib/stocks/stockProfileV2.types";
import { formatCompactFinancialValue } from "@/utils/formatters";

const formatStatementValue = (value: number | undefined, type: StatementValueType | undefined, currency?: string) => {
    if (value === undefined || Number.isNaN(value)) return "—";

    if (type === "perShare") {
        return value.toFixed(2);
    }

    if (type === "count") {
        return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    }

    return formatCompactFinancialValue(value, currency);
};

export const collectExpandableIds = (rows: StatementRow[]): Set<string> => {
    const ids = new Set<string>();
    const walk = (items: StatementRow[]) => {
        items.forEach((row) => {
            if (row.children?.length) {
                ids.add(row.id);
                walk(row.children);
            }
        });
    };

    walk(rows);
    return ids;
};

const getDisplayScale = (grid?: StatementGrid) => {
    if (!grid) return "";

    const findFirstValue = (rows: StatementRow[]): number | undefined => {
        for (const row of rows) {
            const values = Object.values(row.valuesByColumnKey).filter((val) => val !== undefined);
            if (values.length) return values[0];
            if (row.children?.length) {
                const childVal = findFirstValue(row.children);
                if (childVal !== undefined) return childVal;
            }
        }
        return undefined;
    };

    const sampleValue = findFirstValue(grid.rows);
    if (sampleValue === undefined || Number.isNaN(sampleValue)) return "";

    const magnitude = Math.abs(sampleValue);
    if (magnitude >= 1e12) return "(T)";
    if (magnitude >= 1e9) return "(B)";
    if (magnitude >= 1e6) return "(M)";
    if (magnitude >= 1e3) return "(K)";
    return "";
};

type FinancialStatementTableProps = {
    grid?: StatementGrid;
    fallbackCurrency?: string;
    expanded?: Set<string>;
    onToggleRow?: (id: string) => void;
};

export function FinancialStatementTable({ grid, fallbackCurrency, expanded, onToggleRow }: FinancialStatementTableProps) {
    const currency = grid?.currency ?? fallbackCurrency;
    const displayScale = useMemo(() => getDisplayScale(grid), [grid]);
    const expandedRows = expanded ?? new Set<string>();

    if (!grid || grid.rows.length === 0) {
        return (
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-slate-400">
                No data available for this statement.
            </div>
        );
    }

    const renderRows = (rows: StatementRow[], depth = 0): React.ReactNode[] =>
        rows.flatMap((row) => {
            const hasChildren = Boolean(row.children?.length);
            const isExpanded = expandedRows.has(row.id);
            const paddingLeft = depth * 16 + 16;

            const currentRow = (
                <tr
                    key={`${row.id}-${depth}`}
                    className={cn(
                        "border-b border-white/10 last:border-b-0 transition-colors",
                        "odd:bg-white/5 even:bg-white/0 hover:bg-white/10"
                    )}
                >
                    <td
                        className="sticky left-0 z-10 bg-slate-950/90 px-4 py-2.5 text-left shadow-[4px_0_8px_rgba(0,0,0,0.25)] backdrop-blur"
                        style={{ paddingLeft: `${paddingLeft}px` }}
                    >
                        <div className="flex items-center gap-2">
                            {hasChildren ? (
                                <button
                                    type="button"
                                    onClick={() => onToggleRow?.(row.id)}
                                    className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
                                    aria-expanded={isExpanded}
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-slate-400" />
                                    )}
                                </button>
                            ) : (
                                <span className="inline-block h-6 w-6" />
                            )}
                            <span className={cn("font-medium text-slate-100", depth > 0 && "text-slate-400")}>
                                {row.label}
                            </span>
                        </div>
                    </td>
                    {grid.columns.map((column) => {
                        const value = row.valuesByColumnKey[column.key];
                        const isValueNegative = typeof value === "number" && value < 0;
                        return (
                            <td
                                key={column.key}
                                className={cn(
                                    "px-4 py-2.5 text-right align-middle whitespace-nowrap tabular-nums text-slate-200",
                                    isValueNegative && "text-rose-300"
                                )}
                            >
                                {formatStatementValue(value, row.valueType, currency)}
                            </td>
                        );
                    })}
                </tr>
            );

            const childRows = hasChildren && isExpanded ? renderRows(row.children || [], depth + 1) : [];
            return [currentRow, ...childRows];
        });

    const currencyLabel = currency?.toUpperCase() || "report currency";
    const scaleLabel = displayScale ? ` ${displayScale}` : "";

    return (
        <div className="space-y-2">
            <p className="text-xs text-slate-400">
                All values in {currencyLabel}{scaleLabel} unless stated otherwise
            </p>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 shadow-lg">
                <div className="overflow-x-auto">
                    <table className="min-w-[960px] text-sm">
                        <thead className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur">
                            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                                <th className="sticky left-0 z-20 bg-slate-950/90 px-4 py-3 text-left font-semibold shadow-[4px_0_8px_rgba(0,0,0,0.25)]">
                                    Breakdown
                                </th>
                                {grid.columns.map((column) => (
                                    <th
                                        key={column.key}
                                        className="px-4 py-3 text-right font-semibold whitespace-nowrap"
                                        scope="col"
                                    >
                                        {column.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>{renderRows(grid.rows)}</tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
