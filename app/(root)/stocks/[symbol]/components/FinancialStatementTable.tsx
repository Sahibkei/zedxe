"use client";

import React, { useEffect, useState } from "react";

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

const collectExpandableIds = (rows: StatementRow[]): Set<string> => {
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

export function FinancialStatementTable({ grid, fallbackCurrency }: { grid?: StatementGrid; fallbackCurrency?: string }) {
    const currency = grid?.currency ?? fallbackCurrency;
    const [expanded, setExpanded] = useState<Set<string>>(() => collectExpandableIds(grid?.rows || []));

    useEffect(() => {
        setExpanded(collectExpandableIds(grid?.rows || []));
    }, [grid?.rows]);

    if (!grid || grid.rows.length === 0) {
        return <p className="text-sm text-muted-foreground">No data available.</p>;
    }

    const toggleRow = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const renderRows = (rows: StatementRow[], depth = 0): React.ReactNode[] =>
        rows.flatMap((row) => {
            const hasChildren = Boolean(row.children?.length);
            const isExpanded = expanded.has(row.id);
            const paddingLeft = depth * 16 + 12;

            const currentRow = (
                <tr key={`${row.id}-${depth}`} className="border-b last:border-b-0">
                    <td
                        className="sticky left-0 bg-card px-3 py-2 text-left"
                        style={{ paddingLeft: `${paddingLeft}px` }}
                    >
                        <div className="flex items-center gap-2">
                            {hasChildren ? (
                                <button
                                    type="button"
                                    onClick={() => toggleRow(row.id)}
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                    aria-expanded={isExpanded}
                                    aria-controls={`${row.id}-children`}
                                >
                                    {isExpanded ? "▾" : "▸"}
                                </button>
                            ) : (
                                <span className="inline-block w-3" />
                            )}
                            <span className="font-medium">{row.label}</span>
                        </div>
                    </td>
                    {grid.columns.map((column) => (
                        <td key={column.key} className="px-3 py-2 text-right align-middle whitespace-nowrap">
                            {formatStatementValue(row.valuesByColumnKey[column.key], row.valueType, currency)}
                        </td>
                    ))}
                </tr>
            );

            const childRows = hasChildren && isExpanded ? renderRows(row.children || [], depth + 1) : [];
            return [currentRow, ...childRows];
        });

    return (
        <div className="relative overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="border-b text-muted-foreground">
                        <th className="sticky left-0 bg-card px-3 py-2 text-left font-normal">Breakdown</th>
                        {grid.columns.map((column) => (
                            <th
                                key={column.key}
                                className="px-3 py-2 text-right font-normal whitespace-nowrap"
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
    );
}
