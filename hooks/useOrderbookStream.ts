"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type OrderbookLevel = {
    price: number;
    size: number;
};

export type OrderbookSummary = {
    bestBid: number | null;
    bestAsk: number | null;
    spread: number | null;
    spreadPct: number | null;
    totalBidSize: number;
    totalAskSize: number;
};

export type UseOrderbookStreamResult = {
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    summary: OrderbookSummary;
    connected: boolean;
    error: string | null;
};

const BASE_WS_URL = "wss://stream.binance.com:9443/ws";

const buildStreamUrl = (symbol: string, levelCount: number) => {
    const normalizedSymbol = symbol.toLowerCase();
    const normalizedLevel = Math.max(1, Math.min(100, levelCount));
    return `${BASE_WS_URL}/${normalizedSymbol}@depth${normalizedLevel}@100ms`;
};

type DepthMessage = {
    bids: [string, string][];
    asks: [string, string][];
};

const parseDepthMessage = (event: MessageEvent): DepthMessage | null => {
    try {
        const data = JSON.parse(event.data as string);
        const bids = Array.isArray(data?.b) ? data.b : Array.isArray(data?.bids) ? data.bids : [];
        const asks = Array.isArray(data?.a) ? data.a : Array.isArray(data?.asks) ? data.asks : [];

        return { bids, asks };
    } catch (error) {
        console.error("[useOrderbookStream] Failed to parse message", error);
        return null;
    }
};

const applyUpdates = (
    current: OrderbookLevel[],
    updates: [string, string][],
    levelCount: number,
    isBid: boolean,
): OrderbookLevel[] => {
    const bookMap = new Map<number, number>();

    current.forEach((level) => {
        if (Number.isFinite(level.price) && Number.isFinite(level.size)) {
            bookMap.set(level.price, level.size);
        }
    });

    updates.forEach(([priceRaw, sizeRaw]) => {
        const price = Number(priceRaw);
        const size = Number(sizeRaw);
        if (!Number.isFinite(price) || !Number.isFinite(size)) return;
        if (size <= 0) {
            bookMap.delete(price);
        } else {
            bookMap.set(price, size);
        }
    });

    const sorted = Array.from(bookMap.entries())
        .map(([price, size]) => ({ price, size }))
        .sort((a, b) => (isBid ? b.price - a.price : a.price - b.price))
        .slice(0, levelCount);

    return sorted;
};

export const useOrderbookStream = (symbol: string, levelCount = 20): UseOrderbookStreamResult => {
    const [bids, setBids] = useState<OrderbookLevel[]>([]);
    const [asks, setAsks] = useState<OrderbookLevel[]>([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const activeSymbol = useRef(symbol.toLowerCase());
    const activeLevelCount = useRef(levelCount);
    const isMounted = useRef(true);

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

    useEffect(() => {
        isMounted.current = true;
        activeSymbol.current = symbol.toLowerCase();
        activeLevelCount.current = levelCount;
        setBids([]);
        setAsks([]);
        cleanup();

        const connect = () => {
            const wsUrl = buildStreamUrl(activeSymbol.current, activeLevelCount.current);
            const ws = new WebSocket(wsUrl);

            wsRef.current = ws;
            setError(null);

            ws.onopen = () => {
                setConnected(true);
                reconnectAttempts.current = 0;
            };

            ws.onmessage = (event) => {
                const depth = parseDepthMessage(event);
                if (!depth) return;

                setBids((prev) => applyUpdates(prev, depth.bids, activeLevelCount.current, true));
                setAsks((prev) => applyUpdates(prev, depth.asks, activeLevelCount.current, false));
            };

            ws.onerror = () => {
                setError("WebSocket error");
            };

            ws.onclose = () => {
                setConnected(false);
                if (reconnectTimeout.current || !isMounted.current) return;

                const attempt = reconnectAttempts.current;
                const delay = Math.min(30000, 1000 * 2 ** attempt);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, levelCount]);

    const summary = useMemo<OrderbookSummary>(() => {
        const bestBid = bids.length ? bids[0].price : null;
        const bestAsk = asks.length ? asks[0].price : null;
        const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
        const mid = bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;
        const spreadPct = spread !== null && mid ? spread / mid : null;
        const totalBidSize = bids.reduce((total, level) => total + level.size, 0);
        const totalAskSize = asks.reduce((total, level) => total + level.size, 0);

        return {
            bestBid,
            bestAsk,
            spread,
            spreadPct,
            totalBidSize,
            totalAskSize,
        };
    }, [asks, bids]);

    return { bids, asks, summary, connected, error };
};
