"use client";

import { useEffect, useRef } from "react";

import type { NormalizedTrade } from "@/hooks/useOrderflowStream";

const PERSIST_INTERVAL_MS = 5000;

export function usePersistOrderflowTrades(symbol: string, trades: NormalizedTrade[], enabled = true) {
    const lastFlushedTimestamp = useRef<number>(0);
    const tradesRef = useRef<NormalizedTrade[]>(trades);

    useEffect(() => {
        tradesRef.current = trades;
    }, [trades]);

    useEffect(() => {
        lastFlushedTimestamp.current = 0;
    }, [symbol]);

    useEffect(() => {
        if (!enabled || !symbol) return undefined;

        const interval = setInterval(async () => {
            const pending = tradesRef.current.filter((trade) => trade.timestamp > lastFlushedTimestamp.current);
            if (pending.length === 0) return;

            try {
                const response = await fetch("/api/orderflow/ingest", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        symbol: symbol.toLowerCase(),
                        trades: pending.map((trade) => ({
                            timestamp: trade.timestamp,
                            price: trade.price,
                            quantity: trade.quantity,
                            side: trade.side,
                        })),
                    }),
                });

                if (!response.ok) {
                    console.error("Failed to persist trades", await response.text());
                    return;
                }

                const latestTimestamp = pending[pending.length - 1]?.timestamp;
                if (latestTimestamp) {
                    lastFlushedTimestamp.current = latestTimestamp;
                }
            } catch (error) {
                console.error("Error persisting trades", error);
            }
        }, PERSIST_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [enabled, symbol]);
}
