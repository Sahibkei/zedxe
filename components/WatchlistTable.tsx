"use client";

import Link from "next/link";
import { useState } from "react";

import WatchlistButton from "@/components/WatchlistButton";
import { formatMarketCapValue, formatPrice } from "@/lib/utils";

const WatchlistTable = ({ watchlist }: { watchlist: WatchlistEntryWithData[] }) => {
    const [items, setItems] = useState<WatchlistEntryWithData[]>(watchlist);

    const handleWatchlistChange = (symbol: string, isAdded: boolean) => {
        if (isAdded) return;
        setItems((prev) => prev.filter((item) => item.symbol !== symbol));
    };

    const getChangeClass = (changePercent?: number) => {
        if (changePercent === undefined || changePercent === null) return "text-gray-400";
        if (changePercent > 0) return "text-green-400";
        if (changePercent < 0) return "text-red-400";
        return "text-gray-400";
    };

    const formatChangeValue = (item: WatchlistEntryWithData) => {
        if (item.changeFormatted) return item.changeFormatted;
        if (typeof item.changePercent === "number") {
            const sign = item.changePercent > 0 ? "+" : "";
            return `${sign}${item.changePercent.toFixed(2)}%`;
        }
        return "—";
    };

    const formatPriceValue = (item: WatchlistEntryWithData) => {
        if (item.priceFormatted) return item.priceFormatted;
        if (typeof item.currentPrice === "number") return formatPrice(item.currentPrice);
        return "—";
    };

    return (
        <div className="watchlist-table overflow-x-auto text-gray-100">
            <table className="min-w-full divide-y divide-white/5">
                <thead className="bg-[#0d0f14]">
                    <tr className="table-header-row text-sm">
                        <th scope="col" className="table-header px-5 py-3 text-left font-semibold text-gray-200">
                            Company
                        </th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold text-gray-400">
                            Price
                        </th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold text-gray-400">
                            Change
                        </th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold text-gray-400">
                            Market Cap
                        </th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold text-gray-400">
                            P/E Ratio
                        </th>
                        <th scope="col" className="px-5 py-3 text-right font-semibold text-gray-400">
                            Action
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-[#0b0d12]">
                    {items.map((item) => (
                        <tr key={item.symbol} className="table-row transition-colors hover:bg-white/5">
                            <td className="px-5 py-4 text-left">
                                <Link href={`/stocks/${item.symbol}`} className="flex flex-col gap-0.5">
                                    <span className="font-semibold text-white">{item.company}</span>
                                    <span className="text-xs text-gray-500">{item.symbol}</span>
                                </Link>
                            </td>
                            <td className="px-5 py-4 text-right table-cell">{formatPriceValue(item)}</td>
                            <td className={`px-5 py-4 text-right table-cell ${getChangeClass(item.changePercent)}`}>
                                {formatChangeValue(item)}
                            </td>
                            <td className="px-5 py-4 text-right table-cell">
                                {typeof item.marketCap === "number" ? formatMarketCapValue(item.marketCap) : "N/A"}
                            </td>
                            <td className="px-5 py-4 text-right table-cell">
                                {typeof item.peRatio === "number" ? item.peRatio.toFixed(2) : "N/A"}
                            </td>
                            <td className="px-5 py-4 text-right">
                                <WatchlistButton
                                    symbol={item.symbol}
                                    company={item.company}
                                    isInWatchlist
                                    type="icon"
                                    showTrashIcon
                                    onWatchlistChange={handleWatchlistChange}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default WatchlistTable;
