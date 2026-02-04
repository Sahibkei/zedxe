"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

function formatDate(value) {
    if (!value) return "";
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(isDateOnly ? `${value}T00:00:00Z` : value);
    if (Number.isNaN(parsed.getTime())) return value;
    if (isDateOnly) {
        return parsed.toLocaleDateString(undefined, { timeZone: "UTC" });
    }
    return parsed.toLocaleDateString();
}

function formatDateOrDash(value) {
    const formatted = formatDate(value);
    return formatted || "—";
}

function buildFilingsUrl(symbol, formFilter) {
    const params = new URLSearchParams();
    params.set("symbol", symbol);
    if (formFilter) {
        params.set("form", formFilter);
    }
    return `/api/sec/filings?${params.toString()}`;
}

export default function FilingsTable({ symbol, form }) {
    const normalizedSymbol = String(symbol || "").trim().toUpperCase();
    const normalizedForm = String(form || "").trim().toUpperCase();
    const [activeForm, setActiveForm] = useState(normalizedForm || "All");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState("newest");

    const { data, isPending, isError, error, refetch } = useQuery({
        queryKey: ["sec-filings", normalizedSymbol, normalizedForm],
        enabled: Boolean(normalizedSymbol),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
        queryFn: async ({ signal }) => {
            const url = buildFilingsUrl(normalizedSymbol, normalizedForm || "");
            const bustedUrl = `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`;
            let status;
            try {
                const res = await fetch(bustedUrl, {
                    signal,
                    cache: "no-store",
                    headers: {
                        "Cache-Control": "no-cache",
                    },
                });
                status = res.status;
                const text = await res.text();
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
                }
                if (!text) {
                    throw new Error(`Empty response body (HTTP ${res.status})`);
                }
                let data;
                try {
                    data = JSON.parse(text);
                } catch (parseError) {
                    throw new Error(`Invalid JSON (HTTP ${res.status})`);
                }
                if (!data || !Array.isArray(data.filings)) {
                    throw new Error("Bad payload: missing filings[]");
                }
                return data;
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error("[filings] fetch failed", {
                    symbol: normalizedSymbol,
                    url: bustedUrl,
                    status,
                    message,
                });
                throw err;
            }
        },
    });

    const filings = useMemo(() => data?.filings ?? [], [data]);
    const formOptions = useMemo(() => {
        const available = new Set(
            filings.map((filing) => String(filing.formType || "").trim().toUpperCase()).filter(Boolean)
        );
        const order = ["10-K", "10-Q", "8-K", "4", "13F"];
        return ["All", ...order.filter((formType) => available.has(formType))];
    }, [filings]);

    useEffect(() => {
        if (!formOptions.includes(activeForm)) {
            setActiveForm("All");
        }
    }, [activeForm, formOptions]);

    const filteredFilings = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const filtered = filings.filter((filing) => {
            const formType = String(filing.formType || "").trim().toUpperCase();
            if (activeForm !== "All" && formType !== activeForm) {
                return false;
            }
            if (!normalizedSearch) return true;
            const description = String(filing.description || filing.companyName || "").toLowerCase();
            return description.includes(normalizedSearch);
        });
        const sorted = [...filtered];
        sorted.sort((a, b) => {
            const aTime = Date.parse(a.filedAt || "") || 0;
            const bTime = Date.parse(b.filedAt || "") || 0;
            return sortOrder === "oldest" ? aTime - bTime : bTime - aTime;
        });
        return sorted;
    }, [activeForm, filings, searchTerm, sortOrder]);

    if (!normalizedSymbol) {
        return <p className="text-sm text-muted-foreground">No symbol selected.</p>;
    }

    return (
        <div className="space-y-3">
            {isPending && (
                <div className="space-y-3">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-muted/50" />
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs uppercase text-muted-foreground">
                                    <th className="px-3 py-2">Form</th>
                                    <th className="px-3 py-2">Filed</th>
                                    <th className="px-3 py-2">Period End</th>
                                    <th className="px-3 py-2">Description</th>
                                    <th className="px-3 py-2 text-right">Link</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 6 }).map((_, idx) => (
                                    <tr key={`filing-skeleton-${idx}`} className="border-t">
                                        <td className="px-3 py-3">
                                            <div className="h-5 w-12 animate-pulse rounded-full bg-muted/40" />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="h-4 w-20 animate-pulse rounded bg-muted/40" />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="h-4 w-20 animate-pulse rounded bg-muted/40" />
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="h-4 w-48 animate-pulse rounded bg-muted/40" />
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <div className="ml-auto h-7 w-16 animate-pulse rounded bg-muted/40" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                    <p>Filings failed to load — {error?.message}</p>
                    <button
                        type="button"
                        className="mt-3 rounded-md border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
                        onClick={() => refetch()}
                    >
                        Retry
                    </button>
                </div>
            )}

            {!isPending && !isError && (
                <div className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Form filters">
                            {formOptions.map((formOption) => {
                                const isActive = activeForm === formOption;
                                return (
                                    <button
                                        key={formOption}
                                        type="button"
                                        aria-pressed={isActive}
                                        onClick={() => setActiveForm(formOption)}
                                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                            isActive
                                                ? "border-primary/50 bg-primary/15 text-primary"
                                                : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted"
                                        }`}
                                    >
                                        {formOption}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Search description"
                                className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-56"
                            />
                            <select
                                value={sortOrder}
                                onChange={(event) => setSortOrder(event.target.value)}
                                className="h-9 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            >
                                <option value="newest">Filed (newest)</option>
                                <option value="oldest">Filed (oldest)</option>
                            </select>
                        </div>
                    </div>

                    {filteredFilings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No filings found for the selected filter.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-border/60">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs uppercase text-muted-foreground">
                                        <th className="px-3 py-2">Form</th>
                                        <th className="px-3 py-2">Filed</th>
                                        <th className="px-3 py-2">Period End</th>
                                        <th className="px-3 py-2">Description</th>
                                        <th className="px-3 py-2 text-right">Link</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFilings.map((filing, idx) => {
                                        const link = filing.secIndexUrl || filing.link || null;
                                        const isDisabled = !link;
                                        return (
                                            <tr
                                                key={`${filing.accessionNumber || filing.formType}-${idx}`}
                                                className="border-t border-border/60"
                                            >
                                                <td className="px-3 py-3">
                                                    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-semibold text-foreground">
                                                        {filing.formType || "—"}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-muted-foreground">
                                                    {formatDateOrDash(filing.filedAt)}
                                                </td>
                                                <td className="px-3 py-3 text-muted-foreground">
                                                    {formatDateOrDash(filing.reportDate || filing.periodEnd)}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className="block max-w-[220px] truncate text-muted-foreground sm:max-w-none sm:whitespace-normal">
                                                        {filing.description || filing.companyName || "—"}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    {isDisabled ? (
                                                        <button
                                                            type="button"
                                                            disabled
                                                            title="Link unavailable"
                                                            className="cursor-not-allowed rounded-md border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground/70"
                                                        >
                                                            View
                                                        </button>
                                                    ) : (
                                                        <a
                                                            href={link}
                                                            target="_blank"
                                                            rel="noreferrer noopener"
                                                            className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
                                                        >
                                                            View
                                                        </a>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
