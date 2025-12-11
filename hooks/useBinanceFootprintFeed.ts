"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { TIMEFRAME_TO_MS } from "@/lib/footprint/aggregate";
import { FootprintBar, FootprintCell, FootprintTimeframe, RawTrade } from "@/lib/footprint/types";

export type FootprintStreamTimeframe = Extract<FootprintTimeframe, "1m" | "5m" | "15m">;

interface UseBinanceFootprintFeedOptions {
    symbol: string;
    timeframe: FootprintStreamTimeframe;
    isLive?: boolean;
    maxCandles?: number;
    priceStep?: number;
}

interface UseBinanceFootprintFeedResult {
    candles: FootprintBar[];
    isConnected: boolean;
    error: string | null;
}

type BinanceTradeMessage = {
    p: string; // price
    q: string; // quantity
    T?: number; // trade time
    E?: number; // event time
    m: boolean; // is buyer the market maker
    s?: string; // symbol
};

const BASE_WS_URL = "wss://stream.binance.com:9443/ws";

const bucketPrice = (price: number, priceStep?: number) => {
    if (!priceStep) return price;
    if (priceStep <= 0) return price;
    const decimals = priceStep.toString().split(".")[1]?.length ?? 0;
    const bucket = Math.floor(price / priceStep) * priceStep;
    return Number(bucket.toFixed(decimals));
};

const parseTrade = (message: MessageEvent): RawTrade | null => {
    try {
        const data = JSON.parse(message.data as string) as BinanceTradeMessage;
        const price = Number(data.p);
        const quantity = Number(data.q);
        const timestamp = Number(data.T ?? data.E ?? Date.now());
        const isBuyerMaker = Boolean(data.m);
        const symbol = (data.s ?? "").toUpperCase();

        if (!Number.isFinite(price) || !Number.isFinite(quantity) || !Number.isFinite(timestamp)) {
            return null;
        }

        const side: RawTrade["side"] = isBuyerMaker ? "sell" : "buy";

        return { symbol, price, quantity, side, ts: timestamp };
    } catch (error) {
        console.error("[useBinanceFootprintFeed] Failed to parse trade", error);
        return null;
    }
};

interface MutableFootprintBar extends Omit<FootprintBar, "cells" | "delta"> {
    cells: Map<number, FootprintCell>;
}

const BASE_MAX_CANDLES = 150;

export const useBinanceFootprintFeed = ({
    symbol,
    timeframe,
    isLive = true,
    maxCandles = BASE_MAX_CANDLES,
    priceStep,
}: UseBinanceFootprintFeedOptions): UseBinanceFootprintFeedResult => {
    const [candles, setCandles] = useState<FootprintBar[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const barsRef = useRef<Map<number, MutableFootprintBar>>(new Map());
    const liveRef = useRef(isLive);
    const symbolRef = useRef(symbol.toUpperCase());

    useEffect(() => {
        liveRef.current = isLive;
    }, [isLive]);

    useEffect(() => {
        const normalizedSymbol = symbol.trim().toLowerCase();
        const timeframeMs = TIMEFRAME_TO_MS[timeframe];
        if (!timeframeMs) {
            setError(`Unsupported timeframe: ${timeframe}`);
            return;
        }

        symbolRef.current = normalizedSymbol.toUpperCase();
        setCandles([]);
        barsRef.current = new Map();
        setError(null);

        const wsUrl = `${BASE_WS_URL}/${normalizedSymbol}@trade`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            setIsConnected(true);
            setError(null);
        };

        socket.onerror = () => {
            setError("WebSocket error");
        };

        socket.onclose = (event) => {
            setIsConnected(false);
            if (!event.wasClean && !error) {
                setError("Connection closed unexpectedly");
            }
        };

        socket.onmessage = (event) => {
            if (!liveRef.current) return;
            const trade = parseTrade(event);
            if (!trade) return;

            const bucketStart = Math.floor(trade.ts / timeframeMs) * timeframeMs;
            const bucketEnd = bucketStart + timeframeMs;

            const key = bucketStart;
            const currentBars = barsRef.current;
            let bar = currentBars.get(key);

            if (!bar) {
                bar = {
                    symbol: symbolRef.current,
                    timeframe,
                    startTime: bucketStart,
                    endTime: bucketEnd,
                    open: trade.price,
                    high: trade.price,
                    low: trade.price,
                    close: trade.price,
                    cells: new Map(),
                    totalAskVolume: 0,
                    totalBidVolume: 0,
                };
                currentBars.set(key, bar);
            } else {
                bar.close = trade.price;
                bar.high = Math.max(bar.high, trade.price);
                bar.low = Math.min(bar.low, trade.price);
            }

            const bucketedPrice = bucketPrice(trade.price, priceStep);
            const existingCell = bar.cells.get(bucketedPrice);
            const cell: FootprintCell = existingCell ?? {
                price: bucketedPrice,
                bidVolume: 0,
                askVolume: 0,
                tradesCount: 0,
            };

            if (trade.side === "buy") {
                cell.askVolume += trade.quantity;
                bar.totalAskVolume += trade.quantity;
            } else {
                cell.bidVolume += trade.quantity;
                bar.totalBidVolume += trade.quantity;
            }

            cell.tradesCount += 1;
            bar.cells.set(bucketedPrice, cell);

            const sortedKeys = Array.from(currentBars.keys()).sort((a, b) => a - b);
            while (sortedKeys.length > maxCandles) {
                const oldest = sortedKeys.shift();
                if (oldest !== undefined) {
                    currentBars.delete(oldest);
                }
            }

            const nextCandles = sortedKeys.map((start) => {
                const currentBar = currentBars.get(start)!;
                const cells = Array.from(currentBar.cells.values()).sort((a, b) => a.price - b.price);
                return {
                    ...currentBar,
                    cells,
                    delta: currentBar.totalAskVolume - currentBar.totalBidVolume,
                } satisfies FootprintBar;
            });

            setCandles(nextCandles);
        };

        return () => {
            socket.close();
        };
    }, [symbol, timeframe, maxCandles, priceStep]);

    const memoizedCandles = useMemo(() => candles, [candles]);

    return {
        candles: memoizedCandles,
        isConnected,
        error,
    };
};

