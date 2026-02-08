"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import FootprintChartPlaceholder from "@/src/features/orderflow/components/FootprintChartPlaceholder";
import OrderBookPanel from "@/src/features/orderflow/components/OrderBookPanel";
import TradesFeedMock from "@/src/features/orderflow/components/TradesFeedMock";
import { cn } from "@/lib/utils";

const SYMBOL_OPTIONS = [{ label: "BTCUSDT", value: "btcusdt" }] as const;
const WINDOW_OPTIONS = ["1m", "5m", "15m"] as const;
const BUCKET_OPTIONS = ["1s", "5s", "15s"] as const;
const TINY_TRADE_THRESHOLD = 0.001;

export default function FootprintPage() {
    const [selectedSymbol, setSelectedSymbol] = useState<string>("btcusdt");
    const [selectedWindow, setSelectedWindow] = useState<(typeof WINDOW_OPTIONS)[number]>("5m");
    const [selectedBucket, setSelectedBucket] = useState<(typeof BUCKET_OPTIONS)[number]>("5s");
    const [hideTinyTrades, setHideTinyTrades] = useState(false);

    return (
        <section className="space-y-4 px-4 py-6 md:px-6">
            <header className="rounded-xl border border-white/10 bg-[#0d1118] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Orderflow</p>
                <h1 className="text-2xl font-semibold text-white">Orderflow — Footprint</h1>
                <p className="mt-1 text-sm text-slate-400">
                    TapeSurf-style layout skeleton for BTC orderflow footprint. Mocked UI only.
                </p>
            </header>

            <div className="rounded-xl border border-white/10 bg-[#0d1118] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-slate-500">Symbol</span>
                        <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                            <SelectTrigger size="sm" className="w-[130px] border-white/15 bg-[#0a0f15] text-white">
                                <SelectValue placeholder="Select symbol" />
                            </SelectTrigger>
                            <SelectContent>
                                {SYMBOL_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-slate-500">Window</span>
                        <div className="flex gap-2">
                            {WINDOW_OPTIONS.map((option) => (
                                <Button
                                    key={option}
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedWindow(option)}
                                    className={cn(
                                        "border-white/15 bg-[#0a0f15] text-slate-200 hover:bg-[#111722] hover:text-white",
                                        selectedWindow === option && "border-emerald-500/80 bg-emerald-500/15 text-emerald-200",
                                    )}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-slate-500">Bucket</span>
                        <div className="flex gap-2">
                            {BUCKET_OPTIONS.map((option) => (
                                <Button
                                    key={option}
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelectedBucket(option)}
                                    className={cn(
                                        "border-white/15 bg-[#0a0f15] text-slate-200 hover:bg-[#111722] hover:text-white",
                                        selectedBucket === option && "border-cyan-400/80 bg-cyan-500/15 text-cyan-200",
                                    )}
                                >
                                    {option}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                            type="checkbox"
                            checked={hideTinyTrades}
                            onChange={(event) => setHideTinyTrades(event.target.checked)}
                            className="h-4 w-4 rounded border-white/15 bg-[#0a0f15]"
                        />
                        Hide tiny trades (below {TINY_TRADE_THRESHOLD})
                    </label>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                    <FootprintChartPlaceholder
                        symbol={selectedSymbol}
                        windowLabel={selectedWindow}
                        bucketLabel={selectedBucket}
                    />
                    <TradesFeedMock hideTinyTrades={hideTinyTrades} />
                </div>

                <OrderBookPanel />
            </div>
        </section>
    );
}
