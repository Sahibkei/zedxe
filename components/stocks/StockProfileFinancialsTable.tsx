"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { FinancialStatement } from "@/src/server/market-data/provider";

const statementOptions = [
    { key: "income", label: "Income Statement" },
    { key: "balance", label: "Balance Sheet" },
    { key: "cashflow", label: "Cash Flow" },
] as const;

type ChartType = "line" | "bar" | "area";

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

const buildChartData = (statement: FinancialStatement, selectedKeys: string[]) => {
    return statement.columns.map((column, columnIndex) => {
        const point: Record<string, string | number | null> = { label: column };
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
    statement,
    data,
    isLoading,
    error,
    onStatementChange,
}: {
    symbol: string;
    statement: FinancialStatement["statement"];
    data: FinancialStatement | null;
    isLoading?: boolean;
    error?: string;
    onStatementChange: (statement: FinancialStatement["statement"]) => void;
}) => {
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [isChartOpen, setIsChartOpen] = useState(false);
    const [chartType, setChartType] = useState<ChartType>("line");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (!isChartOpen) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsChartOpen(false);
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isChartOpen]);

    useEffect(() => {
        setSelectedKeys([]);
    }, [statement]);

    const rows = useMemo(() => {
        if (!data) return [];
        const term = searchTerm.trim().toLowerCase();
        if (!term) return data.rows;
        return data.rows.filter((row) => row.label.toLowerCase().includes(term));
    }, [data, searchTerm]);

    const displayRows = useMemo(() => {
        const result: Array<(FinancialStatement["rows"][number] & { isGroup?: boolean })> = [];
        let currentGroup = "";
        rows.forEach((row) => {
            if (row.group && row.group !== currentGroup) {
                currentGroup = row.group;
                result.push({
                    key: `${row.group}-header`,
                    label: row.group,
                    values: Array(data?.columns.length ?? 0).fill(null),
                    isGroup: true,
                });
            }
            result.push(row);
        });
        return result;
    }, [rows, data?.columns.length]);

    const selectedRows = useMemo(
        () => rows.filter((row) => selectedKeys.includes(row.key)),
        [rows, selectedKeys],
    );

    const chartData = useMemo(
        () => (data ? buildChartData(data, selectedKeys) : []),
        [data, selectedKeys],
    );

    const toggleRow = (row: FinancialStatement["rows"][number]) => {
        if (!row.values.some((value) => typeof value === "number")) return;
        setSelectedKeys((prev) => {
            if (prev.includes(row.key)) return prev.filter((key) => key !== row.key);
            if (prev.length >= 6) {
                toast("You can compare up to 6 metrics at a time.");
                return prev;
            }
            return [...prev, row.key];
        });
    };

    if (isLoading) {
        return (
            <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl">
                <p className="text-sm text-slate-400">Loading financial statements...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl">
                <p className="text-sm text-slate-400">{error ?? "Financial statement data unavailable."}</p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1c2432] pb-4">
                <div className="flex flex-wrap items-center gap-2">
                    {statementOptions.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => onStatementChange(option.key)}
                            className={cn(
                                "rounded-full px-4 py-2 text-xs font-semibold transition",
                                statement === option.key
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                    Click rows to select metrics for charting (numeric values only).
                </p>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Filter metrics..."
                    className="rounded-lg border border-[#1c2432] bg-[#0b0f14] px-3 py-2 text-xs text-slate-300 outline-none focus:border-emerald-500/40"
                />
            </div>

            <div className="mt-4 overflow-x-auto">
                <table className="min-w-[1100px] w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="sticky left-0 z-10 bg-[#0d1117] px-4 py-3">Metric</th>
                            {data.columns.map((column) => (
                                <th key={column} className="px-4 py-3">
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c2432]">
                        {displayRows.map((row) => {
                            const isGroup = (row as { isGroup?: boolean }).isGroup;
                            const isSelected = selectedKeys.includes(row.key);
                            return (
                                <tr
                                    key={`${statement}-${row.key}`}
                                    onClick={() => (!isGroup ? toggleRow(row) : undefined)}
                                    className={cn(
                                        "text-slate-300 transition",
                                        isGroup
                                            ? "bg-[#10151d] text-slate-200"
                                            : row.values.some((value) => typeof value === "number")
                                              ? "cursor-pointer hover:bg-[#10151d]"
                                              : "text-slate-500",
                                        isSelected ? "bg-emerald-500/10" : "",
                                    )}
                                >
                                    <td className="sticky left-0 bg-[#0d1117] px-4 py-3 font-medium">
                                        {!isGroup && row.values.some((value) => typeof value === "number") && (
                                            <span
                                                className={cn(
                                                    "mr-2 inline-flex h-2.5 w-2.5 rounded-full border",
                                                    isSelected ? "border-emerald-400 bg-emerald-400" : "border-slate-600",
                                                )}
                                            />
                                        )}
                                        <span className="text-slate-300">{row.label}</span>
                                    </td>
                                    {row.values.map((value, index) => (
                                        <td key={`${row.key}-${index}`} className="px-4 py-3">
                                            {value === null
                                                ? "—"
                                                : formatCurrency(value, data.currency ?? "USD")}
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
                    onClick={() => setIsChartOpen(false)}
                >
                    <div
                        className="relative w-full max-w-4xl rounded-2xl border border-[#1c2432] bg-[#0b0f14] p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-mono uppercase tracking-wide text-slate-500">
                                    Financial Statements
                                </p>
                                <h3 className="mt-1 text-lg font-semibold text-slate-100">
                                    {symbol} – Chart
                                </h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {(["line", "bar", "area"] as ChartType[]).map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setChartType(type)}
                                        className={cn(
                                            "rounded-full border px-3 py-1 text-xs",
                                            chartType === type
                                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                                : "border-[#1c2432] text-slate-400",
                                        )}
                                    >
                                        {type.toUpperCase()}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setIsChartOpen(false)}
                                    className="rounded-full border border-[#1c2432] px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="relative mt-4 rounded-xl border border-[#1c2432] bg-[#0d1117]/70 p-4">
                            {selectedRows.length === 0 ? (
                                <p className="text-sm text-slate-400">
                                    Select up to 6 metrics from the table to visualize trends.
                                </p>
                            ) : (
                                <div className="h-80 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        {chartType === "bar" ? (
                                            <BarChart data={chartData}>
                                                <CartesianGrid stroke="#1c2432" strokeDasharray="3 3" />
                                                <XAxis dataKey="label" stroke="#94a3b8" />
                                                <YAxis stroke="#94a3b8" tickFormatter={(value) => formatCompact(Number(value))} />
                                                <Tooltip
                                                    formatter={(value) => formatCompact(Number(value))}
                                                    labelStyle={{ color: "#e2e8f0" }}
                                                    contentStyle={{ background: "#0b0f14", borderColor: "#1c2432" }}
                                                />
                                                {selectedRows.map((row, index) => (
                                                    <Bar
                                                        key={row.key}
                                                        dataKey={row.key}
                                                        fill={
                                                            ["#22d3ee", "#34d399", "#f97316", "#818cf8", "#facc15", "#f472b6"][
                                                                index
                                                            ]
                                                        }
                                                    />
                                                ))}
                                            </BarChart>
                                        ) : chartType === "area" ? (
                                            <AreaChart data={chartData}>
                                                <CartesianGrid stroke="#1c2432" strokeDasharray="3 3" />
                                                <XAxis dataKey="label" stroke="#94a3b8" />
                                                <YAxis stroke="#94a3b8" tickFormatter={(value) => formatCompact(Number(value))} />
                                                <Tooltip
                                                    formatter={(value) => formatCompact(Number(value))}
                                                    labelStyle={{ color: "#e2e8f0" }}
                                                    contentStyle={{ background: "#0b0f14", borderColor: "#1c2432" }}
                                                />
                                                {selectedRows.map((row, index) => (
                                                    <Area
                                                        key={row.key}
                                                        dataKey={row.key}
                                                        type="monotone"
                                                        stroke={
                                                            ["#22d3ee", "#34d399", "#f97316", "#818cf8", "#facc15", "#f472b6"][
                                                                index
                                                            ]
                                                        }
                                                        fillOpacity={0.2}
                                                        fill={
                                                            ["#22d3ee", "#34d399", "#f97316", "#818cf8", "#facc15", "#f472b6"][
                                                                index
                                                            ]
                                                        }
                                                    />
                                                ))}
                                            </AreaChart>
                                        ) : (
                                            <LineChart data={chartData}>
                                                <CartesianGrid stroke="#1c2432" strokeDasharray="3 3" />
                                                <XAxis dataKey="label" stroke="#94a3b8" />
                                                <YAxis stroke="#94a3b8" tickFormatter={(value) => formatCompact(Number(value))} />
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
                                                        stroke={
                                                            ["#22d3ee", "#34d399", "#f97316", "#818cf8", "#facc15", "#f472b6"][
                                                                index
                                                            ]
                                                        }
                                                        strokeWidth={2}
                                                        dot={false}
                                                    />
                                                ))}
                                            </LineChart>
                                        )}
                                    </ResponsiveContainer>
                                </div>
                            )}
                            <span className="pointer-events-none absolute bottom-4 right-4 text-xs font-semibold text-slate-500/60">
                                ZedXe
                            </span>
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
