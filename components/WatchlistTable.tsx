"use client";

import Link from "next/link";
import { useState } from "react";

import WatchlistButton from "@/components/WatchlistButton";
import { Button } from "@/components/ui/button";
import { formatMarketCapValue, formatPrice } from "@/lib/utils";

const WatchlistTable = ({
    watchlist,
    onAddAlert,
}: {
    watchlist: WatchlistEntryWithData[];
    onAddAlert?: (item: WatchlistEntryWithData) => void;
}) => {
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
        <div className="watchlist-table overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800">
                    <tr className="table-header-row">
                        <th scope="col" className="table-header px-4 py-3 text-left text-sm font-semibold">
                            Company
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-400">
                            Symbol
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-400">
                            Price
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-400">
                            Change
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-400">
                            Market Cap
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-400">
                            P/E Ratio
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-400">
                            Add Alert
                        </th>
                        <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-400">
                            Watchlist
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700 bg-gray-900/40">
                    {items.map((item) => (
                        <tr key={item.symbol} className="table-row hover:bg-gray-800/40">
                            <td className="px-4 py-4 text-left">
                                <Link href={`/stocks/${item.symbol}`} className="flex flex-col">
                                    <span className="font-semibold text-gray-100">{item.company}</span>
                                </Link>
                            </td>
                            <td className="px-4 py-4 text-left text-sm text-gray-400">
                                <Link href={`/stocks/${item.symbol}`} className="font-medium text-gray-200 hover:text-gray-100">
                                    {item.symbol}
                                </Link>
                            </td>
                            <td className="px-4 py-4 text-right table-cell">{formatPriceValue(item)}</td>
                            <td className={`px-4 py-4 text-right table-cell ${getChangeClass(item.changePercent)}`}>
                                {formatChangeValue(item)}
                            </td>
                            <td className="px-4 py-4 text-right table-cell">
                                {typeof item.marketCap === "number" ? formatMarketCapValue(item.marketCap) : "N/A"}
                            </td>
                            <td className="px-4 py-4 text-right table-cell">
                                {typeof item.peRatio === "number" ? item.peRatio.toFixed(2) : "N/A"}
                            </td>
                            <td className="px-4 py-4 text-right">
                                <Button
                                    type="button"
                                    className="bg-yellow-500 text-black hover:bg-yellow-400"
                                    onClick={() => onAddAlert?.(item)}
                                >
                                    Add Alert
                                </Button>
                            </td>
                            <td className="px-4 py-4 text-right">
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
