"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic(() => import("react-plotly.js"), {
    ssr: false,
}) as ComponentType<PlotParams>;

type MapLayer = "shipping" | "macro";
type VesselRegion = "global" | "americas" | "europe" | "middle-east" | "asia-pacific";
type MacroMetricKey = "inflation" | "interest" | "gdp" | "unemployment" | "debt";

type VesselPoint = {
    mmsi: number;
    lat: number;
    lon: number;
    shipName: string | null;
    destination: string | null;
    speedKnots: number | null;
    courseDeg: number | null;
    headingDeg: number | null;
    navStatus: number | null;
};

type VesselResponse = {
    updatedAt: string;
    source: "aisstream";
    region: VesselRegion;
    vessels: VesselPoint[];
    stats: {
        tracked: number;
        avgSpeedKnots: number;
        movingCount: number;
    };
    warning?: string;
};

type MacroCountryPoint = {
    iso3: string;
    country: string;
    value: number;
    year: number;
};

type MacroResponse = {
    updatedAt: string;
    source: "worldbank";
    metric: MacroMetricKey;
    label: string;
    unit: string;
    countries: MacroCountryPoint[];
    stats: {
        coverage: number;
        min: number;
        max: number;
        median: number;
    } | null;
    warning?: string;
};

const REGION_OPTIONS: Array<{ key: VesselRegion; label: string }> = [
    { key: "global", label: "Global" },
    { key: "americas", label: "Americas" },
    { key: "europe", label: "Europe" },
    { key: "middle-east", label: "Middle East" },
    { key: "asia-pacific", label: "Asia Pacific" },
];

const MACRO_OPTIONS: Array<{ key: MacroMetricKey; label: string }> = [
    { key: "inflation", label: "Inflation Rate" },
    { key: "interest", label: "Interest Rate" },
    { key: "gdp", label: "GDP" },
    { key: "unemployment", label: "Unemployment Rate" },
    { key: "debt", label: "Government Debt to GDP" },
];

const SHIPPING_REFRESH_MS = 30_000;
const SPEED_MOVE_THRESHOLD_KNOTS = 1.0;

const compactNumber = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
});

const formatRelative = (iso: string | null) => {
    if (!iso) return "n/a";
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) return "n/a";
    const diffMinutes = Math.max(0, Math.floor((Date.now() - parsed) / 60000));
    if (diffMinutes < 1) return "now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours}h ago`;
};

const percentile = (values: number[], p: number) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const formatMacroValue = (metric: MacroMetricKey, value: number) => {
    if (metric === "gdp") return `$${compactNumber.format(value)}`;
    return `${value.toFixed(2)}%`;
};

export default function WorldVesselMap() {
    const [mapLayer, setMapLayer] = useState<MapLayer>("shipping");

    const [selectedRegion, setSelectedRegion] = useState<VesselRegion>("global");
    const [autoRefresh, setAutoRefresh] = useState(true);

    const [selectedMacro, setSelectedMacro] = useState<MacroMetricKey>("inflation");
    const [macroSearch, setMacroSearch] = useState("");

    const [vesselPayload, setVesselPayload] = useState<VesselResponse | null>(null);
    const [vesselStatus, setVesselStatus] = useState<"loading" | "live" | "error">("loading");
    const [vesselError, setVesselError] = useState<string | null>(null);

    const [macroPayload, setMacroPayload] = useState<MacroResponse | null>(null);
    const [macroStatus, setMacroStatus] = useState<"loading" | "live" | "error">("loading");
    const [macroError, setMacroError] = useState<string | null>(null);

    const [refreshNonce, setRefreshNonce] = useState(0);

    useEffect(() => {
        if (mapLayer !== "shipping") return;

        let disposed = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const load = async () => {
            if (!disposed) setVesselStatus((prev) => (prev === "error" ? prev : "loading"));
            try {
                const query = new URLSearchParams({
                    limit: "320",
                    windowSec: "4",
                    region: selectedRegion,
                });
                const response = await fetch(`/api/world/vessels?${query.toString()}`, { cache: "no-store" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = (await response.json()) as VesselResponse;
                if (disposed) return;

                setVesselPayload(data);
                setVesselStatus("live");
                setVesselError(data.warning ?? null);
            } catch (fetchError) {
                if (disposed) return;
                console.error("Failed to load vessel map data", fetchError);
                setVesselStatus("error");
                setVesselError("Unable to reach AISstream right now.");
            }
        };

        load();
        if (autoRefresh) {
            intervalId = setInterval(load, SHIPPING_REFRESH_MS);
        }

        return () => {
            disposed = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, [mapLayer, selectedRegion, autoRefresh, refreshNonce]);

    useEffect(() => {
        if (mapLayer !== "macro") return;

        let disposed = false;

        const loadMacro = async () => {
            if (!disposed) setMacroStatus((prev) => (prev === "error" ? prev : "loading"));
            try {
                const response = await fetch(`/api/world/macro?metric=${selectedMacro}`, { cache: "no-store" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = (await response.json()) as MacroResponse;
                if (disposed) return;

                setMacroPayload(data);
                setMacroStatus("live");
                setMacroError(data.warning ?? null);
            } catch (fetchError) {
                if (disposed) return;
                console.error("Failed to load macro map data", fetchError);
                setMacroStatus("error");
                setMacroError("Macro indicator data is temporarily unavailable.");
            }
        };

        loadMacro();

        return () => {
            disposed = true;
        };
    }, [mapLayer, selectedMacro, refreshNonce]);

    const vessels = useMemo(() => vesselPayload?.vessels ?? [], [vesselPayload]);

    const shippingTopBySpeed = useMemo(
        () =>
            [...vessels]
                .sort((a, b) => (b.speedKnots ?? 0) - (a.speedKnots ?? 0))
                .slice(0, 6),
        [vessels]
    );

    const macroCountries = useMemo(() => macroPayload?.countries ?? [], [macroPayload]);
    const filteredMacroCountries = useMemo(() => {
        const query = macroSearch.trim().toLowerCase();
        if (!query) return macroCountries;
        return macroCountries.filter(
            (country) => country.country.toLowerCase().includes(query) || country.iso3.toLowerCase().includes(query)
        );
    }, [macroCountries, macroSearch]);

    const macroTopCountries = useMemo(
        () => [...filteredMacroCountries].sort((a, b) => b.value - a.value).slice(0, 8),
        [filteredMacroCountries]
    );

    const shippingPlotData = useMemo(() => {
        if (!vessels.length) return [];

        return [
            {
                type: "scattergeo",
                mode: "markers",
                lat: vessels.map((vessel) => vessel.lat),
                lon: vessels.map((vessel) => vessel.lon),
                text: vessels.map((vessel) => {
                    const speed = typeof vessel.speedKnots === "number" ? `${vessel.speedKnots.toFixed(1)} kn` : "--";
                    const destination = vessel.destination ? `<br>Dest: ${vessel.destination}` : "";
                    return `<b>${vessel.shipName || `MMSI ${vessel.mmsi}`}</b><br>MMSI: ${vessel.mmsi}<br>Speed: ${speed}${destination}`;
                }),
                hovertemplate: "%{text}<extra></extra>",
                marker: {
                    size: vessels.map((vessel) => {
                        const speed = vessel.speedKnots ?? 0;
                        return Math.max(4, Math.min(13, 4 + speed * 0.35));
                    }),
                    color: vessels.map((vessel) => vessel.speedKnots ?? 0),
                    colorscale: [
                        [0, "#38bdf8"],
                        [0.55, "#34d399"],
                        [1, "#f59e0b"],
                    ],
                    opacity: 0.88,
                    line: {
                        width: 0.7,
                        color: "#07101f",
                    },
                    colorbar: {
                        title: "kn",
                        thickness: 8,
                        x: 1.01,
                        y: 0.5,
                        len: 0.48,
                        tickcolor: "#8ea3c4",
                        tickfont: { color: "#8ea3c4", size: 10 },
                        titlefont: { color: "#8ea3c4", size: 10 },
                        outlinewidth: 0,
                    },
                },
                hoverlabel: {
                    bgcolor: "#0b1729",
                    bordercolor: "#2d415e",
                    font: { color: "#dbe7ff", size: 12 },
                },
            },
        ];
    }, [vessels]);

    const macroPlotData = useMemo(() => {
        if (!filteredMacroCountries.length || !macroPayload) return [];

        const values = filteredMacroCountries.map((point) => point.value);
        const zmin = percentile(values, 0.05);
        const zmax = percentile(values, 0.95);

        return [
            {
                type: "choropleth",
                locationmode: "ISO-3",
                locations: filteredMacroCountries.map((point) => point.iso3),
                z: filteredMacroCountries.map((point) => point.value),
                customdata: filteredMacroCountries.map((point) => [point.country, point.year]),
                hovertemplate: `<b>%{customdata[0]}</b><br>${macroPayload.label}: %{z:,.2f}${
                    macroPayload.unit === "%" ? "%" : ""
                }<br>Year: %{customdata[1]}<extra></extra>`,
                colorscale: [
                    [0, "#0a1b3a"],
                    [0.25, "#0e2f64"],
                    [0.5, "#164b92"],
                    [0.75, "#1f6dc2"],
                    [1, "#3fa8ff"],
                ],
                zmin,
                zmax: zmax > zmin ? zmax : undefined,
                marker: {
                    line: {
                        color: "#0b1322",
                        width: 0.4,
                    },
                },
                colorbar: {
                    title: macroPayload.unit === "USD" ? "USD" : "%",
                    thickness: 8,
                    x: 1.01,
                    y: 0.5,
                    len: 0.48,
                    tickcolor: "#8ea3c4",
                    tickfont: { color: "#8ea3c4", size: 10 },
                    titlefont: { color: "#8ea3c4", size: 10 },
                    outlinewidth: 0,
                },
                hoverlabel: {
                    bgcolor: "#0b1729",
                    bordercolor: "#2d415e",
                    font: { color: "#dbe7ff", size: 12 },
                },
            },
        ];
    }, [filteredMacroCountries, macroPayload]);

    const plotData = mapLayer === "shipping" ? shippingPlotData : macroPlotData;

    const mapTitle =
        mapLayer === "shipping"
            ? REGION_OPTIONS.find((option) => option.key === selectedRegion)?.label ?? "Global"
            : MACRO_OPTIONS.find((option) => option.key === selectedMacro)?.label ?? "Macro";

    const mapUpdatedAt = mapLayer === "shipping" ? vesselPayload?.updatedAt ?? null : macroPayload?.updatedAt ?? null;

    const mapSummaryCount = mapLayer === "shipping" ? vessels.length : filteredMacroCountries.length;

    const mapStatusText =
        mapLayer === "shipping" ? (autoRefresh ? vesselStatus : "paused") : macroStatus;

    const mapStatusTone =
        mapStatusText === "live"
            ? "text-emerald-300"
            : mapStatusText === "loading"
              ? "text-amber-300"
              : mapStatusText === "paused"
                ? "text-slate-300"
                : "text-red-300";

    const shippingTracked = vesselPayload?.stats.tracked ?? 0;
    const shippingMoving =
        vesselPayload?.stats.movingCount ?? vessels.filter((vessel) => (vessel.speedKnots ?? 0) >= SPEED_MOVE_THRESHOLD_KNOTS).length;
    const shippingAvgSpeed = vesselPayload?.stats.avgSpeedKnots ?? 0;

    return (
        <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-12 xl:items-stretch">
            <div className="xl:col-span-9">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setMapLayer("shipping")}
                            className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                                mapLayer === "shipping"
                                    ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                                    : "border-[#2c3a52] bg-[#0a1323] text-slate-400 hover:text-slate-200"
                            }`}
                        >
                            Shipping
                        </button>
                        <button
                            type="button"
                            onClick={() => setMapLayer("macro")}
                            className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                                mapLayer === "macro"
                                    ? "border-blue-400/60 bg-blue-500/15 text-blue-200"
                                    : "border-[#2c3a52] bg-[#0a1323] text-slate-400 hover:text-slate-200"
                            }`}
                        >
                            Macro
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setRefreshNonce((value) => value + 1)}
                        className="rounded-md border border-[#2c3a52] bg-[#0a1323] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300 transition hover:text-slate-100"
                    >
                        Refresh
                    </button>
                </div>

                <div className="mb-3 flex flex-wrap items-center gap-2">
                    {mapLayer === "shipping"
                        ? REGION_OPTIONS.map((option) => (
                              <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => setSelectedRegion(option.key)}
                                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                                      selectedRegion === option.key
                                          ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200"
                                          : "border-[#2c3a52] bg-[#0a1323] text-slate-400 hover:text-slate-200"
                                  }`}
                              >
                                  {option.label}
                              </button>
                          ))
                        : MACRO_OPTIONS.map((option) => (
                              <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => setSelectedMacro(option.key)}
                                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                                      selectedMacro === option.key
                                          ? "border-blue-400/60 bg-blue-500/15 text-blue-200"
                                          : "border-[#2c3a52] bg-[#0a1323] text-slate-400 hover:text-slate-200"
                                  }`}
                              >
                                  {option.label}
                              </button>
                          ))}

                    {mapLayer === "shipping" ? (
                        <button
                            type="button"
                            onClick={() => setAutoRefresh((prev) => !prev)}
                            className="ml-2 rounded-md border border-[#2c3a52] bg-[#0a1323] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300 transition hover:text-slate-100"
                        >
                            {autoRefresh ? "Pause" : "Resume"}
                        </button>
                    ) : (
                        <div className="ml-auto flex items-center gap-2">
                            <input
                                type="text"
                                value={macroSearch}
                                onChange={(event) => setMacroSearch(event.target.value)}
                                placeholder="Search country..."
                                className="h-8 w-52 rounded-md border border-[#2c3a52] bg-[#0a1323] px-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-400/60 focus:outline-none"
                            />
                            {macroSearch ? (
                                <button
                                    type="button"
                                    onClick={() => setMacroSearch("")}
                                    className="rounded-md border border-[#2c3a52] bg-[#0a1323] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-300 transition hover:text-slate-100"
                                >
                                    Clear
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>

                <div className="relative h-[420px] overflow-hidden rounded-xl border border-[#243145] bg-[#08111f] xl:h-[470px]">
                    {plotData.length ? (
                        <Plot
                            data={plotData}
                            layout={{
                                autosize: true,
                                margin: { l: 0, r: 0, t: 0, b: 0 },
                                paper_bgcolor: "rgba(0,0,0,0)",
                                plot_bgcolor: "rgba(0,0,0,0)",
                                geo: {
                                    projection: { type: "natural earth" },
                                    showland: true,
                                    landcolor: "#152130",
                                    showocean: true,
                                    oceancolor: "#091426",
                                    showlakes: true,
                                    lakecolor: "#091426",
                                    coastlinecolor: "#30415d",
                                    countrycolor: "#30415d",
                                    showcoastlines: true,
                                    showcountries: true,
                                    bgcolor: "rgba(0,0,0,0)",
                                },
                            }}
                            config={{ responsive: true, displayModeBar: false }}
                            style={{ width: "100%", height: "100%" }}
                            useResizeHandler
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center px-6 text-sm text-slate-400">
                            {mapLayer === "shipping"
                                ? vesselStatus === "loading"
                                    ? "Connecting to AISstream..."
                                    : "No vessel positions received yet."
                                : macroStatus === "loading"
                                  ? "Loading macro indicator data..."
                                  : "No macro country data available for this metric."}
                        </div>
                    )}

                    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#08111f]/85 to-transparent" />
                    <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                        <span
                            className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                                mapLayer === "shipping"
                                    ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
                                    : "border-blue-400/30 bg-blue-500/10 text-blue-200"
                            }`}
                        >
                            {mapTitle}
                        </span>
                        <span className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
                            {mapSummaryCount} {mapLayer === "shipping" ? "vessels" : "countries"}
                        </span>
                        <span className="rounded-md border border-[#334155] bg-[#0b172a]/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                            Updated {formatRelative(mapUpdatedAt)}
                        </span>
                    </div>
                </div>
            </div>

            <aside className="flex h-[420px] flex-col gap-3 xl:col-span-3 xl:h-[470px]">
                {mapLayer === "shipping" ? (
                    <>
                        <div className="rounded-xl border border-[#243145] bg-[#0d1729] p-3">
                            <div className="mb-2 flex items-center justify-between text-xs tracking-wider text-slate-400">
                                <span>AISSTREAM STATUS</span>
                                <span className={`font-semibold uppercase ${mapStatusTone}`}>{mapStatusText}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-md border border-[#2a3953] bg-[#0a1324] p-2">
                                    <p className="text-lg font-semibold text-slate-100">{shippingTracked}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Tracked</p>
                                </div>
                                <div className="rounded-md border border-[#2a3953] bg-[#0a1324] p-2">
                                    <p className="text-lg font-semibold text-slate-100">{shippingMoving}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Moving</p>
                                </div>
                                <div className="rounded-md border border-[#2a3953] bg-[#0a1324] p-2">
                                    <p className="text-lg font-semibold text-slate-100">{shippingAvgSpeed.toFixed(1)}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg kn</p>
                                </div>
                            </div>
                            <p className="mt-2 text-[11px] text-slate-500">
                                Updated {formatRelative(vesselPayload?.updatedAt ?? null)} - refresh {SHIPPING_REFRESH_MS / 1000}s
                            </p>
                            {vesselError ? <p className="mt-1 text-[11px] text-amber-300">{vesselError}</p> : null}
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#243145] bg-[#0d1729] p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs tracking-wider text-slate-400">FASTEST VESSELS</p>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top 6</span>
                            </div>
                            <div className="scrollbar-hide min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                {shippingTopBySpeed.length ? (
                                    shippingTopBySpeed.map((vessel) => (
                                        <div
                                            key={`${vessel.mmsi}-${vessel.lat}-${vessel.lon}`}
                                            className="rounded-md border border-[#2a3953] bg-[#0a1324] px-2 py-1.5"
                                        >
                                            <p className="truncate text-xs font-semibold text-slate-100">{vessel.shipName || `MMSI ${vessel.mmsi}`}</p>
                                            <p className="mt-0.5 text-[11px] text-slate-400">
                                                {(vessel.speedKnots ?? 0).toFixed(1)} kn - {vessel.lat.toFixed(2)}, {vessel.lon.toFixed(2)}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-500">Waiting for vessel telemetry...</p>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="rounded-xl border border-[#243145] bg-[#0d1729] p-3">
                            <div className="mb-2 flex items-center justify-between text-xs tracking-wider text-slate-400">
                                <span>MACRO STATUS</span>
                                <span className={`font-semibold uppercase ${mapStatusTone}`}>{mapStatusText}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-md border border-[#2a3953] bg-[#0a1324] p-2">
                                    <p className="text-lg font-semibold text-slate-100">{macroPayload?.stats?.coverage ?? 0}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Coverage</p>
                                </div>
                                <div className="rounded-md border border-[#2a3953] bg-[#0a1324] p-2">
                                    <p className="text-sm font-semibold text-slate-100">
                                        {macroPayload?.stats ? formatMacroValue(selectedMacro, macroPayload.stats.median) : "--"}
                                    </p>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Median</p>
                                </div>
                                <div className="rounded-md border border-[#2a3953] bg-[#0a1324] p-2">
                                    <p className="text-sm font-semibold text-slate-100">
                                        {macroPayload?.stats ? formatMacroValue(selectedMacro, macroPayload.stats.max) : "--"}
                                    </p>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Max</p>
                                </div>
                            </div>
                            <p className="mt-2 text-[11px] text-slate-500">
                                {macroPayload?.label ?? "Macro Indicator"} (World Bank) - updated{" "}
                                {formatRelative(macroPayload?.updatedAt ?? null)}
                            </p>
                            {macroError ? <p className="mt-1 text-[11px] text-amber-300">{macroError}</p> : null}
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[#243145] bg-[#0d1729] p-3">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-xs tracking-wider text-slate-400">
                                    {macroSearch ? "MATCHING COUNTRIES" : "COUNTRIES WITH DATA"}
                                </p>
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    {macroSearch ? `${filteredMacroCountries.length} matches` : "Top 8"}
                                </span>
                            </div>
                            <div className="scrollbar-hide min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                {macroTopCountries.length ? (
                                    macroTopCountries.map((country) => (
                                        <div
                                            key={`${country.iso3}-${country.year}`}
                                            className="rounded-md border border-[#2a3953] bg-[#0a1324] px-2 py-1.5"
                                        >
                                            <p className="truncate text-xs font-semibold text-slate-100">{country.country}</p>
                                            <p className="mt-0.5 text-[11px] text-slate-400">
                                                {formatMacroValue(selectedMacro, country.value)} - {country.year}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-500">
                                        {macroSearch
                                            ? "No countries match this search."
                                            : "No country values available for this metric."}
                                    </p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </aside>
        </div>
    );
}
