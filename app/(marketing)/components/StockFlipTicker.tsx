"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, WheelEvent } from "react";
import { ArrowDown, ArrowUp, Circle } from "lucide-react";

const SYMBOLS = ["NVDA", "AAPL", "AMZN", "PLTR", "GOOGL", "META"] as const;

const COMPANY_NAMES: Record<(typeof SYMBOLS)[number], string> = {
    NVDA: "NVIDIA",
    AAPL: "Apple",
    AMZN: "Amazon",
    PLTR: "Palantir",
    GOOGL: "Alphabet",
    META: "Meta",
};

type Quote = {
    symbol: (typeof SYMBOLS)[number];
    price: number;
    change: number;
    changePercent: number;
};

type QuoteResponse = {
    updatedAt: string;
    source: "finnhub" | "mock";
    quotes: Quote[];
};

const formatPrice = (value: number) => `$${value.toFixed(2)}`;

const formatChange = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}`;
};

const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
};

const StockFlipTicker = () => {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [source, setSource] = useState<QuoteResponse["source"] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [direction, setDirection] = useState<"next" | "prev">("next");
    const [isAnimating, setIsAnimating] = useState(false);
    const scrollLock = useRef(false);

    const fetchQuotes = useCallback(async () => {
        try {
            const response = await fetch(`/api/quotes?symbols=${SYMBOLS.join(",")}`);
            if (!response.ok) {
                throw new Error("Unable to load quotes.");
            }
            const data = (await response.json()) as QuoteResponse;
            setQuotes(data.quotes);
            setUpdatedAt(data.updatedAt);
            setSource(data.source);
            setErrorMessage(null);
        } catch (error) {
            console.error("Quote fetch error", error);
            setErrorMessage("Unable to load quotes.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQuotes();
        const interval = setInterval(fetchQuotes, 15000);
        return () => clearInterval(interval);
    }, [fetchQuotes]);

    useEffect(() => {
        if (!quotes.length) {
            return;
        }
        setActiveIndex((current) => Math.min(current, quotes.length - 1));
    }, [quotes.length]);

    const lockScroll = () => {
        scrollLock.current = true;
        setTimeout(() => {
            scrollLock.current = false;
        }, 400);
    };

    const advance = useCallback(
        (step: number) => {
            if (!quotes.length) {
                return;
            }
            setDirection(step > 0 ? "next" : "prev");
            setIsAnimating(true);
            setActiveIndex((current) => {
                const next = (current + step + quotes.length) % quotes.length;
                return next;
            });
            setTimeout(() => setIsAnimating(false), 400);
        },
        [quotes.length]
    );

    const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
        if (scrollLock.current || !quotes.length) {
            return;
        }
        event.preventDefault();
        lockScroll();
        if (event.deltaY > 0) {
            advance(1);
        } else if (event.deltaY < 0) {
            advance(-1);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (scrollLock.current || !quotes.length) {
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            lockScroll();
            advance(1);
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            lockScroll();
            advance(-1);
        }
    };

    const currentQuote = quotes[activeIndex];
    const nextQuote = quotes.length ? quotes[(activeIndex + 1) % quotes.length] : null;

    const lastUpdated = useMemo(() => {
        if (!updatedAt) {
            return null;
        }
        try {
            return new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } catch {
            return null;
        }
    }, [updatedAt]);

    return (
        <div
            className="flip-stack group relative flex h-full min-h-[360px] flex-col justify-between rounded-3xl p-6 md:p-8"
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            aria-label="Live stock ticker. Scroll to flip between symbols."
        >
            <div className="flex items-center justify-between text-sm text-gray-300">
                <span className="flex items-center gap-2">
                    <Circle className="h-2 w-2 fill-teal-300 text-teal-300" />
                    Live prices
                </span>
                <span className="text-xs text-gray-400">{lastUpdated ? `Updated ${lastUpdated}` : "Updating"}</span>
            </div>

            <div className="relative mt-6 flex-1">
                <div className="flip-scroll-hint" aria-hidden="true" />
                {isLoading && !quotes.length ? (
                    <div className="flex h-full flex-col justify-center gap-4">
                        <div className="h-6 w-24 animate-pulse rounded-full bg-white/10" />
                        <div className="h-10 w-32 animate-pulse rounded-full bg-white/10" />
                        <div className="h-6 w-28 animate-pulse rounded-full bg-white/10" />
                    </div>
                ) : currentQuote ? (
                    <>
                        {nextQuote ? (
                            <div className="flip-card flip-card--next">
                                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Up next</p>
                                <h3 className="mt-2 text-2xl font-semibold text-white">{nextQuote.symbol}</h3>
                                <p className="text-sm text-gray-400">{COMPANY_NAMES[nextQuote.symbol]}</p>
                            </div>
                        ) : null}
                        <div
                            className={`flip-card flip-card--active ${isAnimating ? "flip-card--animate" : ""} ${
                                direction === "next" ? "flip-card--forward" : "flip-card--backward"
                            }`}
                        >
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Now</p>
                            <div className="mt-4 flex items-center justify-between">
                                <div>
                                    <h3 className="text-3xl font-semibold text-white">{currentQuote.symbol}</h3>
                                    <p className="text-sm text-gray-400">{COMPANY_NAMES[currentQuote.symbol]}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-semibold text-white">{formatPrice(currentQuote.price)}</p>
                                    <p
                                        className={`mt-1 text-sm font-medium ${
                                            currentQuote.change >= 0 ? "text-teal-300" : "text-red-400"
                                        }`}
                                    >
                                        {formatChange(currentQuote.change)} ({formatPercent(currentQuote.changePercent)})
                                    </p>
                                </div>
                            </div>
                            <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
                                {direction === "next" ? (
                                    <ArrowDown className="h-4 w-4 text-gray-500" />
                                ) : (
                                    <ArrowUp className="h-4 w-4 text-gray-500" />
                                )}
                                Scroll or use ↑ ↓ to flip
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">Waiting for quotes...</div>
                )}
            </div>

            {errorMessage ? (
                <p className="mt-4 text-xs text-red-300">{errorMessage}</p>
            ) : (
                <p className="mt-4 text-xs text-gray-500">
                    Source: {source === "mock" ? "Mock data" : "Finnhub"} (auto-refresh every 15s)
                </p>
            )}
        </div>
    );
};

export default StockFlipTicker;
