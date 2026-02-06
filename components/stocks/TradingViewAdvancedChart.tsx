"use client";

import { useEffect, useMemo, useRef } from "react";

declare global {
    interface Window {
        TradingView?: any;
    }
}

let tvScriptPromise: Promise<void> | null = null;
let tvScriptElement: HTMLScriptElement | null = null;

const loadTradingViewScript = () => {
    if (tvScriptPromise) return tvScriptPromise;

    tvScriptPromise = new Promise((resolve, reject) => {
        if (typeof window !== "undefined" && window.TradingView) {
            resolve();
            return;
        }

        const existing = document.querySelector<HTMLScriptElement>(
            'script[src="https://s3.tradingview.com/tv.js"]',
        );

        if (existing) {
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () => {
                tvScriptPromise = null;
                reject(new Error("Failed to load TradingView script"));
            });
            return;
        }

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/tv.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            tvScriptPromise = null;
            if (tvScriptElement) {
                tvScriptElement.remove();
                tvScriptElement = null;
            }
            reject(new Error("Failed to load TradingView script"));
        };
        document.head.appendChild(script);
        tvScriptElement = script;
    });

    return tvScriptPromise;
};

const normalizeSymbol = (rawSymbol: string, exchange?: string) => {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!symbol) return "NASDAQ:AAPL";
    if (symbol.includes(":")) return symbol;

    const indexSymbols = new Set(["SPX", "NDX", "DJI", "VIX"]);
    if (indexSymbols.has(symbol)) return symbol;

    const exchangeMap: Record<string, string> = {
        NASDAQ: "NASDAQ",
        NYSE: "NYSE",
        AMEX: "AMEX",
    };
    const normalizedExchange = exchange ? exchangeMap[exchange.toUpperCase()] : undefined;
    return `${normalizedExchange ?? "NASDAQ"}:${symbol}`;
};

const makeContainerId = (symbol: string) =>
    `tv_chart_${symbol.replaceAll(/[^a-zA-Z0-9_-]/g, "_")}`;

const TradingViewAdvancedChart = ({
    symbol,
    exchange,
    className,
}: {
    symbol: string;
    exchange?: string;
    className?: string;
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const tvSymbol = useMemo(() => normalizeSymbol(symbol, exchange), [symbol, exchange]);
    const containerId = useMemo(() => makeContainerId(tvSymbol), [tvSymbol]);

    useEffect(() => {
        let cancelled = false;

        const mount = async () => {
            await loadTradingViewScript();
            if (cancelled) return;

            const container = containerRef.current;
            if (!container) return;

            container.innerHTML = "";

            const inner = document.createElement("div");
            inner.id = containerId;
            inner.style.width = "100%";
            inner.style.height = "100%";
            container.appendChild(inner);

            if (!window.TradingView?.widget) return;

            new window.TradingView.widget({
                symbol: tvSymbol,
                interval: "D",
                timezone: "Etc/UTC",
                theme: "dark",
                style: "1",
                locale: "en",
                autosize: true,
                withdateranges: true,
                allow_symbol_change: false,
                enable_publishing: false,
                hide_top_toolbar: false,
                hide_side_toolbar: false,
                container_id: containerId,
            });
        };

        mount().catch(() => {
            // Avoid throwing during SSR or if TradingView fails to load
        });

        return () => {
            cancelled = true;
            if (containerRef.current) containerRef.current.innerHTML = "";
        };
    }, [tvSymbol, containerId]);

    return (
        <div className={className}>
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
};

export default TradingViewAdvancedChart;
