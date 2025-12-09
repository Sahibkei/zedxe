"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ORDERFLOW_DEFAULT_SYMBOL } from "@/lib/constants";

export const DEFAULT_SYMBOL = ORDERFLOW_DEFAULT_SYMBOL;
export const MAX_TRADES = 1000;
export const BUCKET_SIZE_SECONDS = 5;
export const WINDOW_SECONDS = 120;
export const LARGE_TRADE_THRESHOLD = 5; // in base asset units (e.g., BTC)

export type TradeSide = "buy" | "sell";

export interface NormalizedTrade {
    timestamp: number;
    price: number;
    quantity: number;
    side: TradeSide;
}

interface UseOrderflowStreamOptions {
    symbol?: string;
}

interface StreamState {
    trades: NormalizedTrade[];
    connected: boolean;
    error: string | null;
}

const BASE_WS_URL = "wss://stream.binance.com:9443/ws";

const buildStreamUrl = (symbol: string) => {
    const normalizedSymbol = symbol.toLowerCase();
    return `${BASE_WS_URL}/${normalizedSymbol}@aggTrade`;
};

const parseMessage = (event: MessageEvent): NormalizedTrade | null => {
    try {
        const data = JSON.parse(event.data as string);
        const price = Number(data.p);
        const quantity = Number(data.q);
        const timestamp = Number(data.T ?? data.E ?? Date.now());
        const isBuyerMaker = Boolean(data.m);

        if (!Number.isFinite(price) || !Number.isFinite(quantity) || !Number.isFinite(timestamp)) {
            return null;
        }

        const side: TradeSide = isBuyerMaker ? "sell" : "buy";

        return {
            timestamp,
            price,
            quantity,
            side,
        };
    } catch (error) {
        console.error("[useOrderflowStream] Failed to parse message", error);
        return null;
    }
};

export const useOrderflowStream = ({ symbol = DEFAULT_SYMBOL }: UseOrderflowStreamOptions = {}): StreamState => {
    const [trades, setTrades] = useState<NormalizedTrade[]>([]);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttempts = useRef(0);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const activeSymbol = useRef(symbol.toLowerCase());
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
        cleanup();

        const connect = () => {
            const wsUrl = buildStreamUrl(activeSymbol.current);
            const ws = new WebSocket(wsUrl);

            wsRef.current = ws;
            setError(null);

            ws.onopen = () => {
                setConnected(true);
                reconnectAttempts.current = 0;
            };

            ws.onmessage = (event) => {
                const trade = parseMessage(event);
                if (!trade) return;

                setTrades((prev) => {
                    const next = [...prev, trade];
                    if (next.length > MAX_TRADES) {
                        return next.slice(-MAX_TRADES);
                    }
                    return next;
                });
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
    }, [symbol]);

    const sortedTrades = useMemo(() => [...trades].sort((a, b) => a.timestamp - b.timestamp), [trades]);

    return { trades: sortedTrades, connected, error };
};

