import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const compactFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
});

const epsFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const chartColors = ["#38bdf8", "#a855f7", "#22c55e", "#f97316", "#facc15"];

/**
 * Format numeric values based on unit.
 * @param {number|null|undefined} value - Raw value.
 * @param {string} unit - Unit string.
 * @returns {string} Formatted value.
 */
function formatValue(value, unit) {
    if (value === null || value === undefined) return "—";
    if (unit === "USD/share") return epsFormatter.format(value);
    return compactFormatter.format(value);
}

/**
 * Render a financial statement table with selectable metric rows.
 * @param {object} props - Component props.
 * @param {string} props.title - Table title.
 * @param {Array<{ metric: string, values: Array<number|null>, unit: string, isPercent?: boolean }>} props.rows - Table rows.
 * @param {string[]} props.years - Year columns.
 * @param {Set<string>} props.selectedKeys - Selected row keys.
 * @param {(key: string, row: object) => void} props.onToggle - Toggle handler.
 * @returns {JSX.Element} Table component.
 */
function FinancialStatementTable({ title, rows, years, selectedKeys, onToggle }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <span className="text-xs text-slate-400">FY</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="min-w-full text-sm text-slate-200">
                    <thead className="bg-white/5 text-xs uppercase text-slate-400">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium">Metric</th>
                            {years.map((year) => (
                                <th key={year} className="px-4 py-3 text-right font-medium">
                                    {year}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const key = `${title}:${row.metric}`;
                            const isSelected = selectedKeys.has(key);
                            const isSelectable = !row.isPercent;
                            return (
                                <tr
                                    key={row.metric}
                                    role={isSelectable ? "button" : undefined}
                                    tabIndex={isSelectable ? 0 : undefined}
                                    aria-pressed={isSelectable ? isSelected : undefined}
                                    className={`border-t border-white/5 transition ${
                                        isSelectable ? "cursor-pointer hover:bg-white/5" : "cursor-default"
                                    } ${isSelected ? "bg-sky-500/10" : ""}`}
                                    onClick={() => {
                                        if (isSelectable) onToggle(key, row);
                                    }}
                                    onKeyDown={(event) => {
                                        if (!isSelectable) return;
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            onToggle(key, row);
                                        }
                                    }}
                                >
                                    <td className="px-4 py-3 font-medium text-slate-100">
                                        {row.metric}
                                        {!isSelectable && <span className="ml-2 text-xs text-slate-500">%</span>}
                                    </td>
                                    {row.values.map((value, idx) => (
                                        <td key={`${row.metric}-${years[idx]}`} className="px-4 py-3 text-right">
                                            {formatValue(value, row.unit)}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * Fetch and render SEC-based financial tables with chart selection.
 * @param {object} props - Component props.
 * @param {string} props.symbol - Ticker symbol.
 * @returns {JSX.Element} Financials table UI.
 */
export default function FinancialsTable({ symbol }) {
    const [selectedRows, setSelectedRows] = useState(new Map());
    const [showChart, setShowChart] = useState(false);

    const { data, isPending, isError, refetch } = useQuery({
        queryKey: ["sec-companyfacts", symbol],
        enabled: Boolean(symbol),
        queryFn: async () => {
            const response = await fetch(`/api/sec/companyfacts?symbol=${encodeURIComponent(symbol)}`);
            if (!response.ok) {
                throw new Error("Failed to load financials");
            }
            return response.json();
        },
    });

    const selectedList = useMemo(() => Array.from(selectedRows.values()), [selectedRows]);

    const chartData = useMemo(() => {
        if (!data?.years || selectedList.length === 0) return [];
        const yearIndex = data.years;
        const orderedYears = [...yearIndex].reverse();
        return orderedYears.map((year) => {
            const idx = yearIndex.indexOf(year);
            const point = { year };
            selectedList.forEach((row) => {
                point[row.key] = row.values[idx] ?? null;
            });
            return point;
        });
    }, [data, selectedList]);

    const chartUnit = selectedList[0]?.unit ?? "USD";

    const handleToggle = (key, row) => {
        setSelectedRows((prev) => {
            const next = new Map(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.set(key, { ...row, key });
            }
            if (next.size === 0) {
                setShowChart(false);
            } else {
                setShowChart(true);
            }
            return next;
        });
    };

    return (
        <div className="space-y-6 rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-lg">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white">Financial Statements</h2>
                    <p className="text-sm text-slate-400">SEC companyfacts (annual)</p>
                </div>
                {selectedList.length > 0 && (
                    <button
                        type="button"
                        className="rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
                        onClick={() => setShowChart((prev) => !prev)}
                    >
                        Chart ({selectedList.length})
                    </button>
                )}
            </div>

            {isPending && (
                <div className="space-y-4">
                    <div className="h-6 w-1/3 animate-pulse rounded bg-white/10" />
                    <div className="h-52 animate-pulse rounded-lg bg-white/5" />
                    <div className="h-52 animate-pulse rounded-lg bg-white/5" />
                </div>
            )}

            {isError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                    <p>Unable to load SEC financials for {symbol?.toUpperCase()}.</p>
                    <button
                        type="button"
                        className="mt-3 rounded-md border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
                        onClick={() => refetch()}
                    >
                        Retry
                    </button>
                </div>
            )}

            {data && !isPending && !isError && (
                <div className="space-y-6">
                    <FinancialStatementTable
                        title="Income Statement"
                        rows={data.income}
                        years={data.years}
                        selectedKeys={new Set(selectedRows.keys())}
                        onToggle={handleToggle}
                    />
                    <FinancialStatementTable
                        title="Balance Sheet"
                        rows={data.balance}
                        years={data.years}
                        selectedKeys={new Set(selectedRows.keys())}
                        onToggle={handleToggle}
                    />
                    <FinancialStatementTable
                        title="Cash Flow"
                        rows={data.cashflow}
                        years={data.years}
                        selectedKeys={new Set(selectedRows.keys())}
                        onToggle={handleToggle}
                    />

                    {showChart && selectedList.length > 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-100">Selected Metrics</h3>
                                <span className="text-xs text-slate-400">{data.years.length} years</span>
                            </div>
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ left: 8, right: 16, top: 12, bottom: 8 }}>
                                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} axisLine={false} />
                                        <YAxis
                                            stroke="#94a3b8"
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => formatValue(value, chartUnit)}
                                        />
                                        <Tooltip
                                            formatter={(value, name) => {
                                                const row = selectedList.find((item) => item.key === name);
                                                return [formatValue(value, row?.unit), row?.metric ?? name];
                                            }}
                                            contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none" }}
                                            labelStyle={{ color: "#e2e8f0" }}
                                        />
                                        <Legend />
                                        {selectedList.map((row, idx) => (
                                            <Line
                                                key={row.key}
                                                type="monotone"
                                                dataKey={row.key}
                                                name={row.metric}
                                                stroke={chartColors[idx % chartColors.length]}
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
