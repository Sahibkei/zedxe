"use client";

import { useMemo, useState } from "react";

import BinanceTvChart, {
    BINANCE_INTERVALS,
    BinanceConnectionStatus,
    BinanceInterval,
} from "@/components/charts/BinanceTvChart";

const BADGE_CLASS: Record<BinanceConnectionStatus, string> = {
    idle: "border-slate-600 bg-slate-700/30 text-slate-200",
    loading: "border-amber-500/50 bg-amber-500/15 text-amber-200",
    connecting: "border-amber-500/50 bg-amber-500/15 text-amber-200",
    connected: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
    reconnecting: "border-orange-500/40 bg-orange-500/15 text-orange-200",
    disconnected: "border-rose-500/40 bg-rose-500/15 text-rose-200",
    error: "border-rose-500/40 bg-rose-500/15 text-rose-200",
};

const STATUS_LABEL: Record<BinanceConnectionStatus, string> = {
    idle: "Idle",
    loading: "Loading",
    connecting: "Connecting",
    connected: "Connected",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
    error: "Error",
};

const fmtPrice = (value: number) =>
    value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BtcUsdtChartPage = () => {
    const [interval, setInterval] = useState<BinanceInterval>("1m");
    const [status, setStatus] = useState<BinanceConnectionStatus>("idle");
    const [lastPrice, setLastPrice] = useState<number | null>(null);
    const [previousClose, setPreviousClose] = useState<number | null>(null);

    const pctChange = useMemo(() => {
        if (lastPrice === null || previousClose === null || previousClose === 0) return null;
        return ((lastPrice - previousClose) / previousClose) * 100;
    }, [lastPrice, previousClose]);

    const changeColor = pctChange === null ? "text-slate-300" : pctChange >= 0 ? "text-emerald-300" : "text-rose-300";

    return (
        <section className="space-y-4">
            <header className="rounded-2xl border border-slate-700/70 bg-gradient-to-r from-[#0b1422] via-[#0e1828] to-[#0b1422] p-4 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.85)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Binance Spot</p>
                        <h1 className="text-2xl font-semibold text-slate-100">BTCUSDT Canvas Chart</h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-lg border border-slate-600/70 bg-[#0e1728] px-3 py-2 text-sm text-slate-200">
                            Symbol: <span className="font-semibold">BTCUSDT</span>
                        </div>

                        <label className="flex items-center gap-2 rounded-lg border border-slate-600/70 bg-[#0e1728] px-3 py-2 text-sm text-slate-200">
                            <span>Interval</span>
                            <select
                                value={interval}
                                onChange={(event) => setInterval(event.target.value as BinanceInterval)}
                                className="rounded border border-slate-600 bg-[#0a1220] px-2 py-1 text-sm text-slate-100 outline-none"
                            >
                                {BINANCE_INTERVALS.map((item) => (
                                    <option key={item} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className={`rounded-full border px-3 py-1 text-sm font-medium ${BADGE_CLASS[status]}`}>
                            {STATUS_LABEL[status]}
                        </div>

                        <div className="rounded-lg border border-slate-600/70 bg-[#0e1728] px-3 py-2 text-sm text-slate-100">
                            <span className="text-slate-300">Last:</span>{" "}
                            {lastPrice === null ? "--" : fmtPrice(lastPrice)}
                            {pctChange !== null ? (
                                <span className={`ml-2 ${changeColor}`}>
                                    {pctChange >= 0 ? "+" : ""}
                                    {pctChange.toFixed(2)}%
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </header>

            <BinanceTvChart
                symbol="BTCUSDT"
                interval={interval}
                height={640}
                onConnectionStatusChange={setStatus}
                onLastPriceChange={(last, prev) => {
                    setLastPrice(last);
                    setPreviousClose(prev);
                }}
            />
        </section>
    );
};

export default BtcUsdtChartPage;
