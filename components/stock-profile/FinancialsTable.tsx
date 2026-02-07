"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StatementGrid, StatementRow } from "@/lib/stocks/stockProfileV2.types";
import { formatStatementValue, isFiniteNumber } from "@/components/stock-profile/formatters";

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

export const flattenRows = (rows: StatementRow[]): StatementRow[] => {
    return rows.flatMap((row) => [row, ...(row.children?.length ? flattenRows(row.children) : [])]);
};

const hasNumericValues = (row: StatementRow, columnKeys: string[]) => {
    let numericCount = 0;
    for (const key of columnKeys) {
        if (isFiniteNumber(row.valuesByColumnKey[key])) {
            numericCount += 1;
            if (numericCount >= 2) return true;
        }
    }
    return false;
};

type FinancialsTableProps = {
    grid?: StatementGrid;
    fallbackCurrency?: string;
    selectedIds: Set<string>;
    expandedIds: Set<string>;
    onToggleExpand: (rowId: string) => void;
    onToggleSelect: (row: StatementRow) => void;
};

export default function FinancialsTable({
    grid,
    fallbackCurrency,
    selectedIds,
    expandedIds,
    onToggleExpand,
    onToggleSelect,
}: FinancialsTableProps) {
    if (!grid || grid.rows.length === 0) {
        return (
            <div className="rounded-xl border border-border/80 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                Financial statement data unavailable.
            </div>
        );
    }

    const currency = grid.currency || fallbackCurrency;
    const columnKeys = grid.columns.map((column) => column.key);

    const renderRows = (rows: StatementRow[], depth = 0): ReactNode[] => {
        return rows.flatMap((row) => {
            const hasChildren = Boolean(row.children?.length);
            const isExpanded = expandedIds.has(row.id);
            const canSelect = hasNumericValues(row, columnKeys);
            const isSelected = selectedIds.has(row.id);

            const baseRow = (
                <tr
                    key={`${row.id}-${depth}`}
                    className={cn(
                        "border-b border-border/40 transition-colors",
                        canSelect ? "cursor-pointer hover:bg-muted/20" : "cursor-default",
                        isSelected && "bg-primary/10"
                    )}
                    onClick={() => canSelect && onToggleSelect(row)}
                >
                    <td
                        className="sticky left-0 z-10 bg-card/95 px-3 py-2.5 text-left text-sm shadow-[3px_0_8px_rgba(0,0,0,0.35)]"
                        style={{ paddingLeft: `${depth * 18 + 14}px` }}
                    >
                        <div className="flex items-center gap-2">
                            {hasChildren ? (
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onToggleExpand(row.id);
                                    }}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-border/60 bg-muted/20"
                                    aria-label={isExpanded ? "Collapse row" : "Expand row"}
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                </button>
                            ) : (
                                <span className="inline-block h-5 w-5" />
                            )}

                            <span className={cn("font-medium text-foreground", depth > 0 && "text-muted-foreground")}>{row.label}</span>
                            {canSelect ? (
                                <span
                                    className={cn(
                                        "rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                                        isSelected
                                            ? "border-primary/50 bg-primary/15 text-primary"
                                            : "border-border/70 text-muted-foreground"
                                    )}
                                >
                                    {isSelected ? "Selected" : "Chart"}
                                </span>
                            ) : null}
                        </div>
                    </td>

                    {grid.columns.map((column) => {
                        const value = row.valuesByColumnKey[column.key];
                        const negative = typeof value === "number" && value < 0;
                        return (
                            <td
                                key={`${row.id}-${column.key}`}
                                className={cn(
                                    "px-3 py-2.5 text-right text-sm tabular-nums whitespace-nowrap",
                                    negative ? "text-rose-300" : "text-foreground"
                                )}
                            >
                                {formatStatementValue(value, row.valueType, currency)}
                            </td>
                        );
                    })}
                </tr>
            );

            const children = hasChildren && isExpanded ? renderRows(row.children || [], depth + 1) : [];
            return [baseRow, ...children];
        });
    };

    return (
        <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Click numeric rows to add/remove from chart.
            </div>
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
                <div className="overflow-x-auto">
                    <table
                        className="text-sm"
                        style={{ minWidth: `${Math.max(980, 220 + grid.columns.length * 136)}px` }}
                    >
                        <thead className="sticky top-0 z-20 bg-card">
                            <tr className="border-b border-border/70 text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="sticky left-0 z-20 bg-card px-3 py-3 text-left font-semibold shadow-[3px_0_8px_rgba(0,0,0,0.35)]">
                                    Breakdown
                                </th>
                                {grid.columns.map((column) => (
                                    <th key={column.key} className="px-3 py-3 text-right font-semibold whitespace-nowrap">
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
