"use client";

import { useEffect, useRef, useState } from "react";

export type TradingViewWidgetProps = {
    symbol: string;
    interval?: string;
    className?: string;
};

type WidgetConfig = {
    autosize: boolean;
    symbol: string;
    interval: string;
    timezone: string;
    theme: "dark" | "light";
    style: string;
    locale: string;
    hide_top_toolbar: boolean;
    hide_legend: boolean;
    allow_symbol_change: boolean;
    save_image: boolean;
    details: boolean;
    calendar: boolean;
    support_host: string;
};

export default function TradingViewWidget({
    symbol,
    interval = "60",
    className,
}: TradingViewWidgetProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const initializedRef = useRef(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        if (initializedRef.current) {
            return;
        }
        initializedRef.current = true;
        setError(null);
        container.innerHTML = "";

        const script = document.createElement("script");
        script.src =
            "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.async = true;
        script.type = "text/javascript";

        const config: WidgetConfig = {
            autosize: true,
            symbol,
            interval,
            timezone: "Etc/UTC",
            theme: "dark",
            style: "1",
            locale: "en",
            hide_top_toolbar: true,
            hide_legend: false,
            allow_symbol_change: false,
            save_image: false,
            details: false,
            calendar: false,
            support_host: "https://www.tradingview.com",
        };

        script.innerHTML = JSON.stringify(config);
        container.appendChild(script);

        let timeoutId: number | undefined;
        let cancelled = false;

        const checkForIframe = () => {
            if (cancelled) return;
            const iframe = container.querySelector("iframe");
            if (iframe) return;
            setError("Unable to load chart.");
        };

        timeoutId = window.setTimeout(checkForIframe, 8000);

        return () => {
            cancelled = true;
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
            container.innerHTML = "";
            initializedRef.current = false;
        };
    }, [interval, symbol]);

    return (
        <div className={className ?? "h-[520px] w-full"}>
            <div
                ref={containerRef}
                className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14]"
            >
                {error ? (
                    <div className="flex h-full w-full items-center justify-center text-sm text-slate-300">
                        {error}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
