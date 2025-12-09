"use client";

import { formatNumber } from "@/utils/formatters";

export interface VolumeProfileLevel {
    price: number;
    buyVolume: number;
    sellVolume: number;
    totalVolume: number;
    imbalancePercent: number;
    dominantSide: "buy" | "sell" | null;
}

interface VolumeProfileProps {
    levels: VolumeProfileLevel[];
    priceStep: number;
    referencePrice: number | null;
}

const VolumeProfile = ({ levels, priceStep, referencePrice }: VolumeProfileProps) => {
    const maxVolume = Math.max(...levels.map((level) => level.totalVolume), 0);
    const nearestPrice = referencePrice ?? undefined;

    return (
        <div className="rounded-xl border border-gray-800 bg-[#0f1115] p-4 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between pb-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Mini Volume Profile</p>
                    <h3 className="text-lg font-semibold text-white">Around Current Price</h3>
                </div>
                {priceStep > 0 ? (
                    <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">Step {formatNumber(priceStep)}</span>
                ) : null}
            </div>

            {levels.length === 0 ? (
                <p className="text-sm text-gray-400">Waiting for trades in the active window…</p>
            ) : (
                <div className="space-y-1.5">
                    {levels
                        .slice()
                        .sort((a, b) => b.price - a.price)
                        .map((level) => {
                            const buyWidth = maxVolume > 0 ? (level.buyVolume / maxVolume) * 100 : 0;
                            const sellWidth = maxVolume > 0 ? (level.sellVolume / maxVolume) * 100 : 0;
                            const isAnchor = nearestPrice
                                ? Math.abs(level.price - nearestPrice) <= priceStep * 0.5
                                : false;
                            const imbalanceLabel = level.dominantSide
                                ? `${level.imbalancePercent.toFixed(0)}% ${
                                      level.dominantSide === "buy" ? "Buy" : "Sell"
                                  }`
                                : "Neutral";

                            return (
                                <div
                                    key={level.price}
                                    className={`flex items-center gap-3 rounded-lg px-2 py-1 ${
                                        isAnchor ? "bg-emerald-500/5 ring-1 ring-emerald-500/20" : ""
                                    }`}
                                >
                                    <div className="w-24 text-sm text-gray-400">
                                        <div className="font-mono text-xs text-gray-300">{formatNumber(level.price)}</div>
                                        <div className="text-[10px] uppercase tracking-wide text-gray-500">{imbalanceLabel}</div>
                                    </div>
                                    <div className="flex w-full flex-col gap-1">
                                        <div className="flex h-2 overflow-hidden rounded-full bg-gray-900">
                                            <div
                                                className="h-full bg-emerald-500"
                                                style={{ width: `${buyWidth}%` }}
                                                aria-label="Buy volume"
                                            />
                                            <div
                                                className="h-full bg-rose-500"
                                                style={{ width: `${sellWidth}%` }}
                                                aria-label="Sell volume"
                                            />
                                        </div>
                                        <div className="flex justify-between text-[11px] text-gray-500">
                                            <span className="text-emerald-300">{formatNumber(level.buyVolume)}</span>
                                            <span className="text-rose-300">{formatNumber(level.sellVolume)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
};

export default VolumeProfile;
