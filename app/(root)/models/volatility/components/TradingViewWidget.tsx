"use client";

import { useEffect, useId, useMemo, useRef } from "react";

type TradingViewWidgetProps = {
    symbol: string;
    interval?: string;
};

type TradingViewConfig = {
    autosize: boolean;
    symbol: string;
    interval: string;
    timezone: string;
    theme: "dark" | "light";
    style: string;
    locale: string;
    allow_symbol_change: boolean;
    hide_top_toolbar?: boolean;
    hide_legend?: boolean;
    container_id: string;
    backgroundColor?: string;
};

declare global {
    interface Window {
        TradingView?: {
            widget: (config: TradingViewConfig) => void;
        };
    }
}

const loadTradingViewScript = (() => {
    let promise: Promise<void> | null = null;
    return () => {
        if (promise) return promise;
        promise = new Promise((resolve, reject) => {
            if (typeof window === "undefined") {
                resolve();
                return;
            }
            const existing = document.getElementById("tradingview-widget-script");
            if (existing) {
                resolve();
                return;
            }
            const script = document.createElement("script");
            script.id = "tradingview-widget-script";
            script.src = "https://s3.tradingview.com/tv.js";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load TradingView"));
            document.head.appendChild(script);
        });
        return promise;
    };
})();

export default function TradingViewWidget({ symbol, interval = "D" }: TradingViewWidgetProps) {
    const reactId = useId();
    const containerId = useMemo(() => `tradingview-${reactId.replace(/:/g, "")}`, [reactId]);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadTradingViewScript()
            .then(() => {
                if (cancelled) return;
                if (!containerRef.current) return;
                containerRef.current.innerHTML = "";
                if (!window.TradingView?.widget) return;
                window.TradingView.widget({
                    autosize: true,
                    symbol,
                    interval,
                    timezone: "Etc/UTC",
                    theme: "dark",
                    style: "1",
                    locale: "en",
                    allow_symbol_change: false,
                    hide_top_toolbar: true,
                    hide_legend: true,
                    backgroundColor: "#0b0f14",
                    container_id: containerId,
                });
            })
            .catch(() => {
                if (containerRef.current) {
                    containerRef.current.innerHTML = "Unable to load chart.";
                }
            });
        return () => {
            cancelled = true;
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
        };
    }, [containerId, interval, symbol]);

    return (
        <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14]">
            <div id={containerId} ref={containerRef} className="h-full w-full" />
        </div>
    );
}
