"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DepthTuple = [string, string];

interface DepthMessage {
    e?: string;
    E?: number;
    s?: string;
    b?: DepthTuple[];
    a?: DepthTuple[];
}

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

const BASE_WS_URL = "wss://stream.binance.com:9443/ws";
const clampLevels = (levelCount: number) => Math.max(1, Math.min(100, levelCount));

const buildStreamUrl = (symbol: string, levelCount: number) => {
    const normalizedSymbol = symbol.toLowerCase();
    const normalizedLevel = clampLevels(levelCount);
    return `${BASE_WS_URL}/${normalizedSymbol}@depth${normalizedLevel}@100ms`;
};

const applyDepthUpdates = (
    prev: Map<number, number>,
    updates: DepthTuple[] | undefined,
    side: "bid" | "ask",
) => {
    if (!updates?.length) return prev;

    for (const [priceStr, qtyStr] of updates) {
        const price = parseFloat(priceStr);
        const size = parseFloat(qtyStr);
        if (!Number.isFinite(price) || !Number.isFinite(size)) continue;

        if (size === 0) {
            prev.delete(price);
        } else {
            prev.set(price, size);
        }
    }

    if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.debug(
            `[useOrderbookStream] applied ${updates.length} ${side} updates; depth now ${prev.size}`,
        );
    }

    return prev;
};

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
        if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.error("[useOrderbookStream] Failed to parse depth message", err);
        }
        return null;
    }
}

export function useOrderbookStream(symbol: string, levelCount = 16): UseOrderbookStreamResult {
    const clampedLevelCount = clampLevels(levelCount);

    const [bids, setBids] = useState<OrderbookLevel[]>([]);
    const [asks, setAsks] = useState<OrderbookLevel[]>([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const bidsMap = useRef<Map<number, number>>(new Map());
    const asksMap = useRef<Map<number, number>>(new Map());
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttempts = useRef(0);
    const isMounted = useRef(false);
    const connectionId = useRef(0);

    useEffect(() => {
        isMounted.current = true;
        bidsMap.current.clear();
        asksMap.current.clear();
        setBids([]);
        setAsks([]);
        setError(null);

        const normalizedSymbol = symbol.trim().toLowerCase();

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

        const scheduleReconnect = (thisConnectionId: number) => {
            if (!isMounted.current || thisConnectionId !== connectionId.current) return;
            if (reconnectTimeout.current) return;

            const attempt = reconnectAttempts.current;
            const delay = Math.min(30_000, 1000 * 2 ** attempt);
            reconnectAttempts.current = attempt + 1;

            reconnectTimeout.current = setTimeout(() => {
                reconnectTimeout.current = null;
                connect();
            }, delay);
        };

        const connect = () => {
            const thisConnectionId = connectionId.current + 1;
            connectionId.current = thisConnectionId;

            cleanup();

            const wsUrl = buildStreamUrl(normalizedSymbol, clampedLevelCount);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            if (process.env.NODE_ENV === "development") {
                // eslint-disable-next-line no-console
                console.info(`[useOrderbookStream] connecting to ${wsUrl}`);
            }

            ws.onopen = () => {
                if (!isMounted.current || thisConnectionId !== connectionId.current) return;
                setConnected(true);
                setError(null);
                reconnectAttempts.current = 0;
                if (process.env.NODE_ENV === "development") {
                    // eslint-disable-next-line no-console
                    console.info("[useOrderbookStream] socket opened");
                }
            };

            ws.onerror = () => {
                if (!isMounted.current || thisConnectionId !== connectionId.current) return;
                setError("WebSocket error");
                setConnected(false);
            };

            ws.onmessage = (event) => {
                const handleMessage = async () => {
                    if (!isMounted.current || thisConnectionId !== connectionId.current) return;
                    const depth = await parseDepth(event);
                    if (!depth) return;

                    applyDepthUpdates(bidsMap.current, depth.b, "bid");
                    applyDepthUpdates(asksMap.current, depth.a, "ask");

                    const nextBids = sortLevels(bidsMap.current, "bid", clampedLevelCount);
                    const nextAsks = sortLevels(asksMap.current, "ask", clampedLevelCount);

                    if (!isMounted.current || thisConnectionId !== connectionId.current) return;
                    setBids(nextBids);
                    setAsks(nextAsks);
                };

                void handleMessage();
            };

            ws.onclose = () => {
                if (!isMounted.current || thisConnectionId !== connectionId.current) return;
                setConnected(false);
                scheduleReconnect(thisConnectionId);
                if (process.env.NODE_ENV === "development") {
                    // eslint-disable-next-line no-console
                    console.info("[useOrderbookStream] socket closed");
                }
            };
        };

        connect();

        return () => {
            isMounted.current = false;
            cleanup();
        };
    }, [symbol, clampedLevelCount]);

    const summary = useMemo(() => computeSummary(bids, asks), [bids, asks]);

    return { bids, asks, summary, connected, error: error ?? undefined };
}
