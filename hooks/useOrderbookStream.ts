"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface OrderbookLevel {
    price: number;
    size: number;
}

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

type DepthTuple = [string, string];

interface DepthMessage {
    e: string;
    E: number;
    s: string;
    b: DepthTuple[];
    a: DepthTuple[];
}

const BASE_WS_URL = "wss://stream.binance.com:9443/ws";
const clampLevelCount = (levels: number) => Math.max(1, Math.min(levels, 100));

const parseMessageData = async (event: MessageEvent): Promise<DepthMessage | null> => {
    try {
        const raw =
            typeof event.data === "string"
                ? event.data
                : event.data instanceof Blob
                  ? await event.data.text()
                  : null;

        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<DepthMessage>;
        if (!parsed || (!Array.isArray(parsed.b) && !Array.isArray(parsed.a))) return null;

        return {
            e: parsed.e ?? "",
            E: parsed.E ?? Date.now(),
            s: parsed.s ?? "",
            b: Array.isArray(parsed.b) ? parsed.b : [],
            a: Array.isArray(parsed.a) ? parsed.a : [],
        };
    } catch (err) {
        if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.error("[useOrderbookStream] failed to parse depth message", err);
        }
        return null;
    }
};

const applyDepthUpdates = (
    book: Map<number, number>,
    updates: DepthTuple[],
): void => {
    for (const [priceStr, qtyStr] of updates) {
        const price = parseFloat(priceStr);
        const size = parseFloat(qtyStr);
        if (!Number.isFinite(price) || !Number.isFinite(size)) continue;

        if (size === 0) {
            book.delete(price);
        } else {
            book.set(price, size);
        }
    }
};

const buildSortedLevels = (
    book: Map<number, number>,
    side: "bid" | "ask",
    levelCount: number,
): OrderbookLevel[] =>
    Array.from(book.entries())
        .map(([price, size]) => ({ price, size }))
        .sort((a, b) => (side === "bid" ? b.price - a.price : a.price - b.price))
        .slice(0, levelCount);

export function useOrderbookStream(symbol: string, levelCount = 16): UseOrderbookStreamResult {
    const normalizedSymbol = symbol.trim().toLowerCase();
    const clampedLevels = clampLevelCount(levelCount);

    const [bids, setBids] = useState<OrderbookLevel[]>([]);
    const [asks, setAsks] = useState<OrderbookLevel[]>([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string>();

    const bidsMap = useRef<Map<number, number>>(new Map());
    const asksMap = useRef<Map<number, number>>(new Map());
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const isMounted = useRef(false);
    const connectionId = useRef(0);

    useEffect(() => {
        isMounted.current = true;
        bidsMap.current.clear();
        asksMap.current.clear();
        setBids([]);
        setAsks([]);
        setError(undefined);

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

        const scheduleReconnect = (id: number) => {
            if (!isMounted.current || id !== connectionId.current) return;
            if (reconnectTimeout.current) return;

            reconnectTimeout.current = setTimeout(() => {
                reconnectTimeout.current = null;
                connect();
            }, 1500);
        };

        const handleDepthMessage = (data: DepthMessage, id: number) => {
            applyDepthUpdates(bidsMap.current, data.b ?? []);
            applyDepthUpdates(asksMap.current, data.a ?? []);

            const nextBids = buildSortedLevels(bidsMap.current, "bid", clampedLevels);
            const nextAsks = buildSortedLevels(asksMap.current, "ask", clampedLevels);

            if (!isMounted.current || id !== connectionId.current) return;
            setBids(nextBids);
            setAsks(nextAsks);
        };

        const connect = () => {
            const currentId = connectionId.current + 1;
            connectionId.current = currentId;

            cleanup();

            const wsUrl = `${BASE_WS_URL}/${normalizedSymbol}@depth${clampedLevels}@100ms`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            if (process.env.NODE_ENV === "development") {
                // eslint-disable-next-line no-console
                console.info(`[useOrderbookStream] connecting to ${wsUrl}`);
            }

            ws.onopen = () => {
                if (!isMounted.current || currentId !== connectionId.current) return;
                setConnected(true);
                setError(undefined);
            };

            ws.onerror = () => {
                if (!isMounted.current || currentId !== connectionId.current) return;
                setError("WebSocket error");
                setConnected(false);
            };

            ws.onmessage = (event) => {
                const handle = async () => {
                    if (!isMounted.current || currentId !== connectionId.current) return;
                    const parsed = await parseMessageData(event);
                    if (!parsed) return;
                    handleDepthMessage(parsed, currentId);
                };

                void handle();
            };

            ws.onclose = () => {
                if (!isMounted.current || currentId !== connectionId.current) return;
                setConnected(false);
                scheduleReconnect(currentId);
            };
        };

        connect();

        return () => {
            isMounted.current = false;
            cleanup();
        };
    }, [normalizedSymbol, clampedLevels]);

    const summary = useMemo<OrderbookSummary>(() => {
        const bestBid = bids[0];
        const bestAsk = asks[0];
        const spread = bestBid && bestAsk ? bestAsk.price - bestBid.price : undefined;
        const totalBidSize = bids.reduce((sum, lvl) => sum + lvl.size, 0);
        const totalAskSize = asks.reduce((sum, lvl) => sum + lvl.size, 0);

        return { bestBid, bestAsk, spread, totalBidSize, totalAskSize };
    }, [asks, bids]);

    return { bids, asks, summary, connected, error };
}
