"use client";

import { useEffect, useRef, useState } from "react";

type DepthTuple = [string, string];

interface DepthMessage {
    e?: string;
    E?: number;
    s?: string;
    b?: DepthTuple[];
    a?: DepthTuple[];
}

export type OrderbookLevel = {
    price: number;
    size: number;
};

export interface OrderbookSummary {
    bestBid?: OrderbookLevel;
    bestAsk?: OrderbookLevel;
    spread?: number;
    totalBidSize?: number;
    totalAskSize?: number;
}

export interface UseOrderbookStreamResult {
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
    summary: OrderbookSummary;
    connected: boolean;
    error?: string;
}

const BASE_WS_URL = "wss://stream.binance.com:9443/ws";

const buildStreamUrl = (symbol: string, levelCount: number) => {
    const normalizedSymbol = symbol.toLowerCase();
    const normalizedLevel = Math.max(1, Math.min(100, levelCount));
    return `${BASE_WS_URL}/${normalizedSymbol}@depth${normalizedLevel}@100ms`;
};

const clampLevels = (levelCount: number) => Math.max(1, Math.min(100, levelCount));

const sortLevels = (levels: Map<number, number>, side: "bid" | "ask", levelCount: number) =>
    Array.from(levels.entries())
        .map(([price, size]) => ({ price, size }))
        .sort((a, b) => (side === "bid" ? b.price - a.price : a.price - b.price))
        .slice(0, levelCount);

const computeSummary = (bids: OrderbookLevel[], asks: OrderbookLevel[]): OrderbookSummary => {
    const bestBid = bids[0];
    const bestAsk = asks[0];
    const spread = bestBid && bestAsk ? bestAsk.price - bestBid.price : undefined;
    const totalBidSize = bids.reduce((sum, level) => sum + level.size, 0);
    const totalAskSize = asks.reduce((sum, level) => sum + level.size, 0);

    return {
        bestBid,
        bestAsk,
        spread,
        totalBidSize,
        totalAskSize,
    };
};

async function parseDepth(event: MessageEvent): Promise<DepthMessage | null> {
    try {
        const rawData =
            typeof event.data === "string"
                ? event.data
                : event.data instanceof Blob
                  ? await event.data.text()
                  : null;
        if (!rawData) return null;

        const data = JSON.parse(rawData) as DepthMessage;
        if (!data || (!Array.isArray(data.b) && !Array.isArray(data.a))) return null;

        return {
            e: data.e,
            E: data.E,
            s: data.s,
            b: Array.isArray(data.b) ? data.b : [],
            a: Array.isArray(data.a) ? data.a : [],
        };
    } catch (err) {
        console.error("[useOrderbookStream] Failed to parse depth message", err);
        return null;
    }
}

export function useOrderbookStream(symbol: string, levelCount = 16): UseOrderbookStreamResult {
    const [bids, setBids] = useState<OrderbookLevel[]>([]);
    const [asks, setAsks] = useState<OrderbookLevel[]>([]);
    const [summary, setSummary] = useState<OrderbookSummary>({ totalBidSize: 0, totalAskSize: 0 });
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttempts = useRef(0);
    const activeSymbol = useRef(symbol.toLowerCase());
    const activeLevelCount = useRef(clampLevels(levelCount));
    const isMounted = useRef(false);
    const bookRef = useRef<{ bids: Map<number, number>; asks: Map<number, number> }>({
        bids: new Map(),
        asks: new Map(),
    });

    useEffect(() => {
        isMounted.current = true;
        activeSymbol.current = symbol.toLowerCase();
        activeLevelCount.current = clampLevels(levelCount);

        setBids([]);
        setAsks([]);
        setSummary({ totalBidSize: 0, totalAskSize: 0 });
        bookRef.current = { bids: new Map(), asks: new Map() };

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

                const handleMessage = async () => {
                    const depth = await parseDepth(event);
                    if (!depth) return;

                    const { bids: bidUpdates = [], asks: askUpdates = [] } = { bids: depth.b, asks: depth.a } as {
                        bids: DepthTuple[];
                        asks: DepthTuple[];
                    };

                    for (const [priceStr, qtyStr] of bidUpdates) {
                        const price = parseFloat(priceStr);
                        const size = parseFloat(qtyStr);
                        if (!Number.isFinite(price) || !Number.isFinite(size)) continue;
                        if (size <= 0) {
                            bookRef.current.bids.delete(price);
                        } else {
                            bookRef.current.bids.set(price, size);
                        }
                    }

                    for (const [priceStr, qtyStr] of askUpdates) {
                        const price = parseFloat(priceStr);
                        const size = parseFloat(qtyStr);
                        if (!Number.isFinite(price) || !Number.isFinite(size)) continue;
                        if (size <= 0) {
                            bookRef.current.asks.delete(price);
                        } else {
                            bookRef.current.asks.set(price, size);
                        }
                    }

                    const nextBids = sortLevels(bookRef.current.bids, "bid", activeLevelCount.current);
                    const nextAsks = sortLevels(bookRef.current.asks, "ask", activeLevelCount.current);

                    if (!isMounted.current) return;
                    setBids(nextBids);
                    setAsks(nextAsks);
                    setSummary(computeSummary(nextBids, nextAsks));
                };

                void handleMessage();
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

    return { bids, asks, summary, connected, error: error ?? undefined };
}
