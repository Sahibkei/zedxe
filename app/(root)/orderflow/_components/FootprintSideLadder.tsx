import { useMemo } from "react";

import { decimalsFromStep } from "@/utils/orderflow/footprint-aggregator";

import { CandleFootprint } from "./footprint-types";

type FootprintMode = "Bid x Ask" | "Delta" | "Volume";

interface FootprintSideLadderProps {
    footprint: CandleFootprint | null;
    selectedTimeSec: number | null;
    mode: FootprintMode;
    showNumbers: boolean;
    highlightImbalances: boolean;
    imbalanceRatio: number;
    priceStep: number | null;
    maxHeight?: number | null;
}

const formatVolume = (value: number) => {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
    return value.toFixed(0);
};

export function FootprintSideLadder({
    footprint,
    selectedTimeSec,
    mode,
    showNumbers,
    highlightImbalances,
    imbalanceRatio,
    priceStep,
    maxHeight,
}: FootprintSideLadderProps) {
    const formattedTime = selectedTimeSec
        ? new Date(selectedTimeSec * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
          })
        : "Latest";

    const priceDecimals = priceStep ? decimalsFromStep(priceStep) : 2;

    const { levels, maxVolume, maxDelta } = useMemo(() => {
        const ladderLevels = footprint?.levels ?? [];
        const maxVol = Math.max(...ladderLevels.map((level) => level.total), 0);
        const maxDel = Math.max(...ladderLevels.map((level) => Math.abs(level.ask - level.bid)), 0);
        const sorted = [...ladderLevels].sort((a, b) => b.price - a.price);
        return { levels: sorted, maxVolume: maxVol || 1, maxDelta: maxDel || 1 };
    }, [footprint?.levels]);

    const renderBidAsk = (bid: number, ask: number, total: number) => {
        const bullish = highlightImbalances && ask >= bid * imbalanceRatio;
        const bearish = highlightImbalances && bid >= ask * imbalanceRatio;
        const bidWidth = Math.min(100, (bid / maxVolume) * 100);
        const askWidth = Math.min(100, (ask / maxVolume) * 100);

        const bidColor = bearish ? "bg-red-500/70" : "bg-red-500/50";
        const askColor = bullish ? "bg-blue-500/80" : "bg-blue-500/50";

        return (
            <div className="flex w-full items-center gap-2">
                <div className="flex-1">
                    <div className="flex items-center gap-1 text-[11px] text-gray-200">
                        <div className="relative h-4 w-full overflow-hidden rounded bg-gray-800/60">
                            <div className={`absolute inset-y-0 left-0 ${bidColor}`} style={{ width: `${bidWidth}%` }} />
                        </div>
                        {showNumbers && <span className="tabular-nums text-[11px] text-gray-100">{formatVolume(bid)}</span>}
                    </div>
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-1 text-[11px] text-gray-200">
                        <div className="relative h-4 w-full overflow-hidden rounded bg-gray-800/60">
                            <div className={`absolute inset-y-0 left-0 ${askColor}`} style={{ width: `${askWidth}%` }} />
                        </div>
                        {showNumbers && <span className="tabular-nums text-[11px] text-gray-100">{formatVolume(ask)}</span>}
                    </div>
                </div>
                {showNumbers && (
                    <div className="w-12 text-right text-[11px] text-gray-300">{formatVolume(total)}</div>
                )}
            </div>
        );
    };

    const renderDelta = (bid: number, ask: number) => {
        const delta = ask - bid;
        const isPositive = delta >= 0;
        const width = Math.min(100, (Math.abs(delta) / maxDelta) * 100);
        const barColor = isPositive ? "bg-blue-500/80" : "bg-red-500/70";
        return (
            <div className="flex w-full items-center gap-2">
                <div className="relative h-4 flex-1 overflow-hidden rounded bg-gray-800/60">
                    <div
                        className={`absolute inset-y-0 ${isPositive ? "left-0" : "right-0"} ${barColor}`}
                        style={{ width: `${width}%` }}
                    />
                </div>
                {showNumbers && (
                    <div className={`w-16 text-right tabular-nums text-[11px] ${isPositive ? "text-blue-200" : "text-red-200"}`}>
                        {formatVolume(delta)}
                    </div>
                )}
            </div>
        );
    };

    const renderVolume = (total: number) => {
        const width = Math.min(100, (total / maxVolume) * 100);
        return (
            <div className="flex w-full items-center gap-2">
                <div className="relative h-4 flex-1 overflow-hidden rounded bg-gray-800/60">
                    <div className="absolute inset-y-0 left-0 bg-emerald-500/70" style={{ width: `${width}%` }} />
                </div>
                {showNumbers && <div className="w-16 text-right tabular-nums text-[11px] text-emerald-100">{formatVolume(total)}</div>}
            </div>
        );
    };

    return (
        <div
            className="flex h-full w-[180px] flex-col border-l border-gray-800 bg-[#0f1115]"
            style={maxHeight ? { maxHeight } : undefined}
        >
            <div className="border-b border-gray-800 p-3">
                <p className="text-xs font-semibold text-gray-200">Ladder (selected candle)</p>
                <p className="text-[11px] text-gray-400">{formattedTime ?? "Latest"}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
                {!footprint || levels.length === 0 ? (
                    <p className="pt-6 text-center text-xs text-gray-500">No footprint data</p>
                ) : (
                    <div className="space-y-1">
                        {levels.map((level) => (
                            <div key={level.price} className="flex items-center gap-3">
                                <div className="w-16 text-right text-[11px] text-gray-400">
                                    {level.price.toFixed(priceDecimals)}
                                </div>
                                <div className="flex-1">
                                    {mode === "Bid x Ask" && renderBidAsk(level.bid, level.ask, level.total)}
                                    {mode === "Delta" && renderDelta(level.bid, level.ask)}
                                    {mode === "Volume" && renderVolume(level.total)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
