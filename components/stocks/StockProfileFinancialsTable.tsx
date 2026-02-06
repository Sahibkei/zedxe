"use client";

import { useMemo, useState } from "react";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import type { FinancialStatement } from "@/src/features/stock-profile-v2/contract/types";

const statementOptions = [
    { key: "income", label: "Income Statement" },
    { key: "balance", label: "Balance Sheet" },
    { key: "cashflow", label: "Cash Flow" },
] as const;

type StatementKey = (typeof statementOptions)[number]["key"];

const formatCompact = (value: number) =>
    value.toLocaleString("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
    });

const formatCurrency = (value: number, currency: string) =>
    value.toLocaleString("en-US", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
    });

const formatValue = (
    value: number,
    format: FinancialStatement["rows"][number]["format"],
    currency: string,
) => {
    if (format === "percent") return `${value.toFixed(1)}%`;
    if (format === "ratio") return value.toFixed(2);
    return formatCurrency(value, currency);
};

const buildChartData = (statement: FinancialStatement, selectedKeys: string[]) => {
    return statement.columns.map((column, columnIndex) => {
        const point: Record<string, string | number | null> = { label: column.label };
        statement.rows.forEach((row) => {
            if (!selectedKeys.includes(row.key)) return;
            const value = row.values[columnIndex];
            point[row.key] = value ?? null;
        });
        return point;
    });
};

const StockProfileFinancialsTable = ({
    symbol,
    statements,
}: {
    symbol: string;
    statements: FinancialStatement[];
}) => {
    const [activeStatement, setActiveStatement] = useState<StatementKey>("income");
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [isChartOpen, setIsChartOpen] = useState(false);

    const statement = useMemo(
        () => statements.find((item) => item.statement === activeStatement) ?? statements[0],
        [statements, activeStatement],
    );

    if (!statement) {
        return (
            <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl">
                <p className="text-sm text-slate-400">Financial statement data unavailable.</p>
            </div>
        );
    }

    const selectedRows = useMemo(
        () => statement.rows.filter((row) => selectedKeys.includes(row.key)),
        [statement.rows, selectedKeys],
    );

    const chartData = useMemo(
        () => buildChartData(statement, selectedKeys),
        [statement, selectedKeys],
    );

    const toggleRow = (row: FinancialStatement["rows"][number]) => {
        if (!row.selectable) return;
        setSelectedKeys((prev) =>
            prev.includes(row.key) ? prev.filter((key) => key !== row.key) : [...prev, row.key].slice(0, 5),
        );
    };

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2432] pb-4">
                <div className="flex flex-wrap items-center gap-2">
                    {statementOptions.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => {
                                setActiveStatement(option.key);
                                setSelectedKeys([]);
                            }}
                            className={cn(
                                "rounded-full px-4 py-2 text-xs font-semibold transition",
                                activeStatement === option.key
                                    ? "bg-[#10151d] text-slate-100 shadow"
                                    : "text-slate-400 hover:bg-[#10151d] hover:text-slate-200",
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => setIsChartOpen(true)}
                    disabled={selectedKeys.length === 0}
                    className={cn(
                        "rounded-full border px-4 py-2 text-xs font-semibold transition",
                        selectedKeys.length === 0
                            ? "cursor-not-allowed border-[#1c2432] text-slate-500"
                            : "border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10",
                    )}
                >
                    Chart ({selectedKeys.length})
                </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
                Click rows to select metrics for charting (numeric values only).
            </p>

            <div className="mt-4 overflow-x-auto">
                <table className="min-w-[1100px] w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="sticky left-0 z-10 bg-[#0d1117] px-4 py-3">Metric</th>
                            {statement.columns.map((column) => (
                                <th key={column.date} className="px-4 py-3">
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c2432]">
                        {statement.rows.map((row) => {
                            const isSelected = selectedKeys.includes(row.key);
                            const isSection = Boolean(row.section);
                            return (
                                <tr
                                    key={`${statement.statement}-${row.key}`}
                                    onClick={() => toggleRow(row)}
                                    className={cn(
                                        "text-slate-300 transition",
                                        row.selectable ? "cursor-pointer hover:bg-[#10151d]" : "text-slate-500",
                                        isSelected ? "bg-emerald-500/10" : "",
                                    )}
                                >
                                    <td className="sticky left-0 bg-[#0d1117] px-4 py-3 font-medium">
                                        {row.selectable && (
                                            <span
                                                className={cn(
                                                    "mr-2 inline-flex h-2.5 w-2.5 rounded-full border",
                                                    isSelected ? "border-emerald-400 bg-emerald-400" : "border-slate-600",
                                                )}
                                            />
                                        )}
                                        <span
                                            className={cn(isSection ? "text-slate-200" : "text-slate-300")}
                                            style={row.indent ? { paddingLeft: `${row.indent * 12}px` } : undefined}
                                        >
                                            {row.label}
                                        </span>
                                    </td>
                                    {row.values.map((value, index) => (
                                        <td key={`${row.key}-${index}`} className="px-4 py-3">
                                            {value === null ? "—" : formatValue(value, row.format, statement.currency)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {isChartOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Financial statement chart"
                >
                    <div className="w-full max-w-4xl rounded-2xl border border-[#1c2432] bg-[#0b0f14] p-6 shadow-2xl">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-mono uppercase tracking-wide text-slate-500">
                                    Financial Statements
                                </p>
                                <h3 className="mt-1 text-lg font-semibold text-slate-100">
                                    {symbol} – Chart
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsChartOpen(false)}
                                className="rounded-full border border-[#1c2432] px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                            >
                                Close
                            </button>
                        </div>

                        <div className="mt-4 rounded-xl border border-[#1c2432] bg-[#0d1117]/70 p-4">
                            {selectedRows.length === 0 ? (
                                <p className="text-sm text-slate-400">
                                    Select up to 5 metrics from the table to visualize trends.
                                </p>
                            ) : (
                                <div className="h-80 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid stroke="#1c2432" strokeDasharray="3 3" />
                                            <XAxis dataKey="label" stroke="#94a3b8" />
                                            <YAxis
                                                stroke="#94a3b8"
                                                tickFormatter={(value) => formatCompact(Number(value))}
                                            />
                                            <Tooltip
                                                formatter={(value) => formatCompact(Number(value))}
                                                labelStyle={{ color: "#e2e8f0" }}
                                                contentStyle={{ background: "#0b0f14", borderColor: "#1c2432" }}
                                            />
                                            {selectedRows.map((row, index) => (
                                                <Line
                                                    key={row.key}
                                                    type="monotone"
                                                    dataKey={row.key}
                                                    stroke={["#22d3ee", "#34d399", "#f97316", "#818cf8", "#facc15"][index]}
                                                    strokeWidth={2}
                                                    dot={false}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {selectedRows.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {selectedRows.map((row) => (
                                    <button
                                        key={row.key}
                                        type="button"
                                        onClick={() => toggleRow(row)}
                                        className="rounded-full border border-[#1c2432] px-3 py-1 text-xs text-slate-300 hover:border-emerald-400"
                                    >
                                        {row.label} ✕
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockProfileFinancialsTable;
