"use client";

import { useMemo } from "react";
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

    if (!normalizedSymbol) {
        return <p className="text-sm text-muted-foreground">No symbol selected.</p>;
    }

    return (
        <div className="space-y-3">
            {isPending && (
                <div className="space-y-3">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-muted/50" />
                    <div className="h-16 animate-pulse rounded-lg bg-muted/30" />
                    <div className="h-16 animate-pulse rounded-lg bg-muted/30" />
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

            {!isPending && !isError && filings.length === 0 && (
                <p className="text-sm text-muted-foreground">No filings available.</p>
            )}

            {!isPending && !isError && filings.length > 0 && (
                <div className="space-y-3">
                    {filings.map((filing, idx) => (
                        <div
                            key={`${filing.accessionNumber || filing.formType}-${idx}`}
                            className="rounded-lg border border-border/60 bg-card/60 p-3 text-sm"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold">{filing.formType}</span>
                                <span className="text-muted-foreground">
                                    {formatDate(filing.filedAt)}
                                    {filing.periodEnd ? ` · Period end ${formatDate(filing.periodEnd)}` : ""}
                                </span>
                            </div>
                            <p className="text-muted-foreground">
                                {filing.companyName || filing.description || ""}
                            </p>
                            {filing.link && (
                                <a
                                    href={filing.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 underline text-sm"
                                >
                                    View filing
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
