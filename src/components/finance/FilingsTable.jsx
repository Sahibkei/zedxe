"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const filterOptions = [
    { label: "All", value: "" },
    { label: "10-K", value: "10-K" },
    { label: "10-Q", value: "10-Q" },
    { label: "8-K", value: "8-K" },
    { label: "20-F", value: "20-F" },
    { label: "6-K", value: "6-K" },
];

/**
 * Render SEC filings table with filter pills.
 * @param {object} props - Component props.
 * @param {string} props.symbol - Ticker symbol.
 * @returns {JSX.Element} Filings table.
 */
export default function FilingsTable({ symbol }) {
    const [activeFilter, setActiveFilter] = useState("");

    const queryKey = useMemo(() => ["sec-filings", symbol, activeFilter], [symbol, activeFilter]);
    const { data, isPending, isError, error, refetch } = useQuery({
        queryKey,
        enabled: Boolean(symbol),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        queryFn: async () => {
            if (!symbol) {
                throw new Error("Missing symbol");
            }
            let url = `/api/sec/filings?symbol=${encodeURIComponent(symbol)}`;
            if (activeFilter) {
                url += `&form=${encodeURIComponent(activeFilter)}`;
            }
            const controller = new AbortController();
            const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
            const text = await response.text().catch(() => "");
            if (!response.ok) {
                throw new Error(`SEC filings API ${response.status}: ${text.slice(0, 200)}`);
            }
            try {
                return JSON.parse(text);
            } catch (parseError) {
                throw new Error(parseError?.message || "Invalid JSON");
            }
        },
    });

    const filings = data?.filings ?? [];

    return (
        <div className="space-y-6 rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-white">SEC Filings</h2>
                    <p className="text-sm text-slate-400">Latest submissions from the SEC EDGAR feed.</p>
                </div>
                <div
                    className="inline-flex flex-wrap gap-2 rounded-full border border-white/10 bg-white/5 p-1"
                    role="tablist"
                    aria-label="Filter filings by form"
                >
                    {filterOptions.map((option) => {
                        const isActive = option.value === activeFilter;
                        return (
                            <button
                                key={option.label}
                                type="button"
                                className={cn(
                                    "rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70",
                                    isActive
                                        ? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/50"
                                        : "text-slate-300 hover:bg-white/10"
                                )}
                                onClick={() => setActiveFilter(option.value)}
                                role="tab"
                                aria-selected={isActive}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {isPending && (
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={`skeleton-${idx}`} className="h-10 animate-pulse rounded-lg bg-white/5" />
                    ))}
                </div>
            )}

            {isError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                    <p>Filings failed to load for {symbol?.toUpperCase()}.</p>
                    {error?.message && <p className="mt-1 text-xs text-red-100">{error.message}</p>}
                    <button
                        type="button"
                        className="mt-3 rounded-md border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
                        onClick={() => refetch()}
                    >
                        Retry
                    </button>
                </div>
            )}

            {!isPending && !isError && filings.length === 0 && (
                <p className="text-sm text-slate-400">No filings found.</p>
            )}

            {!isPending && !isError && filings.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-white/10">
                    <table className="min-w-full text-sm text-slate-200">
                        <thead className="bg-white/5 text-xs uppercase text-slate-400">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium">Filed</th>
                                <th className="px-4 py-3 text-left font-medium">Form</th>
                                <th className="px-4 py-3 text-left font-medium">Report Date</th>
                                <th className="px-4 py-3 text-left font-medium">Description</th>
                                <th className="px-4 py-3 text-left font-medium">Links</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filings.map((filing, idx) => (
                                <tr
                                    key={filing.accession ? `${filing.accession}-${filing.filed}` : `filing-${idx}`}
                                    className="border-t border-white/5"
                                >
                                    <td className="px-4 py-3 font-medium text-slate-100">{filing.filed || "—"}</td>
                                    <td className="px-4 py-3">{filing.form || "—"}</td>
                                    <td className="px-4 py-3">{filing.reportDate || "—"}</td>
                                    <td className="px-4 py-3 text-slate-300">{filing.description || "—"}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-3">
                                            {filing.secIndexUrl && (
                                                <a
                                                    href={filing.secIndexUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-sky-300 underline decoration-sky-500/50 underline-offset-4"
                                                >
                                                    Index
                                                </a>
                                            )}
                                            {filing.primaryDocUrl && (
                                                <a
                                                    href={filing.primaryDocUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-sky-300 underline decoration-sky-500/50 underline-offset-4"
                                                >
                                                    Document
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
