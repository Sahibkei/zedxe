"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    AggTradeMessage,
    CandleFootprint,
    CANDLE_INTERVAL_MS,
    getCandleOpenSec,
    getPriceStep,
    parseAggTrade,
    pruneOldCandles,
    upsertFootprintLevel,
} from "@/utils/orderflow/footprint-aggregator";

const WINDOW_MS_DEFAULT = 2 * 60 * 60 * 1000;
const SUMMARY_THROTTLE_MS = 250;
const SOCKET_RETRY_BASE_MS = 1000;
const SOCKET_RETRY_MAX_MS = 10_000;

export type FootprintSummary = {
    tSec: number;
    buyTotal: number;
    sellTotal: number;
    levelsCount: number;
};

export type FootprintLevel = { price: number; bid: number; ask: number; total: number };

interface FootprintHookParams {
    symbol: string;
    interval: keyof typeof CANDLE_INTERVAL_MS;
    windowMs?: number;
}

export function useFootprintAggTrades({ symbol, interval, windowMs = WINDOW_MS_DEFAULT }: FootprintHookParams) {
    const [priceStep, setPriceStep] = useState<number | null>(null);
    const [latestSummary, setLatestSummary] = useState<FootprintSummary | null>(null);

    const footprintsRef = useRef<Map<number, CandleFootprint>>(new Map());
    const latestCandleKeyRef = useRef<number | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intervalMsRef = useRef<number>(CANDLE_INTERVAL_MS[interval]);
    const priceStepRef = useRef<number>(0.1);

    const resetAggregation = useCallback(() => {
        footprintsRef.current = new Map();
        latestCandleKeyRef.current = null;
        setLatestSummary(null);
    }, []);

    useEffect(() => {
        intervalMsRef.current = CANDLE_INTERVAL_MS[interval];
        resetAggregation();
    }, [interval, resetAggregation]);

    useEffect(() => {
        let cancelled = false;
        setPriceStep(null);
        const loadStep = async () => {
            const step = await getPriceStep(symbol).catch(() => null);
            if (cancelled) return;
            if (step && Number.isFinite(step)) {
                priceStepRef.current = step;
                setPriceStep(step);
            } else {
                priceStepRef.current = 0.1;
                setPriceStep(0.1);
            }
        };
        loadStep();
        resetAggregation();
        return () => {
            cancelled = true;
        };
    }, [symbol, resetAggregation]);

    useEffect(() => {
        const cleanupSocket = () => {
            websocketRef.current?.close();
            websocketRef.current = null;
        };

        let disposed = false;
        let retryDelay = SOCKET_RETRY_BASE_MS;

        const connect = () => {
            if (disposed) return;
            cleanupSocket();
            const stream = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@aggTrade`;
            const socket = new WebSocket(stream);
            websocketRef.current = socket;

            socket.onopen = () => {
                retryDelay = SOCKET_RETRY_BASE_MS;
            };

            socket.onmessage = (event) => {
                try {
                    const parsed = parseAggTrade(JSON.parse(event.data) as AggTradeMessage);
                    if (!parsed) return;

                    const { price, quantity, time, side } = parsed;
                    const intervalMs = intervalMsRef.current;
                    const candleKey = getCandleOpenSec(time, intervalMs);
                    latestCandleKeyRef.current = candleKey;

                    const priceStepValue = priceStepRef.current;
                    const footprint = footprintsRef.current.get(candleKey) ?? {
                        tSec: candleKey,
                        buyTotal: 0,
                        sellTotal: 0,
                        levels: new Map(),
                    };

                    if (side === "ask") {
                        footprint.buyTotal += quantity;
                    } else {
                        footprint.sellTotal += quantity;
                    }

                    upsertFootprintLevel(footprint, price, side, quantity, priceStepValue);
                    footprintsRef.current.set(candleKey, footprint);
                } catch (error) {
                    console.error("Failed to process aggTrade", error);
                }
            };

            socket.onclose = () => {
                if (disposed) return;
                retryDelay = Math.min(SOCKET_RETRY_MAX_MS, retryDelay * 1.5);
                if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = setTimeout(() => connect(), retryDelay);
            };

            socket.onerror = () => {
                socket.close();
            };
        };

        connect();

        return () => {
            disposed = true;
            if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
            cleanupSocket();
        };
    }, [symbol]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            pruneOldCandles(footprintsRef.current, windowMs);
            const latestKey = latestCandleKeyRef.current;
            if (latestKey == null) return;
            const footprint = footprintsRef.current.get(latestKey);
            if (!footprint) return;
            setLatestSummary({
                tSec: footprint.tSec,
                buyTotal: footprint.buyTotal,
                sellTotal: footprint.sellTotal,
                levelsCount: footprint.levels.size,
            });
        }, SUMMARY_THROTTLE_MS);

        return () => clearInterval(intervalId);
    }, [windowMs]);

    const getFootprintForCandle = useCallback(
        (tSec: number) => {
            const footprint = footprintsRef.current.get(tSec);
            if (!footprint) return null;
            const levels = Array.from(footprint.levels.entries())
                .map(([price, level]) => ({ price, bid: level.bid, ask: level.ask, total: level.bid + level.ask }))
                .sort((a, b) => a.price - b.price);
            return {
                buyTotal: footprint.buyTotal,
                sellTotal: footprint.sellTotal,
                levels,
            };
        },
        [],
    );

    return useMemo(
        () => ({
            priceStep,
            latestSummary,
            getFootprintForCandle,
        }),
        [getFootprintForCandle, latestSummary, priceStep],
    );
}
