"use client";

import { useEffect, useRef, useState } from "react";

type DepthTuple = [string, string];

interface DepthMessage {
    e: string;
    E: number;
    s: string;
    b: DepthTuple[];
    a: DepthTuple[];
}

export type OrderbookLevel = {
    price: number;
    size: number;
};

export interface OrderbookSummary {
    bestBid?: OrderbookLevel;
    bestAsk?: OrderbookLevel;
    spread?: number;
    totalBidSize: number;
    totalAskSize: number;
}

export interface UseOrderbookStreamResult {
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    summary: OrderbookSummary | null;
    connected: boolean;
    error: string | null;
}

const BASE_WS_URL = "wss://stream.binance.com:9443/ws";

const buildStreamUrl = (symbol: string, levelCount: number) => {
    const normalizedSymbol = symbol.toLowerCase();
    const normalizedLevel = Math.max(1, Math.min(100, levelCount));
    return `${BASE_WS_URL}/${normalizedSymbol}@depth${normalizedLevel}@100ms`;
};

function applyDepthUpdates(
    prev: OrderbookLevel[],
    updates: DepthTuple[],
    side: "bid" | "ask",
    levelCount: number,
): OrderbookLevel[] {
    const map = new Map<number, number>();
    for (const level of prev) {
        if (Number.isFinite(level.price) && Number.isFinite(level.size)) {
            map.set(level.price, level.size);
        }
    }

    for (const [priceStr, qtyStr] of updates) {
        const price = parseFloat(priceStr);
        const size = parseFloat(qtyStr);
        if (!Number.isFinite(price) || !Number.isFinite(size)) continue;

        if (size <= 0) {
            map.delete(price);
        } else {
            map.set(price, size);
        }
    }

    const sorted = Array.from(map.entries())
        .map(([price, size]) => ({ price, size }))
        .sort((a, b) => (side === "bid" ? b.price - a.price : a.price - b.price))
        .slice(0, levelCount);

    return sorted;
}

function parseDepth(event: MessageEvent): DepthMessage | null {
    try {
        const data = JSON.parse(event.data as string);
        if (!data) return null;

        const bids = Array.isArray(data.b) ? data.b : [];
        const asks = Array.isArray(data.a) ? data.a : [];

        return {
            e: data.e,
            E: data.E,
            s: data.s,
            b: bids,
            a: asks,
        };
    } catch (err) {
        console.error("[useOrderbookStream] Failed to parse depth message", err);
        return null;
    }
}

export function useOrderbookStream(symbol: string, levelCount = 16): UseOrderbookStreamResult {
    const [bids, setBids] = useState<OrderbookLevel[]>([]);
    const [asks, setAsks] = useState<OrderbookLevel[]>([]);
    const [summary, setSummary] = useState<OrderbookSummary | null>(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttempts = useRef(0);
    const activeSymbol = useRef(symbol.toLowerCase());
    const activeLevelCount = useRef(levelCount);
    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        activeSymbol.current = symbol.toLowerCase();
        activeLevelCount.current = levelCount;

        setBids([]);
        setAsks([]);
        setSummary(null);

        const cleanup = () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
                reconnectTimeout.current = null;
            }

            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };

        const connect = () => {
            const wsUrl = buildStreamUrl(activeSymbol.current, activeLevelCount.current);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;
            setError(null);

            ws.onopen = () => {
                if (!isMounted.current) return;
                setConnected(true);
                reconnectAttempts.current = 0;
            };

            ws.onerror = () => {
                if (!isMounted.current) return;
                setError("WebSocket error");
            };

            ws.onmessage = (event) => {
                if (!isMounted.current) return;
                const depth = parseDepth(event);
                if (!depth) return;

                setBids((prev) => applyDepthUpdates(prev, depth.b, "bid", activeLevelCount.current));
                setAsks((prev) => applyDepthUpdates(prev, depth.a, "ask", activeLevelCount.current));
            };

            ws.onclose = () => {
                if (!isMounted.current) return;
                setConnected(false);

                if (reconnectTimeout.current) return;

                const attempt = reconnectAttempts.current;
                const delay = Math.min(30_000, 1000 * 2 ** attempt);
                reconnectAttempts.current = attempt + 1;

                reconnectTimeout.current = setTimeout(() => {
                    reconnectTimeout.current = null;
                    connect();
                }, delay);
            };
        };

        connect();

        return () => {
            isMounted.current = false;
            cleanup();
        };
    }, [symbol, levelCount]);

    useEffect(() => {
        if (!bids.length && !asks.length) {
            setSummary({ totalBidSize: 0, totalAskSize: 0 });
            return;
        }

        const bestBid = bids[0];
        const bestAsk = asks[0];
        const spread = bestBid && bestAsk ? bestAsk.price - bestBid.price : undefined;
        const totalBidSize = bids.reduce((total, level) => total + level.size, 0);
        const totalAskSize = asks.reduce((total, level) => total + level.size, 0);

        setSummary({ bestBid, bestAsk, spread, totalBidSize, totalAskSize });
    }, [asks, bids]);

    return { bids, asks, summary, connected, error };
}
